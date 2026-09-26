"""Printful mockup-generator helpers for mug, bag, pet, and accessory wrap previews.

POST /mockup-generator/create-task/{product_id} then poll
GET /mockup-generator/task?task_key= until a wrap photo is ready.
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

import requests

from printful_catalog import (
    MUG_OZ_CATALOG_PRODUCT_IDS,
    PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME,
    catalog_product_id_for_product_name,
    get_nested_variant_map,
    lookup_catalog_variant_id,
    printful_request_headers,
)

logger = logging.getLogger(__name__)

PRINTFUL_API_BASE = "https://api.printful.com"
MAX_DATA_URL_BYTES = 2_500_000
POLL_INTERVAL_SEC = 1.2
POLL_MAX_ATTEMPTS = 20
FILE_READY_ATTEMPTS = 12
CACHE_TTL_SEC = 30 * 60
CACHE_MAX_ENTRIES = 64
MUG_PREVIEW_BUCKET = "thumbnails"
BAG_CATALOG_PRODUCT_IDS = frozenset({262, 274, 394})
PET_BOWL_CATALOG_ID = 678
PET_BANDANA_CATALOG_ID = 902
PET_CATALOG_PRODUCT_IDS = frozenset({PET_BOWL_CATALOG_ID, PET_BANDANA_CATALOG_ID})
GREETING_CARD_CATALOG_ID = 568
NOTEBOOK_CATALOG_ID = 682
APRON_CATALOG_ID = 894
JIGSAW_CATALOG_ID = 906
ACCESSORY_CATALOG_PRODUCT_IDS = frozenset({
    GREETING_CARD_CATALOG_ID,
    NOTEBOOK_CATALOG_ID,
    APRON_CATALOG_ID,
    JIGSAW_CATALOG_ID,
})
TOTE_WRAP_CATALOG_ID = 274
DRAWSTRING_CATALOG_ID = 262
# Portrait tools crop keeps the top of a tall photo (object-position y 26%).
DRAWSTRING_PORTRAIT_FOCAL_Y = 0.26
# Laptop sleeve, pets, and accessories fill the printfile (crop). Bowl
# printfile is the 21.66" × 2.68" wrap strip. Drawstring portrait also
# covers its tall printfile; an explicit landscape orientation stays contain.
# Tote 274 is one tall wrap (front + bottom + back); covering it prints
# the back upside-down.
COVER_PRINT_AREA_CATALOG_IDS = frozenset({
    394,
    PET_BOWL_CATALOG_ID,
    PET_BANDANA_CATALOG_ID,
    GREETING_CARD_CATALOG_ID,
    NOTEBOOK_CATALOG_ID,
    APRON_CATALOG_ID,
    JIGSAW_CATALOG_ID,
})
# Top of the unrolled tote printfile is the front face; bottom is the back
# (sewn inverted). Keep a small gusset between the two panels.
TOTE_FRONT_PANEL_FRAC = 0.48
TOTE_BACK_PANEL_FRAC = 0.48
# Pull art off the opening and gusset so a frame or feather stays on the bag face.
TOTE_ART_INSET_FRAC = 0.08

_storage_admin = None
_storage_admin_failed = False
_storage_url = ""

DEFAULT_MUG_SIZE_BY_CATALOG = {
    19: "11 oz",
    403: "11 oz",
    407: "12 oz",
    663: "25 oz",
}
DEFAULT_MUG_COLOR_BY_CATALOG = {
    19: "White",
    403: "Black",
    407: "White",
    663: "White",
}
DEFAULT_BAG_SIZE_BY_CATALOG = {
    262: '15"x17"',
    274: '16"x20"',
    394: '13.5"x10.5"',
}
DEFAULT_BAG_COLOR_BY_CATALOG = {
    262: "White",
    274: "Black",
    394: "White",
}
DEFAULT_PET_SIZE_BY_CATALOG = {
    PET_BOWL_CATALOG_ID: "18 oz",
    PET_BANDANA_CATALOG_ID: "S",
}
DEFAULT_PET_COLOR_BY_CATALOG = {
    PET_BOWL_CATALOG_ID: "White",
    PET_BANDANA_CATALOG_ID: "Black",
}
DEFAULT_ACCESSORY_SIZE_BY_CATALOG = {
    GREETING_CARD_CATALOG_ID: '4"x6"',
    NOTEBOOK_CATALOG_ID: '5.5"x8.5"',
    APRON_CATALOG_ID: "One Size",
    JIGSAW_CATALOG_ID: "110 pcs: 10″ × 8″ (25.40 cm × 20.32 cm)",
}
DEFAULT_ACCESSORY_COLOR_BY_CATALOG = {
    GREETING_CARD_CATALOG_ID: "White",
    NOTEBOOK_CATALOG_ID: "Black",
    APRON_CATALOG_ID: "White",
    JIGSAW_CATALOG_ID: "White",
}
# Used only if GET /mockup-generator/printfiles fails.
FALLBACK_PRINT_AREA_BY_CATALOG = {
    19: (520, 202),
    403: (520, 202),
    407: (540, 270),
    663: (1000, 400),
    262: (2400, 2850),
    274: (3150, 5550),
    394: (2250, 1725),
    PET_BOWL_CATALOG_ID: (6496, 803),
    PET_BANDANA_CATALOG_ID: (3060, 1875),
    GREETING_CARD_CATALOG_ID: (1842, 1240),
    NOTEBOOK_CATALOG_ID: (900, 1500),
    APRON_CATALOG_ID: (4350, 4783),
    JIGSAW_CATALOG_ID: (2953, 2350),
}
PREFERRED_PLACEMENTS_BY_CATALOG = {
    274: ("default", "front"),
    262: ("default", "front"),
    394: ("default", "front"),
    PET_BOWL_CATALOG_ID: ("default", "front"),
    PET_BANDANA_CATALOG_ID: ("front", "default"),
    GREETING_CARD_CATALOG_ID: ("front", "default"),
    NOTEBOOK_CATALOG_ID: ("front", "default"),
    APRON_CATALOG_ID: ("front", "default"),
    JIGSAW_CATALOG_ID: ("front", "default"),
}
# Printful option names for one front + both sides. White glossy uses handle extras instead.
MUG_ANGLE_OPTIONS_BY_CATALOG = {
    403: ("Front", "Left", "Right"),
    407: ("Front", "Left", "Right"),
    663: ("Front", "Left", "Right"),
}
BAG_ANGLE_OPTIONS_BY_CATALOG = {
    262: ("Front", "Back"),
    274: ("Front", "Back"),
    394: ("Front",),
}
PET_ANGLE_OPTIONS_BY_CATALOG = {
    PET_BOWL_CATALOG_ID: ("Front", "Left", "Right"),
    PET_BANDANA_CATALOG_ID: ("Front",),
}
ACCESSORY_ANGLE_OPTIONS_BY_CATALOG = {
    GREETING_CARD_CATALOG_ID: ("Front",),
    NOTEBOOK_CATALOG_ID: ("Front",),
    APRON_CATALOG_ID: ("Front",),
    JIGSAW_CATALOG_ID: ("Front",),
}

_printfile_lock = threading.Lock()
_printfile_cache: Dict[int, Dict[str, Any]] = {}
_mockup_cache_lock = threading.Lock()
_mockup_cache: Dict[str, Tuple[float, Any]] = {}


def is_mug_product_name(name: str, category: str = "") -> bool:
    cat = str(category or "").strip().lower()
    if cat == "mugs":
        return True
    n = str(name or "").strip().lower()
    return "mug" in n


def resolve_mug_catalog_id(product_name: str) -> Optional[int]:
    name = str(product_name or "").strip()
    if not name:
        return None
    cid = catalog_product_id_for_product_name(name)
    if cid in MUG_OZ_CATALOG_PRODUCT_IDS:
        return int(cid)
    lower = name.lower()
    for pname, pid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
        if pid not in MUG_OZ_CATALOG_PRODUCT_IDS:
            continue
        if pname.lower() in lower or lower in pname.lower():
            return int(pid)
    if "mug" not in lower:
        return None
    if "travel" in lower:
        return 663
    if "enamel" in lower:
        return 407
    if "color" in lower:
        return 403
    if "glossy" in lower:
        return 19
    return 19


def is_bag_product_name(name: str, category: str = "") -> bool:
    n = str(name or "").strip().lower()
    if any(
        token in n
        for token in (
            "drawstring",
            "tote pocket",
            "laptop sleeve",
        )
    ):
        return True
    cat = str(category or "").strip().lower()
    return cat == "bags" and bool(n) and resolve_bag_catalog_id(n) is not None


def resolve_bag_catalog_id(product_name: str) -> Optional[int]:
    name = str(product_name or "").strip()
    if not name:
        return None
    cid = catalog_product_id_for_product_name(name)
    if cid in BAG_CATALOG_PRODUCT_IDS:
        return int(cid)
    lower = name.lower()
    for pname, pid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
        if pid not in BAG_CATALOG_PRODUCT_IDS:
            continue
        if pname.lower() in lower or lower in pname.lower():
            return int(pid)
    if "drawstring" in lower:
        return 262
    if "tote pocket" in lower or "tote bag w" in lower:
        return 274
    if "laptop" in lower:
        return 394
    return None


def is_pet_product_name(name: str, category: str = "") -> bool:
    n = str(name or "").strip().lower()
    if "pet bowl" in n or "bandana collar" in n:
        return True
    cat = str(category or "").strip().lower()
    return cat == "pets" and bool(n) and resolve_pet_catalog_id(n) is not None


def resolve_pet_catalog_id(product_name: str) -> Optional[int]:
    name = str(product_name or "").strip()
    if not name:
        return None
    cid = catalog_product_id_for_product_name(name)
    if cid in PET_CATALOG_PRODUCT_IDS:
        return int(cid)
    lower = name.lower()
    for pname, pid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
        if pid not in PET_CATALOG_PRODUCT_IDS:
            continue
        if pname.lower() in lower or lower in pname.lower():
            return int(pid)
    if "pet bowl" in lower:
        return PET_BOWL_CATALOG_ID
    if "bandana collar" in lower or ("pet" in lower and "bandana" in lower):
        return PET_BANDANA_CATALOG_ID
    return None


def is_accessory_product_name(name: str, category: str = "") -> bool:
    n = str(name or "").strip().lower()
    if any(
        token in n
        for token in (
            "greeting card",
            "hardcover bound notebook",
            "jigsaw puzzle",
        )
    ) or (n == "apron" or (n.endswith(" apron") or n.startswith("apron "))):
        return True
    if "apron" in n and "all-over" in n:
        return True
    cat = str(category or "").strip().lower()
    return cat == "misc" and bool(n) and resolve_accessory_catalog_id(n) is not None


def resolve_accessory_catalog_id(product_name: str) -> Optional[int]:
    name = str(product_name or "").strip()
    if not name:
        return None
    cid = catalog_product_id_for_product_name(name)
    if cid in ACCESSORY_CATALOG_PRODUCT_IDS:
        return int(cid)
    lower = name.lower()
    for pname, pid in PRINTFUL_CATALOG_PRODUCT_IDS_BY_NAME.items():
        if pid not in ACCESSORY_CATALOG_PRODUCT_IDS:
            continue
        if pname.lower() in lower or lower in pname.lower():
            return int(pid)
    if "greeting card" in lower:
        return GREETING_CARD_CATALOG_ID
    if "notebook" in lower:
        return NOTEBOOK_CATALOG_ID
    if "apron" in lower:
        return APRON_CATALOG_ID
    if "jigsaw" in lower or "puzzle" in lower:
        return JIGSAW_CATALOG_ID
    return None


def resolve_wrap_catalog_id(product_name: str) -> Optional[int]:
    name = str(product_name or "").strip()
    if not name:
        return None
    cid = catalog_product_id_for_product_name(name)
    if (
        cid in MUG_OZ_CATALOG_PRODUCT_IDS
        or cid in BAG_CATALOG_PRODUCT_IDS
        or cid in PET_CATALOG_PRODUCT_IDS
        or cid in ACCESSORY_CATALOG_PRODUCT_IDS
    ):
        return int(cid)
    if is_mug_product_name(name):
        return resolve_mug_catalog_id(name)
    if is_pet_product_name(name):
        return resolve_pet_catalog_id(name)
    if is_accessory_product_name(name):
        return resolve_accessory_catalog_id(name)
    return resolve_bag_catalog_id(name)


def _default_size(catalog_id: int, size: str) -> str:
    sz = str(size or "").strip()
    cid = int(catalog_id)
    if sz and sz.lower() not in ("n/a", "na", "default"):
        if sz.lower() != "one size" or cid in BAG_CATALOG_PRODUCT_IDS or cid in ACCESSORY_CATALOG_PRODUCT_IDS:
            return sz
    return (
        DEFAULT_MUG_SIZE_BY_CATALOG.get(cid)
        or DEFAULT_BAG_SIZE_BY_CATALOG.get(cid)
        or DEFAULT_PET_SIZE_BY_CATALOG.get(cid)
        or DEFAULT_ACCESSORY_SIZE_BY_CATALOG.get(cid)
        or "11 oz"
    )


def _default_color(catalog_id: int, color: str) -> str:
    c = str(color or "").strip()
    if c and c.lower() not in ("n/a", "na", "default"):
        return c
    cid = int(catalog_id)
    return (
        DEFAULT_MUG_COLOR_BY_CATALOG.get(cid)
        or DEFAULT_BAG_COLOR_BY_CATALOG.get(cid)
        or DEFAULT_PET_COLOR_BY_CATALOG.get(cid)
        or DEFAULT_ACCESSORY_COLOR_BY_CATALOG.get(cid)
        or "White"
    )


def resolve_mug_variant_id(catalog_id: int, color: str, size: str) -> Optional[int]:
    color = _default_color(catalog_id, color)
    size = _default_size(catalog_id, size)
    vid = lookup_catalog_variant_id(int(catalog_id), color, size)
    if vid:
        return int(vid)

    nested = get_nested_variant_map(int(catalog_id), fetch=True) or {}
    for _ck, by_size in nested.items():
        if not isinstance(by_size, dict) or not by_size:
            continue
        first = next(iter(by_size.values()), None)
        if first:
            return int(first)
    return None


def contain_in_print_area(
    area_width: int,
    area_height: int,
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
) -> Dict[str, int]:
    """Center the artwork in the wrap printfile (contain, no stretch)."""
    aw = max(1, int(area_width))
    ah = max(1, int(area_height))
    iw = int(image_width or 0)
    ih = int(image_height or 0)
    if iw <= 0 or ih <= 0:
        side = min(aw, ah)
        return {
            "area_width": aw,
            "area_height": ah,
            "width": side,
            "height": side,
            "left": int(round((aw - side) / 2)),
            "top": int(round((ah - side) / 2)),
        }
    scale = min(aw / float(iw), ah / float(ih))
    width = max(1, int(round(iw * scale)))
    height = max(1, int(round(ih * scale)))
    return {
        "area_width": aw,
        "area_height": ah,
        "width": width,
        "height": height,
        "left": int(round((aw - width) / 2)),
        "top": int(round((ah - height) / 2)),
    }


def cover_in_print_area(
    area_width: int,
    area_height: int,
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    focal_x: float = 0.5,
    focal_y: float = 0.5,
) -> Dict[str, int]:
    """Fill the printfile (cover/crop). Focal 0 keeps the start of that axis."""
    aw = max(1, int(area_width))
    ah = max(1, int(area_height))
    iw = int(image_width or 0)
    ih = int(image_height or 0)
    if iw <= 0 or ih <= 0:
        return {
            "area_width": aw,
            "area_height": ah,
            "width": aw,
            "height": ah,
            "left": 0,
            "top": 0,
        }
    scale = max(aw / float(iw), ah / float(ih))
    width = max(1, int(round(iw * scale)))
    height = max(1, int(round(ih * scale)))
    fx = min(1.0, max(0.0, float(focal_x)))
    fy = min(1.0, max(0.0, float(focal_y)))
    return {
        "area_width": aw,
        "area_height": ah,
        "width": width,
        "height": height,
        "left": int(round((aw - width) * fx)),
        "top": int(round((ah - height) * fy)),
    }


def tote_wrap_panels(
    area_width: int, area_height: int
) -> Tuple[Tuple[int, int, int, int], Tuple[int, int, int, int]]:
    """Return (front_box, back_box) as (left, top, width, height)."""
    aw = max(1, int(area_width))
    ah = max(1, int(area_height))
    front_h = max(1, int(round(ah * TOTE_FRONT_PANEL_FRAC)))
    back_h = max(1, int(round(ah * TOTE_BACK_PANEL_FRAC)))
    if front_h + back_h > ah:
        back_h = max(1, ah - front_h)
    return (0, 0, aw, front_h), (0, ah - back_h, aw, back_h)


def _inset_box(box: Tuple[int, int, int, int], frac: float) -> Tuple[int, int, int, int]:
    left, top, width, height = box
    pad_x = max(0, int(round(width * float(frac))))
    pad_y = max(0, int(round(height * float(frac))))
    inner_w = max(1, width - pad_x * 2)
    inner_h = max(1, height - pad_y * 2)
    return (left + pad_x, top + pad_y, inner_w, inner_h)


def tote_front_artwork_position(
    area_width: int,
    area_height: int,
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
) -> Dict[str, int]:
    """Contain the shopper photo on the tote front only (no wrap onto the back)."""
    front, _back = tote_wrap_panels(area_width, area_height)
    left, top, panel_w, panel_h = _inset_box(front, TOTE_ART_INSET_FRAC)
    pos = contain_in_print_area(panel_w, panel_h, image_width, image_height)
    return {
        "area_width": max(1, int(area_width)),
        "area_height": max(1, int(area_height)),
        "width": pos["width"],
        "height": pos["height"],
        "left": left + pos["left"],
        "top": top + pos["top"],
    }


def artwork_position_for_catalog(
    catalog_id: int,
    area_width: int,
    area_height: int,
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    orientation: Optional[str] = None,
) -> Dict[str, int]:
    if int(catalog_id) == TOTE_WRAP_CATALOG_ID:
        return tote_front_artwork_position(area_width, area_height, image_width, image_height)
    ori = str(orientation or "").strip().lower()
    if int(catalog_id) == DRAWSTRING_CATALOG_ID and ori != "landscape":
        return cover_in_print_area(
            area_width,
            area_height,
            image_width,
            image_height,
            focal_y=DRAWSTRING_PORTRAIT_FOCAL_Y,
        )
    if int(catalog_id) in COVER_PRINT_AREA_CATALOG_IDS:
        return cover_in_print_area(area_width, area_height, image_width, image_height)
    return contain_in_print_area(area_width, area_height, image_width, image_height)


def _pil_resample():
    from PIL import Image

    return getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)


def _contain_paste_rgb(canvas, src, box: Tuple[int, int, int, int]) -> None:
    """Contain ``src`` inside ``box`` on an RGB canvas (letterbox stays canvas fill)."""
    left, top, width, height = box
    if width < 1 or height < 1 or src is None:
        return
    rgba = src.convert("RGBA")
    pos = contain_in_print_area(width, height, rgba.size[0], rgba.size[1])
    resized = rgba.resize((pos["width"], pos["height"]), _pil_resample())
    rgb = resized.convert("RGB")
    mask = resized.split()[-1] if "A" in resized.getbands() else None
    canvas.paste(rgb, (left + pos["left"], top + pos["top"]), mask)


def compose_tote_wrap_bytes(
    front_im,
    back_im=None,
    area_width: int = 3150,
    area_height: int = 5550,
) -> bytes:
    """Build the single tote printfile: front upright, back rotated 180°.

    If no back image is supplied, the front photo is mirrored onto the back
    so both faces print and the reverse side reads a little differently.
    """
    from PIL import Image

    aw = max(1, int(area_width))
    ah = max(1, int(area_height))
    canvas = Image.new("RGB", (aw, ah), (0, 0, 0))
    front_box, back_box = tote_wrap_panels(aw, ah)
    front_art_box = _inset_box(front_box, TOTE_ART_INSET_FRAC)
    if front_im is not None:
        _contain_paste_rgb(canvas, front_im, front_art_box)
    back_art = back_im if back_im is not None else front_im
    if back_art is not None:
        if back_im is None:
            back_art = back_art.transpose(Image.FLIP_LEFT_RIGHT)
        _bl, back_top, bw, bh = back_box
        panel = Image.new("RGB", (bw, bh), (0, 0, 0))
        panel_art_box = _inset_box((0, 0, bw, bh), TOTE_ART_INSET_FRAC)
        _contain_paste_rgb(panel, back_art, panel_art_box)
        canvas.paste(panel.rotate(180), (0, back_top))
    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


def _load_pil_image(image: str):
    raw = str(image or "").strip()
    try:
        if raw.startswith("data:image"):
            blob, _mime = _decode_data_url(raw)
        elif is_public_https_url(raw):
            r = requests.get(raw, timeout=20)
            r.raise_for_status()
            blob = r.content
        else:
            return None
        from PIL import Image

        im = Image.open(io.BytesIO(blob))
        im.load()
        return im.convert("RGBA")
    except Exception as e:
        logger.warning("Tote wrap could not load image: %s", e)
        return None


def prepare_tote_wrap_printfile(
    front_image: str,
    back_image: str,
    area_width: int,
    area_height: int,
    api_key: str,
) -> Optional[Tuple[str, int, int]]:
    """Host a tote wrap JPEG (front + optional back). Returns (url, width, height)."""
    front_im = _load_pil_image(front_image)
    if front_im is None:
        return None
    back_im = _load_pil_image(back_image) if str(back_image or "").strip() else None
    blob = compose_tote_wrap_bytes(front_im, back_im, area_width, area_height)
    hosted = _upload_blob_to_supabase(blob, "image/jpeg")
    if hosted:
        return hosted, int(area_width), int(area_height)
    try:
        data_url = "data:image/jpeg;base64," + base64.b64encode(blob).decode("ascii")
        url = public_image_url_for_printful(data_url, api_key)
        return url, int(area_width), int(area_height)
    except Exception as e:
        logger.warning("Tote wrap printfile host failed: %s", e)
        return None


def _api_key() -> str:
    return (os.getenv("PRINTFUL_API_KEY") or "").strip()


def is_public_https_url(url: str) -> bool:
    u = str(url or "").strip()
    if not u.lower().startswith("https://"):
        return False
    low = u.lower()
    if "localhost" in low or "127.0.0.1" in low or "0.0.0.0" in low:
        return False
    return True


def _decode_data_url(image: str) -> Tuple[bytes, str]:
    raw = str(image or "").strip()
    if not raw.startswith("data:image"):
        raise ValueError("image must be an https URL or data:image")
    header, _, b64 = raw.partition(",")
    if not b64:
        raise ValueError("empty data URL")
    mime = "image/jpeg"
    m = re.match(r"data:([^;]+)", header, re.I)
    if m:
        mime = m.group(1).strip() or mime
    blob = base64.b64decode(b64, validate=False)
    if not blob:
        raise ValueError("empty image data")
    if len(blob) > MAX_DATA_URL_BYTES:
        raise ValueError("image is too large for a live wrap preview")
    return blob, mime


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    now = time.time()
    with _mockup_cache_lock:
        hit = _mockup_cache.get(key)
        if not hit:
            return None
        ts, payload = hit
        if now - ts > CACHE_TTL_SEC:
            _mockup_cache.pop(key, None)
            return None
        if isinstance(payload, str):
            return {"mockup_url": payload, "mockup_urls": [{"url": payload, "title": "View"}]}
        if isinstance(payload, dict) and payload.get("mockup_url"):
            return payload
        return None


def _cache_put(key: str, payload: Dict[str, Any]) -> None:
    now = time.time()
    with _mockup_cache_lock:
        if len(_mockup_cache) >= CACHE_MAX_ENTRIES:
            oldest = sorted(_mockup_cache.items(), key=lambda kv: kv[1][0])
            for stale_key, _ in oldest[: max(1, CACHE_MAX_ENTRIES // 4)]:
                _mockup_cache.pop(stale_key, None)
        _mockup_cache[key] = (now, payload)


def cache_key_for(
    catalog_id: int,
    variant_id: int,
    image: str,
    back_image: str = "",
    orientation: str = "",
) -> str:
    src = str(image or "")
    digest = hashlib.sha256(src.encode("utf-8", errors="ignore")).hexdigest()[:40]
    back = str(back_image or "").strip()
    back_digest = (
        hashlib.sha256(back.encode("utf-8", errors="ignore")).hexdigest()[:16]
        if back
        else "noback"
    )
    base = f"{int(catalog_id)}:{int(variant_id)}:{digest}:{back_digest}:a11"
    if int(catalog_id) == DRAWSTRING_CATALOG_ID:
        ori = str(orientation or "").strip().lower()
        if ori not in ("portrait", "landscape"):
            ori = "portrait"
        return f"{base}:{ori}"
    return base


def image_pixel_size(image: str = "", blob: Optional[bytes] = None) -> Tuple[int, int]:
    """Natural width/height so wrap contain does not stretch the photo."""
    data = blob
    if data is None and str(image or "").startswith("data:image"):
        try:
            data, _ = _decode_data_url(image)
        except Exception:
            return 0, 0
    if not data:
        return 0, 0
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as im:
            width, height = im.size
            return int(width or 0), int(height or 0)
    except Exception:
        return 0, 0


def _printfiles_for_product(catalog_id: int, api_key: str) -> Dict[str, Any]:
    cid = int(catalog_id)
    with _printfile_lock:
        cached = _printfile_cache.get(cid)
        if cached is not None:
            return cached
    try:
        r = requests.get(
            f"{PRINTFUL_API_BASE}/mockup-generator/printfiles/{cid}",
            headers=printful_request_headers(api_key),
            timeout=20,
        )
        body = r.json() if r.content else {}
        result = body.get("result") if isinstance(body, dict) else None
        if r.status_code != 200 or not isinstance(result, dict):
            logger.warning(
                "Printful printfiles failed catalog_id=%s status=%s body=%s",
                cid,
                r.status_code,
                str(body)[:300],
            )
            result = {}
    except Exception as e:
        logger.warning("Printful printfiles catalog_id=%s: %s", cid, e)
        result = {}
    with _printfile_lock:
        _printfile_cache.setdefault(cid, result)
    return result


def _pick_placement(catalog_id: int, placements: Dict[str, Any]) -> Tuple[str, Any]:
    """Prefer the wrap face (front/default). Skip label and pocket placements."""
    if not isinstance(placements, dict) or not placements:
        return "default", None
    keys_by_lower = {str(k).lower(): k for k in placements}
    preferred = PREFERRED_PLACEMENTS_BY_CATALOG.get(int(catalog_id), ("front", "default"))
    for want in preferred:
        key = keys_by_lower.get(str(want).lower())
        if key is not None:
            return str(key), placements.get(key)
    for key, value in placements.items():
        low = str(key).lower()
        if any(skip in low for skip in ("label", "pocket")):
            continue
        return str(key), value
    key = next(iter(placements.keys()))
    return str(key), placements.get(key)


def print_area_for_variant(
    catalog_id: int,
    variant_id: int,
    api_key: str,
) -> Tuple[str, int, int]:
    """Return (placement, area_width, area_height)."""
    pf = _printfiles_for_product(catalog_id, api_key)
    printfiles = pf.get("printfiles") if isinstance(pf, dict) else None
    variant_printfiles = pf.get("variant_printfiles") if isinstance(pf, dict) else None
    placement = "default"
    printfile_id = None
    if isinstance(variant_printfiles, list):
        for row in variant_printfiles:
            if not isinstance(row, dict):
                continue
            try:
                if int(row.get("variant_id") or 0) != int(variant_id):
                    continue
            except (TypeError, ValueError):
                continue
            placements = row.get("placements") or {}
            if isinstance(placements, dict) and placements:
                placement, printfile_id = _pick_placement(int(catalog_id), placements)
            break
    area_w, area_h = FALLBACK_PRINT_AREA_BY_CATALOG.get(int(catalog_id), (520, 202))
    if isinstance(printfiles, list):
        chosen = None
        for row in printfiles:
            if not isinstance(row, dict):
                continue
            if printfile_id is not None and row.get("printfile_id") == printfile_id:
                chosen = row
                break
            if chosen is None:
                chosen = row
        if chosen:
            try:
                area_w = int(chosen.get("width") or area_w)
                area_h = int(chosen.get("height") or area_h)
            except (TypeError, ValueError):
                pass
    return placement, max(1, area_w), max(1, area_h)


def mug_preview_object_path(blob: bytes, mime: str) -> Tuple[str, str]:
    """Content-addressed Storage path + content-type for a baked mug preview."""
    kind = (mime or "image/jpeg").split(";")[0].strip().lower()
    ext = "png" if "png" in kind else "jpg"
    content_type = "image/png" if ext == "png" else "image/jpeg"
    digest = hashlib.sha256(blob or b"").hexdigest()[:32]
    return f"mug-preview/{digest}.{ext}", content_type


def _storage_admin_client():
    global _storage_admin, _storage_admin_failed, _storage_url
    if _storage_admin is not None:
        return _storage_admin
    if _storage_admin_failed:
        return None
    url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        logger.warning("Mug preview: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        _storage_admin_failed = True
        return None
    try:
        from supabase import create_client

        _storage_admin = create_client(url, key)
        _storage_url = url
        return _storage_admin
    except Exception as e:
        logger.warning("Mug preview supabase client failed: %s", e)
        _storage_admin_failed = True
        return None


def _upload_blob_to_supabase(blob: bytes, mime: str) -> Optional[str]:
    """Host a baked Tools preview so Printful can fetch it over HTTPS."""
    client = _storage_admin_client()
    if not client or not blob:
        return None
    path, content_type = mug_preview_object_path(blob, mime)
    try:
        client.storage.from_(MUG_PREVIEW_BUCKET).upload(
            path=path,
            file=blob,
            file_options={
                "content-type": content_type,
                "contentType": content_type,
                "upsert": "true",
                "x-upsert": "true",
            },
        )
    except Exception as e:
        logger.info("Mug preview supabase upload: %s", e)
    return (
        f"{_storage_url.rstrip('/')}/storage/v1/object/public/{MUG_PREVIEW_BUCKET}/{path}"
    )


def _upload_data_url(image: str, api_key: str) -> str:
    blob, mime = _decode_data_url(image)
    ext = "png" if "png" in mime else "jpg"
    headers = printful_request_headers(api_key)
    last_error = "Printful file upload failed"
    for file_type in ("preview", "default", "image"):
        r = requests.post(
            f"{PRINTFUL_API_BASE}/files",
            headers=headers,
            files={"file": (f"mug-preview.{ext}", io.BytesIO(blob), mime)},
            data={"type": file_type},
            timeout=40,
        )
        body = r.json() if r.content else {}
        if r.status_code in (200, 201):
            result = body.get("result") if isinstance(body, dict) else None
            if isinstance(result, dict):
                break
        last_error = f"Printful file upload failed ({r.status_code}): {str(body)[:240]}"
        result = None
    else:
        raise RuntimeError(last_error)
    if not isinstance(result, dict):
        raise RuntimeError(last_error)
    file_id = result.get("id")
    url = str(result.get("url") or result.get("preview_url") or "").strip()
    status = str(result.get("status") or "").lower()
    if status in ("ok", "completed", "") and is_public_https_url(url):
        return url
    if not file_id:
        if is_public_https_url(url):
            return url
        raise RuntimeError("Printful file is not ready")
    for _ in range(FILE_READY_ATTEMPTS):
        time.sleep(0.6)
        gr = requests.get(
            f"{PRINTFUL_API_BASE}/files/{int(file_id)}",
            headers=printful_request_headers(api_key),
            timeout=20,
        )
        gbody = gr.json() if gr.content else {}
        gres = gbody.get("result") if isinstance(gbody, dict) else None
        if not isinstance(gres, dict):
            continue
        status = str(gres.get("status") or "").lower()
        url = str(gres.get("url") or gres.get("preview_url") or "").strip()
        if status in ("ok", "completed") and is_public_https_url(url):
            return url
        if status in ("failed", "error"):
            raise RuntimeError("Printful could not process the preview image")
    if is_public_https_url(url):
        return url
    raise RuntimeError("Printful file processing timed out")


def public_image_url_for_printful(image: str, api_key: str) -> str:
    src = str(image or "").strip()
    if is_public_https_url(src):
        return src
    if src.startswith("data:image"):
        blob, mime = _decode_data_url(src)
        hosted = _upload_blob_to_supabase(blob, mime)
        if hosted:
            return hosted
        logger.warning("Mug preview supabase host failed; trying Printful /files")
        return _upload_data_url(src, api_key)
    raise ValueError("image must be an https URL or data:image")


def _title_from_mockup_url(url: str) -> str:
    name = str(url or "").lower()
    if "handle-on-left" in name or "handle_on_left" in name:
        return "Handle left"
    if "handle-on-right" in name or "handle_on_right" in name:
        return "Handle right"
    if "front" in name:
        return "Front"
    if re.search(r"(^|[-_/\s])back($|[-_./\s])", name):
        return "Back"
    if "left" in name and "right" not in name:
        return "Left"
    if "right" in name:
        return "Right"
    return "View"


def _view_bucket(title: str, url: str) -> str:
    """front / back / left / right / other / skip — used to drop duplicate cameras."""
    t = f"{title} {url}".lower()
    if any(skip in t for skip in ("lifestyle", "person", "scene", "girl", "in-hand", "holding")):
        return "skip"
    if re.search(r"\bboy\b", t):
        return "skip"
    is_left = (
        "handle-on-left" in t
        or "handle_on_left" in t
        or "handle on left" in t
        or ("left" in t and "right" not in t)
    )
    is_right = (
        "handle-on-right" in t
        or "handle_on_right" in t
        or "handle on right" in t
        or ("right" in t and "left" not in t)
    )
    if is_left and not is_right:
        return "left"
    if is_right and not is_left:
        return "right"
    if "front" in t:
        return "front"
    if re.search(r"\bback\b", t) or "-back" in t or "_back" in t:
        return "back"
    return "other"


def _view_rank(title: str, url: str) -> int:
    """Lower is better: front first, then back, then the two handle sides."""
    bucket = _view_bucket(title, url)
    if bucket == "skip":
        return 90
    if bucket == "front":
        return 0
    if bucket == "back":
        return 5
    if bucket == "left":
        return 10
    if bucket == "right":
        return 20
    return 40


def unique_angle_views(views: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Keep at most one front, back, left, and right mockup (cap 3)."""
    ranked = sorted(
        [v for v in views if isinstance(v, dict)],
        key=lambda v: _view_rank(v.get("title") or "", v.get("url") or ""),
    )
    by_bucket: Dict[str, Dict[str, str]] = {}
    others: List[Dict[str, str]] = []
    for view in ranked:
        url = str(view.get("url") or "").strip()
        if not url:
            continue
        bucket = _view_bucket(view.get("title") or "", url)
        if bucket == "skip":
            continue
        if bucket == "other":
            others.append(view)
            continue
        by_bucket.setdefault(bucket, view)
    ordered: List[Dict[str, str]] = []
    for bucket in ("front", "back", "left", "right"):
        if len(ordered) >= 3:
            break
        if bucket in by_bucket:
            ordered.append(by_bucket[bucket])
    for extra in others:
        if len(ordered) >= 3:
            break
        extra_url = str(extra.get("url") or "")
        if any(row.get("url") == extra_url for row in ordered):
            continue
        ordered.append(extra)
    return ordered


