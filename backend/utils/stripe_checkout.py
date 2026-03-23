"""
Stripe Checkout Session helpers — normalize shipping for order records.

Webhook event payloads can omit parts of shipping_details.address; retrieving
the Session by id returns the full object Stripe shows after payment.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def session_obj_to_dict(session: Any) -> Dict[str, Any]:
    """StripeObject or dict -> plain dict."""
    if session is None:
        return {}
    if isinstance(session, dict):
        return dict(session)
    if hasattr(session, "to_dict"):
        try:
            return dict(session.to_dict())
        except Exception:
            pass
    try:
        return dict(session)
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
        full = stripe_module.checkout.Session.retrieve(sid)
        out = session_obj_to_dict(full)
        logger.info("Fetched full Checkout Session %s for shipping merge", sid)
        return out
    except Exception as e:
        logger.warning("checkout.Session.retrieve(%s) failed: %s", sid, e)
        return d


def build_shipping_address_payload(session_dict: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Build orders.shipping_address JSON from a Checkout Session dict.
    Returns None if nothing useful was collected.
    """
    s = session_dict or {}
    sd = s.get("shipping_details")
    if isinstance(sd, str):
        try:
            sd = json.loads(sd)
        except Exception:
            sd = None
    if not isinstance(sd, dict):
        sd = {}

    addr = sd.get("address") or {}
    if isinstance(addr, str):
        try:
            addr = json.loads(addr)
        except Exception:
            addr = {}
    if not isinstance(addr, dict):
        addr = {}

    ship_name = (sd.get("name") or "").strip()
    cd = s.get("customer_details") or {}
    if isinstance(cd, str):
        try:
            cd = json.loads(cd)
        except Exception:
            cd = {}
    if not isinstance(cd, dict):
        cd = {}
    if not ship_name:
        ship_name = (cd.get("name") or "").strip()

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
