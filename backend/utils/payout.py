"""
Precise payout calculations for ScreenMerch.

Every product: $12.00 markup per sale → Creator $6.00, ScreenMerch $6.00 (50/50).
"""

# Standard markup split per unit (exact dollars)
STANDARD_MARKUP_PER_SALE = 12.00
CREATOR_SHARE_PER_MARKUP_SALE = 6.00
PLATFORM_FEE_PER_MARKUP_SALE = 6.00

# Minimum owed balance before a storefront owner can record an off-platform collaborator payout.
UMBRELLA_COLLABORATOR_PAYOUT_MINIMUM = 50.0

# Storefront-owner ScreenMerch payouts: on or about the 1st and 15th (Terms §10.2).
CREATOR_PAYOUT_DAYS = (1, 15)


def next_creator_payout_date(today=None):
    """Next regular ScreenMerch payout day (1st or 15th)."""
    from datetime import date, datetime, timezone

    today = today or datetime.now(timezone.utc).date()
    if today.day <= 1:
        return date(today.year, today.month, 1)
    if today.day <= 15:
        return date(today.year, today.month, 15)
    if today.month == 12:
        return date(today.year + 1, 1, 1)
    return date(today.year, today.month + 1, 1)


def creator_earnings_pending_amount(client, user_id):
    """Unpaid ScreenMerch → owner balance (same source as admin Pending)."""
    if not client or not user_id:
        return 0.0
    try:
        result = (
            client.table("creator_earnings")
            .select("creator_share")
            .eq("user_id", str(user_id))
            .eq("status", "pending")
            .execute()
        )
    except Exception:
        return 0.0
    return round(sum(float(row.get("creator_share") or 0) for row in (result.data or [])), 2)


def screenmerch_pending_fields(client, user_id):
    return {
        "screenmerch_pending_amount": creator_earnings_pending_amount(client, user_id),
        "next_payout_date": next_creator_payout_date().isoformat(),
    }


def get_payout_for_sale(product_name, sale_amount, quantity=1):
    """
    Return (creator_share, platform_fee) in dollars, rounded to 2 decimals.

    Every product uses the standard $12 markup: $6.00 to creator, $6.00 to platform per unit.
    """
    try:
        qty = max(1, int(quantity))
    except (TypeError, ValueError):
        qty = 1

    creator_share = round(CREATOR_SHARE_PER_MARKUP_SALE * qty, 2)
    platform_fee = round(PLATFORM_FEE_PER_MARKUP_SALE * qty, 2)
    return (creator_share, platform_fee)


def sale_revenue_breakdown(product_name, sale_amount, platform_fee=None, creator_share=None, quantity=1):
    """
    Admin reporting: decompose a sale into Printful fulfillment cost and creator net payout.

    - printful_cost: sale amount minus platform fee minus creator markup share.
    - creator_net_payout: amount owed to creator ($6/unit).
    """
    sale = round(float(sale_amount or 0), 2)
    if platform_fee is None or creator_share is None:
        cs_calc, pf_calc = get_payout_for_sale(product_name, sale_amount, quantity)
        if platform_fee is None:
            platform_fee = pf_calc
        if creator_share is None:
            creator_share = cs_calc
    pf = round(float(platform_fee or 0), 2)
    cs = round(float(creator_share or 0), 2)
    printful_cost = round(max(0.0, sale - pf - cs), 2)
    return {
        "printful_cost": printful_cost,
        "creator_net_payout": cs,
        "platform_fee": pf,
        "creator_share": cs,
        "sale_amount": sale,
    }


def earning_payout_financials(earning, quantity=1):
    """
    Canonical payout numbers for one creator_earnings (or sale-like) row.

    Always recomputes platform_fee and creator_share from product + amount via
    get_payout_for_sale so dashboards stay consistent even if stored rows are stale.
    """
    return sale_revenue_breakdown(
        earning.get("product_name"),
        earning.get("sale_amount") if earning.get("sale_amount") is not None else earning.get("amount"),
        platform_fee=None,
        creator_share=None,
        quantity=quantity,
    )


def aggregate_sales_payout_totals(sale_lines):
    """
    Sum gross, platform fee, collaborator/creator share, and merchandise (Printful) cost
    for a list of sale row dicts (product_name, amount; each row = one unit sold).
    """
    gross = 0.0
    platform_fee = 0.0
    collaborator_pay = 0.0
    merch_cost = 0.0
    count = 0
    for line in sale_lines or []:
        amount = float(line.get("amount") or 0)
        product_name = line.get("product_name") or ""
        qty = 1
        try:
            qty = max(1, int(line.get("quantity") or 1))
        except (TypeError, ValueError):
            qty = 1
        gross += amount
        count += qty
        cs, pf = get_payout_for_sale(product_name, amount, qty)
        bd = sale_revenue_breakdown(product_name, amount, pf, cs, qty)
        platform_fee += pf
        collaborator_pay += cs
        merch_cost += bd["printful_cost"]
    return {
        "order_count": count,
        "gross_amount": round(gross, 2),
        "platform_fee_amount": round(platform_fee, 2),
        "pay_collaborator_amount": round(collaborator_pay, 2),
        "merch_cost_amount": round(merch_cost, 2),
    }


