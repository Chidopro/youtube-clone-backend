"""
ISO 3166-1 alpha-2 codes for Stripe Checkout ``shipping_address_collection``
and alignment with the storefront country list.

Stripe Tax: add a **registration** in Dashboard (Tax → Registrations) for each
jurisdiction where you must collect — that is separate from this list (which
is only “where we let customers ship / pay”).
"""
from __future__ import annotations

from typing import Tuple

# Keep in sync with ``CHECKOUT_COUNTRY_OPTIONS`` in frontend/src/data/shippingRegions.js
CHECKOUT_ALLOWED_COUNTRIES: Tuple[str, ...] = (
    "US",
    "CA",
    "GB",
    "IE",
    "AU",
    "DE",
)


def is_allowed_checkout_country(code: str) -> bool:
    return str(code or "").strip().upper() in CHECKOUT_ALLOWED_COUNTRIES


SHIPPING_COUNTRY_ERROR = (
    "We only ship to the United States, Canada, the United Kingdom, Ireland, Australia, and Germany."
)
