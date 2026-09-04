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
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

_maps_lock = threading.Lock()
_nested_maps: Dict[int, Dict[str, Dict[str, int]]] = {}

# Storefront product name -> Printful catalog product id (verified against Printful API).
# Omit entries we have not matched to a catalog product; those keep using legacy heuristics.
PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME: Dict[str, int] = {
    # Printful: Unisex Staple T-Shirt | Bella + Canvas 3001 — ScreenMerch: "T-Shirt".
    "T-Shirt": 71,
    "Unisex T-Shirt": 71,  # legacy alias
    # Printful: Men's Fitted T-Shirt | Next Level 3600 — ScreenMerch: "Mens Fitted T-Shirt".
    "Mens Fitted T-Shirt": 108,
    # Printful: Men's Fitted Long Sleeve Shirt | Next Level 3601 — ScreenMerch: "Men's Fitted Long Sleeve".
    "Men's Fitted Long Sleeve": 116,
    # Printful: Unisex Oversized Garment-Dyed T-Shirt | Bella + Canvas 4810 — ScreenMerch: "Oversized T-Shirt".
    "Oversized T-Shirt": 880,
    "Unisex Oversized T-Shirt": 880,  # legacy alias
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
    # Printful: Unisex Pullover Hoodie | Bella + Canvas 3719 — ScreenMerch: "Pullover Hoodie".
    "Pullover Hoodie": 294,
    "Unisex Pullover Hoodie": 294,  # legacy alias
    # Printful: Unisex Premium Pullover Hoodie | Cotton Heritage M2580 — ScreenMerch: "Hoodie".
    "Hoodie": 380,
    "Unisex Hoodie": 380,  # legacy alias
    "Cropped Hoodie": 317,
    # Printful: Unisex Garment-Dyed Heavyweight T-Shirt | Comfort Colors 1717 — ScreenMerch: "Heavyweight T-Shirt".
    "Heavyweight T-Shirt": 586,
    "Unisex Heavyweight T-Shirt": 586,  # legacy alias
    # Printful: Women's Relaxed T-Shirt | Bella + Canvas 6400 — ScreenMerch name is "Women's Shirt".
    "Women's Shirt": 360,
    # Stanley/Stella SATU001; Printful title says "Unisex" — matches storefront organic ribbed tee colors.
    "Women's Ribbed Neck": 818,
    # Printful: Women's Ideal Racerback Tank Top | Next Level 1533 — ScreenMerch: "Racerback Tank".
    "Racerback Tank": 857,
    # Printful: Women's Micro-Rib Tank Top | Bella Canvas 1012 — ScreenMerch: "Micro-Rib Tank Top".
    "Micro-Rib Tank Top": 780,
    # Printful: Women's Crop Top | AS Colour 4062 — ScreenMerch: "Women's Crop Top".
    "Women's Crop Top": 636,
    # Printful: Unisex Champion Powerblend Hoodie | S700 — ScreenMerch: "Champion Hoodie".
    "Champion Hoodie": 842,
    "Unisex Champion Hoodie": 842,  # legacy alias
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
    # Printful: Greeting Card — ScreenMerch: "Greeting Card".
    "Greeting Card": 568,
    # Printful: Hardcover Bound Notebook | JournalBook — ScreenMerch: "Hardcover Bound Notebook".
    "Hardcover Bound Notebook": 682,
    # Printful: Cork-Back Coaster — ScreenMerch: "Coasters".
    "Coasters": 611,
    # Printful: All-Over Print Apron — ScreenMerch: "Apron".
    "Apron": 894,
    # Printful: All-Over Print Bandana — ScreenMerch: "Bandana".
    "Bandana": 630,
    # Printful: Jigsaw Puzzle with Tin — ScreenMerch: "Jigsaw Puzzle with Tin".
    "Jigsaw Puzzle with Tin": 906,
}

