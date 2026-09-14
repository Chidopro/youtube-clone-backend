"""Printful catalog stock by selling region, keyed for storefront ship-to countries."""
from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import requests

logger = logging.getLogger(__name__)

# Storefront ISO country -> Printful selling_region_name values to accept (first match wins).
# Do not inherit a nearby region's stock: that is what listed US-only 5XL in Canada
# and Europe-only sizes in the UK. Ireland has no Printful region of its own, so it
# uses Europe. Germany prefers germany, then Europe (v1 often emits EU, not DE).
SHIP_TO_REGION_CANDIDATES: Dict[str, tuple[str, ...]] = {
    "US": ("north_america", "usa", "worldwide"),
    "CA": ("canada",),
    "GB": ("uk",),
    "IE": ("europe",),
    "DE": ("germany", "europe"),
    "AU": ("australia",),
}

# Extra Printful blank cost vs US (pricing). Stock filtering uses LIVE_STOCK_COUNTRIES.
REGIONAL_FILTER_COUNTRIES = ("CA", "GB", "IE", "AU", "DE")
# Ship-to countries that get a live Printful availability matrix (including US).
LIVE_STOCK_COUNTRIES = ("US", "CA", "GB", "IE", "AU", "DE")

# Blank/production price region (what Printful charges to fulfill into that country).
# GB/DE use europe first — UK dashboard checkout fulfills in Europe, not a separate UK blank rate.
SHIP_TO_PRICE_REGION: Dict[str, tuple[str, ...]] = {
    "US": ("north_america", "usa"),
    "CA": ("canada", "north_america"),
    "GB": ("europe", "uk"),
    "IE": ("europe",),
    "DE": ("europe", "germany"),
    "AU": ("australia",),
}

_IN_STOCK = frozenset({
    "in stock",
    "in_stock",
    "stocked",
    "stocked on demand",
    "available",
})

# All-over-print / cut-sew catalog IDs — do not force DTG stock.
_AOP_CATALOG_PRODUCT_IDS = frozenset({
    262, 274, 394, 568, 611, 630, 678, 682, 744, 894, 902, 906,
})

_CACHE_TTL_SEC = 6 * 3600
_stock_lock = threading.Lock()
# catalog_product_id -> (expires_at, {variant_id: {region, ...}})
_stock_cache: Dict[int, tuple[float, Dict[int, Set[str]]]] = {}

_price_lock = threading.Lock()
# (catalog_product_id, selling_region_name) -> (expires_at, min_blank_usd | None)
_price_cache: Dict[Tuple[int, str], Tuple[float, Optional[float]]] = {}

# Live /shipping/rates probe when add-to-cart checks a non-US destination.
AVAILABILITY_PROBE_RECIPIENTS: Dict[str, Dict[str, str]] = {
    "US": {"country_code": "US", "zip": "10001", "state_code": "NY", "city": "New York"},
    "CA": {"country_code": "CA", "zip": "M5V 2T6", "state_code": "ON", "city": "Toronto"},
    "GB": {"country_code": "GB", "zip": "SW1A 1AA", "city": "London"},
    "IE": {"country_code": "IE", "zip": "D02 AF30", "city": "Dublin"},
    "DE": {"country_code": "DE", "zip": "10115", "city": "Berlin"},
    "AU": {"country_code": "AU", "zip": "2000", "state_code": "NSW", "city": "Sydney"},
}


def normalize_ship_to_country(code: str) -> str:
    c = str(code or "").strip().upper()
    return c if c in SHIP_TO_REGION_CANDIDATES else "US"


def probe_recipient_for_country(code: str) -> Dict[str, str]:
    country = normalize_ship_to_country(code)
    return dict(AVAILABILITY_PROBE_RECIPIENTS.get(country) or AVAILABILITY_PROBE_RECIPIENTS["US"])