def payout_list_key(value):
    """Match favorite_list_id values whether they include UUID dashes or mixed case."""
    return str(value or "").strip().lower().replace("-", "")


def sales_rows_matching_lists(rows, list_ids):
    """Keep sale rows attributed to any of the given favorite-list ids."""
    want = {payout_list_key(x) for x in (list_ids or []) if x not in (None, "")}
    if not want:
        return []
    matched = []
    for row in rows or []:
        if payout_list_key(row.get("favorite_list_id")) in want:
            matched.append(row)
    return matched


def _payout_recency_key(payout):
    """Newest-first: prefer ledger insert time, then the paid-on date."""
    if not payout:
        return ""
    return str(
        payout.get("created_at")
        or payout.get("paid_at")
        or payout.get("payout_date")
        or ""
    )


def umbrella_payout_balance_fields(lifetime_net, payouts):
    """
    Unpaid balance and payout history for one umbrella collaborator page.

    Paying at least the current earnings marks the page paid up. Extra ledger rows
    (retries or leftover test payments) must not bring the Record payment button back.
    """
    paid_total = 0.0
    for p in payouts or []:
        try:
            paid_total += float(p.get("amount") or 0)
        except (TypeError, ValueError):
            pass
    paid_total = round(paid_total, 2)
    lifetime_net = round(float(lifetime_net or 0), 2)

    balance_owed = round(max(0.0, lifetime_net - paid_total), 2)
    is_paid_up = lifetime_net > 0 and balance_owed <= 0
    payout_stale = lifetime_net > 0 and round(paid_total - lifetime_net, 2) > 0.05
    can_record_payout = balance_owed >= UMBRELLA_COLLABORATOR_PAYOUT_MINIMUM

    payouts_newest = sorted(
        list(payouts or []),
        key=_payout_recency_key,
        reverse=True,
    )
    last_payout = payouts_newest[0] if payouts_newest else None
    recent_payouts = payouts_newest[:5]

    return {
        "paid_total": paid_total,
        "balance_owed": balance_owed,
        "is_paid_up": is_paid_up,
        "can_record_payout": can_record_payout,
        "payout_stale": payout_stale,
        "last_payout": last_payout,
        "recent_payouts": recent_payouts,
    }


def split_sales_payout_totals(sale_lines, collaborator_list_ids=None):
    """Split payout totals into all sales, storefront-owner direct, and umbrella collaborator."""
    collab_ids = {str(x) for x in (collaborator_list_ids or []) if x}

    def _is_collab_line(line):
        flid = str(line.get("favorite_list_id") or "")
        return bool(flid and flid in collab_ids)

    owner_lines = [ln for ln in (sale_lines or []) if not _is_collab_line(ln)]
    collab_lines = [ln for ln in (sale_lines or []) if _is_collab_line(ln)]
    return {
        "all": aggregate_sales_payout_totals(sale_lines),
        "owner_direct": aggregate_sales_payout_totals(owner_lines),
        "collaborator_attributed": aggregate_sales_payout_totals(collab_lines),
    }


def normalize_owner_collab_fee(fee_type, fee_value):
    """Clamp storefront-owner collaborator fee to a supported type and range."""
    t = str(fee_type or "none").strip().lower()
    if t not in ("none", "percent", "flat"):
        t = "none"
    try:
        v = float(fee_value or 0)
    except (TypeError, ValueError):
        v = 0.0
    if t == "percent":
        v = max(0.0, min(100.0, v))
    elif t == "flat":
        v = max(0.0, min(CREATOR_SHARE_PER_MARKUP_SALE, v))
    else:
        v = 0.0
    return t, round(v, 2)


def owner_collab_fee_per_item(fee_type, fee_value):
    """Dollars the storefront owner keeps from each collaborator item ($6 share)."""
    t, v = normalize_owner_collab_fee(fee_type, fee_value)
    if t == "percent":
        return round(CREATOR_SHARE_PER_MARKUP_SALE * (v / 100.0), 2)
    if t == "flat":
        return round(v, 2)
    return 0.0


def apply_owner_fee_to_sale_share(creator_share, fee_type, fee_value, quantity=1):
    """Split one sale's $6-style creator share into owner fee vs collaborator pay."""
    try:
        qty = max(1, int(quantity or 1))
    except (TypeError, ValueError):
        qty = 1
    cs = round(float(creator_share or 0), 2)
    per_item = owner_collab_fee_per_item(fee_type, fee_value)
    fee = round(min(cs, per_item * qty), 2)
    return {
        "quantity": qty,
        "collaborator_share_before_fee": cs,
        "owner_fee_amount": fee,
        "owner_fee_per_item": per_item,
        "pay_collaborator_amount": round(max(0.0, cs - fee), 2),
    }


