# Print area dimensions for products (inches). Used by print-quality page to fit image to product.
# Mirrors frontend printAreaConfig for consistency with cart tools.
# Each product has default width/height; some have size-specific dimensions.

def _sizes(*pairs):
    """Helper: list of { label, width, height } from (label, w, h), ..."""
    return [{"label": l, "width": w, "height": h} for l, w, h in pairs]

# Flat list: name, description, default width/height, optional sizes for dropdown
PRINT_AREA_PRODUCTS = [
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
    {"name": "Unisex Classic Tee", "description": "Standard T-Shirt", "width": 12, "height": 15},
    {"name": "Unisex T-Shirt", "description": "Unisex T-Shirt", "width": 11.5, "height": 13.8,
     "sizes": _sizes(("XS-M", 11.5, 13.8), ("L-3XL", 15, 18))},
    {"name": "Men's Tank Top", "description": "Tank Top", "width": 12, "height": 16},
    {"name": "Unisex Hoodie", "description": "Hoodie", "width": 13, "height": 13},
    {"name": "Unisex Champion Hoodie", "description": "Champion Hoodie", "width": 11.5, "height": 11.5,
     "sizes": _sizes(("S-M", 11.5, 11.5), ("L-XL", 13, 13), ("2XL-3XL", 14, 14))},
    {"name": "Unisex Pullover Hoodie", "description": "Pullover Hoodie", "width": 13, "height": 13},
    {"name": "Unisex Heavyweight T-Shirt", "description": "Heavyweight T-Shirt", "width": 12, "height": 16},
    {"name": "Women's Shirt", "description": "Women's Shirt", "width": 10, "height": 12,
     "sizes": _sizes(("S-M", 10, 12), ("L-3XL", 12, 16))},
    {"name": "Women's Crop Top", "description": "Crop Top", "width": 10, "height": 10},
    {"name": "Cropped Hoodie", "description": "Cropped Hoodie", "width": 10, "height": 10},
    {"name": "Micro-Rib Tank Top", "description": "Micro-Rib Tank", "width": 10, "height": 12,
     "sizes": _sizes(("XS-S", 10, 12), ("M-2XL", 12, 16))},
    {"name": "White Glossy Mug", "description": "Mug (Square)", "width": 4, "height": 4},
    {"name": "Travel Mug", "description": "Travel Mug (Square)", "width": 4, "height": 4},
    {"name": "Tote Bag", "description": "Tote Bag", "width": 12, "height": 14},
    {"name": "Pet Bandana Collar", "description": "Bandana (Square)", "width": 12, "height": 12},
    {"name": "Pet Bowl All-Over Print", "description": "Pet Bowl (Square)", "width": 6, "height": 6},
    {"name": "Distressed Dad Hat", "description": "Dad Hat Front", "width": 5, "height": 2},
    {"name": "Five Panel Trucker Hat", "description": "Trucker Hat Front", "width": 5.5, "height": 2.5},
    {"name": "Canvas Tote", "description": "Tote Bag", "width": 12, "height": 14},
    {"name": "Laptop Sleeve", "description": "Laptop Sleeve (Horizontal)", "width": 14, "height": 10},
]

def get_products():
    return list(PRINT_AREA_PRODUCTS)

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
