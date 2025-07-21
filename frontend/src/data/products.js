export const products = {
  "alloverpajamatop": {
    name: "All Over Pajama Top",
    price: 29.99,
    description: "Comfortable all-over print pajama top",
    image: "/static/images/alloverpajamatop.png",
    preview: "/static/images/alloverpajamatoppreview.png",
    category: "clothing",
    variables: {
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      colors: ["Black", "White", "Navy", "Gray"],
      availability: {
        "XS": { "Black": true, "White": true, "Navy": false, "Gray": true },
        "S": { "Black": true, "White": true, "Navy": true, "Gray": true },
        "M": { "Black": true, "White": true, "Navy": true, "Gray": true },
        "L": { "Black": true, "White": false, "Navy": true, "Gray": true },
        "XL": { "Black": true, "White": true, "Navy": true, "Gray": false },
        "XXL": { "Black": false, "White": true, "Navy": true, "Gray": true }
      }
    }
  },
  "allovertotebag": {
    name: "All Over Tote Bag",
    price: 24.99,
    description: "Stylish all-over print tote bag",
    image: "/static/images/allovertotebag.png",
    preview: "/static/images/allovertotebagpreview.png",
    category: "bags",
    variables: {
      colors: ["Black", "White", "Navy", "Red"],
      availability: {
        "Black": true,
        "White": true,
        "Navy": true,
        "Red": false
      }
    }
  },
  "unisexclassictee": {
    name: "Unisex Classic T-Shirt",
    price: 19.99,
    description: "Classic unisex t-shirt with custom prints",
    image: "/static/images/unisexclassictee.png",
    preview: "/static/images/unisexclassicteepreview.png",
    category: "clothing",
    variables: {
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      colors: ["White", "Black", "Navy", "Gray", "Red"],
      availability: {
        "XS": { "White": true, "Black": true, "Navy": true, "Gray": true, "Red": false },
        "S": { "White": true, "Black": true, "Navy": true, "Gray": true, "Red": true },
        "M": { "White": true, "Black": true, "Navy": true, "Gray": true, "Red": true },
        "L": { "White": true, "Black": true, "Navy": true, "Gray": true, "Red": true },
        "XL": { "White": true, "Black": true, "Navy": true, "Gray": true, "Red": true },
        "XXL": { "White": true, "Black": true, "Navy": true, "Gray": true, "Red": true }
      }
    }
  }
};

// Helper function to check availability
export const checkAvailability = (productId, size = null, color = null) => {
  const product = products[productId];
  if (!product) return false;
  
  if (!product.variables) return true; // No variables = always available
  
  if (size && color) {
    return product.variables.availability?.[size]?.[color] ?? false;
  } else if (color) {
    return product.variables.availability?.[color] ?? false;
  }
  
  return true;
};

// Helper function to get available options
export const getAvailableOptions = (productId) => {
  const product = products[productId];
  if (!product?.variables) return { sizes: [], colors: [] };
  
  const available = { sizes: [], colors: [] };
  
  if (product.variables.sizes) {
    available.sizes = product.variables.sizes.filter(size => 
      Object.values(product.variables.availability[size] || {}).some(available => available)
    );
  }
  
  if (product.variables.colors) {
    if (product.variables.sizes) {
      // For products with both size and color
      const allColors = new Set();
      product.variables.sizes.forEach(size => {
        Object.entries(product.variables.availability[size] || {}).forEach(([color, available]) => {
          if (available) allColors.add(color);
        });
      });
      available.colors = Array.from(allColors);
    } else {
      // For products with only color
      available.colors = product.variables.colors.filter(color => 
        product.variables.availability[color]
      );
    }
  }
  
  return available;
}; 