# Printful dashboard customizer pages (logged-in catalog product URLs).
# /dashboard/custom/products/{id} redirects to a generic catalog, so these must
# use the pretty path (e.g. Women's Shirt → Bella + Canvas 6400).
PRINTFUL_DASHBOARD_URLS_BY_CATALOG_ID: Dict[int, str] = {
    71: "https://www.printful.com/dashboard/custom/mens/t-shirts/unisex-staple-t-shirt-bella-canvas-3001",
    108: "https://www.printful.com/dashboard/custom/mens/t-shirts/mens-fitted-t-shirt-next-level-3600",
    116: "https://www.printful.com/dashboard/custom/mens/long-sleeve-shirts/mens-fitted-long-sleeve-shirt-next-level-3601",
    880: "https://www.printful.com/dashboard/custom/womens/t-shirts/unisex-oversized-garment-dyed-t-shirt-bella-canvas-4810",
    57: "https://www.printful.com/dashboard/custom/mens/long-sleeve-shirts/mens-long-sleeve-shirt-gildan-2400",
    248: "https://www.printful.com/dashboard/custom/mens/tank-tops/unisex-staple-tank-top-bella-canvas-3480",
    307: "https://www.printful.com/dashboard/custom/kids-teen/shirts/youth-staple-tee-bella-canvas-3001y",
    511: "https://www.printful.com/dashboard/custom/kids-teen/shirts/youth-long-sleeve-tee-bella-canvas-3501y",
    689: "https://www.printful.com/dashboard/custom/kids-teen/hoodies/youth-heavy-blend-hoodie-gildan-18500-b",
    677: "https://www.printful.com/dashboard/custom/kids-teen/hoodies/youth-crew-neck-sweatshirt-gildan-18000b",
    294: "https://www.printful.com/dashboard/custom/mens/hoodies-sweatshirts/unisex-pullover-hoodie-bella-canvas-3719",
    380: "https://www.printful.com/dashboard/custom/mens/hoodies/unisex-premium-hoodie-cotton-heritage-m2580",
    317: "https://www.printful.com/dashboard/custom/womens/hoodies-sweatshirts/womens-cropped-hoodie-bella-canvas-7502",
    586: "https://www.printful.com/dashboard/custom/womens/t-shirts/unisex-garment-dyed-heavyweight-shirt-comfort-colors-1717",
    360: "https://www.printful.com/dashboard/custom/womens/t-shirts/womens-relaxed-t-shirt-bella-canvas-6400",
    818: "https://www.printful.com/dashboard/custom/mens/shirts/unisex-organic-ribbed-neck-t-shirt-stanley-stella-satu001",
    857: "https://www.printful.com/dashboard/custom/womens/tank-tops/womens-ideal-racerback-tank-top-next-level-1533",
    780: "https://www.printful.com/dashboard/custom/womens/tank-tops/womens-micro-rib-tank-top-bella-canvas-1012",
    636: "https://www.printful.com/dashboard/custom/womens/crop-tops/womens-crop-top-as-colour-4062",
    842: "https://www.printful.com/dashboard/custom/mens/hoodies/unisex-champion-hoodie",
    305: "https://www.printful.com/dashboard/custom/kids-teen/shirts/baby-staple-tee-bella-canvas-3001b",
    854: "https://www.printful.com/dashboard/custom/kids-teen/t-shirts/baby-jersey-t-shirt-rabbit-skins-3322",
    234: "https://www.printful.com/dashboard/custom/kids-teen/baby-bodysuits/baby-short-sleeve-bodysuit-rabbit-skins-4400",
    489: "https://www.printful.com/dashboard/custom/kids-teen/shirts/toddler-jersey-t-shirt-rabbit-skins-3321",
    19: "https://www.printful.com/dashboard/custom/mugs/personalized/white-glossy-mug",
    663: "https://www.printful.com/dashboard/custom/mugs/personalized/travel-mug-with-a-handle",
    407: "https://www.printful.com/dashboard/custom/mugs/personalized/enamel-mug",
    403: "https://www.printful.com/dashboard/custom/mugs/personalized/ceramic-mug",
    396: "https://www.printful.com/dashboard/custom/embroidered/hats/distressed-dad-hat-otto-cap-104-1018",
    140: "https://www.printful.com/dashboard/custom/embroidered/dad-hats/closed-back-cap-flexfit-6277",
    100: "https://www.printful.com/dashboard/custom/embroidered/trucker-hats/5-panel-trucker-cap-yupoong-6006",
    394: "https://www.printful.com/dashboard/custom/bags/laptop-cases/laptop-sleeve",
    262: "https://www.printful.com/dashboard/custom/bags/drawstring/all-over-print-drawstring-bag",
    274: "https://www.printful.com/dashboard/custom/bags/totes/all-over-print-large-tote-bag",
    744: "https://www.printful.com/dashboard/custom/bags/handbags/all-over-print-utility-crossbody-bag",
    678: "https://www.printful.com/dashboard/custom/pet-products/personalized/pet-bowl",
    902: "https://www.printful.com/dashboard/custom/pet-products/personalized/pet-bandana-collar",
    568: "https://www.printful.com/dashboard/custom/stationery/greeting-cards/greeting-card",
    682: "https://www.printful.com/dashboard/custom/stationery/notebooks/hardcover-bound-notebook-journalbook",
    611: "https://www.printful.com/dashboard/custom/drinkware/coasters/cork-back-coaster",
    894: "https://www.printful.com/dashboard/custom/aprons/personalized/all-over-print-apron",
    630: "https://www.printful.com/dashboard/custom/hair-accessories/personalized/all-over-print-bandana",
    906: "https://www.printful.com/dashboard/custom/toys-and-games/personalized/jigsaw-puzzle-with-tin",
}

