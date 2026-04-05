#!/usr/bin/env python3
"""
Search Printful Catalog API (v2) for products by id or by text in the product name.

Uses PRINTFUL_API_KEY from .env (backend/.env or repo root .env).

Examples (run from backend/):
  python scripts/printful_catalog_search.py 317
  python scripts/printful_catalog_search.py 7502
  python scripts/printful_catalog_search.py "cropped hoodie"
  python scripts/printful_catalog_search.py "bella canvas 3001"

The dashboard URL slug and manufacturer numbers (e.g. 7502) are not always the API id;
this script returns the numeric catalog product id used in printful_catalog.py.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import requests

backend_dir = Path(__file__).resolve().parent.parent
repo_root = backend_dir.parent

from dotenv import load_dotenv

for p in (backend_dir / ".env", repo_root / ".env", Path.cwd() / ".env"):
    if p.exists():
        load_dotenv(p)
        break

BASE = "https://api.printful.com/v2/catalog-products"


def get_headers() -> dict:
    key = os.getenv("PRINTFUL_API_KEY")
    if not key:
        print("Missing PRINTFUL_API_KEY in environment (.env).", file=sys.stderr)
        sys.exit(1)
    return {"Authorization": f"Bearer {key}"}


def fetch_by_id(catalog_id: int) -> None:
    headers = get_headers()
    r = requests.get(f"{BASE}/{catalog_id}", headers=headers, timeout=60)
    if r.status_code != 200:
        print(f"HTTP {r.status_code}: {r.text[:500]}", file=sys.stderr)
        sys.exit(1)
    data = r.json().get("data") or {}
    pid = data.get("id")
    name = data.get("name", "")
    print(f"{pid}\t{name}")


def name_matches(name: str, tokens: list[str]) -> bool:
    low = name.lower()
    return all(t in low for t in tokens)


def search_catalog(query: str, pages: int, page_size: int, sleep_s: float) -> None:
    headers = get_headers()
    tokens = [t.strip().lower() for t in query.split() if t.strip()]
    if not tokens:
        print("Empty search query.", file=sys.stderr)
        sys.exit(1)

    matches: list[tuple[int, str]] = []
    for page in range(pages):
        offset = page * page_size
        r = requests.get(
            BASE,
            headers=headers,
            params={"limit": page_size, "offset": offset},
            timeout=60,
        )
        if r.status_code != 200:
            print(f"HTTP {r.status_code} at offset {offset}: {r.text[:400]}", file=sys.stderr)
            sys.exit(1)
        body = r.json()
        items = body.get("data") or []
        if not items:
            break
        for item in items:
            if not isinstance(item, dict):
                continue
            pid = item.get("id")
            name = item.get("name") or ""
            if pid is None:
                continue
            if name_matches(name, tokens):
                matches.append((int(pid), name))
        paging = body.get("paging") or {}
        total = paging.get("total")
        if total is not None and offset + len(items) >= int(total):
            break
        if sleep_s > 0:
            time.sleep(sleep_s)

    matches.sort(key=lambda x: x[0])
    if not matches:
        print(
            f"No catalog products matched tokens {tokens!r} in the first "
            f"{pages * page_size} products scanned. Try fewer words, a style number, "
            f"or increase --pages.",
            file=sys.stderr,
        )
        sys.exit(2)

    print("id\tname")
    for pid, name in matches:
        print(f"{pid}\t{name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Search Printful catalog products (v2).")
    parser.add_argument(
        "query",
        nargs="?",
        help='Catalog product id (digits) or words to find in the product name (e.g. "7502" or "cropped hoodie")',
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=40,
        metavar="N",
        help="Max pages to scan when searching by text (default: 40, 100 products each)",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=100,
        help="Catalog API limit per request (default: 100)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.12,
        help="Seconds between paginated requests (default: 0.12)",
    )
    args = parser.parse_args()

    if not args.query:
        parser.print_help()
        sys.exit(0)

    q = args.query.strip()
    if q.isdigit():
        fetch_by_id(int(q))
        return

    search_catalog(q, pages=args.pages, page_size=args.page_size, sleep_s=args.sleep)


if __name__ == "__main__":
    main()
