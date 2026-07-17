"""Keep auth.users in sync with public.users for email/password umbrella accounts."""
import logging
import secrets

logger = logging.getLogger(__name__)

# Tables/columns that may reference public.users.id (best-effort remap on mismatch)
_USER_ID_FK_TARGETS = (
    ("creator_favorite_lists", "owner_user_id"),
    ("creator_favorite_lists", "storefront_owner_id"),
    ("creator_favorites", "user_id"),
    ("channel_friends", "friend_id"),
    ("channel_friends", "channel_owner_id"),
    ("videos2", "user_id"),
    ("user_subscriptions", "user_id"),
    ("sales", "user_id"),
    ("subscriptions", "subscriber_id"),
    ("subscriptions", "channel_id"),
)


def _auth_user_exists(supabase_admin, uid):
    try:
        res = supabase_admin.auth.admin.get_user_by_id(str(uid).strip())
        user = getattr(res, "user", None) or res
        auth_id = getattr(user, "id", None) if user is not None else None
        if auth_id is None and isinstance(user, dict):
            auth_id = user.get("id")
        return bool(auth_id)
    except Exception:
        return False


def _find_auth_id_by_email(supabase_admin, email):
    """Scan auth admin list for email (paginated). Returns auth user id or None."""
    em = (email or "").strip().lower()
    if not em:
        return None
    try:
        for page_num in range(1, 11):
            page = supabase_admin.auth.admin.list_users(page=page_num, per_page=200)
            users = getattr(page, "users", None) or page
            if not users:
                break
            for au in users:
                au_email = getattr(au, "email", None)
                if au_email is None and isinstance(au, dict):
                    au_email = au.get("email")
                if (au_email or "").strip().lower() != em:
                    continue
                au_id = getattr(au, "id", None)
                if au_id is None and isinstance(au, dict):
                    au_id = au.get("id")
                return str(au_id) if au_id else None
            if len(list(users)) < 200:
                break
    except Exception as e:
        logger.exception("list_users by email failed for %s: %s", em, e)
    return None


def _remap_public_user_id(supabase_admin, old_id, new_id):
    """
    Move public.users row from old_id -> new_id and rewrite common FK refs.
    Used when auth.users already owns the email under new_id.
    """
    old_id = str(old_id).strip()
    new_id = str(new_id).strip()
    if not old_id or not new_id or old_id == new_id:
        return True, old_id

    old_row = (
        supabase_admin.table("users")
        .select("*")
        .eq("id", old_id)
        .limit(1)
        .execute()
    )
    if not old_row.data:
        # Already remapped?
        chk = supabase_admin.table("users").select("id").eq("id", new_id).limit(1).execute()
        if chk.data:
            return True, new_id
        return False, "public_user_missing"

    existing_new = (
        supabase_admin.table("users").select("id").eq("id", new_id).limit(1).execute()
    )
    if not existing_new.data:
        payload = dict(old_row.data[0])
        payload["id"] = new_id
        # Free unique email/username on the old row before insert, or email unique fails.
        park_email = f"__remap_{old_id}@invalid.local"
        park_update = {"email": park_email}
        if payload.get("username"):
            park_update["username"] = f"__remap_{old_id}"
        try:
            supabase_admin.table("users").update(park_update).eq("id", old_id).execute()
        except Exception as e:
            logger.exception("park old user %s before remap failed: %s", old_id, e)
            return False, str(e)
        try:
            supabase_admin.table("users").insert(payload).execute()
        except Exception as e:
            # Best-effort restore so the account is not left with a parked email.
            try:
                restore = {"email": old_row.data[0].get("email")}
                if old_row.data[0].get("username") is not None:
                    restore["username"] = old_row.data[0].get("username")
                supabase_admin.table("users").update(restore).eq("id", old_id).execute()
            except Exception:
                pass
            logger.exception("insert remapped user %s -> %s failed: %s", old_id, new_id, e)
            return False, str(e)

    for table, col in _USER_ID_FK_TARGETS:
        try:
            supabase_admin.table(table).update({col: new_id}).eq(col, old_id).execute()
        except Exception as e:
            logger.warning("remap skip %s.%s: %s", table, col, e)

    try:
        supabase_admin.table("users").delete().eq("id", old_id).execute()
    except Exception as e:
        logger.warning("could not delete old public.users %s after remap: %s", old_id, e)

    logger.info("Remapped public.users %s -> %s for auth email match", old_id, new_id)
    return True, new_id


def ensure_auth_user_for_public_user(supabase_admin, user_id, email, password=None):
    """
    Ensure auth.users has a row usable for creator_favorites.user_id FK.
    Returns (ok, error_or_None, canonical_user_id).
    On email/id mismatch, remaps public.users (+ FKs) onto the existing auth user id.
    """
    if not supabase_admin or not user_id or not email:
        return False, "missing inputs", None
    uid = str(user_id).strip()
    em = str(email).strip().lower()
    if _auth_user_exists(supabase_admin, uid):
        return True, None, uid
    try:
        attrs = {
            "id": uid,
            "email": em,
            "email_confirm": True,
            "user_metadata": {"source": "public.users"},
            "password": password if password else secrets.token_urlsafe(24) + "Aa1!",
        }
        supabase_admin.auth.admin.create_user(attrs)
        logger.info("Created auth.users row for public.users id=%s email=%s", uid, em)
        return True, None, uid
    except Exception as e:
        err = str(e).lower()
        if "already been registered" in err or "already exists" in err or "duplicate" in err:
            if _auth_user_exists(supabase_admin, uid):
                return True, None, uid
            auth_id = _find_auth_id_by_email(supabase_admin, em)
            if not auth_id:
                logger.error("auth email %s registered but could not resolve auth id", em)
                return False, "auth_id_mismatch", None
            if auth_id == uid:
                return True, None, uid
            ok, result = _remap_public_user_id(supabase_admin, uid, auth_id)
            if not ok:
                return False, result or "auth_id_mismatch", None
            return True, None, auth_id
        logger.exception("ensure_auth_user_for_public_user failed for %s: %s", em, e)
        return False, str(e), None
