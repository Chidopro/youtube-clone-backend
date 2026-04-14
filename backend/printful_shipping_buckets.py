"""
US flat-rate table estimates aligned with Printful's public Standard shipping math.

Used as a floor against live ``/shipping/rates`` so heavy or mixed carts cannot
collapse to shirt-tier quotes when the API bundles aggressively.

Enable with env SHIPPING_TABLE_FLOOR_ENABLED=1 (or true/yes).

Non-US destinations return 0 (no table floor; API only).
"""
from __future__ import annotations

import os
from datetime import date
from typing import Dict, List, Optional, Tuple

# (single_product_usd, additional_product_usd) — US, Printful marketing table snapshots.
_BUCKET_US: Dict[str, Tuple[float, float]] = {
    "shirts_light": (4.75, 2.20),
    "hoodies_heavy": (8.49, 2.50),
    "mugs_drinkware": (8.49, 2.50),
    "hats_embroidery": (4.49, 2.00),
    "bags_small": (4.49, 2.00),
    "tech_laptop": (7.99, 2.50),
    "pet_bulky": (10.49, 7.50),
    "pet_small": (5.69, 0.70),
    "stationery_notebook": (5.50, 3.25),
    "puzzles_games": (7.99, 2.50),
    "cards_stickers_flat": (4.75, 1.25),
    "home_coasters": (5.50, 2.00),
    "apron": (6.99, 2.00),
    "magnets": (4.49, 2.00),
}

# Printful "ships separately" style — each bucket here gets its own S+(n-1)A package,
# then summed with the non-separate bundle (see Help Center).
_SHIPS_SEPARATE: frozenset = frozenset(
    {
        "mugs_drinkware",
        "hats_embroidery",
        "stationery_notebook",
        "cards_stickers_flat",
    }
)

# ScreenMerch product ``name`` / ``product`` (and common aliases) -> internal bucket id.
_PRODUCT_BUCKET: Dict[str, str] = {}

for _name, _b in (
    ("Unisex T-Shirt", "shirts_light"),
    ("Mens Fitted T-Shirt", "shirts_light"),
    ("Men's Fitted Long Sleeve", "shirts_light"),
    ("Unisex Oversized T-Shirt", "shirts_light"),
    ("Men's Long Sleeve Shirt", "shirts_light"),
    ("Men's Tank Top", "shirts_light"),
    ("Kids Shirt", "shirts_light"),
    ("Kids Long Sleeve", "shirts_light"),
    ("Women's Shirt", "shirts_light"),
    ("Women's Ribbed Neck", "shirts_light"),
    ("Fitted Racerback Tank", "shirts_light"),
    ("Micro-Rib Tank Top", "shirts_light"),
    ("Women's Crop Top", "shirts_light"),
    ("Baby Staple Tee", "shirts_light"),
    ("Baby Jersey T-Shirt", "shirts_light"),
    ("Baby Body Suit", "shirts_light"),
    ("Toddler Jersey T-Shirt", "shirts_light"),
    ("Unisex Heavyweight T-Shirt", "shirts_light"),
    ("Bandana", "shirts_light"),
    ("Unisex Hoodie", "hoodies_heavy"),
    ("Cropped Hoodie", "hoodies_heavy"),
    ("Unisex Pullover Hoodie", "hoodies_heavy"),
    ("Unisex Champion Hoodie", "hoodies_heavy"),
    ("Youth Heavy Blend Hoodie", "hoodies_heavy"),
    ("Kids Sweatshirt", "hoodies_heavy"),
    ("White Glossy Mug", "mugs_drinkware"),
    ("Travel Mug", "mugs_drinkware"),
    ("Enamel Mug", "mugs_drinkware"),
    ("Colored Mug", "mugs_drinkware"),
    ("Distressed Dad Hat", "hats_embroidery"),
    ("Closed Back Cap", "hats_embroidery"),
    ("Five Panel Trucker Hat", "hats_embroidery"),
    ("Five Panel Baseball Cap", "hats_embroidery"),
    ("Laptop Sleeve", "tech_laptop"),
    ("All-Over Print Drawstring", "bags_small"),
    ("All Over Print Tote Pocket", "bags_small"),
    ("All-Over Print Utility Bag", "bags_small"),
    ("Pet Bowl All-Over Print", "pet_bulky"),
    ("Pet Bandana Collar", "pet_small"),
    ("All Over Print Leash", "bags_small"),
    ("All Over Print Collar", "bags_small"),
    ("Greeting Card", "cards_stickers_flat"),
    ("Hardcover Bound Notebook", "stationery_notebook"),
    ("Coasters", "home_coasters"),
    ("Kiss-Cut Stickers", "cards_stickers_flat"),
    ("Apron", "apron"),
    ("Jigsaw Puzzle with Tin", "puzzles_games"),
    ("Die-Cut Magnets", "magnets"),
    # Legacy / integration-only names
    ("Unisex Classic Tee", "shirts_light"),
    ("Soft Tee", "shirts_light"),
    ("Women's HD Shirt", "shirts_light"),
    ("Canvas Tote", "bags_small"),
    ("Tote Bag", "bags_small"),
    ("Large Canvas Bag", "bags_small"),
    ("Notebook", "stationery_notebook"),
    ("Sticker Pack", "cards_stickers_flat"),
    ("Dog Bowl", "pet_bulky"),
    ("Magnet Set", "magnets"),
    ("Men's Long Sleeve", "shirts_light"),
):
    _PRODUCT_BUCKET[_name.strip()] = _b


