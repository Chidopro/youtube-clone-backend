"""Helper utility functions for the ScreenMerch application"""
import json
import logging
from flask import request

logger = logging.getLogger(__name__)


def format_timestamp(timestamp):
    """Convert timestamp to MM:SS format"""
    try:
        # Debug logging
        logger.info(f"🔍 Formatting timestamp: {timestamp} (type: {type(timestamp)})")
        
        if isinstance(timestamp, str):
            # Handle ISO timestamp format
            if 'T' in timestamp:
                from datetime import datetime
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                total_seconds = dt.timestamp()
            else:
                # Try to convert string to float
                total_seconds = float(timestamp)
        else:
            total_seconds = float(timestamp)
        
        # Handle very large timestamps (might be milliseconds or microseconds)
        if total_seconds > 86400:  # More than 24 hours, likely wrong format
            if total_seconds > 1000000000:  # Looks like milliseconds since epoch
                total_seconds = total_seconds / 1000
            elif total_seconds > 1000000000000:  # Looks like microseconds since epoch
                total_seconds = total_seconds / 1000000
        
        # If still too large, it might be a timestamp in seconds but for a very long video
        # Cap it at 24 hours (86400 seconds) for display purposes
        if total_seconds > 86400:
            total_seconds = total_seconds % 86400  # Get the remainder to show reasonable time
        
        minutes = int(total_seconds // 60)
        seconds = int(total_seconds % 60)
        result = f"{minutes:02d}:{seconds:02d}"
        logger.info(f"✅ Formatted timestamp: {timestamp} -> {result}")
        return result
    except (ValueError, TypeError) as e:
        logger.error(f"❌ Error formatting timestamp {timestamp}: {str(e)}")
        return str(timestamp)


def read_json():
    """Robust JSON reader with detailed diagnostics for proxied requests."""
    ct = (request.headers.get("Content-Type") or "").lower()
    raw = request.get_data(cache=False, as_text=True) or ""
    
    # Short raw log
    logger.info(f"[REQ] {request.path} CT={ct} len={len(raw)} raw[0:200]={raw[:200]!r}")

    data = None
    # 1) Normal case - application/json
    if "application/json" in ct:
        data = request.get_json(silent=True)
    # 2) Some proxies send text/plain or missing CT
    if data is None and raw:
        try:
            data = json.loads(raw)
        except Exception as e:
            logger.warning(f"[PARSE] JSON.loads failed: {str(e)}")
            data = None
    # 3) Fallback: form-encoded (unlikely but safe)
    if data is None and request.form:
        try:
            data = {k: json.loads(v) if v and v.strip().startswith(("{", "[")) else v
                    for k, v in request.form.items()}
        except Exception:
            data = dict(request.form)

    if not isinstance(data, dict):
        data = {}

    # Detailed keys snapshot
    logger.info(f"[PARSED] keys={list(data.keys())} shipping_address={data.get('shipping_address')}")
    return data


def require_shipping_address(payload):
    """Validate and extract shipping address from payload. Accepts full address for display and fulfillment."""
    addr = payload.get("shipping_address") or {}
    zip_code = (
        (addr.get("zip") or addr.get("postal_code") or addr.get("postalCode") or "").strip()
    )
    country = (addr.get("country_code") or addr.get("country") or "US").strip()
    if not zip_code:
        return False, "ZIP / Postal Code is required."
    if not country:
        country = "US"  # Default to US
    # Pass through full address when provided (for ScreenMerch UI and Printful)
    state_val = (addr.get("state_code") or addr.get("state") or "").strip()
    result = {
        "zip": zip_code,
        "country_code": country,
        "name": (addr.get("name") or "").strip(),
        "line1": (addr.get("line1") or addr.get("address1") or addr.get("address_line1") or "").strip(),
        "line2": (addr.get("line2") or addr.get("address2") or addr.get("address_line2") or "").strip(),
        "city": (addr.get("city") or "").strip(),
        "state": state_val,
        "state_code": state_val,
    }
    return True, result


def _parse_zip(shipping_address: dict) -> str:
    """Parse ZIP code from shipping_address dict, handling multiple field names and types."""
    if not shipping_address:
        return ""
    raw = (
        shipping_address.get("zip") or
        shipping_address.get("postal_code") or
        shipping_address.get("postcode") or
        shipping_address.get("postalCode") or
        shipping_address.get("ZIP") or
        ""
    )
    try:
        return str(raw).strip()
    except Exception:
        return ""


def _data_from_request():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form or {}


def _return_url():
    return request.values.get("return_url") or "https://screenmerch.com/"


def _cookie_domain():
    host = (request.host or "").lower()
    if host.endswith("screenmerch.com"):
        return "screenmerch.com"
    if host.endswith("screenmerch.fly.dev"):
        return "screenmerch.fly.dev"
    return None


def get_cookie_domain():
    """
    Cookie Domain for sm_session. When the API is hit via Fly (request.host=*.fly.dev) but the
    browser is on a creator subdomain (Origin / X-Forwarded-Host), we must still use .screenmerch.com
    so the storefront receives the cookie.
    """
    host = (request.host or "").lower()
    forwarded = (request.headers.get("X-Forwarded-Host") or "").split(",")[0].strip().lower()
    origin = (request.headers.get("Origin") or "").strip()
    origin_host = ""
    if origin:
        try:
            from urllib.parse import urlparse

            origin_host = (urlparse(origin).hostname or "").lower()
        except Exception:
            origin_host = ""

    # Prefer Origin host first so creator subdomains win over proxy Host (fly.dev) or stale X-Forwarded-Host.
    for candidate in (origin_host, forwarded, host):
        if not candidate:
            continue
        if candidate.endswith(".screenmerch.com") or candidate in ("screenmerch.com", "www.screenmerch.com"):
            return ".screenmerch.com"

    if "localhost" in host:
        return None
    return ".screenmerch.fly.dev"


def _allow_origin(resp):
    """Add CORS headers to response based on request origin"""
    # Check if CORS headers already exist (from Flask-CORS or other middleware)
    existing_origin = resp.headers.get('Access-Control-Allow-Origin')
    if existing_origin:
        # Headers already set, don't duplicate
        return resp
    
    origin = request.headers.get('Origin')
    allowed = {
        "https://screenmerch.com",
        "https://www.screenmerch.com",
        "https://screenmerch.fly.dev",
        "http://localhost:5173",
        "http://localhost:3000",
    }
    
    # Check exact match first
    origin_allowed = origin in allowed
    
    # If not exact match, check if it's a Netlify subdomain or screenmerch.com subdomain
    if not origin_allowed and origin:
        if origin.endswith('.netlify.app') and origin.startswith('https://'):
            origin_allowed = True
        # Allow subdomains of screenmerch.com (e.g., testcreator.screenmerch.com)
        elif origin.endswith('.screenmerch.com') and origin.startswith('https://'):
            origin_allowed = True
    
    # Use assignment (not .add()) to prevent duplicates
    if origin_allowed:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Vary'] = 'Origin'
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
    else:
        # Fallback to default
        resp.headers['Access-Control-Allow-Origin'] = 'https://screenmerch.com'
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
    
    # CRITICAL: Add methods and headers for CORS preflight (required for PUT requests)
    resp.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Cache-Control,Pragma,Expires'
    
    return resp


def build_platform_revenue_attribution_maps(client, earnings):
    """Resolve favorite_list_id per earning via orders and sales tables."""
    order_ids = list({e.get("order_id") for e in earnings if e.get("order_id")})
    orders_by_oid = {}
    if order_ids:
        try:
            ords = (
                client.table("orders")
                .select("order_id, favorite_list_id")
                .in_("order_id", order_ids)
                .execute()
            )
            for row in ords.data or []:
                if row.get("order_id"):
                    orders_by_oid[row["order_id"]] = row.get("favorite_list_id")
        except Exception as err:
            logger.warning("platform revenue orders attribution lookup failed: %s", err)

    sales_attribution = {}
    user_ids = list({e.get("user_id") for e in earnings if e.get("user_id")})
    if user_ids:
        try:
            sales_res = (
                client.table("sales")
                .select("user_id, product_name, amount, favorite_list_id, created_at")
                .in_("user_id", user_ids)
                .execute()
            )
            for row in sales_res.data or []:
                if not row.get("favorite_list_id"):
                    continue
                key = (
                    str(row.get("user_id")),
                    (row.get("product_name") or "").strip(),
                    round(float(row.get("amount") or 0), 2),
                )
                sales_attribution[key] = row.get("favorite_list_id")
        except Exception as err:
            logger.warning("platform revenue sales attribution lookup failed: %s", err)

    list_ids = set()
    for lid in orders_by_oid.values():
        if lid:
            list_ids.add(str(lid))
    for lid in sales_attribution.values():
        if lid:
            list_ids.add(str(lid))

    lists_map = {}
    users_map = {}
    if list_ids:
        try:
            lr = (
                client.table("creator_favorite_lists")
                .select("id, display_name, slug, owner_user_id, storefront_owner_id")
                .in_("id", list(list_ids))
                .execute()
            )
            for row in lr.data or []:
                lists_map[str(row["id"])] = row
            member_ids = {
                str(row.get("owner_user_id"))
                for row in lists_map.values()
                if row.get("owner_user_id")
            }
            if member_ids:
                ur = (
                    client.table("users")
                    .select("id, display_name, username, email")
                    .in_("id", list(member_ids))
                    .execute()
                )
                for u in ur.data or []:
                    users_map[str(u["id"])] = u
        except Exception as err:
            logger.warning("platform revenue list attribution lookup failed: %s", err)

    return orders_by_oid, sales_attribution, lists_map, users_map


def platform_revenue_attribution_for_earning(
    earning, orders_by_oid, sales_attribution, lists_map, users_map
):
    """Label storefront owner vs umbrella collaborator page for admin transactions."""
    storefront_user = earning.get("users") or {}
    storefront_name = (
        storefront_user.get("display_name")
        or storefront_user.get("username")
        or storefront_user.get("email")
        or "Storefront"
    )
    storefront_uid = str(earning.get("user_id") or "")

    fav_list_id = None
    order_id = earning.get("order_id")
    if order_id:
        fav_list_id = orders_by_oid.get(order_id)
    if not fav_list_id:
        key = (
            storefront_uid,
            (earning.get("product_name") or "").strip(),
            round(float(earning.get("sale_amount") or 0), 2),
        )
        fav_list_id = sales_attribution.get(key)

    meta = lists_map.get(str(fav_list_id)) if fav_list_id else None
    if not meta:
        return {
            "creator_name": storefront_name,
            "creator_display": storefront_name,
            "attributed_page_name": None,
            "attributed_collaborator_name": None,
            "is_umbrella_attribution": False,
        }

    page_name = (meta.get("display_name") or meta.get("slug") or "Favorites page").strip()
    owner_uid = str(meta.get("owner_user_id") or "")
    storefront_owner_uid = str(meta.get("storefront_owner_id") or "")
    is_collab = (
        storefront_owner_uid == storefront_uid
        and owner_uid
        and owner_uid != storefront_uid
    )

    collab_user = users_map.get(owner_uid, {})
    collab_label = (
        collab_user.get("display_name")
        or collab_user.get("username")
        or page_name
    )

    if is_collab:
        return {
            "creator_name": storefront_name,
            "creator_display": f"{storefront_name} · via {collab_label}",
            "attributed_page_name": page_name,
            "attributed_collaborator_name": collab_label,
            "is_umbrella_attribution": True,
        }

    return {
        "creator_name": storefront_name,
        "creator_display": storefront_name,
        "attributed_page_name": page_name if owner_uid == storefront_uid else None,
        "attributed_collaborator_name": None,
        "is_umbrella_attribution": False,
    }


def reset_creator_sales_records(client, user_id, order_store=None, log=None):
    """Clear sales + creator_earnings (+ in-memory orders) for one storefront owner."""
    uid = str(user_id)
    deleted_sales = client.table("sales").delete().eq("user_id", uid).execute()
    deleted_sales_count = len(deleted_sales.data or [])
    deleted_earnings_count = 0
    try:
        earnings_res = client.table("creator_earnings").delete().eq("user_id", uid).execute()
        deleted_earnings_count = len(earnings_res.data or [])
    except Exception as err:
        if log:
            log.warning("Could not delete creator_earnings for %s: %s", uid, err)

    purged_order_store_count = 0
    if order_store is not None:
        for order_id in list(order_store.keys()):
            od = order_store.get(order_id) or {}
            creator_uid = str(od.get("creator_user_id") or od.get("user_id") or "")
            if creator_uid == uid:
                order_store.pop(order_id, None)
                purged_order_store_count += 1

    return {
        "deleted_sales_count": deleted_sales_count,
        "deleted_earnings_count": deleted_earnings_count,
        "purged_order_store_count": purged_order_store_count,
    }


def _delete_all_table_rows(client, table_name, log=None):
    """Delete every row in a Supabase table (PostgREST requires a filter)."""
    attempts = [
        lambda q: q.gte("created_at", "1970-01-01T00:00:00Z"),
        lambda q: q.neq("id", "00000000-0000-0000-0000-000000000000"),
        lambda q: q.neq("id", 0),
    ]
    for build in attempts:
        try:
            result = build(client.table(table_name).delete()).execute()
            return len(result.data or [])
        except Exception as err:
            if log:
                log.warning("delete all rows from %s failed: %s", table_name, err)
    return 0


def reset_all_platform_sales_records(client, order_store=None, log=None):
    """Master admin: wipe all sales analytics + platform revenue test data."""
    deleted_sales_count = _delete_all_table_rows(client, "sales", log)
    deleted_earnings_count = _delete_all_table_rows(client, "creator_earnings", log)

    purged_order_store_count = 0
    if order_store is not None:
        purged_order_store_count = len(order_store)
        order_store.clear()

    return {
        "deleted_sales_count": deleted_sales_count,
        "deleted_earnings_count": deleted_earnings_count,
        "purged_order_store_count": purged_order_store_count,
    }
