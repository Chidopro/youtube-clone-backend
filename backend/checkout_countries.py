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
    "AE",
    "AR",
    "AT",
    "AU",
    "BE",
    "BG",
    "BR",
    "CA",
    "CH",
    "CL",
    "CO",
    "CR",
    "CY",
    "CZ",
    "DE",
    "DK",
    "DO",
    "EE",
    "ES",
    "FI",
    "FR",
    "GB",
    "GR",
    "GT",
    "HK",
    "HR",
    "HU",
    "IE",
    "IL",
    "IN",
    "IS",
    "IT",
    "JP",
    "KR",
    "LT",
    "LU",
    "LV",
    "MC",
    "MT",
    "MX",
    "MY",
    "NL",
    "NO",
    "NZ",
    "PA",
    "PE",
    "PH",
    "PL",
    "PT",
    "RO",
    "SA",
    "SE",
    "SG",
    "SI",
    "SK",
    "TH",
    "TR",
    "TW",
    "US",
    "UY",
    "VN",
    "ZA",
)
