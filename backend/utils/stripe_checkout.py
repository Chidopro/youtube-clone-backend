"""
Stripe Checkout Session helpers — normalize shipping for order records.

Webhook event payloads can omit parts of shipping_details.address; retrieving
the Session by id returns the full object Stripe shows after payment.

Stripe Checkout (especially Link) may put the full address on
`collected_information.shipping_details` while top-level `shipping_details`
only has postal_code + country — we merge both and merge with DB so we never
overwrite a good address with a thin payload.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _to_plain(obj: Any) -> Any:
    """Recursively convert Stripe SDK objects to JSON-safe plain dict/list."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): _to_plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_plain(x) for x in obj]
    if hasattr(obj, "to_dict"):
        try:
            return _to_plain(obj.to_dict())
        except Exception:
            pass
    return obj


def session_obj_to_dict(session: Any) -> Dict[str, Any]:
    """StripeObject or dict -> plain dict (nested-safe)."""
    if session is None:
        return {}
    if isinstance(session, dict):
        return _to_plain(dict(session))
    if hasattr(session, "to_dict"):
        try:
            return _to_plain(session.to_dict())
        except Exception:
            pass
    try:
        return _to_plain(dict(session))
    except Exception:
        return {}


def fetch_full_checkout_session(session: Any, stripe_module: Any) -> Dict[str, Any]:
    """
    Retrieve Checkout Session from Stripe so shipping_details.address is complete.
    Safe no-op if retrieve fails.
    """
    d = session_obj_to_dict(session)
    sid = d.get("id")
    if not sid or not stripe_module:
        return d
    try:
        try:
            full = stripe_module.checkout.Session.retrieve(
                sid,
                expand=["line_items.data.price", "customer"],
            )
        except Exception as expand_err:
            logger.info(
                "checkout.Session.retrieve expand failed for %s, retrying plain: %s",
                sid,
                expand_err,
            )
            full = stripe_module.checkout.Session.retrieve(sid)
        out = session_obj_to_dict(full)
        logger.info("Fetched full Checkout Session %s for shipping merge", sid)
        return out
    except Exception as e:
        logger.warning("checkout.Session.retrieve(%s) failed: %s", sid, e)
        return d


def _parse_maybe_json(val: Any) -> Any:
    if isinstance(val, str) and val.strip():
        try:
            return json.loads(val)
        except Exception:
            return val
    return val


def _normalized_shipping_block(raw: Any) -> Dict[str, Any]:
    raw = _parse_maybe_json(raw)
    if not isinstance(raw, dict):
        return {}
    return raw