# Printful catalog titles shown on the product page (for admin confirmation).
PRINTFUL_CATALOG_TITLES_BY_ID: Dict[int, str] = {
    71: "Unisex Staple T-Shirt | Bella + Canvas 3001",
    108: "Men's Fitted T-Shirt | Next Level 3600",
    116: "Men's Fitted Long Sleeve Shirt | Next Level 3601",
    880: "Unisex Oversized Garment-Dyed T-Shirt | Bella + Canvas 4810",
    57: "Unisex Long Sleeve Shirt | Gildan 2400",
    248: "Men's Staple Tank Top | Bella + Canvas 3480",
    307: "Youth Staple Tee | Bella + Canvas 3001Y",
    511: "Youth Long Sleeve Tee | Bella + Canvas 3501Y",
    689: "Youth Heavy Blend Hoodie | Gildan 18500B",
    677: "Youth Crew Neck Sweatshirt | Gildan 18000B",
    294: "Unisex Pullover Hoodie | Bella + Canvas 3719",
    380: "Unisex Premium Pullover Hoodie | Cotton Heritage M2580",
    317: "Women's Cropped Hoodie | Bella + Canvas 7502",
    586: "Unisex Garment-Dyed Heavyweight T-Shirt | Comfort Colors 1717",
    360: "Women's Relaxed T-Shirt | Bella + Canvas 6400",
    818: "Unisex Organic Ribbed Neck Creator 2.0 T-Shirt | Stanley/Stella SATU001",
    857: "Women's Ideal Racerback Tank Top | Next Level 1533",
    780: "Women's Micro-Rib Tank Top | Bella Canvas 1012",
    636: "Women's Crop Top | AS Colour 4062",
    842: "Unisex Champion Powerblend Hoodie | S700",
    305: "Baby Staple Tee | Bella + Canvas 3001B",
    854: "Baby Jersey T-Shirt | Rabbit Skins 3322",
    234: "Baby Short Sleeve Bodysuit | Rabbit Skins 4400",
    489: "Toddler Jersey T-Shirt | Rabbit Skins 3321",
    19: "White Glossy Mug",
    663: "Travel Mug with a Handle",
    407: "Enamel Mug",
    403: "White Ceramic Mug with Color Inside",
    396: "Distressed Dad Hat | Otto Cap 104-1018",
    140: "Closed-Back Structured Cap | Flexfit 6277",
    100: "5 Panel Trucker Cap | Yupoong 6006",
    394: "Laptop Sleeve",
    262: "All-Over Print Drawstring Bag",
    274: "All-Over Print Large Tote Bag w/ Pocket",
    678: "Pet Bowl",
    902: "Pet Bandana Collar",
    568: "Greeting Card",
    682: "Hardcover Bound Notebook | JournalBook",
    611: "Cork-Back Coaster",
    894: "All-Over Print Apron",
    630: "All-Over Print Bandana",
    906: "Jigsaw Puzzle with Tin",
    744: "All-Over Print Utility Crossbody Bag",
}

# When storefront ``color`` labels differ from Printful catalog variant ``color`` strings.
# Key: catalog product id. Inner key: storefront color (matched case-insensitively).
CATALOG_COLOR_ALIASES: Dict[int, Dict[str, str]] = {
    # API uses "White (glossy)"; storefront uses "White".
    906: {"White": "White (glossy)"},
    # White Glossy Mug (catalog 19): storefront "White" → Printful color label.
    19: {"White": "White (glossy)"},
}

JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID = 906

# Printful caps / hats fulfilled as embroidery (not DTG). Wrong technique breaks v2/shipping-rates
# and legacy /shipping/rates often returns a misleading "out of stock" for valid variants.
HAT_EMBROIDERY_CATALOG_PRODUCT_IDS = frozenset({100, 140, 396})

# Gildan 18500B Youth Heavy Blend Hoodie — Printful catalog sizes use YXS/YS/YM/YL/YXL.
YOUTH_HEAVY_BLEND_HOODIE_CATALOG_ID = 689
GILDAN_18500B_YOUTH_SIZE: Dict[str, str] = {
    "XS": "YXS",
    "S": "YS",
    "M": "YM",
    "L": "YL",
    "XL": "YXL",
}

# Bella+Canvas pullovers / similar — some catalogs spell S/M/L as Small/Medium/Large.
# (689 youth Gildan uses YS/YM… only; do not add "Small" here.)
HOODIE_CATALOG_IDS_ALT_SIZE_WORDS = frozenset({294, 380, 317})

# Bella youth tees (3001Y, 3501Y): Printful catalog often labels sizes YXS/YS/YM/YL while the storefront uses XS/S/M/L.
YOUTH_BELLA_STYLE_CATALOG_IDS = frozenset({307, 511})


def _youth_bella_letter_size_alternates(sz: str) -> List[str]:
    letter = str(sz or "").strip()
    m = {
        "XS": ("YXS",),
        "S": ("YS",),
        "M": ("YM",),
        "L": ("YL",),
        "XL": ("YXL",),
    }
    return [x for x in m.get(letter, ()) if x]


