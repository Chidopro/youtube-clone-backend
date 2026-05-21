"""
Stripe Tax helpers for Checkout Session creation (automatic_tax + product tax codes).
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

from checkout_countries import CHECKOUT_ALLOWED_COUNTRIES
from utils.stripe_checkout import build_stripe_customer_shipping_for_tax


def stripe_product_tax_code_for_line_item(item: dict) -> str:
    """
    Stripe Tax product tax codes for Checkout price_data.product_data.
    https://docs.stripe.com/tax/tax-codes
    """
    name = (item.get("product") or item.get("name") or "").strip().lower()
    hard = (
        "mug",
        "enamel",
        "travel mug",
        "coaster",
        "tote",
        "drawstring",
        "laptop sleeve",
        "sticker",
        "magnet",
        "puzzle",
        "notebook",
        "greeting card",
        "apron",
        "bowl",
        "bandana",
        "leash",
        "collar",
        "pet bowl",
        "trucker",
        "dad hat",
        "baseball cap",
        "closed back cap",
        "jigsaw",
        "kiss-cut",
        "hardcover",
        "greeting",
        "phone case",
    )
    if any(k in name for k in hard):
        return os.getenv("STRIPE_TAX_CODE_HARD_GOODS", "txcd_99999999")
    if any(k in name for k in ("kid", "baby", "toddler", "youth")):
        return os.getenv("STRIPE_TAX_CODE_CHILDRENS_APPAREL", "txcd_30011200")
    return os.getenv("STRIPE_TAX_CODE_APPAREL", "txcd_30011000")


def tax_line_item_price_data(product_data: dict, unit_amount: int) -> dict:
    """Build price_data with exclusive tax (tax added at Checkout when automatic_tax is on)."""
    return {
        "currency": "usd",
        "product_data": product_data,
        "unit_amount": unit_amount,
        "tax_behavior": "exclusive",
    }


def shipping_tax_product_data(name: str = "Shipping") -> dict:
    return {
        "name": name,
        "tax_code": os.getenv("STRIPE_TAX_CODE_SHIPPING", "txcd_92010001"),
    }


def apply_automatic_tax_to_checkout_session(
    session_params: Dict[str, Any],
    shipping_address: Dict[str, Any],
    raw_shipping_address: Any,
    user_email: str,
    stripe_module: Any,
    logger: Any,
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Enable Stripe Tax on a Checkout Session. Returns (session_params, error_message).
    """
    enabled = os.getenv("STRIPE_AUTOMATIC_TAX_ENABLED", "true").lower() in ("1", "true", "yes")
    if not enabled:
        return session_params, None

    ship_for_tax = build_stripe_customer_shipping_for_tax(shipping_address, raw_shipping_address)
    try:
        session_params["billing_address_collection"] = "required"
        session_params["automatic_tax"] = {"enabled": True}
        if ship_for_tax:
            cust_kw: dict = {"shipping": ship_for_tax}
            if user_email:
                cust_kw["email"] = user_email
            cust = stripe_module.Customer.create(**cust_kw)
            session_params["customer"] = cust.id
            session_params["customer_update"] = {
                "shipping": "auto",
                "name": "auto",
                "address": "auto",
            }
            session_params["shipping_address_collection"] = {
                "allowed_countries": list(CHECKOUT_ALLOWED_COUNTRIES),
            }
            logger.info(
                "Stripe Tax: automatic_tax enabled (Customer ship-to prefilled from checkout)"
            )
        else:
            session_params["shipping_address_collection"] = {
                "allowed_countries": list(CHECKOUT_ALLOWED_COUNTRIES),
            }
            logger.info(
                "Stripe Tax: automatic_tax enabled with shipping_address_collection"
            )
    except Exception as tax_err:
        logger.error("Stripe Tax / Customer setup failed: %s", tax_err)
        return session_params, (
            "Tax calculation could not be started. Enable Stripe Tax in the Stripe Dashboard "
            "(Tax → Settings) and set your business address, or set STRIPE_AUTOMATIC_TAX_ENABLED=false "
            f"temporarily. Details: {tax_err}"
        )
    return session_params, None