def au_state_code_from_postcode(postal_code: str) -> str:
    """Map an Australian postcode to Printful ``state_code`` (NSW, VIC, …)."""
    digits = "".join(ch for ch in str(postal_code or "") if ch.isdigit())
    if len(digits) < 3:
        return ""
    n = int(digits[:4]) if len(digits) >= 4 else int(digits)
    if 800 <= n <= 999:
        return "NT"
    if 200 <= n <= 299 or 2600 <= n <= 2618 or 2900 <= n <= 2920:
        return "ACT"
    if 1000 <= n <= 1999 or 2000 <= n <= 2599 or 2619 <= n <= 2899 or 2921 <= n <= 2999:
        return "NSW"
    if 3000 <= n <= 3999 or 8000 <= n <= 8999:
        return "VIC"
    if 4000 <= n <= 4999 or 9000 <= n <= 9999:
        return "QLD"
    if 5000 <= n <= 5999:
        return "SA"
    if 6000 <= n <= 6999:
        return "WA"
    if 7000 <= n <= 7999:
        return "TAS"
    return ""


def _region_is_in_stock(availability: Any) -> bool:
    return str(availability or "").strip().lower() in _IN_STOCK


def _technique_key(tech: Dict[str, Any]) -> str:
    for field in ("technique", "technique_key", "key", "name"):
        raw = tech.get(field)
        if raw:
            return str(raw).strip().lower()
    return ""


def preferred_stock_techniques(catalog_product_id: int) -> Optional[Tuple[str, ...]]:
    """
    Print method ScreenMerch actually fulfills for this catalog product.

    T-shirts/hoodies are DTG. Hats are embroidery. Mugs are sublimation.
    AOP/cut-sew catalogs return None so any in-stock technique counts.
    """
    cid = int(catalog_product_id)
    if cid in (100, 140, 396):
        return ("embroidery",)
    if cid in (19, 403, 407, 663):
        return ("sublimation",)
    if cid in _AOP_CATALOG_PRODUCT_IDS:
        return None
    return ("dtg",)


def _technique_is_preferred(tech: Dict[str, Any], preferred: Set[str]) -> bool:
    key = _technique_key(tech)
    if not key:
        return False
    return any(p == key or p in key or key in p for p in preferred)


def regions_in_stock_from_availability_item(
    item: Dict[str, Any],
    preferred_techniques: Optional[Iterable[str]] = None,
) -> Set[str]:
    """Collect Printful selling-region names in stock for the fulfillment technique we use."""
    techs = [t for t in (item.get("techniques") or []) if isinstance(t, dict)]
    preferred = {str(t).strip().lower() for t in (preferred_techniques or []) if t}
    if preferred:
        matched = [t for t in techs if _technique_is_preferred(t, preferred)]
        # Do not fall back to embroidery/other methods when DTG (etc.) is listed OOS.
        techs = matched
    found: Set[str] = set()
    for tech in techs:
        for region in tech.get("selling_regions") or []:
            if not isinstance(region, dict):
                continue
            if not _region_is_in_stock(region.get("availability")):
                continue
            name = str(region.get("name") or "").strip().lower()
            if name:
                found.add(name)
    return found


# Printful v1 GET /products/{id} availability_status.region -> v2 selling_region_name.
_V1_STATUS_REGION_TO_SELLING: Dict[str, str] = {
    "US": "usa",
    "CA": "canada",
    "AU": "australia",
    "UK": "uk",
    "GB": "uk",
    "EU": "europe",
    "EU_LV": "europe",
    "EU_ES": "europe",
    "EU_DE": "europe",
    "EU_IT": "europe",
    "EU_FR": "europe",
    "EU_IE": "europe",
    "DE": "germany",
    "FR": "europe",
    "IE": "europe",
    "MX": "north_america",
    "JP": "japan",
    "NZ": "new_zealand",
    "BR": "brazil",
}


def regions_in_stock_from_v1_variant(variant: Dict[str, Any]) -> Set[str]:
    """Map Printful v1 availability_status rows to selling-region names."""
    found: Set[str] = set()
    rows = variant.get("availability_status")
    if not isinstance(rows, list):
        return found
    for row in rows:
        if not isinstance(row, dict):
            continue
        status = str(row.get("status") or "").strip().lower().replace("-", "_")
        if status not in _IN_STOCK and status != "in_stock":
            continue
        region = str(row.get("region") or "").strip().upper()
        mapped = _V1_STATUS_REGION_TO_SELLING.get(region)
        if mapped:
            found.add(mapped)
    return found