def _sizes_for_catalog_lookup(catalog_product_id: int, size: str) -> List[str]:
    """Ordered size candidates for variant map keys (youth Gildan, spelled-out sizes)."""
    sz = str(size or "").strip()
    out: List[str] = []
    for cand in (sz, normalize_printful_size(sz)):
        if cand and cand not in out:
            out.append(cand)
    if catalog_product_id == YOUTH_HEAVY_BLEND_HOODIE_CATALOG_ID:
        # Catalog v2 for 18500B often uses XS/S/M/L/XL like adult labels; some feeds use YXS/YS….
        # Try storefront letter sizes first, then Y-prefixed aliases.
        y = GILDAN_18500B_YOUTH_SIZE.get(sz)
        if y and y not in out:
            out.append(y)
    if catalog_product_id in HOODIE_CATALOG_IDS_ALT_SIZE_WORDS:
        spell = {
            "S": "Small",
            "M": "Medium",
            "L": "Large",
            "XL": "XLarge",
        }
        if sz in spell and spell[sz] not in out:
            out.append(spell[sz])
        if sz.upper() == "XL":
            for x in ("X-Large", "2XL"):
                if x not in out:
                    out.append(x)
    if catalog_product_id in YOUTH_BELLA_STYLE_CATALOG_IDS:
        for existing in list(out):
            for alt in _youth_bella_letter_size_alternates(existing):
                if alt not in out:
                    out.append(alt)
    return out


# Catalog products whose variant ``size`` is an ounce label (11 oz / 15oz / etc.). If string
# matching misses, we match on the numeric ounce value so shipping uses the real mug variant
# (not the DEFAULT_PRINTFUL_SHIPPING_VARIANT_ID t-shirt fallback → unrealistically low rates).
MUG_OZ_CATALOG_PRODUCT_IDS = frozenset({19, 403, 407, 663})

# Printful sometimes returns empty ``color`` on catalog variants (e.g. greeting card 568).
NO_COLOR_BUCKET_KEY = "__printful_no_color__"

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


def _normalize_size_loose(size: str) -> str:
    """Compare storefront vs catalog labels (quotes, × vs x, spaces)."""
    if not size:
        return ""
    t = str(size).strip().lower()
    t = re.sub(r"\s+", "", t)
    for u in ("\u2033", "\u201c", "\u201d", '"', "'"):
        t = t.replace(u, "")
    t = t.replace("\u00d7", "x").replace("*", "x")
    return t


def _match_size_in_bucket(requested: str, by_size: Dict[str, int]) -> Optional[int]:
    """Exact key, case-insensitive, then loose normalization match."""
    if not requested or not by_size:
        return None
    req = str(requested).strip()
    sizes_try = [req, normalize_printful_size(req)]
    for sz in sizes_try:
        if sz and sz in by_size:
            return int(by_size[sz])
    rl = req.lower()
    for sk, vid in by_size.items():
        if str(sk).lower() == rl:
            return int(vid)
    nreq = _normalize_size_loose(req)
    if nreq:
        for sk, vid in by_size.items():
            if _normalize_size_loose(str(sk)) == nreq:
                return int(vid)
    return None


def _match_mug_oz_size(requested: str, by_size: Dict[str, int]) -> Optional[int]:
    """Match storefront '15 oz' to catalog '15oz' / '15 Oz' by ounce number."""
    m = re.search(r"(\d+)\s*oz", str(requested), re.I)
    if not m or not by_size:
        return None
    oz = m.group(1)
    for sk, vid in by_size.items():
        sm = re.search(r"(\d+)\s*oz", str(sk), re.I)
        if sm and sm.group(1) == oz:
            return int(vid)
    return None


def _lookup_mug_variant_by_oz_any_color(
    catalog_product_id: int,
    size: str,
    nested: Dict[str, Dict[str, int]],
) -> Optional[int]:
    """If color bucket misses (e.g. catalog label differs), find any variant whose size label matches oz."""
    if catalog_product_id not in MUG_OZ_CATALOG_PRODUCT_IDS or not nested:
        return None
    for _ck, by_size in nested.items():
        if not isinstance(by_size, dict):
            continue
        vid = _match_mug_oz_size(size, by_size)
        if vid is not None:
            return int(vid)
    return None


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


def printful_dashboard_url_for_product_name(name: str) -> Optional[str]:
    """Logged-in Printful catalog page for a ScreenMerch product name."""
    cid = catalog_product_id_for_product_name(name)
    if cid is None:
        return None
    return PRINTFUL_DASHBOARD_URLS_BY_CATALOG_ID.get(int(cid))


def printful_dashboard_urls_by_product_name() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for pname, cid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
        url = PRINTFUL_DASHBOARD_URLS_BY_CATALOG_ID.get(int(cid))
        if url:
            out[pname] = url
    return out


def printful_catalog_titles_by_product_name() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for pname, cid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
        title = PRINTFUL_CATALOG_TITLES_BY_ID.get(int(cid))
        if title:
            out[pname] = title
    return out


