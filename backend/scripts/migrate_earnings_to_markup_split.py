"""
One-time migration: set creator_share and platform_fee from payout.py for all
creator_earnings rows that are standard products (not cards/stickers/magnets).

Historical rows may use an older split; this corrects them to the current
standard markup split ($6 creator / $6 platform per sale on $12 markup).

Run from repo root: python -m backend.scripts.migrate_earnings_to_markup_split
Or from backend/: python scripts/migrate_earnings_to_markup_split.py
"""
import os
import sys
from pathlib import Path

# Ensure backend is on path and load .env
backend_dir = Path(__file__).resolve().parent.parent
repo_root = backend_dir.parent
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(repo_root))

from dotenv import load_dotenv
for p in [backend_dir / ".env", repo_root / ".env", Path.cwd() / ".env"]:
    if p.exists():
        load_dotenv(p)
        break

from utils.payout import (
    CREATOR_SHARE_PER_MARKUP_SALE,
    PLATFORM_FEE_PER_MARKUP_SALE,
    PRODUCTS_WITHOUT_STANDARD_MARKUP,
)


def main():
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    client = create_client(supabase_url, service_key)

    result = client.table("creator_earnings").select("id, product_name, creator_share, platform_fee").execute()
    rows = result.data or []
    to_update = []
    for r in rows:
        product_name = (r.get("product_name") or "").strip()
        if product_name in PRODUCTS_WITHOUT_STANDARD_MARKUP:
            continue
        to_update.append({
            "id": r["id"],
            "creator_share": CREATOR_SHARE_PER_MARKUP_SALE,
            "platform_fee": PLATFORM_FEE_PER_MARKUP_SALE,
        })

    if not to_update:
        print("No rows to update (all are cards/stickers/magnets or table empty).")
        return

    print(f"Updating {len(to_update)} creator_earnings rows to ${CREATOR_SHARE_PER_MARKUP_SALE} / ${PLATFORM_FEE_PER_MARKUP_SALE} per sale...")
    updated = 0
    for u in to_update:
        try:
            client.table("creator_earnings").update({
                "creator_share": u["creator_share"],
                "platform_fee": u["platform_fee"],
            }).eq("id", u["id"]).execute()
            updated += 1
        except Exception as e:
            print(f"  Error updating id={u['id']}: {e}", file=sys.stderr)
    print(f"Done. Updated {updated} rows.")


if __name__ == "__main__":
    main()