def variant_available_for_country(stocked_regions: Optional[Iterable[str]], country: str) -> bool:
    """
    True if this variant can ship to ``country``.

    Unknown / missing stock rows fail open so a catalog gap does not empty the store.
    """
    if stocked_regions is None:
        return True
    regions = {str(r).strip().lower() for r in stocked_regions if r}
    if not regions:
        return False
    country = normalize_ship_to_country(country)
    for candidate in SHIP_TO_REGION_CANDIDATES.get(country, ()):
        if candidate in regions:
            return True
    return False


def _fetch_catalog_region_stock_v1(catalog_product_id: int, headers: Dict[str, str]) -> Tuple[Dict[int, Set[str]], bool]:
    """
    One-request stock map from Printful v1 GET /products/{id}.

    This is the same availability_status grid Printful's catalog Availability tab uses
    (e.g. Black 5XL not listed for AU, Black 4XL listed).
    """
    try:
        r = requests.get(
            f"https://api.printful.com/products/{int(catalog_product_id)}",
            headers=headers,
            timeout=60,
        )
    except Exception as e:
        logger.warning("Printful v1 products/%s request failed: %s", catalog_product_id, e)
        return {}, False
    if r.status_code != 200:
        logger.warning(
            "Printful v1 products/%s status=%s body=%s",
            catalog_product_id,
            r.status_code,
            (r.text or "")[:400],
        )
        return {}, False
    try:
        body = r.json()
    except Exception:
        return {}, False
    variants = (body.get("result") or {}).get("variants")
    if not isinstance(variants, list) or not variants:
        return {}, False
    out: Dict[int, Set[str]] = {}
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        vid = variant.get("id")
        try:
            vid_int = int(vid)
        except (TypeError, ValueError):
            continue
        out[vid_int] = regions_in_stock_from_v1_variant(variant)
    return out, True


def _fetch_catalog_region_stock(catalog_product_id: int) -> Tuple[Dict[int, Set[str]], bool]:
    """
    Return (stock_map, complete).

    complete is False if a page failed so the map may be missing variants.
    Variants with no in-stock region are stored as an empty set.
    """
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        return {}, False

    from printful_catalog import printful_request_headers

    headers = printful_request_headers(api_key)
    v1_stock, v1_ok = _fetch_catalog_region_stock_v1(int(catalog_product_id), headers)
    if v1_ok and v1_stock:
        names = sorted({n for regions in v1_stock.values() for n in regions})
        logger.info(
            "Printful v1 region stock catalog_product_id=%s variants=%s regions=%s",
            catalog_product_id,
            len(v1_stock),
            names,
        )
        return v1_stock, True

    out: Dict[int, Set[str]] = {}
    offset = 0
    limit = 100
    complete = False
    preferred = preferred_stock_techniques(int(catalog_product_id))
    params: Dict[str, Any] = {"selling_region_name": "all", "limit": limit, "offset": offset}
    if preferred and len(preferred) == 1:
        params["techniques"] = preferred[0]

    while True:
        url = f"https://api.printful.com/v2/catalog-products/{catalog_product_id}/availability"
        r = None
        params["offset"] = offset
        for attempt in range(3):
            try:
                r = requests.get(
                    url,
                    headers=headers,
                    params=params,
                    timeout=60,
                )
            except Exception as e:
                logger.warning("Printful availability request failed catalog_product_id=%s: %s", catalog_product_id, e)
                return out, False
            if r.status_code != 429:
                break
            wait_s = min(8, 1.5 * (attempt + 1))
            logger.warning(
                "Printful availability rate-limited catalog_product_id=%s offset=%s; retry in %.1ss",
                catalog_product_id,
                offset,
                wait_s,
            )
            time.sleep(wait_s)
        if r is None or r.status_code != 200:
            logger.warning(
                "Printful availability failed catalog_product_id=%s status=%s body=%s",
                catalog_product_id,
                getattr(r, "status_code", None),
                ((r.text or "")[:400] if r is not None else ""),
            )
            return out, False
        try:
            body = r.json()
        except Exception:
            return out, False
        data = body.get("data") or []
        if not data:
            complete = True
            break
        for item in data:
            if not isinstance(item, dict):
                continue
            vid = item.get("catalog_variant_id")
            if vid is None:
                vid = item.get("id")
            try:
                vid_int = int(vid)
            except (TypeError, ValueError):
                continue
            out[vid_int] = regions_in_stock_from_availability_item(item, preferred)
        offset += limit
        paging = body.get("paging") or {}
        total = paging.get("total")
        if total is not None and offset >= int(total):
            complete = True
            break
        if len(data) < limit:
            complete = True
            break

    return out, complete