# Catalog-variants defaults to selling_region_name=worldwide, which 400s
# ("Selling region not found") for some stores. Variant IDs are global; pull
# the US catalog so storefront color/size rows can be mapped.
CATALOG_VARIANT_REGION_TRIES: Tuple[str, ...] = (
    "north_america",
    "usa",
    "europe",
    "australia",
)


def _ingest_catalog_variant_rows(
    data: List[Any],
    out: Dict[str, Dict[str, int]],
) -> None:
    for v in data:
        if not isinstance(v, dict):
            continue
        vid = v.get("id")
        if vid is None:
            vid = v.get("catalog_variant_id")
        color = (v.get("color") or "").strip()
        size = (v.get("size") or "").strip()
        if not size or vid is None:
            continue
        color_key = color if color else NO_COLOR_BUCKET_KEY
        out.setdefault(color_key, {})[size] = int(vid)


def _fetch_catalog_variants_for_region(
    catalog_product_id: int,
    headers: Dict[str, str],
    selling_region_name: str,
) -> Tuple[Optional[Dict[str, Dict[str, int]]], int]:
    """Return (map, status). map is None when this region should not be used."""
    out: Dict[str, Dict[str, int]] = {}
    offset = 0
    limit = 100
    url = f"https://api.printful.com/v2/catalog-products/{catalog_product_id}/catalog-variants"

    while True:
        r = requests.get(
            url,
            headers=headers,
            params={
                "limit": limit,
                "offset": offset,
                "selling_region_name": selling_region_name,
            },
            timeout=60,
        )
        if r.status_code != 200:
            logger.error(
                "Printful catalog variants failed catalog_product_id=%s region=%s status=%s body=%s",
                catalog_product_id,
                selling_region_name,
                r.status_code,
                (r.text or "")[:400],
            )
            return None, r.status_code
        body = r.json()
        data = body.get("data") or []
        if not data:
            break
        _ingest_catalog_variant_rows(data, out)
        offset += limit
        paging = body.get("paging") or {}
        total = paging.get("total")
        if total is not None and offset >= int(total):
            break
        if len(data) < limit:
            break

    return out, 200


def _fetch_catalog_variants_nested(catalog_product_id: int) -> Dict[str, Dict[str, int]]:
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        raise RuntimeError("PRINTFUL_API_KEY not set")

    headers = printful_request_headers(api_key)
    for region in CATALOG_VARIANT_REGION_TRIES:
        nested, status = _fetch_catalog_variants_for_region(catalog_product_id, headers, region)
        if nested:
            logger.info(
                "Printful catalog variants catalog_product_id=%s region=%s colors=%s",
                catalog_product_id,
                region,
                len(nested),
            )
            return nested
        if nested is not None:
            logger.warning(
                "Printful catalog variants empty catalog_product_id=%s region=%s",
                catalog_product_id,
                region,
            )
            continue
        if status == 400:
            continue
        break

    logger.error("Printful catalog variants unavailable catalog_product_id=%s", catalog_product_id)
    return {}


def get_nested_variant_map(catalog_product_id: int) -> Dict[str, Dict[str, int]]:
    with _maps_lock:
        cached = _nested_maps.get(catalog_product_id)
    if cached is not None:
        return cached

    nested = _fetch_catalog_variants_nested(catalog_product_id)
    # Do not cache an empty map from a failed fetch; browse would otherwise
    # keep serving fail-open regional matrices until process restart.
    if nested:
        with _maps_lock:
            _nested_maps.setdefault(catalog_product_id, nested)
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

    if not size:
        return None

    color_in = str(color or "").strip()
    color = _apply_catalog_color_aliases(catalog_product_id, color_in)
    size = str(size).strip()

    by_color = m.get(color) if color else None
    if by_color is None and color_in:
        cl = color_in.lower()
        for k in m:
            if str(k).lower() == cl:
                by_color = m[k]
                break
    # Storefront "Black" vs catalog "Black / Navy / …" (Bella hoodies, mugs, etc.)
    if by_color is None and color_in:
        cl = color_in.strip().lower()
        best_k = None
        for k in m:
            kl = str(k).lower()
            if kl.startswith(cl + "/") or kl.startswith(cl + " ") or kl == cl:
                if best_k is None or len(str(k)) < len(str(best_k)):
                    best_k = k
        if best_k is not None:
            by_color = m[best_k]
    if not by_color and NO_COLOR_BUCKET_KEY in m:
        by_color = m[NO_COLOR_BUCKET_KEY]
    if not by_color:
        return None

    for sz in _sizes_for_catalog_lookup(catalog_product_id, size):
        matched = _match_size_in_bucket(sz, by_color)
        if matched is not None:
            return matched

    if catalog_product_id in MUG_OZ_CATALOG_PRODUCT_IDS:
        mug_vid = _match_mug_oz_size(size, by_color)
        if mug_vid is not None:
            return mug_vid
        mug_any = _lookup_mug_variant_by_oz_any_color(catalog_product_id, size, m)
        if mug_any is not None:
            return mug_any

    if catalog_product_id == JIGSAW_PUZZLE_WITH_TIN_CATALOG_ID:
        jvid = _jigsaw_tin_variant_id_for_store_size(size, by_color)
        if jvid is not None:
            return jvid
    return None


