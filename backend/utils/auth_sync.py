"""Keep auth.users in sync with public.users for email/password umbrella accounts."""
import logging
import secrets

logger = logging.getLogger(__name__)


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


def ensure_auth_user_for_public_user(supabase_admin, user_id, email, password=None):
    """
    Ensure auth.users has a row with the same UUID as public.users.
    creator_favorites.user_id FK references auth.users on this Supabase project.
    """
    if not supabase_admin or not user_id or not email:
        return False, "missing inputs"
    uid = str(user_id).strip()
    em = str(email).strip().lower()
    if _auth_user_exists(supabase_admin, uid):
        return True, None
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
        return True, None
    except Exception as e:
        err = str(e).lower()
        if "already been registered" in err or "already exists" in err or "duplicate" in err:
            if _auth_user_exists(supabase_admin, uid):
                return True, None
            logger.error("auth email %s registered but id %s missing in auth.users", em, uid)
            return False, "auth_id_mismatch"
        logger.exception("ensure_auth_user_for_public_user failed for %s: %s", em, e)
        return False, str(e)