def _cached_stock_row(cid: int) -> Optional[Tuple[Dict[int, Set[str]], bool]]:
    now = time.time()
    with _stock_lock:
        cached = _stock_cache.get(cid)
        if cached and cached[0] > now:
            stock = cached[1]
            complete = bool(cached[2]) if len(cached) > 2 else True
            return stock, complete
    return None


def variant_region_stock_cached(catalog_product_id: int) -> bool:
    return _cached_stock_row(int(catalog_product_id)) is not None


def get_variant_region_stock(catalog_product_id: int, fetch: bool = True) -> Dict[int, Set[str]]:
    row = get_variant_region_stock_meta(catalog_product_id, fetch=fetch)
    return row[0]


def get_variant_region_stock_meta(
    catalog_product_id: int,
    fetch: bool = True,
) -> Tuple[Dict[int, Set[str]], bool]:
    cid = int(catalog_product_id)
    cached = _cached_stock_row(cid)
    if cached is not None:
        return cached
    if not fetch:
        return {}, False
    stock, complete = _fetch_catalog_region_stock(cid)
    if stock:
        names = sorted({n for regions in stock.values() for n in regions})
        logger.info(
            "Printful region stock catalog_product_id=%s variants=%s complete=%s regions=%s",
            cid,
            len(stock),
            complete,
            names,
        )
    ttl = _CACHE_TTL_SEC if complete else 45
    if complete or stock:
        with _stock_lock:
            _stock_cache[cid] = (time.time() + ttl, stock, complete)
    return stock, complete


def prefetch_variant_region_stock(catalog_product_id: int) -> None:
    try:
        get_variant_region_stock(int(catalog_product_id))
    except Exception as e:
        logger.warning("Prefetch region stock %s: %s", catalog_product_id, e)


def _float_price(raw: Any) -> Optional[float]:
    try:
        val = float(raw)
    except (TypeError, ValueError):
        return None
    if val <= 0:
        return None
    return val


_PREFERRED_TECHNIQUE_KEYS = ("dtg", "digital", "sublimation", "embroidery", "dtfilm")


def min_blank_price_from_catalog_prices(payload: Any) -> Optional[float]:
    """Cheapest variant price, preferring DTG (ScreenMerch apparel) over other techniques."""
    if not isinstance(payload, dict):
        return None
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    by_tech: Dict[str, List[float]] = {}
    variants = data.get("variants") if isinstance(data, dict) else None
    if not isinstance(variants, list) and isinstance(data, list):
        variants = data
    for v in variants or []:
        if not isinstance(v, dict):
            continue
        for tech in v.get("techniques") or []:
            if not isinstance(tech, dict):
                continue
            val = _float_price(tech.get("price"))
            if val is None:
                val = _float_price(tech.get("discounted_price"))
            if val is None:
                continue
            key = str(tech.get("technique_key") or "").strip().lower() or "_"
            by_tech.setdefault(key, []).append(val)
    for preferred in _PREFERRED_TECHNIQUE_KEYS:
        if preferred in by_tech:
            return min(by_tech[preferred])
    found = [p for prices in by_tech.values() for p in prices]
    if found:
        return min(found)
    product = data.get("product") if isinstance(data, dict) else {}
    placement_prices: List[float] = []
    for placement in (product or {}).get("placements") or []:
        if not isinstance(placement, dict):
            continue
        val = _float_price(placement.get("price"))
        if val is None:
            val = _float_price(placement.get("discounted_price"))
        if val is not None:
            placement_prices.append(val)
    return min(placement_prices) if placement_prices else None


