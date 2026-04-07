"""
Printful Catalog v2: true variant IDs per color × size for storefront products.

Maps ScreenMerch product names to Printful catalog product IDs, then fetches
/v2/catalog-products/{id}/catalog-variants (cached in memory).

Keys in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME MUST match the exact ``name`` field
from ScreenMerch ``PRODUCTS`` in app.py (e.g. "Women's Shirt"), not necessarily
the long Printful catalog title (e.g. "Women's Relaxed T-Shirt | Bella + Canvas 6400").
"""
from __future__ import annotations

import copy
import logging
import os
import re
import threading
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

_maps_lock = threading.Lock()
_nested_maps: Dict[int, Dict[str, Dict[str, int]]] = {}

# Storefront product name -> Printful catalog product id (verified against Printful API).
# Omit entries we have not matched to a catalog product; those keep using legacy heuristics.
PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME: Dict[str, int] = {
    # Printful: Unisex Staple T-Shirt | Bella + Canvas 3001 — ScreenMerch: "Unisex T-Shirt".
    "Unisex T-Shirt": 71,
    # Printful: Men's Fitted T-Shirt | Next Level 3600 — ScreenMerch: "Mens Fitted T-Shirt".
    "Mens Fitted T-Shirt": 108,
    # Printful: Men's Fitted Long Sleeve Shirt | Next Level 3601 — ScreenMerch: "Men's Fitted Long Sleeve".
    "Men's Fitted Long Sleeve": 116,
    # Printful: Unisex Oversized Garment-Dyed T-Shirt | Bella + Canvas 4810 — ScreenMerch: "Unisex Oversized T-Shirt".
    "Unisex Oversized T-Shirt": 880,
    # Printful: Unisex Long Sleeve Shirt | Gildan 2400 — ScreenMerch: "Men's Long Sleeve Shirt".
    "Men's Long Sleeve Shirt": 57,
    # Printful: Men's Staple Tank Top | Bella + Canvas 3480 — ScreenMerch: "Men's Tank Top".
    "Men's Tank Top": 248,
    # Printful: Youth Staple Tee | Bella + Canvas 3001Y — ScreenMerch: "Kids Shirt".
    "Kids Shirt": 307,
    # Printful: Youth Long Sleeve Tee | Bella + Canvas 3501Y — ScreenMerch: "Kids Long Sleeve".
    "Kids Long Sleeve": 511,
    # Printful: Youth Heavy Blend Hoodie | Gildan 18500B — ScreenMerch: "Youth Heavy Blend Hoodie".
    "Youth Heavy Blend Hoodie": 689,
    # Printful: Youth Crew Neck Sweatshirt | Gildan 18000B — ScreenMerch: "Kids Sweatshirt".
    "Kids Sweatshirt": 677,
    # Printful: Unisex Pullover Hoodie | Bella + Canvas 3719 — ScreenMerch: "Unisex Pullover Hoodie".
    "Unisex Pullover Hoodie": 294,
    # Printful: Unisex Premium Pullover Hoodie | Cotton Heritage M2580 — ScreenMerch: "Unisex Hoodie".
    "Unisex Hoodie": 380,
    "Cropped Hoodie": 317,
    # Printful: Unisex Garment-Dyed Heavyweight T-Shirt | Comfort Colors 1717 — ScreenMerch: "Unisex Heavyweight T-Shirt".
    "Unisex Heavyweight T-Shirt": 586,
    # Printful: Women's Relaxed T-Shirt | Bella + Canvas 6400 — ScreenMerch name is "Women's Shirt".
    "Women's Shirt": 360,
    # Stanley/Stella SATU001; Printful title says "Unisex" — matches storefront organic ribbed tee colors.
    "Women's Ribbed Neck": 818,
    # Printful: Women's Ideal Racerback Tank Top | Next Level 1533 — ScreenMerch: "Fitted Racerback Tank".
    "Fitted Racerback Tank": 857,
    # Printful: Women's Micro-Rib Tank Top | Bella Canvas 1012 — ScreenMerch: "Micro-Rib Tank Top".
    "Micro-Rib Tank Top": 780,
    # Printful: Women's Crop Top | AS Colour 4062 — ScreenMerch: "Women's Crop Top".
    "Women's Crop Top": 636,
    # Printful: Unisex Champion Powerblend Hoodie | S700 — ScreenMerch: "Unisex Champion Hoodie".
    "Unisex Champion Hoodie": 842,
    # Printful: Baby Staple Tee | Bella + Canvas 3001B — ScreenMerch: "Baby Staple Tee".
    "Baby Staple Tee": 305,
    # Printful: Baby Jersey T-Shirt | Rabbit Skins 3322 — ScreenMerch: "Baby Jersey T-Shirt".
    "Baby Jersey T-Shirt": 854,
    # Printful: Baby Short Sleeve Bodysuit | Rabbit Skins 4400 — ScreenMerch: "Baby Body Suit".
    "Baby Body Suit": 234,
    # Printful: Toddler Jersey T-Shirt | Rabbit Skins 3321 — ScreenMerch: "Toddler Jersey T-Shirt".
    "Toddler Jersey T-Shirt": 489,
    # Printful: White Glossy Mug — ScreenMerch: "White Glossy Mug".
    "White Glossy Mug": 19,
    # Printful: Travel Mug with a Handle — ScreenMerch: "Travel Mug".
    "Travel Mug": 663,
    # Printful: Enamel Mug — ScreenMerch: "Enamel Mug".
    "Enamel Mug": 407,
    # Printful: White Ceramic Mug with Color Inside — ScreenMerch: "Colored Mug".
    "Colored Mug": 403,
    # Printful: Distressed Dad Hat | Otto Cap 104-1018 — ScreenMerch: "Distressed Dad Hat".
    "Distressed Dad Hat": 396,
    # Printful: Closed-Back Structured Cap | Flexfit 6277 — ScreenMerch: "Closed Back Cap".
    "Closed Back Cap": 140,
    # Printful: 5 Panel Trucker Cap | Yupoong 6006 — ScreenMerch: "Five Panel Trucker Hat".
    "Five Panel Trucker Hat": 100,
    # Same Printful catalog as trucker hat — ScreenMerch: "Five Panel Baseball Cap".
    "Five Panel Baseball Cap": 100,
    # Printful: Laptop Sleeve — ScreenMerch: "Laptop Sleeve".
    "Laptop Sleeve": 394,
    # Printful: All-Over Print Drawstring Bag — ScreenMerch: "All-Over Print Drawstring".
    "All-Over Print Drawstring": 262,
    # Printful: All-Over Print Large Tote Bag w/ Pocket — ScreenMerch: "All Over Print Tote Pocket".
    "All Over Print Tote Pocket": 274,
    # Printful: All-Over Print Utility Crossbody Bag — ScreenMerch: "All-Over Print Utility Bag".
    "All-Over Print Utility Bag": 744,
    # Printful: Pet Bowl — ScreenMerch: "Pet Bowl All-Over Print".
    "Pet Bowl All-Over Print": 678,
    # Printful: Pet Bandana Collar — ScreenMerch: "Pet Bandana Collar".
    "Pet Bandana Collar": 902,
    # Printful: Pet Leash — ScreenMerch: "All Over Print Leash".
    "All Over Print Leash": 745,
    # Printful: Pet Collar — ScreenMerch: "All Over Print Collar".
    "All Over Print Collar": 749,
    # Printful: Greeting Card — ScreenMerch: "Greeting Card".
    "Greeting Card": 568,
    # Printful: Hardcover Bound Notebook | JournalBook — ScreenMerch: "Hardcover Bound Notebook".
    "Hardcover Bound Notebook": 682,
    # Printful: Cork-Back Coaster — ScreenMerch: "Coasters".
    "Coasters": 611,
    # Printful: All-Over Print Apron — ScreenMerch: "Apron".
    "Apron": 894,
    # Printful: Kiss-Cut Stickers — ScreenMerch: "Kiss-Cut Stickers".
    "Kiss-Cut Stickers": 358,
    # Printful: All-Over Print Bandana — ScreenMerch: "Bandana".
    "Bandana": 630,
    # Printful: Jigsaw Puzzle with Tin — ScreenMerch: "Jigsaw Puzzle with Tin".
    "Jigsaw Puzzle with Tin": 906,
    # Printful: Die-Cut Magnets — ScreenMerch: "Die-Cut Magnets".
    "Die-Cut Magnets": 656,
}

