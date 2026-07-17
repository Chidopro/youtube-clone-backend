"""
Precise payout calculations for ScreenMerch.

- Most products: $12.00 markup per sale → Creator $6.00, ScreenMerch $6.00 (50/50).
- Cards, stickers, magnets: different pricing (TBD); currently 70% creator / 30% platform.
"""

# Standard markup split per unit (exact dollars)
STANDARD_MARKUP_PER_SALE = 12.00
CREATOR_SHARE_PER_MARKUP_SALE = 6.00
PLATFORM_FEE_PER_MARKUP_SALE = 6.00

# Minimum owed balance before a storefront owner can record an off-platform collaborator payout.
UMBRELLA_COLLABORATOR_PAYOUT_MINIMUM = 50.0

# Products that do NOT use the standard markup; pricing TBD (cards, stickers, magnets)
PRODUCTS_WITHOUT_STANDARD_MARKUP = frozenset([
    "Greeting Card",
    "Kiss-Cut Stickers",
    "Die-Cut Magnets",
])


def get_payout_for_sale(product_name, sale_amount, quantity=1):
    """
    Return (creator_share, platform_fee) in dollars, rounded to 2 decimals.

    - For products with standard $12 markup: $6.00 to creator, $6.00 to platform per unit.
    - For cards, stickers, magnets: 70% / 30% of sale amount (to be updated later).
    """
    product_name = (product_name or "").strip()
    try:
        qty = max(1, int(quantity))
    except (TypeError, ValueError):
        qty = 1

    if product_name in PRODUCTS_WITHOUT_STANDARD_MARKUP:
        total = float(sale_amount) * qty
        creator_share = round(total * 0.70, 2)
        platform_fee = round(total * 0.30, 2)
        return (creator_share, platform_fee)

    creator_share = round(CREATOR_SHARE_PER_MARKUP_SALE * qty, 2)
    platform_fee = round(PLATFORM_FEE_PER_MARKUP_SALE * qty, 2)
    return (creator_share, platform_fee)


def sale_revenue_breakdown(product_name, sale_amount, platform_fee=None, creator_share=None, quantity=1):
    """
    Admin reporting: decompose a sale into Printful fulfillment cost and creator net payout.

    - printful_cost: sale amount minus platform fee minus creator markup share.
    - creator_net_payout: amount owed to creator ($6/unit on standard markup items).
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
