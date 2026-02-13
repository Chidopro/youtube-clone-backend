#!/usr/bin/env python3
"""
Check ScreenMerch environment: backend API, videos endpoint, and optional Supabase.
Run from repo root. For Supabase/videos2 check, ensure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
"""
import os
import sys
import json

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

BACKEND_URL = os.getenv("BACKEND_URL", "https://screenmerch.fly.dev")
TIMEOUT = 15


def check_backend_up():
    """Verify Fly.io backend is responding."""
    print("Backend (Fly.io)")
    print("  URL:", BACKEND_URL)
    try:
        r = requests.get(BACKEND_URL + "/", timeout=TIMEOUT)
        print("  GET /:", r.status_code, "OK" if r.ok else "FAIL")
        return r.ok
    except requests.exceptions.RequestException as e:
        print("  GET /: FAIL -", e)
        return False


def check_videos_api():
    """Verify /api/videos returns 200 and a JSON array."""
    print("\nVideos API")
    print("  URL:", BACKEND_URL + "/api/videos")
    try:
        r = requests.get(BACKEND_URL + "/api/videos", timeout=TIMEOUT)
        print("  Status:", r.status_code, "OK" if r.ok else "FAIL")
        if not r.ok:
            try:
                body = r.json()
                print("  Response:", json.dumps(body)[:200])
            except Exception:
                print("  Response (text):", (r.text or "")[:200])
            return False
        try:
            data = r.json()
        except Exception as e:
            print("  Invalid JSON:", e)
            return False
        if not isinstance(data, list):
            print("  Expected JSON array, got:", type(data).__name__)
            return False
        print("  Count:", len(data), "videos")
        return True
    except requests.exceptions.RequestException as e:
        print("  Request failed:", e)
        return False


def check_supabase_and_videos2():
    """Optional: verify Supabase connection and videos2 table (requires .env)."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        return None
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        print("\nSupabase (optional)")
        print("  Skipped: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env")
        return None
    print("\nSupabase")
    print("  URL: set (OK)")
    print("  Key: set (OK)")
    try:
        from supabase import create_client
        client = create_client(url, key)
        # Just check we can read videos2 without error
        result = client.table("videos2").select("id").limit(5).execute()
        data = result.data if result.data is not None else []
        print("  videos2 table: readable OK")
        print("  Sample rows:", len(data))
        return True
    except Exception as e:
        print("  videos2 table: FAIL -", e)
        return False


def main():
    print("=" * 50)
    print("ScreenMerch environment check")
    print("=" * 50)
    backend_ok = check_backend_up()
    videos_ok = check_videos_api()
    supabase_result = check_supabase_and_videos2()
    print("\n" + "=" * 50)
    print("Summary")
    print("=" * 50)
    print("  Backend up:    ", "OK" if backend_ok else "FAIL")
    print("  Videos API:    ", "OK" if videos_ok else "FAIL")
    if supabase_result is not None:
        print("  Supabase/videos2:", "OK" if supabase_result else "FAIL")
    else:
        print("  Supabase:      (skipped)")
    if not backend_ok or not videos_ok:
        print("\nFix: ensure backend is deployed and SUPABASE_URL/SUPABASE_ANON_KEY are set in Fly.io secrets.")
        sys.exit(1)
    print("\nEnvironment looks good.")
    sys.exit(0)


if __name__ == "__main__":
    main()