# When storefront ``color`` labels differ from Printful catalog variant ``color`` strings.
# Key: catalog product id. Inner key: storefront color (matched case-insensitively).
CATALOG_COLOR_ALIASES: Dict[int, Dict[str, str]] = {
    # API uses "White (glossy)"; storefront uses "White".
    906: {"White": "White (glossy)"},
}

JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID = 906

SIZE_TO_PRINTFUL: Dict[str, str] = {
    "XXL": "2XL",
    "XXXL": "3XL",
    "XXXXL": "4XL",
    "XXXXXL": "5XL",
    # Toddler Jersey (storefront uses numeric sizes; Printful uses *T)
    "2": "2T",
    "3": "3T",
    "4": "4T",
    "5/6": "5T",
}


def normalize_printful_size(size: str) -> str:
    if not size:
        return size
    s = str(size).strip()
    return SIZE_TO_PRINTFUL.get(s, s)


def _apply_catalog_color_aliases(catalog_product_id: int, color: str) -> str:
    aliases = CATALOG_COLOR_ALIASES.get(catalog_product_id, {})
    if not color or not aliases:
        return color
    c = str(color).strip()
    if c in aliases:
        return aliases[c]
    cl = c.lower()
    for k, v in aliases.items():
        if str(k).lower() == cl:
            return v
    return c


