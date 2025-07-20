# Printful Configuration for ScreenMerch
# This file contains product mappings and configuration settings

# Printful Product Variant IDs
# These map your product names to Printful's variant IDs
PRINTFUL_VARIANTS = {
    # T-Shirts
    "Unisex Classic Tee": {
        "base_variant_id": 4012,  # Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt
        "colors": {
            "Black": 4012,
            "White": 4013,
            "Gray": 4014,
            "Navy": 4015
        },
        "sizes": ["S", "M", "L", "XL"]
    },
    
    # Hoodies
    "Unisex Hoodie": {
        "base_variant_id": 4383,  # Bella + Canvas 3710 Unisex Fleece Pullover Hoodie
        "colors": {
            "Black": 4383,
            "Gray": 4384
        },
        "sizes": ["S", "M", "L"]
    },
    
    "Cropped Hoodie": {
        "base_variant_id": 4383,
        "colors": {
            "Black": 4383,
            "Gray": 4384,
            "Navy": 4385
        },
        "sizes": ["S", "M", "L", "XL"]
    },
    
    # Women's Clothing
    "Women's Ribbed Neck": {
        "base_variant_id": 4012,
        "colors": {
            "Black": 4012,
            "White": 4013,
            "Gray": 4014,
            "Pink": 4016
        },
        "sizes": ["S", "M", "L", "XL"]
    },
    
    "Women's Shirt": {
        "base_variant_id": 4012,
        "colors": {
            "Black": 4012,
            "White": 4013,
            "Gray": 4014,
            "Pink": 4016
        },
        "sizes": ["S", "M", "L", "XL"]
    },
    
    "Women's HD Shirt": {
        "base_variant_id": 4012,
        "colors": {
            "Black": 4012,
            "White": 4013,
            "Gray": 4014,
            "Navy": 4015
        },
        "sizes": ["S", "M", "L", "XL"]
    },
    
    # Kids Clothing
    "Kids Shirt": {
        "base_variant_id": 4012,
        "colors": {
            "Black": 4012,
            "White": 4013,
            "Gray": 4014,
            "Pink": 4016
        },
        "sizes": ["XS", "S", "M", "L"]
    },
    
    "Kids Hoodie": {
        "base_variant_id": 4383,
        "colors": {
            "Black": 4383,
            "White": 4384,
            "Gray": 4385,
            "Navy": 4386
        },
        "sizes": ["XS", "S", "M", "L"]
    },
    
    "Kids Long Sleeve": {
        "base_variant_id": 4012,
        "colors": {
            "Black": 4012,
            "White": 4013,
            "Gray": 4014,
            "Pink": 4016
        },
        "sizes": ["XS", "S", "M", "L"]
    },
    
    # Bags
    "Canvas Tote": {
        "base_variant_id": 1,  # Canvas Tote Bag
        "colors": {
            "Natural": 1,
            "Black": 2
        },
        "sizes": []
    },
    
    "Tote Bag": {
        "base_variant_id": 1,
        "colors": {
            "White": 1,
            "Black": 2,
            "Blue": 3
        },
        "sizes": []
    },
    
    "Large Canvas Bag": {
        "base_variant_id": 1,
        "colors": {
            "Natural": 1,
            "Black": 2,
            "Navy": 3
        },
        "sizes": []
    },
    
    # Other Products
    "Greeting Card": {
        "base_variant_id": 1,
        "colors": {
            "White": 1,
            "Cream": 2
        },
        "sizes": []
    },
    
    "Notebook": {
        "base_variant_id": 1,
        "colors": {
            "Black": 1,
            "Blue": 2
        },
        "sizes": []
    },
    
    "Coasters": {
        "base_variant_id": 1,
        "colors": {
            "Wood": 1,
            "Cork": 2,
            "Black": 3
        },
        "sizes": []
    },
    
    # Products without variants
    "Sticker Pack": {
        "base_variant_id": 1,
        "colors": {},
        "sizes": []
    },
    
    "Dog Bowl": {
        "base_variant_id": 1,
        "colors": {},
        "sizes": []
    },
    
    "Magnet Set": {
        "base_variant_id": 1,
        "colors": {},
        "sizes": []
    }
}

# Printful API Configuration
PRINTFUL_CONFIG = {
    "base_url": "https://api.printful.com",
    "rate_limit": 100,  # requests per minute
    "timeout": 30,  # seconds
    "retry_attempts": 3,
    "mockup_format": "jpg",
    "image_quality": "high"
}

# Shipping Configuration
SHIPPING_OPTIONS = {
    "STANDARD": {
        "name": "Standard Shipping",
        "price": 0,
        "delivery_time": "7-14 business days"
    },
    "EXPRESS": {
        "name": "Express Shipping", 
        "price": 5.99,
        "delivery_time": "3-7 business days"
    }
}

# Product Categories
PRODUCT_CATEGORIES = {
    "clothing": ["Unisex Classic Tee", "Unisex Hoodie", "Cropped Hoodie", "Women's Ribbed Neck", "Women's Shirt", "Women's HD Shirt", "Kids Shirt", "Kids Hoodie", "Kids Long Sleeve"],
    "accessories": ["Canvas Tote", "Tote Bag", "Large Canvas Bag"],
    "home": ["Greeting Card", "Notebook", "Coasters"],
    "other": ["Sticker Pack", "Dog Bowl", "Magnet Set"]
}

# Helper Functions
def get_product_variant(product_name: str, color: str = None, size: str = None):
    """Get Printful variant ID for a product"""
    if product_name not in PRINTFUL_VARIANTS:
        return None
    
    product = PRINTFUL_VARIANTS[product_name]
    
    if color and color in product["colors"]:
        return product["colors"][color]
    
    return product["base_variant_id"]

def get_available_colors(product_name: str):
    """Get available colors for a product"""
    if product_name not in PRINTFUL_VARIANTS:
        return []
    
    return list(PRINTFUL_VARIANTS[product_name]["colors"].keys())

def get_available_sizes(product_name: str):
    """Get available sizes for a product"""
    if product_name not in PRINTFUL_VARIANTS:
        return []
    
    return PRINTFUL_VARIANTS[product_name]["sizes"]

def is_valid_product(product_name: str):
    """Check if a product name is valid"""
    return product_name in PRINTFUL_VARIANTS 