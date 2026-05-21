#!/usr/bin/env python3
"""
Add a fixed dollar amount to catalog prices, excluding Miscellaneous category products.
Misc list matches backend/routes/products.py category_mappings['misc'].
"""

from __future__ import annotations

import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUMP = 2.0

MISC_NAMES = {
    "Bandana",
    "Hardcover Bound Notebook",
    "Coasters",
    "Apron",
    "Jigsaw Puzzle with Tin",
    "Greeting Card",
    "Kiss-Cut Stickers",
    "Die-Cut Magnets",
}

MISC_ALIASES = {"Notebook", "Sticker Pack", "Magnet Set"}


def is_misc_product(name: str) -> bool:
    return name in MISC_NAMES or name in MISC_ALIASES


def backup(path: Path) -> None:
    ts = int(time.time())
    bak = path.with_suffix(path.suffix + f".{ts}.bak")
    bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Backup: {bak}")


def bump_line_oriented_prices(path: Path, in_products_block: bool = False) -> tuple[int, int]:
    """Bump top-level product price fields; track current name from preceding \"name\" line."""
    backup(path)
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    current_name: str | None = None
    bumped = skipped = 0
    in_block = not in_products_block
    block_depth = 0

    name_re = re.compile(r'^\s*"name":\s*"([^"]+)"')
    price_re = re.compile(r'^(\s*"price":\s*)([0-9]+(?:\.[0-9]+)?)(.*)$')

    for idx, line in enumerate(lines):
        if in_products_block and not in_block:
            if "PRODUCTS = [" in line:
                in_block = True
                block_depth = 0
            continue

        if in_products_block and in_block:
            block_depth += line.count("[") - line.count("]")
            if block_depth < 0:
                in_block = False
                continue

        nm = name_re.match(line)
        if nm:
            current_name = nm.group(1)
            continue

        pm = price_re.match(line)
        if not pm or current_name is None:
            continue

        # Only the first price after each name (base price), not size_pricing values
        if is_misc_product(current_name):
            skipped += 1
            current_name = None
            continue

        old = float(pm.group(2))
        new = round(old + BUMP, 2)
        lines[idx] = f"{pm.group(1)}{new:.2f}{pm.group(3)}\n" if not pm.group(3).endswith("\n") else f"{pm.group(1)}{new:.2f}{pm.group(3)}"
        if not lines[idx].endswith("\n") and line.endswith("\n"):
            lines[idx] += "\n"
        bumped += 1
        current_name = None

    path.write_text("".join(lines), encoding="utf-8")
    return bumped, skipped


def bump_products_js() -> tuple[int, int]:
    path = ROOT / "frontend" / "src" / "data" / "products.js"
    backup(path)
    content = path.read_text(encoding="utf-8")
    lines = content.splitlines(keepends=True)
    current_name: str | None = None
    bumped = skipped = 0
    name_re = re.compile(r'^\s*"name":\s*"([^"]+)"')
    price_re = re.compile(r'^(\s*"price":\s*)([0-9]+(?:\.[0-9]+)?)(.*)$')

    for idx, line in enumerate(lines):
        nm = name_re.match(line)
        if nm:
            current_name = nm.group(1)
            continue
        pm = price_re.match(line)
        if not pm or current_name is None:
            continue
        if is_misc_product(current_name):
            skipped += 1
            current_name = None
            continue
        old = float(pm.group(2))
        new = round(old + BUMP, 2)
        rest = pm.group(3)
        lines[idx] = f"{pm.group(1)}{new:.2f}{rest}"
        if line.endswith("\n") and not lines[idx].endswith("\n"):
            lines[idx] += "\n"
        bumped += 1
        current_name = None

    path.write_text("".join(lines), encoding="utf-8")
    return bumped, skipped


def find_products_block_end(contents: str, first_bracket: int) -> int | None:
    i = first_bracket
    depth = 0
    in_string = False
    string_char = ""
    while i < len(contents):
        ch = contents[i]
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == string_char:
                in_string = False
            i += 1
            continue
        if ch in ('"', "'"):
            in_string = True
            string_char = ch
            i += 1
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return None


def bump_backend_products() -> tuple[int, int]:
    path = ROOT / "backend" / "app.py"
    backup(path)
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)

    products_start = next(i for i, l in enumerate(lines) if "PRODUCTS = [" in l)
    first_bracket_line = products_start
    # Find line index where PRODUCTS block ends
    content = "".join(lines)
    products_start_char = content.find("PRODUCTS = [")
    first_bracket = content.find("[", products_start_char)
    end_index = find_products_block_end(content, first_bracket)
    end_line = content[:end_index].count("\n")

    current_name: str | None = None
    bumped = skipped = 0
    name_re = re.compile(r'^\s*"name":\s*"([^"]+)"')
    price_re = re.compile(r'^\s*"price":\s*([0-9]+(?:\.[0-9]+)?)')

    for idx in range(products_start, min(end_line + 1, len(lines))):
        line = lines[idx]
        nm = name_re.match(line)
        if nm:
            current_name = nm.group(1)
            continue
        pm = price_re.match(line)
        if not pm or current_name is None:
            continue
        if is_misc_product(current_name):
            skipped += 1
            current_name = None
            continue
        old = float(pm.group(1))
        new = round(old + BUMP, 2)
        indent = re.match(r"^(\s*)", line).group(1)
        lines[idx] = f'{indent}"price": {new:.2f},\n'
        bumped += 1
        current_name = None

    path.write_text("".join(lines), encoding="utf-8")
    return bumped, skipped


def bump_product_page_jsx() -> tuple[int, int]:
    path = ROOT / "frontend" / "src" / "Pages" / "ProductPage" / "ProductPage.jsx"
    backup(path)
    content = path.read_text(encoding="utf-8")
    bumped = skipped = 0

    def repl(m: re.Match) -> str:
        nonlocal bumped, skipped
        product_name = m.group(1)
        inner = m.group(2)
        price = float(m.group(3))
        if is_misc_product(product_name):
            skipped += 1
            return m.group(0)
        bumped += 1
        new_price = round(price + BUMP, 2)
        return f'"{product_name}": {{ {inner}price: {new_price:.2f} }}'

    pattern = re.compile(
        r'"([^"]+)":\s*\{\s*([^}]*?)price:\s*([0-9]+(?:\.[0-9]+)?)\s*\}',
    )
    updated = pattern.sub(repl, content)
    path.write_text(updated, encoding="utf-8")
    return bumped, skipped


def main() -> None:
    js_b, js_s = bump_products_js()
    be_b, be_s = bump_backend_products()
    px_b, px_s = bump_product_page_jsx()
    print(f"products.js: +${BUMP} on {js_b} products, skipped {js_s} misc")
    print(f"backend/app.py: +${BUMP} on {be_b} products, skipped {be_s} misc")
    print(f"ProductPage.jsx: +${BUMP} on {px_b} products, skipped {px_s} misc")
    print("Done.")


if __name__ == "__main__":
    main()