def _jigsaw_tin_variant_id_for_store_size(store_size: str, by_color: Dict[str, int]) -> Optional[int]:
    """Store uses long labels; Printful uses e.g. 40″×28″ (2000 pcs). Match on (N pcs)."""
    if not store_size or not by_color:
        return None
    m = re.search(r"(\d+)\s*pcs", str(store_size), re.I)
    if not m:
        return None
    needle = f"({m.group(1)} pcs)"
    for sk, vid in by_color.items():
        if needle in str(sk):
            return int(vid)
    return None


def catalog_product_id_for_product_name(name: str) -> Optional[int]:
    if not name:
        return None
    return PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.get(str(name).strip())


def _fetch_catalog_variants_nested(catalog_product_id: int) -> Dict[str, Dict[str, int]]:
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        raise RuntimeError("PRINTFUL_API_KEY not set")

    headers = {"Authorization": f"Bearer {api_key}"}
    out: Dict[str, Dict[str, int]] = {}
    offset = 0
    limit = 100

    while True:
        url = f"https://api.printful.com/v2/catalog-products/{catalog_product_id}/catalog-variants"
        r = requests.get(url, headers=headers, params={"limit": limit, "offset": offset}, timeout=60)
        if r.status_code != 200:
            logger.error(
                "Printful catalog variants failed catalog_product_id=%s status=%s body=%s",
                catalog_product_id,
                r.status_code,
                (r.text or "")[:400],
            )
            break
        body = r.json()
        data = body.get("data") or []
        if not data:
            break
        for v in data:
            if not isinstance(v, dict):
                continue
            vid = v.get("id")
            color = (v.get("color") or "").strip()
            size = (v.get("size") or "").strip()
            if not color or not size or vid is None:
                continue
            out.setdefault(color, {})[size] = int(vid)
        offset += limit
        paging = body.get("paging") or {}
        total = paging.get("total")
        if total is not None and offset >= int(total):
            break
        if len(data) < limit:
            break

    return out


def get_nested_variant_map(catalog_product_id: int) -> Dict[str, Dict[str, int]]:
    with _maps_lock:
        cached = _nested_maps.get(catalog_product_id)
    if cached is not None:
        return cached

    nested = _fetch_catalog_variants_nested(catalog_product_id)
    with _maps_lock:
        _nested_maps[catalog_product_id] = nested
    return nested


def lookup_catalog_variant_id(
    catalog_product_id: int,
    color: str,
    size: str,
) -> Optional[int]:
    try:
        m = get_nested_variant_map(catalog_product_id)
    except Exception as e:
        logger.warning("Variant map load failed for catalog_product_id=%s: %s", catalog_product_id, e)
        return None

    if not color or not size:
        return None

    color = _apply_catalog_color_aliases(catalog_product_id, str(color).strip())
    size = str(size).strip()
    sizes_try: List[str] = []
    for s in (size, normalize_printful_size(size)):
        if s and s not in sizes_try:
            sizes_try.append(s)

    by_color = m.get(color)
    if by_color is None:
        cl = color.lower()
        for k in m:
            if str(k).lower() == cl:
                by_color = m[k]
                break
    if not by_color:
        return None

    for sz in sizes_try:
        if sz in by_color:
            return int(by_color[sz])
    sl = size.lower()
    for sk, vid in by_color.items():
        if str(sk).lower() == sl:
            return int(vid)
    for sz in sizes_try:
        szl = sz.lower()
        for sk, vid in by_color.items():
            if str(sk).lower() == szl:
                return int(vid)

    if catalog_product_id == JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID:
        jvid = _jigsaw_tin_variant_id_for_store_size(size, by_color)
        if jvid is not None:
            return jvid
    return None


def attach_printful_catalog_data(product: Dict[str, Any]) -> Dict[str, Any]:
    """Deep copy; set printful_catalog_product_id and printful_variant_map when possible."""
    out = copy.deepcopy(product)
    name = out.get("name") or ""
    pid: Optional[int] = out.get("printful_catalog_product_id")
    if pid is None:
        pid = catalog_product_id_for_product_name(str(name))
    if not pid:
        return out
    out["printful_catalog_product_id"] = int(pid)
    if not os.getenv("PRINTFUL_API_KEY"):
        return out
    try:
        out["printful_variant_map"] = get_nested_variant_map(int(pid))
    except Exception as e:
        logger.warning("attach_printful_catalog_data(%s): %s", name, e)
    return out


def attach_printful_catalog_data_list(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enrich a list (e.g. category browse). Fetches each distinct catalog id once (cached)."""
    if not products:
        return []
    unique_ids: List[int] = []
    seen = set()
    for p in products:
        name = (p or {}).get("name") or ""
        pid = (p or {}).get("printful_catalog_product_id")
        if pid is None:
            pid = catalog_product_id_for_product_name(str(name))
        if pid and int(pid) not in seen:
            seen.add(int(pid))
            unique_ids.append(int(pid))
    if os.getenv("PRINTFUL_API_KEY"):
        for cid in unique_ids:
            try:
                get_nested_variant_map(cid)
            except Exception as e:
                logger.warning("Prefetch catalog %s: %s", cid, e)
    return [attach_printful_catalog_data(p) for p in products]