def collect_mockup_views(result: Any) -> List[Dict[str, str]]:
    """Primary + extra Printful camera angles, ranked so the wrap is easier to see."""
    views: List[Dict[str, str]] = []
    seen = set()

    def add(url: Any, title: Any = "") -> None:
        u = str(url or "").strip()
        if not is_public_https_url(u) or u in seen:
            return
        seen.add(u)
        label = str(title or "").strip() or _title_from_mockup_url(u)
        views.append({"url": u, "title": label})

    if not isinstance(result, dict):
        return []
    mockups = result.get("mockups")
    if not isinstance(mockups, list):
        return []
    for row in mockups:
        if not isinstance(row, dict):
            continue
        add(row.get("mockup_url") or row.get("url"), row.get("title") or row.get("placement") or "")
        extra = row.get("extra") or row.get("extra_mockups") or []
        if not isinstance(extra, list):
            continue
        for item in extra:
            if not isinstance(item, dict):
                continue
            add(item.get("url") or item.get("mockup_url"), item.get("title") or item.get("option") or "")
    views.sort(key=lambda v: _view_rank(v.get("title") or "", v.get("url") or ""))
    return unique_angle_views(views)


def pick_mockup_url(result: Any) -> Optional[str]:
    views = collect_mockup_views(result)
    return views[0]["url"] if views else None


