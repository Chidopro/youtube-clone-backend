# Print area dimensions for products (inches). Used by print-quality page to fit image to product.
# Mirrors frontend printAreaConfig for consistency with cart tools (all categories).
# Each product has default width/height; some have size-specific dimensions.

def _sizes(*pairs):
    """Helper: list of { label, width, height } from (label, w, h), ..."""
    return [{"label": l, "width": w, "height": h} for l, w, h in pairs]

# Full list: all products from all categories (frontend printAreaConfig)
PRINT_AREA_PRODUCTS = [
    # Kids
    {"name": "Kids Long Sleeve", "description": "Youth Long Sleeve Tee", "width": 10, "height": 12},
    {"name": "Kids Shirt", "description": "Kids T-Shirt", "width": 10, "height": 12,
     "sizes": _sizes(("S-M", 10, 12), ("L-XL", 12, 16))},
    {"name": "Kids Hoodie", "description": "Kids Hoodie", "width": 12, "height": 14},
    {"name": "Youth Heavy Blend Hoodie", "description": "Youth Heavy Blend Hoodie", "width": 10, "height": 9,
     "sizes": _sizes(("XS", 10, 7), ("S", 10, 8), ("M", 10, 9), ("L", 11.5, 11), ("XL", 11.5, 12))},
    {"name": "Toddler Short Sleeve T-Shirt", "description": "Toddler T-Shirt", "width": 8, "height": 10},
    {"name": "Toddler Jersey T-Shirt", "description": "Toddler Jersey", "width": 7, "height": 8},
    {"name": "Kids Sweatshirt", "description": "Kids Sweatshirt", "width": 10, "height": 12,
     "sizes": _sizes(("XS-M", 10, 12), ("L-XL", 12, 16))},
    {"name": "Baby Staple Tee", "description": "Baby Tee", "width": 7, "height": 8},
    {"name": "Baby Jersey T-Shirt", "description": "Baby Jersey", "width": 7, "height": 8},
    {"name": "Baby Body Suit", "description": "Baby Body Suit", "width": 7, "height": 8},
    # Men's / Unisex
    {"name": "Unisex Classic Tee", "description": "Standard T-Shirt", "width": 12, "height": 15},
    {"name": "Unisex T-Shirt", "description": "Unisex T-Shirt", "width": 11.5, "height": 13.8,
     "sizes": _sizes(("XS-M", 11.5, 13.8), ("L-3XL", 15, 18))},
    {"name": "Men's Tank Top", "description": "Tank Top", "width": 12, "height": 16},
    {"name": "Men's Fitted Long Sleeve", "description": "Long Sleeve Shirt", "width": 12, "height": 16},
    {"name": "Men's Long Sleeve Shirt", "description": "Long Sleeve Shirt", "width": 12, "height": 16},
    {"name": "Unisex Hoodie", "description": "Hoodie", "width": 13, "height": 13},
    {"name": "Unisex Champion Hoodie", "description": "Champion Hoodie", "width": 11.5, "height": 11.5,
     "sizes": _sizes(("S-M", 11.5, 11.5), ("L-XL", 13, 13), ("2XL-3XL", 14, 14))},
    {"name": "Unisex Pullover Hoodie", "description": "Pullover Hoodie", "width": 13, "height": 13},
    {"name": "Unisex Heavyweight T-Shirt", "description": "Heavyweight T-Shirt", "width": 12, "height": 16},
    {"name": "Unisex Oversized T-Shirt", "description": "Oversized T-Shirt", "width": 11.5, "height": 15.3},
    {"name": "Mens Fitted T-Shirt", "description": "Fitted T-Shirt", "width": 12, "height": 16},
    # Women's
    {"name": "Women's Ribbed Neck", "description": "Women's Ribbed Neck", "width": 12, "height": 16},
    {"name": "Women's Shirt", "description": "Women's Shirt", "width": 10, "height": 12,
     "sizes": _sizes(("S-M", 10, 12), ("L-3XL", 12, 16))},
    {"name": "Women's HD Shirt", "description": "Women's HD Shirt", "width": 10, "height": 13},
    {"name": "Women's Crop Top", "description": "Crop Top", "width": 10, "height": 10},
    {"name": "Cropped Hoodie", "description": "Cropped Hoodie", "width": 10, "height": 10},
    {"name": "Fitted Racerback Tank", "description": "Racerback Tank", "width": 10, "height": 12,
     "sizes": _sizes(("XS-S", 10, 12), ("M-2XL", 12, 16))},
    {"name": "Micro-Rib Tank Top", "description": "Micro-Rib Tank", "width": 10, "height": 12,
     "sizes": _sizes(("XS-S", 10, 12), ("M-2XL", 12, 16))},
    # Hats
    {"name": "Distressed Dad Hat", "description": "Dad Hat Front (5\" × 2\")", "width": 5, "height": 2},
    {"name": "Closed Back Cap", "description": "Closed Back Cap Front (5\" × 2\")", "width": 5, "height": 2},
    {"name": "Five Panel Trucker Hat", "description": "Trucker Hat Front (5.5\" × 2.5\")", "width": 5.5, "height": 2.5},
    {"name": "Five Panel Baseball Cap", "description": "Baseball Cap Front (5\" × 2\")", "width": 5, "height": 2},
    # Mugs
    {"name": "White Glossy Mug", "description": "Mug (Square)", "width": 4, "height": 4},
    {"name": "Travel Mug", "description": "Travel Mug (Square)", "width": 4, "height": 4},
    {"name": "Enamel Mug", "description": "Enamel Mug (Square)", "width": 4, "height": 4},
    {"name": "Colored Mug", "description": "Colored Mug (Square)", "width": 4, "height": 4},
    # Bags
    {"name": "Canvas Tote", "description": "Tote Bag", "width": 12, "height": 14},
    {"name": "Tote Bag", "description": "Tote Bag", "width": 12, "height": 14},
    {"name": "Large Canvas Bag", "description": "Large Canvas Bag", "width": 14, "height": 16},
    {"name": "Laptop Sleeve", "description": "Laptop Sleeve (Horizontal)", "width": 14, "height": 10},
    {"name": "All-Over Print Drawstring", "description": "Drawstring Bag", "width": 12, "height": 14},
    {"name": "All Over Print Tote Pocket", "description": "Tote with Pocket", "width": 12, "height": 14},
    {"name": "All-Over Print Crossbody Bag", "description": "Crossbody Bag", "width": 10, "height": 12},
    {"name": "All-Over Print Utility Bag", "description": "Utility Bag", "width": 12, "height": 14},
    # Pets
    {"name": "Pet Bowl All-Over Print", "description": "Pet Bowl (Square)", "width": 6, "height": 6},
    {"name": "Pet Bandana Collar", "description": "Bandana (Square)", "width": 12, "height": 12},
    {"name": "All Over Print Leash", "description": "Leash (Vertical)", "width": 1, "height": 48},
    {"name": "All Over Print Collar", "description": "Collar (Vertical)", "width": 1, "height": 12},
    # Misc
    {"name": "Hardcover Bound Notebook", "description": "Hardcover Bound Notebook (3\" × 5\")", "width": 3, "height": 5},
    {"name": "Coasters", "description": "Coasters (3.97\" × 3.97\")", "width": 3.97, "height": 3.97},
    {"name": "Apron", "description": "Apron (All-Over Print)", "width": 12, "height": 14},
    {"name": "Kiss Cut Stickers - 3\" × 3\"", "description": "Kiss Cut Stickers (3\" × 3\")", "width": 3, "height": 3},
    {"name": "Kiss Cut Stickers - 4\" × 4\"", "description": "Kiss Cut Stickers (4\" × 4\")", "width": 4, "height": 4},
    {"name": "Kiss Cut Stickers - 5.5\" × 5.5\"", "description": "Kiss Cut Stickers (5.5\" × 5.5\")", "width": 5.5, "height": 5.5},
    {"name": "Kiss Cut Stickers - 3.75\" × 15\"", "description": "Kiss Cut Stickers (3.75\" × 15\")", "width": 3.75, "height": 15},
    {"name": "Bandana", "description": "Bandana (27.5\" × 27.5\")", "width": 27.5, "height": 27.5},
    {"name": "Jigsaw Puzzle with Tin - 10\" × 18\" (110 pcs)", "description": "Jigsaw Puzzle 110 pcs", "width": 9.84, "height": 7.83},
    {"name": "Jigsaw Puzzle with Tin - 10\" × 18\" (30 pcs)", "description": "Jigsaw Puzzle 30 pcs", "width": 9.84, "height": 7.83},
    {"name": "Jigsaw Puzzle with Tin - 14\" × 11\" (252 pcs)", "description": "Jigsaw Puzzle 252 pcs", "width": 14, "height": 11},
    {"name": "Jigsaw Puzzle with Tin - 21\" × 15.5\" (500 pcs)", "description": "Jigsaw Puzzle 500 pcs", "width": 21, "height": 15.5},
    {"name": "Jigsaw Puzzle with Tin - 30\" × 20\" (1000 pcs)", "description": "Jigsaw Puzzle 1000 pcs", "width": 30.25, "height": 20.5},
    {"name": "Die-Cut Magnets - 3\" × 3\"", "description": "Die-Cut Magnets (3\" × 3\")", "width": 3, "height": 3},
    {"name": "Die-Cut Magnets - 4\" × 4\"", "description": "Die-Cut Magnets (4\" × 4\")", "width": 4, "height": 4},
    {"name": "Die-Cut Magnets - 6\" × 6\"", "description": "Die-Cut Magnets (6\" × 6\")", "width": 6, "height": 6},
    {"name": "Greeting Card - 4\" × 6\"", "description": "Greeting Card (4\" × 6\")", "width": 4.15, "height": 6.15},
    {"name": "Greeting Card - 5\" × 7\"", "description": "Greeting Card (5\" × 7\")", "width": 5.15, "height": 7.15},
    {"name": "Greeting Card - 5.83\" × 8.27\"", "description": "Greeting Card (5.83\" × 8.27\")", "width": 5.98, "height": 8.42},
]


def get_products():
    return sorted(PRINT_AREA_PRODUCTS, key=lambda p: p["name"].lower())


def get_dimensions_for_product(product_name, size_label=None):
    """Return (width, height) in inches for the product (and optional size)."""
    for p in PRINT_AREA_PRODUCTS:
        if p["name"] == product_name:
            if size_label and p.get("sizes"):
                for s in p["sizes"]:
                    if s["label"] == size_label:
                        return (s["width"], s["height"])
            return (p["width"], p["height"])
    return None
