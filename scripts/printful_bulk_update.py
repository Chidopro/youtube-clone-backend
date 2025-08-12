"""
Bulk updater for syncing Printful availability and bumping prices by a fixed amount.

- Reads all products from the Printful Store (sync products)
- For each product, collects available size/color combinations
- Updates frontend `frontend/src/data/products.js` entries by:
  - Replacing the `variables` availability matrix to match Printful
  - Adding a fixed dollar amount to `price`
- Optionally updates backend `PRODUCTS` prices (+amount) for display/checkout

Requirements:
  - Set environment variable PRINTFUL_API_KEY
  - Run from repository root:  python scripts/printful_bulk_update.py --price-bump 10

Safeguards:
  - Only edits the two files above
  - Creates a timestamped backup of each file before editing
  - Does not touch any CORS code or other modules
"""

from __future__ import annotations

import os
import re
import json
import time
import argparse
from collections import defaultdict
from typing import Dict, List, Tuple

import requests


PRINTFUL_BASE_URL = "https://api.printful.com"


def slug_product_key(product_name: str) -> str:
    """Derive the key used in products.js for a product name.
    Empirically the file uses lowercased names with spaces removed (apostrophes often kept).
    We will search by the product's "name" field instead of relying on slug alone.
    """
    return (
        product_name.strip().lower().replace(" ", "")
    )


def fetch_store_products(api_key: str) -> List[Dict]:
    products = []
    limit = 100
    offset = 0
    headers = {"Authorization": f"Bearer {api_key}"}
    while True:
        resp = requests.get(
            f"{PRINTFUL_BASE_URL}/store/products?limit={limit}&offset={offset}", headers=headers
        )
        resp.raise_for_status()
        data = resp.json()["result"]
        products.extend(data)
        if len(data) < limit:
            break
        offset += limit
    return products


def fetch_variant_details(api_key: str, variant_id: int) -> Dict:
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(f"{PRINTFUL_BASE_URL}/products/variant/{variant_id}", headers=headers)
    resp.raise_for_status()
    return resp.json()["result"]


def build_availability_for_product(api_key: str, sync_product_id: int) -> Tuple[List[str], List[str], Dict[str, Dict[str, bool]]]:
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(f"{PRINTFUL_BASE_URL}/store/products/{sync_product_id}", headers=headers)
    resp.raise_for_status()
    result = resp.json()["result"]
    sync_variants = result.get("sync_variants", [])

    # Aggregate
    size_to_colors: Dict[str, set] = defaultdict(set)
    all_colors: set = set()

    for sv in sync_variants:
        variant_id = sv.get("variant_id")
        if not variant_id:
            continue
        details = fetch_variant_details(api_key, variant_id)
        size = details.get("size") or details.get("options", {}).get("size")
        color = details.get("color") or details.get("options", {}).get("color")
        if not size or not color:
            # Fallback: parse from name if options missing, e.g., "Black / XL"
            name = details.get("name", "")
            if "/" in name:
                parts = [p.strip() for p in name.split("/")]
                if len(parts) >= 2:
                    color = color or parts[0]
                    size = size or parts[1]
        if size and color:
            size_to_colors[size].add(color)
            all_colors.add(color)

    # Ordering for sizes
    size_order = [
        "2XS",
        "XS",
        "S",
        "M",
        "L",
        "XL",
        "2XL",
        "XXL",
        "3XL",
        "XXXL",
        "4XL",
        "XXXXL",
        "5XL",
        "XXXXXL",
    ]

    # Normalize size keys to the forms used in the frontend (e.g., XXL not 2XL if necessary)
    def normalize_size(sz: str) -> str:
        mapping = {
            "2XS": "XXS",
            "2XL": "XXL",
            "3XL": "XXXL",
            "4XL": "XXXXL",
            "5XL": "XXXXXL",
        }
        return mapping.get(sz.upper(), sz.upper())

    sizes_sorted = []
    seen = set()
    for sz in size_order:
        norm = normalize_size(sz)
        if sz in size_to_colors or norm in size_to_colors:
            if norm not in seen:
                sizes_sorted.append(norm)
                seen.add(norm)
    # Also include any sizes not in size_order
    for sz in list(size_to_colors.keys()):
        norm = normalize_size(sz)
        if norm not in seen:
            sizes_sorted.append(norm)

    colors_sorted = sorted(all_colors)

    availability: Dict[str, Dict[str, bool]] = {}
    for sz_key, colors in size_to_colors.items():
        norm = normalize_size(sz_key)
        availability[norm] = {c: True for c in colors}

    return sizes_sorted, colors_sorted, availability


def backup_file(path: str) -> None:
    ts = time.strftime("%Y%m%d_%H%M%S")
    backup_path = f"{path}.{ts}.bak"
    with open(path, "rb") as fsrc, open(backup_path, "wb") as fdst:
        fdst.write(fsrc.read())