# Cached GET /v2/catalog-variants/{id} for placement + v2 shipping fallback.
_variant_detail_lock = threading.Lock()
_variant_detail_cache: Dict[int, Dict[str, Any]] = {}

# Printful-hosted placeholder art (required by v2 shipping-rates for catalog items).
PRINTFUL_PLACEHOLDER_ART_URL = "https://www.printful.com/static/images/layout/printful-logo.png"


def printful_request_headers(api_key: str, *, json_body: bool = False) -> Dict[str, str]:
    """
    Authorization + optional X-PF-Store-Id.

    Account-level API tokens often require ``PRINTFUL_STORE_ID`` for shipping and catalog calls;
    without it Printful may return misleading errors (e.g. stock-related 400s).
    """
    h: Dict[str, str] = {"Authorization": f"Bearer {api_key}"}
    if json_body:
        h["Content-Type"] = "application/json"
    store_id = os.getenv("PRINTFUL_STORE_ID", "").strip()
    if store_id:
        h["X-PF-Store-Id"] = store_id
    return h


def get_catalog_variant_v2_detail(catalog_variant_id: int, api_key: str) -> Optional[Dict[str, Any]]:
    """Single catalog variant (placement_dimensions, catalog_product_id)."""
    vid = int(catalog_variant_id)
    with _variant_detail_lock:
        cached = _variant_detail_cache.get(vid)
    if cached is not None:
        return cached
    if not api_key:
        return None
    try:
        r = requests.get(
            f"https://api.printful.com/v2/catalog-variants/{vid}",
            headers=printful_request_headers(api_key),
            params={"selling_region_name": CATALOG_VARIANT_REGION_TRIES[0]},
            timeout=30,
        )
        if r.status_code != 200:
            logger.warning(
                "GET v2/catalog-variants/%s failed status=%s body=%s",
                vid,
                r.status_code,
                (r.text or "")[:350],
            )
            return None
        body = r.json()
        data = body.get("data")
        if not isinstance(data, dict):
            return None
        with _variant_detail_lock:
            _variant_detail_cache[vid] = data
        return data
    except Exception as e:
        logger.warning("GET v2/catalog-variants/%s: %s", vid, e)
        return None


def _placement_and_technique_for_v2_shipping(catalog_variant_id: int, api_key: str) -> tuple[str, str]:
    """Derive placement + technique for POST /v2/shipping-rates from catalog variant metadata."""
    detail = get_catalog_variant_v2_detail(catalog_variant_id, api_key)
    cat_pid = 0
    if detail:
        try:
            cat_pid = int(detail.get("catalog_product_id") or 0)
        except (TypeError, ValueError):
            cat_pid = 0

    placement_names: List[str] = []
    if detail and isinstance(detail.get("placement_dimensions"), list):
        for d in detail["placement_dimensions"]:
            if isinstance(d, dict) and d.get("placement"):
                placement_names.append(str(d["placement"]).strip())

    if cat_pid in MUG_OZ_CATALOG_PRODUCT_IDS:
        # Mugs: prefer API placement string when present; avoid inventing names Printful rejects.
        if placement_names:
            return placement_names[0], "sublimation"
        return "default", "sublimation"

    if cat_pid in HAT_EMBROIDERY_CATALOG_PRODUCT_IDS:
        for p in placement_names:
            if "embroidery" in p.lower():
                return p, "embroidery"
        return "embroidery_front", "embroidery"

    if "front_large" in placement_names:
        return "front_large", "dtg"
    if "front" in placement_names:
        return "front", "dtg"
    if placement_names:
        return placement_names[0], "dtg"
    return "front_large", "dtg"


def _catalog_product_id_for_variant_id(catalog_variant_id: int, api_key: str) -> int:
    d = get_catalog_variant_v2_detail(catalog_variant_id, api_key)
    if not d:
        return 0
    try:
        return int(d.get("catalog_product_id") or 0)
    except (TypeError, ValueError):
        return 0


def _v2_order_item_dict(v_int: int, q_int: int, placement: str, technique: str) -> Dict[str, Any]:
    return {
        "source": "catalog",
        "catalog_variant_id": v_int,
        "quantity": q_int,
        "placements": [
            {
                "placement": placement,
                "technique": technique,
                "print_area_type": "simple",
                "layers": [{"type": "file", "url": PRINTFUL_PLACEHOLDER_ART_URL}],
            }
        ],
    }


