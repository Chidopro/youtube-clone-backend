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


def umbrella_payout_balance_fields(lifetime_net, payouts):
    """
    Unpaid balance and payout history for one umbrella collaborator page.

    When recorded payouts exceed current earnings (e.g. sales were cleared and re-tested),
    excess payments are ignored so the collaborator is not shown as paid up incorrectly.
    """
    paid_total = 0.0
    for p in payouts or []:
        try:
            paid_total += float(p.get("amount") or 0)
        except (TypeError, ValueError):
            pass
    paid_total = round(paid_total, 2)
    lifetime_net = round(float(lifetime_net or 0), 2)

    payout_stale = paid_total > lifetime_net and lifetime_net > 0
    if payout_stale:
        balance_owed = lifetime_net
    else:
        balance_owed = round(max(0.0, lifetime_net - paid_total), 2)

    is_paid_up = lifetime_net > 0 and balance_owed <= 0 and not payout_stale
    can_record_payout = balance_owed >= UMBRELLA_COLLABORATOR_PAYOUT_MINIMUM

    last_payout = None if payout_stale else (payouts[0] if payouts else None)
    recent_payouts = [] if payout_stale else (payouts or [])[:5]

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
    Apply a possibly different owner fee to each collaborator's sales and sum.

    Returns (adjusted_collab_pay_total, owner_fee_total).
    """
    grouped = {}
    for line in collab_lines or []:
        key = str(line.get("favorite_list_id") or "")
        grouped.setdefault(key, []).append(line)
    pay_total = 0.0
    fee_total = 0.0
    for flid, lines in grouped.items():
        fee = resolve_owner_collab_fee(fees_by_list, flid or None)
        adj = apply_owner_fee_to_collab_totals(
            aggregate_sales_payout_totals(lines),
            fee.get("fee_type"),
            fee.get("fee_value"),
        )
        pay_total += float(adj.get("pay_collaborator_amount") or 0)
        fee_total += float(adj.get("owner_fee_amount") or 0)
    return round(pay_total, 2), round(fee_total, 2)
