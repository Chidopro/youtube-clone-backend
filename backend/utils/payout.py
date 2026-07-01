"""
Precise payout calculations for ScreenMerch.

- Most products: $12.00 markup per sale → Creator $6.00, ScreenMerch $6.00 (50/50).
- Cards, stickers, magnets: different pricing (TBD); currently 70% creator / 30% platform.
"""

# Standard markup split per unit (exact dollars)
STANDARD_MARKUP_PER_SALE = 12.00
CREATOR_SHARE_PER_MARKUP_SALE = 6.00
PLATFORM_FEE_PER_MARKUP_SALE = 6.00

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
        # Cards, stickers, magnets: use percentage split until specific pricing is defined
        total = float(sale_amount) * qty
        creator_share = round(total * 0.70, 2)
        platform_fee = round(total * 0.30, 2)
        return (creator_share, platform_fee)

    # Standard $12 markup: exact $6 / $6 per unit
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