def add_price_bump_in_products_js(contents: str, product_name: str, bump: float) -> str:
    # Find the block containing this product by name
    name_pattern = re.escape(f'"name": "{product_name}"')
    match = re.search(name_pattern, contents)
    if not match:
        return contents
    # Search backward a bit to find the start of the enclosing object
    start_idx = contents.rfind("{", 0, match.start())
    end_idx = contents.find("}\n", match.end())
    if start_idx == -1 or end_idx == -1:
        return contents
    block = contents[start_idx:end_idx]

    # Replace price
    price_match = re.search(r'"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)', block)
    if price_match:
        old_price = float(price_match.group(1))
        new_price = round(old_price + bump, 2)
        block = (
            block[: price_match.start(1)] + f"{new_price}" + block[price_match.end(1) :]
        )

    # Put the block back
    return contents[:start_idx] + block + contents[end_idx:]


def upsert_variables_in_products_js(
    contents: str,
    product_name: str,
    sizes: List[str],
    colors: List[str],
    availability: Dict[str, Dict[str, bool]],
) -> str:
    # Locate by name
    name_pattern = re.escape(f'"name": "{product_name}"')
    name_match = re.search(name_pattern, contents)
    if not name_match:
        return contents

    # Find the "variables": { ... } block boundaries within the product object
    # Heuristic: search forward from name for '"variables": {' and then match braces.
    var_start = contents.find('"variables": {', name_match.end())
    if var_start == -1:
        return contents

    # Brace matching to find the end of the variables object
    brace_count = 0
    i = var_start
    while i < len(contents):
        if contents[i] == '{':
            brace_count += 1
        elif contents[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                var_end = i + 1
                break
        i += 1
    else:
        return contents

    # Construct the new variables block JSON-ish string (keep JS formatting simple)
    variables_obj = {
        "sizes": sizes,
        "colors": colors,
        "availability": availability,
    }
    # Pretty-print with sorted keys false to retain order
    new_block = '"variables": ' + json.dumps(variables_obj, indent=2, ensure_ascii=False)

    updated = contents[:var_start] + new_block + contents[var_end:]
    return updated


def update_frontend_products_js(api_key: str, price_bump: float) -> None:
    path = os.path.join("frontend", "src", "data", "products.js")
    backup_file(path)
    with open(path, "r", encoding="utf-8") as f:
        contents = f.read()

    store_products = fetch_store_products(api_key)

    # Iterate and update each product found in the frontend file
    for sp in store_products:
        product_name = sp.get("name")
        sync_product_id = sp.get("id")
        if not product_name or not sync_product_id:
            continue
        try:
            sizes, colors, availability = build_availability_for_product(api_key, sync_product_id)
        except Exception:
            continue

        contents_after_vars = upsert_variables_in_products_js(
            contents, product_name, sizes, colors, availability
        )
        contents_after_price = add_price_bump_in_products_js(
            contents_after_vars, product_name, price_bump
        )
        contents = contents_after_price

    with open(path, "w", encoding="utf-8") as f:
        f.write(contents)


def update_backend_prices(price_bump: float) -> None:
    path = os.path.join("backend", "app.py")
    backup_file(path)
    with open(path, "r", encoding="utf-8") as f:
        contents = f.read()

    # Add bump to every "price": number inside the PRODUCTS list only.
    # Narrow scope between 'PRODUCTS = [' and the closing ']\n' that ends the list.
    products_start = contents.find("PRODUCTS = [")
    if products_start == -1:
        return
    # Find the end of the list by tracking brackets
    i = products_start
    bracket_count = 0
    end_index = None
    while i < len(contents):
        if contents[i] == '[':
            bracket_count += 1
        elif contents[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                end_index = i + 1
                break
        i += 1
    if end_index is None:
        return

    products_block = contents[products_start:end_index]

    def bump_price_match(m: re.Match) -> str:
        old = float(m.group(1))
        return f'"price": {round(old + price_bump, 2)}'

    products_block = re.sub(r'"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)', bump_price_match, products_block)

    new_contents = contents[:products_start] + products_block + contents[end_index:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_contents)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync availability from Printful and bump prices")
    parser.add_argument("--price-bump", type=float, default=10.0, help="Dollar amount to add to each product price")
    parser.add_argument("--skip-backend", action="store_true", help="Do not modify backend/app.py prices")
    args = parser.parse_args()

    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        raise SystemExit("PRINTFUL_API_KEY is not set")

    update_frontend_products_js(api_key, args.price_bump)
    if not args.skip_backend:
        update_backend_prices(args.price_bump)

    print("✅ Bulk update complete. Review git diff and test the app.")


if __name__ == "__main__":
    main()