def _fetch_catalog_region_blank_price(catalog_product_id: int, selling_region_name: str) -> Optional[float]:
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        return None

    from printful_catalog import printful_request_headers

    headers = printful_request_headers(api_key)
    offset = 0
    limit = 100
    cheapest: Optional[float] = None
    url = f"https://api.printful.com/v2/catalog-products/{catalog_product_id}/prices"

    while True:
        try:
            r = requests.get(
                url,
                headers=headers,
                params={
                    "selling_region_name": selling_region_name,
                    "currency": "USD",
                    "limit": limit,
                    "offset": offset,
                },
                timeout=60,
            )
        except Exception as e:
            logger.warning(
                "Printful prices request failed catalog_product_id=%s region=%s: %s",
                catalog_product_id,
                selling_region_name,
                e,
            )
            break
        if r.status_code != 200:
            logger.warning(
                "Printful prices failed catalog_product_id=%s region=%s status=%s body=%s",
                catalog_product_id,
                selling_region_name,
                r.status_code,
                (r.text or "")[:400],
            )
            break
        try:
            body = r.json()
        except Exception:
            break
        page_min = min_blank_price_from_catalog_prices(body)
        if page_min is not None:
            cheapest = page_min if cheapest is None else min(cheapest, page_min)
        paging = body.get("paging") or {}
        data = body.get("data") or {}
        variants = data.get("variants") if isinstance(data, dict) else []
        total = paging.get("total")
        offset += limit
        if total is not None and offset >= int(total):
            break
        if not variants or len(variants) < limit:
            break

    return cheapest


def get_selling_region_blank_cost(
    catalog_product_id: int,
    selling_region_name: str,
    fetch: bool = True,
) -> Optional[float]:
    cid = int(catalog_product_id)
    region = str(selling_region_name or "").strip().lower()
    if not region:
        return None
    key = (cid, region)
    now = time.time()
    with _price_lock:
        cached = _price_cache.get(key)
        if cached and cached[0] > now:
            return cached[1]
    if not fetch:
        return None
    cost = _fetch_catalog_region_blank_price(cid, region)
    if cost is not None:
        logger.info("Printful blank cost catalog_product_id=%s region=%s usd=%s", cid, region, cost)
    with _price_lock:
        _price_cache[key] = (now + _CACHE_TTL_SEC, cost)
    return cost


def get_region_blank_cost(catalog_product_id: int, country: str, fetch: bool = True) -> Optional[float]:
    """Printful blank/production USD for fulfilling this catalog product into ``country``."""
    country = normalize_ship_to_country(country)
    for region in SHIP_TO_PRICE_REGION.get(country, ()):
        cost = get_selling_region_blank_cost(catalog_product_id, region, fetch=fetch)
        if cost is not None:
            return cost
    return None


def build_regional_base_prices(
    us_retail: float,
    catalog_product_id: int,
    fetch: bool = True,
) -> Dict[str, float]:
    """
    Storefront sticker prices by ship-to country.

    Keep the US catalog price as the base, then add any extra Printful blank cost
    for CA / GB / IE / AU / DE. Never discount below the US retail.
    """
    retail = round(float(us_retail or 0), 2)
    out: Dict[str, float] = {code: retail for code in SHIP_TO_REGION_CANDIDATES}
    us_cost = get_region_blank_cost(catalog_product_id, "US", fetch=fetch)
    if us_cost is None:
        return {} if not fetch else out
    for country in REGIONAL_FILTER_COUNTRIES:
        cost = get_region_blank_cost(catalog_product_id, country, fetch=fetch)
        if cost is None:
            continue
        delta = round(max(0.0, cost - us_cost), 2)
        out[country] = round(retail + delta, 2)
    return out


def prefetch_region_blank_costs(catalog_product_id: int) -> None:
    try:
        cid = int(catalog_product_id)
        seen = set()
        for regions in SHIP_TO_PRICE_REGION.values():
            for region in regions:
                if region in seen:
                    continue
                seen.add(region)
                get_selling_region_blank_cost(cid, region)
    except Exception as e:
        logger.warning("Prefetch region prices %s: %s", catalog_product_id, e)