def _merge_mockup_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    views: List[Dict[str, str]] = []
    seen = set()
    task_key = ""
    last_error = ""
    pending = False
    for polled in results:
        if not isinstance(polled, dict):
            continue
        if polled.get("pending"):
            pending = True
            task_key = task_key or str(polled.get("task_key") or "")
        if polled.get("error"):
            last_error = str(polled.get("error"))
        task_key = task_key or str(polled.get("task_key") or "")
        for row in polled.get("mockup_urls") or []:
            if not isinstance(row, dict):
                continue
            url = str(row.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            views.append({
                "url": url,
                "title": str(row.get("title") or "View").strip() or "View",
            })
        url = str(polled.get("mockup_url") or "").strip()
        if url and url not in seen:
            seen.add(url)
            views.append({"url": url, "title": _title_from_mockup_url(url)})
    views.sort(key=lambda v: _view_rank(v.get("title") or "", v.get("url") or ""))
    views = unique_angle_views(views)
    if views:
        return {
            "success": True,
            "mockup_url": views[0]["url"],
            "mockup_urls": views,
            "task_key": task_key,
            "pending": False,
        }
    if pending and task_key:
        return {"success": True, "pending": True, "task_key": task_key}
    return {"success": False, "error": last_error or "Printful returned no wrap mockup"}


def create_mockup_task(
    catalog_id: int,
    variant_id: int,
    image_url: str,
    api_key: str,
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    extra_payload: Optional[Dict[str, Any]] = None,
    prepared_printfile: bool = False,
    image_orientation: str = "",
) -> str:
    placement, area_w, area_h = print_area_for_variant(catalog_id, variant_id, api_key)
    if prepared_printfile:
        position = cover_in_print_area(area_w, area_h, image_width, image_height)
    else:
        position = artwork_position_for_catalog(
            catalog_id,
            area_w,
            area_h,
            image_width,
            image_height,
            orientation=image_orientation,
        )
    payload: Dict[str, Any] = {
        "variant_ids": [int(variant_id)],
        "format": "jpg",
        "files": [
            {
                "placement": placement,
                "image_url": image_url,
                "position": position,
            }
        ],
    }
    extra_payload = extra_payload or {}
    payload.update(extra_payload)
    r = None
    body: Dict[str, Any] = {}
    for attempt in range(2):
        r = requests.post(
            f"{PRINTFUL_API_BASE}/mockup-generator/create-task/{int(catalog_id)}",
            headers=printful_request_headers(api_key, json_body=True),
            json=payload,
            timeout=30,
        )
        if r.status_code == 400 and extra_payload:
            payload.pop("option_groups", None)
            payload.pop("options", None)
            extra_payload = {}
            r = requests.post(
                f"{PRINTFUL_API_BASE}/mockup-generator/create-task/{int(catalog_id)}",
                headers=printful_request_headers(api_key, json_body=True),
                json=payload,
                timeout=30,
            )
        body = r.json() if r.content else {}
        if r.status_code != 429:
            break
        logger.warning(
            "Printful create-task 429 catalog_id=%s wait=12s attempt=%s",
            catalog_id,
            attempt + 1,
        )
        time.sleep(12)
    if r is None or r.status_code not in (200, 201):
        logger.warning(
            "Printful create-task failed catalog_id=%s variant=%s status=%s body=%s",
            catalog_id,
            variant_id,
            r.status_code,
            str(body)[:400],
        )
        raise RuntimeError("Printful could not start the wrap mockup")
    result = body.get("result") if isinstance(body, dict) else None
    task_key = ""
    if isinstance(result, dict):
        task_key = str(result.get("task_key") or result.get("id") or "").strip()
    if not task_key:
        raise RuntimeError("Printful mockup task key missing")
    return task_key


def mockup_task_payloads(catalog_id: int) -> List[Optional[Dict[str, Any]]]:
    """Default extras plus named Front/Back or Front/Left/Right when Printful lists those options."""
    cid = int(catalog_id)
    mug_options = MUG_ANGLE_OPTIONS_BY_CATALOG.get(cid)
    if mug_options:
        return [{}, {"options": list(mug_options)}]
    bag_options = BAG_ANGLE_OPTIONS_BY_CATALOG.get(cid)
    if bag_options:
        named = {"options": list(bag_options)}
        if len(bag_options) <= 1:
            return [named]
        return [{}, named]
    pet_options = PET_ANGLE_OPTIONS_BY_CATALOG.get(cid)
    if pet_options:
        named = {"options": list(pet_options)}
        if len(pet_options) <= 1:
            return [named]
        return [{}, named]
    accessory_options = ACCESSORY_ANGLE_OPTIONS_BY_CATALOG.get(cid)
    if accessory_options:
        named = {"options": list(accessory_options)}
        if len(accessory_options) <= 1:
            return [named]
        return [{}, named]
    return [{}, {"option_groups": ["Flat"]}]


def poll_mockup_task(task_key: str, api_key: str, *, wait: bool = True) -> Dict[str, Any]:
    key = str(task_key or "").strip()
    if not key:
        return {"success": False, "error": "task_key is required"}
    attempts = POLL_MAX_ATTEMPTS if wait else 1
    last_status = "pending"
    for i in range(attempts):
        if i:
            time.sleep(POLL_INTERVAL_SEC)
        r = requests.get(
            f"{PRINTFUL_API_BASE}/mockup-generator/task",
            headers=printful_request_headers(api_key),
            params={"task_key": key},
            timeout=25,
        )
        body = r.json() if r.content else {}
        result = body.get("result") if isinstance(body, dict) else None
        if r.status_code != 200 or not isinstance(result, dict):
            last_status = "error"
            if not wait:
                break
            continue
        last_status = str(result.get("status") or "").lower()
        if last_status in ("completed", "complete", "done"):
            views = collect_mockup_views(result)
            if views:
                return {
                    "success": True,
                    "mockup_url": views[0]["url"],
                    "mockup_urls": views,
                    "task_key": key,
                    "pending": False,
                }
            return {"success": False, "error": "Printful returned no wrap mockup", "task_key": key}
        if last_status in ("failed", "failure", "error"):
            err = result.get("error") or result.get("message") or "Printful mockup failed"
            return {"success": False, "error": str(err), "task_key": key}
    return {
        "success": True,
        "pending": True,
        "task_key": key,
        "status": last_status or "pending",
    }


def poll_existing_mug_task(task_key: str) -> Dict[str, Any]:
    api_key = _api_key()
    if not api_key:
        return {"success": False, "error": "PRINTFUL_API_KEY is not configured"}
    return poll_mockup_task(str(task_key or "").strip(), api_key, wait=False)


def generate_mug_mockup(
    product_name: str,
    color: str,
    size: str,
    image: str,
    *,
    image_width: Optional[int] = None,
    image_height: Optional[int] = None,
    back_image: str = "",
    image_orientation: str = "",
    wait: bool = True,
) -> Dict[str, Any]:
    api_key = _api_key()
    if not api_key:
        return {"success": False, "error": "PRINTFUL_API_KEY is not configured"}
    catalog_id = resolve_wrap_catalog_id(product_name)
    if not catalog_id:
        return {"success": False, "error": "Not a Printful wrap product"}
    variant_id = resolve_mug_variant_id(catalog_id, color, size)
    if not variant_id:
        return {"success": False, "error": "Could not match this product color and size"}
    src = str(image or "").strip()
    if not src:
        return {"success": False, "error": "image is required"}
    back_src = str(back_image or "").strip()
    iw = int(image_width or 0)
    ih = int(image_height or 0)
    if iw < 1 or ih < 1:
        blob = None
        if src.startswith("data:image"):
            try:
                blob, _ = _decode_data_url(src)
            except Exception:
                blob = None
        probed_w, probed_h = image_pixel_size(src, blob)
        if probed_w > 0 and probed_h > 0:
            iw, ih = probed_w, probed_h
    key = cache_key_for(catalog_id, variant_id, src, back_src, image_orientation)
    hosted_key = key
    cached = _cache_get(key)
    if cached:
        return {
            "success": True,
            "mockup_url": cached.get("mockup_url"),
            "mockup_urls": cached.get("mockup_urls") or [],
            "printfile_url": cached.get("printfile_url") or "",
            "pending": False,
            "cached": True,
        }
    prepared_printfile = False
    printfile_url = ""
    try:
        image_url = public_image_url_for_printful(src, api_key)
        if int(catalog_id) == TOTE_WRAP_CATALOG_ID:
            _placement, area_w, area_h = print_area_for_variant(catalog_id, variant_id, api_key)
            prepared = prepare_tote_wrap_printfile(
                image_url, back_src, area_w, area_h, api_key
            )
            if prepared:
                image_url, iw, ih = prepared
                prepared_printfile = True
                printfile_url = image_url
        hosted_key = cache_key_for(catalog_id, variant_id, image_url, back_src, image_orientation)
        if hosted_key != key:
            cached_hosted = _cache_get(hosted_key)
            if cached_hosted:
                _cache_put(key, cached_hosted)
                return {
                    "success": True,
                    "mockup_url": cached_hosted.get("mockup_url"),
                    "mockup_urls": cached_hosted.get("mockup_urls") or [],
                    "printfile_url": cached_hosted.get("printfile_url") or printfile_url,
                    "pending": False,
                    "cached": True,
                }

        def run_task(extra_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
            try:
                task_key = create_mockup_task(
                    catalog_id,
                    variant_id,
                    image_url,
                    api_key,
                    image_width=iw or None,
                    image_height=ih or None,
                    extra_payload=extra_payload,
                    prepared_printfile=prepared_printfile,
                    image_orientation=image_orientation,
                )
                return poll_mockup_task(task_key, api_key, wait=wait)
            except Exception as e:
                logger.warning("Wrap mockup task failed extra=%s: %s", extra_payload, e)
                return {"success": False, "error": "Could not start wrap mockup"}

        if wait:
            extras = mockup_task_payloads(catalog_id)
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(run_task, extras))
        else:
            results = [run_task({})]
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.warning("Wrap mockup start failed: %s", e)
        return {"success": False, "error": "Could not start wrap mockup"}
    polled = _merge_mockup_results(results)
    url = polled.get("mockup_url")
    views = polled.get("mockup_urls") or []
    if url:
        payload = {"mockup_url": url, "mockup_urls": views}
        if printfile_url:
            payload["printfile_url"] = printfile_url
        _cache_put(key, payload)
        if hosted_key != key:
            _cache_put(hosted_key, payload)
    if printfile_url:
        polled["printfile_url"] = printfile_url
    return polled