def _build_v2_order_items(
    lines: List[Tuple[int, int]],
    api_key: str,
    mug_override: Optional[Tuple[str, str]],
) -> List[Dict[str, Any]]:
    order_items: List[Dict[str, Any]] = []
    for vid, qty in lines:
        try:
            v_int = int(vid)
            q_int = max(1, int(qty))
        except (TypeError, ValueError):
            continue
        pl, tech = _placement_and_technique_for_v2_shipping(v_int, api_key)
        cat_pid = _catalog_product_id_for_variant_id(v_int, api_key)
        if mug_override is not None and cat_pid in MUG_OZ_CATALOG_PRODUCT_IDS:
            pl, tech = mug_override[0], mug_override[1]
        order_items.append(_v2_order_item_dict(v_int, q_int, pl, tech))
    return order_items


def _parse_v2_shipping_rates_response(payload: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None
    rows = payload.get("data") or []
    if not isinstance(rows, list) or not rows:
        return None
    standard = None
    for row in rows:
        if isinstance(row, dict) and str(row.get("shipping") or "").upper() == "STANDARD":
            standard = row
            break
    row = standard or rows[0]
    if not isinstance(row, dict):
        return None
    rate_raw = row.get("rate") or row.get("shipping_cost")
    if rate_raw is None:
        return None
    try:
        cost = float(rate_raw)
    except (TypeError, ValueError):
        return None
    name = row.get("shipping_method_name") or row.get("name") or "Standard Shipping"
    mind = row.get("min_delivery_days")
    maxd = row.get("max_delivery_days")
    if mind is not None and maxd is not None:
        delivery = f"{mind}-{maxd}"
    elif mind is not None:
        delivery = str(mind)
    else:
        delivery = "5-7"
    return {
        "shipping_cost": cost,
        "shipping_method": str(name),
        "delivery_days": delivery,
    }


def try_v2_shipping_rates(
    api_key: str,
    recipient: Dict[str, Any],
    lines: List[Tuple[int, int]],
    currency: str = "USD",
) -> Optional[Dict[str, Any]]:
    """
    Printful POST /v2/shipping-rates — aligned with current catalog + placements.

    Use when legacy POST /shipping/rates fails (often misleading ``out of stock`` on newer catalog IDs).
    Retries mug lines with alternate placement/technique pairs when the first attempt fails.
    """
    if not api_key or not lines:
        return None

    has_mug_line = False
    for vid, _ in lines:
        try:
            if _catalog_product_id_for_variant_id(int(vid), api_key) in MUG_OZ_CATALOG_PRODUCT_IDS:
                has_mug_line = True
                break
        except (TypeError, ValueError):
            continue

    strategies: List[Optional[Tuple[str, str]]] = [None]
    if has_mug_line:
        strategies.extend(
            [
                ("default", "sublimation"),
                ("wrap", "sublimation"),
                ("wraparound", "sublimation"),
                ("default", "digital"),
                ("wrap", "digital"),
            ]
        )

    seen_strat = set()
    for strat in strategies:
        key = strat if strat is None else (strat[0], strat[1])
        if key in seen_strat:
            continue
        seen_strat.add(key)

        order_items = _build_v2_order_items(lines, api_key, strat)
        if not order_items:
            continue
        body = {"recipient": recipient, "order_items": order_items, "currency": currency or "USD"}
        try:
            r = requests.post(
                "https://api.printful.com/v2/shipping-rates",
                json=body,
                headers=printful_request_headers(api_key, json_body=True),
                timeout=25,
            )
        except Exception as e:
            logger.warning("v2/shipping-rates request failed: %s", e)
            continue
        if r.status_code != 200:
            logger.warning(
                "v2/shipping-rates HTTP %s strat=%s body=%s",
                r.status_code,
                strat,
                (r.text or "")[:500],
            )
            continue
        try:
            payload = r.json()
        except Exception:
            continue
        parsed = _parse_v2_shipping_rates_response(payload)
        if parsed:
            if strat is not None:
                logger.info(
                    "v2/shipping-rates succeeded with mug strategy placement=%s technique=%s",
                    strat[0],
                    strat[1],
                )
            return parsed
    return None


def _storefront_size_color_base(product: Dict[str, Any]) -> Dict[str, List[str]]:
    """US catalog matrix (size -> colors). Falls back to the full options grid."""
    sca = product.get("size_color_availability")
    if isinstance(sca, dict) and sca:
        out: Dict[str, List[str]] = {}
        for size, colors in sca.items():
            if isinstance(colors, list) and colors:
                out[str(size)] = [str(c) for c in colors]
        if out:
            return out
    options = product.get("options") if isinstance(product.get("options"), dict) else {}
    sizes = [str(s) for s in (options.get("size") or []) if s]
    colors = [str(c) for c in (options.get("color") or []) if c]
    if sizes and colors:
        return {sz: list(colors) for sz in sizes}
    return {}


def build_regional_size_color_availability(
    product: Dict[str, Any],
    catalog_product_id: int,
) -> Dict[str, Dict[str, List[str]]]:
    """Filter the US size/color matrix by Printful stock for CA / GB / IE / AU / DE."""
    from printful_regions import (
        REGIONAL_FILTER_COUNTRIES,
        get_variant_region_stock,
        variant_available_for_country,
    )

    base = _storefront_size_color_base(product)
    if not base:
        return {}
    try:
        stock = get_variant_region_stock(int(catalog_product_id))
    except Exception as e:
        logger.warning("Region stock load failed catalog_product_id=%s: %s", catalog_product_id, e)
        return {}
    if not stock:
        return {}

    regional: Dict[str, Dict[str, List[str]]] = {}
    for country in REGIONAL_FILTER_COUNTRIES:
        filtered: Dict[str, List[str]] = {}
        for size, colors in base.items():
            kept: List[str] = []
            for color in colors:
                vid = lookup_catalog_variant_id(int(catalog_product_id), color, size)
                if vid is None:
                    kept.append(color)
                    continue
                regions = stock.get(int(vid))
                if regions is None:
                    continue
                if variant_available_for_country(regions, country):
                    kept.append(color)
            if kept:
                filtered[str(size)] = kept
        regional[country] = filtered
    return regional


def combo_available_for_country(product_name: str, color: str, size: str, country: str) -> Optional[bool]:
    """
    True/False when Printful region stock is known; None when we cannot tell
    (no catalog id, no stock map, or variant lookup miss).
    """
    from printful_regions import get_variant_region_stock, variant_available_for_country

    pid = catalog_product_id_for_product_name(product_name)
    if not pid:
        return None
    try:
        stock = get_variant_region_stock(int(pid))
    except Exception:
        return None
    if not stock:
        return None
    vid = lookup_catalog_variant_id(int(pid), color or "", size or "")
    if vid is None:
        return None
    regions = stock.get(int(vid))
    if regions is None:
        return False
    return variant_available_for_country(regions, country)


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
        nested = get_nested_variant_map(int(pid))
        # Frontend matches on storefront color (e.g. "White"); catalog may only have no-color bucket.
        if NO_COLOR_BUCKET_KEY in nested:
            bucket = nested[NO_COLOR_BUCKET_KEY]
            for alias in ("White", "Default", "Black"):
                if alias not in nested:
                    nested[alias] = dict(bucket)
        out["printful_variant_map"] = nested
        regional = build_regional_size_color_availability(out, int(pid))
        if regional:
            out["regional_size_color_availability"] = regional
    except Exception as e:
        logger.warning("attach_printful_catalog_data(%s): %s", name, e)
    try:
        from printful_regions import build_regional_base_prices

        prices = build_regional_base_prices(float(out.get("price") or 0), int(pid))
        if prices:
            out["regional_base_prices"] = prices
    except Exception as e:
        logger.warning("attach_printful_catalog_data prices (%s): %s", name, e)
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
        from printful_regions import prefetch_region_blank_costs, prefetch_variant_region_stock

        def _warm(cid: int) -> None:
            try:
                get_nested_variant_map(cid)
            except Exception as e:
                logger.warning("Prefetch catalog %s: %s", cid, e)
            prefetch_variant_region_stock(cid)
            prefetch_region_blank_costs(cid)

        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(_warm, unique_ids))
    return [attach_printful_catalog_data(p) for p in products]


