"""Printful order cost estimates — destination tax/VAT/GST on the merchant invoice."""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

# Printful rejects its own logo URL as a print file. Use a fetchable ScreenMerch asset.
ESTIMATE_PLACEHOLDER_FILE_URL = os.getenv(
    "PRINTFUL_ESTIMATE_FILE_URL",
    "https://screenmerch.fly.dev/static/icons/screenmerch_logo.png",
)

_DEFAULT_CITY_BY_COUNTRY = {
    "GB": "London",
    "UK": "London",
    "IE": "Dublin",
    "DE": "Berlin",
    "AU": "Sydney",
    "US": "New York",
    "CA": "Toronto",
}

_DEFAULT_CITY_BY_CA_PROVINCE = {
    "ON": "Toronto",
    "BC": "Vancouver",
    "QC": "Montreal",
    "AB": "Calgary",
    "MB": "Winnipeg",
    "SK": "Saskatoon",
    "NS": "Halifax",
    "NB": "Moncton",
    "NL": "St. John's",
    "PE": "Charlottetown",
    "NT": "Yellowknife",
    "NU": "Iqaluit",
    "YT": "Whitehorse",
}

_DEFAULT_CITY_BY_AU_STATE = {
    "NSW": "Sydney",
    "VIC": "Melbourne",
    "QLD": "Brisbane",
    "SA": "Adelaide",
    "WA": "Perth",
    "TAS": "Hobart",
    "ACT": "Canberra",
    "NT": "Darwin",
}


def _money(raw: Any) -> float:
    try:
        val = float(raw or 0)
    except (TypeError, ValueError):
        return 0.0
    if val < 0:
        return 0.0
    return round(val, 2)


def tax_from_printful_costs(costs: Any) -> float:
    """Sum Printful ``tax`` + ``vat`` (UK VAT often lands in ``tax``)."""
    if not isinstance(costs, dict):
        return 0.0
    return round(_money(costs.get("tax")) + _money(costs.get("vat")), 2)


def fulfillment_tax_applies(country: str) -> bool:
    """Printful VAT/GST/HST we recover at checkout (not US sales tax / resale-cert invoices)."""
    return str(country or "").strip().upper() in ("GB", "UK", "IE", "DE", "AU", "CA")


def fulfillment_tax_label(country: str) -> str:
    c = str(country or "").strip().upper()
    if c in ("GB", "UK", "IE", "DE"):
        return "Fulfillment VAT"
    if c == "AU":
        return "Fulfillment GST"
    if c == "CA":
        return "Fulfillment GST/HST"
    return "Fulfillment tax"


def recipient_for_printful_estimate(recipient: Dict[str, Any]) -> Dict[str, Any]:
    """estimate-costs requires city + address1; checkout often only has country + ZIP."""
    r = dict(recipient or {})
    if not str(r.get("address1") or "").strip():
        r["address1"] = "Address"
    if not str(r.get("city") or "").strip():
        cc = str(r.get("country_code") or "").strip().upper()
        state = str(r.get("state_code") or "").strip().upper()
        if cc == "CA" and state in _DEFAULT_CITY_BY_CA_PROVINCE:
            r["city"] = _DEFAULT_CITY_BY_CA_PROVINCE[state]
        elif cc == "AU" and state in _DEFAULT_CITY_BY_AU_STATE:
            r["city"] = _DEFAULT_CITY_BY_AU_STATE[state]
        else:
            r["city"] = _DEFAULT_CITY_BY_COUNTRY.get(cc, "City")
    return r


def estimate_printful_order_costs(
    api_key: str,
    recipient: Dict[str, Any],
    items: List[Dict[str, Any]],
    timeout: int = 20,
) -> Optional[Dict[str, Any]]:
    """
    POST /orders/estimate-costs (v1, synchronous).

    Returns the ``costs`` object Printful would invoice (subtotal, shipping, tax, vat, total).
    """
    if not api_key or not items or not isinstance(recipient, dict):
        return None
    from printful_catalog import printful_request_headers

    payload_recipient = recipient_for_printful_estimate(recipient)

    try:
        r = requests.post(
            "https://api.printful.com/orders/estimate-costs",
            headers=printful_request_headers(api_key, json_body=True),
            json={"recipient": payload_recipient, "items": items},
            timeout=timeout,
        )
    except Exception as e:
        logger.warning("Printful estimate-costs request failed: %s", e)
        return None
    if r.status_code != 200:
        logger.warning(
            "Printful estimate-costs HTTP %s body=%s",
            r.status_code,
            (r.text or "")[:400],
        )
        return None
    try:
        body = r.json()
    except Exception:
        return None
    result = body.get("result") if isinstance(body, dict) else None
    costs = result.get("costs") if isinstance(result, dict) else None
    if not isinstance(costs, dict):
        return None
    return costs


def quote_fulfillment_tax_usd(
    api_key: str,
    recipient: Dict[str, Any],
    items: List[Dict[str, Any]],
) -> Optional[float]:
    """Return Printful destination tax in USD, or None if the estimate request failed."""
    costs = estimate_printful_order_costs(api_key, recipient, items)
    if not costs:
        return None
    tax = tax_from_printful_costs(costs)
    if tax > 0:
        logger.info(
            "Printful fulfillment tax $%s country=%s subtotal=%s shipping=%s",
            tax,
            (recipient or {}).get("country_code"),
            costs.get("subtotal"),
            costs.get("shipping"),
        )
    return tax


def parse_client_fulfillment_tax(raw: Any) -> float:
    try:
        val = float(raw or 0)
    except (TypeError, ValueError):
        return 0.0
    if val < 0:
        return 0.0
    return round(val, 2)


def resolve_checkout_fulfillment_tax(
    api_key: str,
    recipient: Dict[str, Any],
    items: List[Dict[str, Any]],
    client_tax: Any = 0,
) -> float:
    """Prefer a live Printful estimate (including $0). Fall back to the client quote if the API fails."""
    if api_key and recipient and items:
        quoted = quote_fulfillment_tax_usd(api_key, recipient, items)
        if quoted is not None:
            return quoted
    return parse_client_fulfillment_tax(client_tax)