def apply_owner_fee_to_collab_totals(collab_totals, fee_type, fee_value):
    """
    Split the $6/item collaborator share into owner fee vs remaining collaborator pay.

    Percentage is of the $6 collaborator share. Flat rate is dollars per item sold.
    Owner fee never exceeds the original collaborator share.
    """
    totals = dict(collab_totals or {})
    items = 0
    try:
        items = max(0, int(totals.get("order_count") or 0))
    except (TypeError, ValueError):
        items = 0
    full_collab = round(float(totals.get("pay_collaborator_amount") or 0), 2)
    per_item = owner_collab_fee_per_item(fee_type, fee_value)
    owner_from_collab = round(min(full_collab, per_item * items), 2)
    collab_remaining = round(max(0.0, full_collab - owner_from_collab), 2)
    t, v = normalize_owner_collab_fee(fee_type, fee_value)
    totals["pay_collaborator_amount"] = collab_remaining
    totals["owner_fee_amount"] = owner_from_collab
    totals["owner_fee_per_item"] = per_item
    totals["collaborator_share_before_fee"] = full_collab
    totals["owner_fee_type"] = t
    totals["owner_fee_value"] = v
    return totals


def resolve_owner_collab_fee(fees_by_list, favorite_list_id=None):
    """Per-collaborator fee, else storefront-wide fallback, else no fee."""
    fees_by_list = fees_by_list or {}
    if favorite_list_id not in (None, ""):
        keyed = fees_by_list.get(str(favorite_list_id))
        if keyed:
            return keyed
    fallback = fees_by_list.get(None) or fees_by_list.get("")
    if fallback:
        return fallback
    return {"fee_type": "none", "fee_value": 0.0}


def apply_per_list_owner_fees(collab_lines, fees_by_list):
    """
    Apply the fee that was in effect for each sale, then sum.

    Returns (adjusted_collab_pay_total, owner_fee_total).
    """
    pay_total = 0.0
    fee_total = 0.0
    for line in collab_lines or []:
        fee = resolve_owner_collab_fee(fees_by_list, line.get("favorite_list_id"))
        split = split_collab_sale_share(line, fee)
        pay_total += float(split.get("pay_collaborator_amount") or 0)
        fee_total += float(split.get("owner_fee_amount") or 0)
    return round(pay_total, 2), round(fee_total, 2)


def _parse_sale_time(raw):
    from datetime import datetime

    if not raw:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        if "T" not in text and len(text) >= 10:
            text = text[:10] + "T00:00:00+00:00"
        return datetime.fromisoformat(text[:32])
    except Exception:
        return None


def sale_has_locked_owner_fee(sale):
    """True when this sale row was stamped with the fee at purchase time."""
    if not isinstance(sale, dict):
        return False
    if sale.get("owner_fee_type") not in (None, ""):
        return True
    return False


def fee_at_time(list_fee, created_at):
    """Fee settings that applied at created_at. Closed history periods win over the current rate."""
    current = list_fee or {"fee_type": "none", "fee_value": 0.0}
    sale_ts = _parse_sale_time(created_at)
    history = current.get("history") if isinstance(current, dict) else None
    if sale_ts and isinstance(history, list):
        for entry in history:
            if not isinstance(entry, dict):
                continue
            start = _parse_sale_time(entry.get("effective_from"))
            end = _parse_sale_time(entry.get("effective_to"))
            if start and sale_ts < start:
                continue
            if end and sale_ts >= end:
                continue
            t, v = normalize_owner_collab_fee(entry.get("fee_type"), entry.get("fee_value"))
            return {"fee_type": t, "fee_value": v}
        current_from = _parse_sale_time(current.get("effective_from") or current.get("updated_at"))
        if current_from and sale_ts < current_from:
            # Sale is before the current rate started, but no history row matched.
            # Keep looking: if history was empty this falls through to current.
            pass
    t, v = normalize_owner_collab_fee(current.get("fee_type"), current.get("fee_value"))
    return {"fee_type": t, "fee_value": v}


def owner_fee_for_sale(sale, list_fee):
    """Locked snapshot on the sale row, else the fee in effect when it was created."""
    if sale_has_locked_owner_fee(sale):
        t, v = normalize_owner_collab_fee(sale.get("owner_fee_type"), sale.get("owner_fee_value"))
        return {"fee_type": t, "fee_value": v}
    return fee_at_time(list_fee, (sale or {}).get("created_at"))


def split_collab_sale_share(sale, list_fee):
    """Split one collaborator sale using the locked or historical fee, never a later setting."""
    sale = sale or {}
    try:
        qty = max(1, int(sale.get("quantity") or 1))
    except (TypeError, ValueError):
        qty = 1
    try:
        cs, _pf = get_payout_for_sale(sale.get("product_name"), sale.get("amount"), qty)
    except Exception:
        cs = 0.0
    fee = owner_fee_for_sale(sale, list_fee)
    split = apply_owner_fee_to_sale_share(cs, fee["fee_type"], fee["fee_value"], qty)
    split["owner_fee_type"] = fee["fee_type"]
    split["owner_fee_value"] = fee["fee_value"]
    return split