def storefront_unit_price(product: Dict[str, Any], size: Optional[str], country: str) -> float:
    """US catalog price (plus size extra) adjusted for Printful's ship-to blank cost."""
    if not product:
        return 0.0
    p = product
    if not p.get("regional_base_prices"):
        try:
            p = attach_printful_catalog_data(p)
        except Exception:
            p = product
    from printful_regions import normalize_ship_to_country

    code = normalize_ship_to_country(country)
    regional = p.get("regional_base_prices") if isinstance(p.get("regional_base_prices"), dict) else {}
    base = regional.get(code)
    if base is None:
        base = p.get("price") or 0
    extra = 0.0
    if size:
        extra = (p.get("size_pricing") or {}).get(size) or 0
    try:
        return round(float(base) + float(extra or 0), 2)
    except (TypeError, ValueError):
        return round(float(p.get("price") or 0), 2)


def resolve_cart_item_unit_price(
    item: Dict[str, Any],
    products: List[Dict[str, Any]],
    country: str,
) -> Optional[float]:
    """Charge the regional storefront price for a checkout line, not a stale US cart snapshot."""
    name = str((item or {}).get("product") or (item or {}).get("name") or "").strip()
    variants = (item or {}).get("variants") if isinstance((item or {}).get("variants"), dict) else {}
    size = str((item or {}).get("size") or variants.get("size") or "").strip()
    product = next((p for p in (products or []) if (p or {}).get("name") == name), None)
    if not product:
        lower = name.lower()
        product = next(
            (p for p in (products or []) if str((p or {}).get("name") or "").lower() == lower),
            None,
        )
    if product:
        return storefront_unit_price(product, size, country)
    try:
        snap = float((item or {}).get("price") or 0)
    except (TypeError, ValueError):
        return None
    return round(snap, 2) if snap > 0 else None