def _merge_top_level_shipping_details(
    legacy_sd: Dict[str, Any],
    collected_sd: Dict[str, Any],
    billing_address: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Combine shipping_details, collected_information.shipping_details, and
    customer_details.address when shipping objects are thin (Link).
    """
    leg_a = _normalized_shipping_block(legacy_sd.get("address") if legacy_sd else None)
    col_a = _normalized_shipping_block(collected_sd.get("address") if collected_sd else None)
    bill_a = _normalized_shipping_block(billing_address)

    def pick_field(*keys: str) -> str:
        for addr in (col_a, leg_a, bill_a):
            if not isinstance(addr, dict):
                continue
            for k in keys:
                v = addr.get(k)
                if v is None:
                    continue
                s = str(v).strip() if not isinstance(v, (int, float)) else str(v).strip()
                if s:
                    return s
        return ""

    name = ""
    for block in (collected_sd, legacy_sd):
        if isinstance(block, dict):
            n = (block.get("name") or "").strip()
            if n:
                name = n
                break

    merged_addr = {
        "line1": pick_field("line1", "line_1"),
        "line2": pick_field("line2", "line_2"),
        "city": pick_field("city"),
        "state": pick_field("state"),
        "postal_code": pick_field("postal_code", "postalCode", "zip"),
        "country": pick_field("country"),
    }
    return {"name": name, "address": merged_addr}


def build_stripe_shipping_address_payload(session_dict: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Build a canonical shipping_address dict from Stripe session fields only
    (merges shipping_details + collected_information.shipping_details).
    """
    s = session_dict or {}
    legacy_sd = _normalized_shipping_block(s.get("shipping_details"))
    ci = _normalized_shipping_block(s.get("collected_information"))
    collected_sd = _normalized_shipping_block(ci.get("shipping_details")) if ci else {}
    cd = _normalized_shipping_block(s.get("customer_details"))
    cd_billing_addr = cd.get("address") if isinstance(cd.get("address"), dict) else {}

    merged_sd = _merge_top_level_shipping_details(legacy_sd, collected_sd, cd_billing_addr)

    addr = merged_sd.get("address") or {}
    if not isinstance(addr, dict):
        addr = {}

    ship_name = (merged_sd.get("name") or "").strip()
    if not ship_name:
        ship_name = (cd.get("name") or "").strip()
    if not ship_name and isinstance(ci, dict):
        ship_name = (ci.get("individual_name") or ci.get("business_name") or "").strip()

    line1 = (addr.get("line1") or addr.get("line_1") or "").strip()
    line2 = (addr.get("line2") or addr.get("line_2") or "").strip()
    city = (addr.get("city") or "").strip()
    state = (addr.get("state") or "").strip()
    postal = (
        addr.get("postal_code")
        or addr.get("postalCode")
        or addr.get("zip")
        or ""
    )
    if isinstance(postal, (int, float)):
        postal = str(postal)
    postal = (postal or "").strip()
    country = (addr.get("country") or "").strip()
    if isinstance(country, str) and len(country) == 2:
        country_code = country.upper()
    elif country:
        country_code = country[:2].upper()
    else:
        country_code = ""

    if not any([ship_name, line1, line2, city, state, postal, country]):
        return None

    return {
        "name": ship_name,
        "line1": line1,
        "line2": line2,
        "city": city,
        "state": state,
        "zip": postal,
        "postal_code": postal,
        "country": country,
        "country_code": country_code,
    }


def merge_shipping_address_records(
    existing: Optional[Dict[str, Any]],
    stripe_payload: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    For each field, use Stripe when non-empty; otherwise keep the value from
    the order row (e.g. address collected on ScreenMerch before redirect).
    """
    ex = _parse_maybe_json(existing)
    if not isinstance(ex, dict):
        ex = {}
    sp = stripe_payload if isinstance(stripe_payload, dict) else {}

    def pick(*keys: str) -> str:
        for k in keys:
            v = sp.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        for k in keys:
            v = ex.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return ""

    postal = pick("zip", "postal_code") or pick("postal_code", "zip")
    country_raw = pick("country", "country_code") or pick("country_code", "country")
    country_code = ""
    if country_raw:
        country_code = country_raw.upper() if len(country_raw) == 2 else country_raw[:2].upper()

    out = {
        "name": pick("name"),
        "line1": pick("line1", "address1", "address_line1"),
        "line2": pick("line2", "address2", "address_line2"),
        "city": pick("city"),
        "state": pick("state", "state_code"),
        "zip": postal,
        "postal_code": postal,
        "country": country_raw or country_code,
        "country_code": country_code,
    }

    if not any(
        [
            out["name"],
            out["line1"],
            out["line2"],
            out["city"],
            out["state"],
            postal,
            country_code,
        ]
    ):
        return None
    return out


# Backwards-compatible name used by webhooks
def build_shipping_address_payload(session_dict: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return build_stripe_shipping_address_payload(session_dict)


def session_shipping_cost_usd(session_dict: Optional[Dict[str, Any]]) -> Optional[float]:
    """
    Shipping amount in USD from a Checkout Session.
    Uses total_details.amount_shipping when set; otherwise sums line items whose
    description looks like shipping (Stripe line-item shipping).
    """
    s = _to_plain(session_dict or {})
    td = s.get("total_details")
    if isinstance(td, dict):
        cents = td.get("amount_shipping")
        if cents is not None:
            try:
                v = float(cents) / 100.0
                if v > 0:
                    return round(v, 2)
            except (TypeError, ValueError):
                pass

    li = s.get("line_items")
    data: list = []
    if isinstance(li, dict):
        data = list(li.get("data") or [])
    elif isinstance(li, list):
        data = li
    total_cents = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        desc = (item.get("description") or "").strip().lower()
        if "shipping" not in desc:
            continue
        for k in ("amount_total", "amount_subtotal"):
            raw = item.get(k)
            if raw is not None:
                try:
                    total_cents += int(raw)
                except (TypeError, ValueError):
                    pass
                break
    if total_cents > 0:
        return round(total_cents / 100.0, 2)
    return None


def session_customer_email(session_dict: Optional[Dict[str, Any]]) -> str:
    """Best-effort email from a Checkout Session dict (hosted checkout + Link)."""
    s = session_dict or {}
    cd = _normalized_shipping_block(s.get("customer_details"))
    email = (cd.get("email") or "").strip()
    if email:
        return email
    top = (s.get("customer_email") or "").strip()
    if top:
        return top
    # Some API shapes nest customer
    cust = _parse_maybe_json(s.get("customer"))
    if isinstance(cust, dict):
        em = (cust.get("email") or "").strip()
        if em:
            return em
    ci = _normalized_shipping_block(s.get("collected_information"))
    if isinstance(ci, dict):
        em = (ci.get("email") or "").strip()
        if em:
            return em
    return ""
