// Print Area Configuration for Products
// Dimensions are in inches (width x height)
// These dimensions represent the maximum print area for each product at 300 DPI
// 
// Structure:
// - Simple format: { width, height, dpi, description } - for products with same dimensions for all sizes
// - Size-specific format: { front: { sizes: {...}, default: {...} }, back: {...}, dpi, description }
//   - sizes: object with size groups as keys (e.g., "XS-S", "M-2XL", "L-XL")
//   - default: fallback dimensions if size not found

export const PRINT_AREA_CONFIG = {
  // Kids Products
  "Kids Long Sleeve": {
    front: {
      default: { width: 10, height: 12 }
    },
    back: {
      default: { width: 10, height: 12 }
    },
    dpi: 300,
    description: "Youth Long Sleeve Tee"
  },
  "Kids Shirt": {
    front: {
      sizes: {
        "S-M": { width: 10, height: 12 },
        "L-XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    back: {
      sizes: {
        "S-M": { width: 10, height: 12 },
        "L-XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    dpi: 300,
    description: "Kids T-Shirt"
  },
  "Kids Hoodie": {
    width: 12,
    height: 14,
    dpi: 300,
    description: "Kids Hoodie"
  },
  "Youth Heavy Blend Hoodie": {
    front: {
      sizes: {
        "XS": { width: 10, height: 7 },
        "S": { width: 10, height: 8 },
        "M": { width: 10, height: 9 },
        "L": { width: 11.5, height: 11 },
        "XL": { width: 11.5, height: 12 }
      },
      default: { width: 10, height: 9 }
    },
    back: {
      default: { width: 11.5, height: 13.8 } // Range: 10x12 to 11.5x13.8, using max
    },
    dpi: 300,
    description: "Youth Heavy Blend Hoodie"
  },
  "Toddler Short Sleeve T-Shirt": {
    width: 8,
    height: 10,
    dpi: 300,
    description: "Toddler T-Shirt"
  },
  "Toddler Jersey T-Shirt": {
    front: {
      default: { width: 7, height: 8 }
    },
    back: {
      default: { width: 7, height: 8 }
    },
    dpi: 300,
    description: "Toddler Jersey"
  },
  "Kids Sweatshirt": {
    front: {
      sizes: {
        "XS-M": { width: 10, height: 12 },
        "L-XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    back: {
      sizes: {
        "XS-M": { width: 10, height: 12 },
        "L-XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    dpi: 300,
    description: "Kids Sweatshirt"
  },
  "Baby Staple Tee": {
    front: {
      default: { width: 7, height: 8 }
    },
    back: {
      default: { width: 7, height: 8 }
    },
    dpi: 300,
    description: "Baby Tee"
  },
  "Baby Jersey T-Shirt": {
    front: {
      default: { width: 7, height: 8 }
    },
    back: {
      default: { width: 7, height: 8 }
    },
    dpi: 300,
    description: "Baby Jersey"
  },
  "Baby Body Suit": {
    front: {
      default: { width: 7, height: 8 }
    },
    back: {
      default: { width: 7, height: 8 }
    },
    dpi: 300,
    description: "Baby Body Suit"
  },
  
  // Men's Products
  "Unisex Classic Tee": {
    width: 12,
    height: 15,
    dpi: 300,
    description: "Standard T-Shirt"
  },
  "Unisex T-Shirt": {
    front: {
      sizes: {
        "XS-M": { width: 11.5, height: 13.8 },
        "L-3XL": { width: 15, height: 18 }
      },
      default: { width: 11.5, height: 13.8 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Unisex T-Shirt"
  },
  "Men's Tank Top": {
    front: {
      default: { width: 12, height: 16 } // 30.48 x 40.64 cm converted
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Tank Top"
  },
  "Men's Fitted Long Sleeve": {
    front: {
      default: { width: 12, height: 16 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Long Sleeve Shirt"
  },
  "Men's Long Sleeve Shirt": {
    front: {
      default: { width: 12, height: 16 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Long Sleeve Shirt"
  },
  "Unisex Hoodie": {
    front: {
      default: { width: 13, height: 13 } // Range: 10x10 to 13x13, using max
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Hoodie"
  },
  "Unisex Champion Hoodie": {
    front: {
      sizes: {
        "S-M": { width: 11.5, height: 11.5 },
        "L-XL": { width: 13, height: 13 },
        "2XL-3XL": { width: 14, height: 14 }
      },
      default: { width: 11.5, height: 11.5 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Champion Hoodie"
  },
  "Unisex Pullover Hoodie": {
    front: {
      default: { width: 13, height: 13 } // Range: 10x10 to 13x13, using max
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Pullover Hoodie"
  },
  "Unisex Heavyweight T-Shirt": {
    front: {
      default: { width: 12, height: 16 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Heavyweight T-Shirt"
  },
  "Unisex Oversized T-Shirt": {
    front: {
      default: { width: 11.5, height: 15.3 }
    },
    back: {
      default: { width: 11.5, height: 15.3 }
    },
    dpi: 300,
    description: "Oversized T-Shirt"
  },
  "Mens Fitted T-Shirt": {
    front: {
      default: { width: 12, height: 16 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Fitted T-Shirt"
  },
  
  // Women's Products
  "Women's Ribbed Neck": {
    front: {
      default: { width: 12, height: 16 }
    },
    back: {
      default: { width: 12, height: 16 }
    },
    dpi: 300,
    description: "Women's Ribbed Neck"
  },
  "Women's Shirt": {
    front: {
      sizes: {
        "S-M": { width: 10, height: 12 },
        "L-3XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    back: {
      sizes: {
        "S-M": { width: 10, height: 12 },
        "L-3XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    dpi: 300,
    description: "Women's Shirt"
  },
  "Women's HD Shirt": {
    width: 10,
    height: 13,
    dpi: 300,
    description: "Women's HD Shirt"
  },
  "Women's Crop Top": {
    front: {
      default: { width: 10, height: 10 }
    },
    back: {
      default: { width: 10, height: 10 }
    },
    dpi: 300,
    description: "Crop Top"
  },
  "Cropped Hoodie": {
    front: {
      default: { width: 10, height: 10 }
    },
    back: {
      default: { width: 10, height: 10 }
    },
    dpi: 300,
    description: "Cropped Hoodie"
  },
  "Fitted Racerback Tank": {
    front: {
      sizes: {
        "XS-S": { width: 10, height: 12 },
        "M-2XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    back: {
      sizes: {
        "XS-S": { width: 10, height: 12 },
        "M-2XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    dpi: 300,
    description: "Racerback Tank"
  },
  "Micro-Rib Tank Top": {
    front: {
      sizes: {
        "XS-S": { width: 10, height: 12 },
        "M-2XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    back: {
      sizes: {
        "XS-S": { width: 10, height: 12 },
        "M-2XL": { width: 12, height: 16 }
      },
      default: { width: 10, height: 12 }
    },
    dpi: 300,
    description: "Micro-Rib Tank"
  },
  
  // Hats
  "Distressed Dad Hat": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Dad Hat (Square)"
  },
  "Snapback Hat": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Snapback Hat (Square)"
  },
  "Five Panel Trucker Hat": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Trucker Hat (Square)"
  },
  "Five Panel Baseball Cap": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Baseball Cap (Square)"
  },
  
  // Mugs
  "White Glossy Mug": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Mug (Square)"
  },
  "Travel Mug": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Travel Mug (Square)"
  },
  "Enamel Mug": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Enamel Mug (Square)"
  },
  "Colored Mug": {
    width: 4,
    height: 4,
    dpi: 300,
    description: "Colored Mug (Square)"
  },
  
  // Bags
  "Canvas Tote": {
    width: 12,
    height: 14,
    dpi: 300,
    description: "Tote Bag"
  },
  "Tote Bag": {
    width: 12,
    height: 14,
    dpi: 300,
    description: "Tote Bag"
  },
  "Large Canvas Bag": {
    width: 14,
    height: 16,
    dpi: 300,
    description: "Large Canvas Bag"
  },
  "Laptop Sleeve": {
    width: 14,
    height: 10,
    dpi: 300,
    description: "Laptop Sleeve (Horizontal)"
  },
  "All-Over Print Drawstring": {
    width: 12,
    height: 14,
    dpi: 300,
    description: "Drawstring Bag"
  },
  "All Over Print Tote Pocket": {
    width: 12,
    height: 14,
    dpi: 300,
    description: "Tote with Pocket"
  },
  "All-Over Print Crossbody Bag": {
    width: 10,
    height: 12,
    dpi: 300,
    description: "Crossbody Bag"
  },
  "All-Over Print Utility Bag": {
    width: 12,
    height: 14,
    dpi: 300,
    description: "Utility Bag"
  },
  
  // Pets
  "Pet Bowl All-Over Print": {
    width: 6,
    height: 6,
    dpi: 300,
    description: "Pet Bowl (Square)"
  },
  "Pet Bandana Collar": {
    width: 12,
    height: 12,
    dpi: 300,
    description: "Bandana (Square)"
  },
  "All Over Print Leash": {
    width: 1,
    height: 48,
    dpi: 300,
    description: "Leash (Vertical)"
  },
  "All Over Print Collar": {
    width: 1,
    height: 12,
    dpi: 300,
    description: "Collar (Vertical)"
  },
  
  // Misc
  "Bandana": {
    width: 22,
    height: 22,
    dpi: 300,
    description: "Bandana (Square)"
  }
};

// Helper function to get print area config for a product
// Returns the config object which may have simple format or size-specific format
export const getPrintAreaConfig = (productName) => {
  return PRINT_AREA_CONFIG[productName] || null;
};

// Helper function to get dimensions for a product, size, and placement (front/back)
// Returns { width, height } in inches
export const getPrintAreaDimensions = (productName, size = null, placement = 'front') => {
  const config = PRINT_AREA_CONFIG[productName];
  if (!config) return null;
  
  // Check if it's the new size-specific format
  if (config.front || config.back) {
    const placementConfig = config[placement] || config.front;
    
    // If size is provided and sizes object exists, try to find matching size group
    if (size && placementConfig.sizes) {
      // Try to match size to size groups
      const sizeUpper = size.toUpperCase();
      
      // Check each size group
      for (const [sizeGroup, dimensions] of Object.entries(placementConfig.sizes)) {
        const sizes = sizeGroup.split('-').map(s => s.trim().toUpperCase());
        if (sizes.length === 1) {
          // Single size match
          if (sizeUpper === sizes[0]) {
            return dimensions;
          }
        } else {
          // Range match (e.g., "XS-S", "L-XL")
          // Simple check: if size is in the range
          const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
          const startIdx = sizeOrder.indexOf(sizes[0]);
          const endIdx = sizeOrder.indexOf(sizes[1]);
          const currentIdx = sizeOrder.indexOf(sizeUpper);
          
          if (startIdx !== -1 && endIdx !== -1 && currentIdx !== -1) {
            if (currentIdx >= startIdx && currentIdx <= endIdx) {
              return dimensions;
            }
          }
        }
      }
    }
    
    // Fall back to default if no size match or no size provided
    return placementConfig.default || { width: 12, height: 16 };
  }
  
  // Legacy format (simple width/height)
  return { width: config.width, height: config.height };
};

// Helper function to calculate aspect ratio from dimensions
export const getAspectRatio = (width, height) => {
  return width / height;
};

// Helper function to get aspect ratio for a product, size, and placement
export const getPrintAreaAspectRatio = (productName, size = null, placement = 'front') => {
  const dimensions = getPrintAreaDimensions(productName, size, placement);
  if (!dimensions) return null;
  return getAspectRatio(dimensions.width, dimensions.height);
};

// Helper function to calculate pixel dimensions at 300 DPI
export const getPixelDimensions = (widthInches, heightInches, dpi = 300) => {
  return {
    width: Math.round(widthInches * dpi),
    height: Math.round(heightInches * dpi)
  };
};

