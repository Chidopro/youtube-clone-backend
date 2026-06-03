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