def _truthy_env(name: str) -> bool:
    v = os.getenv(name)
    if v is None or str(v).strip() == "":
        return False
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _us_holiday_40c_enabled() -> bool:
    """Printful US $0.40 surcharge window (Oct 15 – Jan 17), calendar wrap."""
    if not _truthy_env("SHIPPING_TABLE_INCLUDE_US_HOLIDAY_40C"):
        return False
    t = date.today()
    m, d = t.month, t.day
    return (m == 10 and d >= 15) or m in (11, 12) or (m == 1 and d <= 17)


def bucket_for_line(item: dict) -> Optional[str]:
    """Resolve storefront cart line to a shipping bucket, or None if unknown."""
    name = (item.get("product") or item.get("name") or "").strip()
    if not name:
        return None
    if name in _PRODUCT_BUCKET:
        return _PRODUCT_BUCKET[name]
    low = name.lower()
    for k, b in _PRODUCT_BUCKET.items():
        if k.lower() == low:
            return b
    return None


def _aggregate_by_bucket(cart: List[dict]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for item in cart or []:
        b = bucket_for_line(item)
        if not b:
            continue
        q = item.get("quantity") or item.get("qty") or 1
        try:
            q = int(q)
        except (TypeError, ValueError):
            q = 1
        out[b] = out.get(b, 0) + max(1, q)
    return out


def _together_bundle_cost(qty_by_bucket: Dict[str, int]) -> float:
    """Non-separate items: highest Single as base, every other unit pays its bucket Additional."""
    active = {b: q for b, q in qty_by_bucket.items() if q > 0}
    if not active:
        return 0.0
    winner = max(active.keys(), key=lambda b: _BUCKET_US[b][0])
    s_w, a_w = _BUCKET_US[winner]
    total = s_w + (active[winner] - 1) * a_w
    for b, q in active.items():
        if b == winner:
            continue
        _, a_b = _BUCKET_US[b]
        total += q * a_b
    return float(total)


def _separate_lines_cost(qty_by_bucket: Dict[str, int]) -> float:
    """Each separate-shipment bucket is its own S + (n-1)*A package."""
    total = 0.0
    for b, q in qty_by_bucket.items():
        if q <= 0:
            continue
        s_b, a_b = _BUCKET_US[b]
        total += s_b + (q - 1) * a_b
    return float(total)


def printful_table_shipping_floor_usd(cart: List[dict], country_code: str) -> float:
    """
    Lower-bound style estimate from Printful's US Standard table (not a live carrier quote).
    Returns 0 when disabled, unknown country, or empty cart after filtering.
    """
    if not _truthy_env("SHIPPING_TABLE_FLOOR_ENABLED"):
        return 0.0
    cc = (country_code or "US").strip().upper()
    if cc not in ("US", "USA"):
        return 0.0

    counts = _aggregate_by_bucket(cart)
    if not counts:
        return 0.0

    together: Dict[str, int] = {}
    separate: Dict[str, int] = {}
    for b, q in counts.items():
        if b in _SHIPS_SEPARATE:
            separate[b] = q
        else:
            together[b] = q

    est = _together_bundle_cost(together) + _separate_lines_cost(separate)
    if _us_holiday_40c_enabled():
        est += 0.40
    return round(est, 2)


def blend_api_with_table_floor(api_usd: float, cart: List[dict], country_code: str) -> float:
    """max(API, table_estimate) when enabled; otherwise API unchanged."""
    try:
        api_f = float(api_usd)
    except (TypeError, ValueError):
        api_f = 0.0
    if api_f < 0:
        api_f = 0.0
    est = printful_table_shipping_floor_usd(cart, country_code)
    if est <= 0:
        return round(api_f, 2)
    blended = max(api_f, est)
    return round(blended, 2)
