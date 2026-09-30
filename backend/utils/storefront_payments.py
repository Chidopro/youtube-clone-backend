"""Per-storefront payment controls shared by order routes."""
import base64
from urllib.parse import urlparse


PAYMENTS_DISABLED_MESSAGE = (
    "Purchases are not available on this storefront yet. Please check back soon."
)
_SETTINGS_BUCKET = "creator-logos"
_ENABLED_MARKER = "stripe-enabled.png"


def _marker_bytes():
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )


def storefront_stripe_enabled(user_id, supabase_client):
    """Read the durable opt-in marker. Missing or unreadable means disabled."""
    if not user_id or not supabase_client:
        return False
    try:
        items = supabase_client.storage.from_(_SETTINGS_BUCKET).list(str(user_id)) or []
        return any(
            isinstance(item, dict) and item.get("name") == _ENABLED_MARKER
            for item in items
        )
    except Exception:
        return False


def write_storefront_stripe_enabled(user_id, enabled, supabase_client):
    """Persist an opt-in marker in the existing creator settings bucket."""
    if not user_id or not supabase_client:
        return False
    path = f"{user_id}/{_ENABLED_MARKER}"
    bucket = supabase_client.storage.from_(_SETTINGS_BUCKET)
    try:
        if enabled:
            if storefront_stripe_enabled(user_id, supabase_client):
                return True
            bucket.upload(
                path=path,
                file=_marker_bytes(),
                file_options={"content-type": "image/png", "upsert": "true"},
            )
        else:
            bucket.remove([path])
        return True
    except Exception:
        if not enabled and not storefront_stripe_enabled(user_id, supabase_client):
            return True
        return False


def storefront_subdomain_from_origin(origin):
    """Return a ScreenMerch storefront subdomain, or None for the main site."""
    try:
        hostname = (urlparse((origin or "").strip()).hostname or "").lower()
    except Exception:
        return None
    suffix = ".screenmerch.com"
    if not hostname.endswith(suffix):
        return None
    subdomain = hostname[: -len(suffix)]
    if not subdomain or "." in subdomain or subdomain in {"www", "api"}:
        return None
    return subdomain


def storefront_payments_allowed(origin, supabase_client):
    """
    Return (allowed, subdomain).

    Main-domain requests are unaffected. Storefront requests fail closed if the
    creator is missing, the setting is false, or the setting cannot be read.
    """
    subdomain = storefront_subdomain_from_origin(origin)
    if not subdomain:
        return True, None
    if not supabase_client:
        return False, subdomain
    try:
        result = (
            supabase_client.table("users")
            .select("id")
            .eq("subdomain", subdomain)
            .limit(1)
            .execute()
        )
        row = result.data[0] if result.data else None
        return storefront_stripe_enabled(row.get("id"), supabase_client) if row else False, subdomain
    except Exception:
        return False, subdomain
