// Printful API Integration Example for ScreenMerch
// This shows how to integrate Printful API into your existing workflow

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_BASE_URL = 'https://api.printful.com';

// Printful API wrapper
class PrintfulAPI {
  constructor() {
    this.apiKey = PRINTFUL_API_KEY;
    this.baseURL = PRINTFUL_BASE_URL;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const options = {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    };

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Printful API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Printful API request failed:', error);
      throw error;
    }
  }

  // Upload image to Printful
  async uploadImage(imageData) {
    // Convert base64 to file if needed
    const imageFile = this.base64ToFile(imageData);
    
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('type', 'image');

    const response = await fetch(`${this.baseURL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }

    const result = await response.json();
    return result.result; // Returns file info with URL
  }

  // Create product in Printful
  async createProduct(productData) {
    const { name, description, thumbnail, variants } = productData;
    
    const productPayload = {
      name,
      description,
      thumbnail,
      variants: variants.map(variant => ({
        id: variant.printful_id,
        files: variant.files,
        options: variant.options
      }))
    };

    return await this.makeRequest('/products', 'POST', productPayload);
  }

  // Create order in Printful
  async createOrder(orderData) {
    const { recipient, items, shipping, retail_costs } = orderData;
    
    const orderPayload = {
      recipient,
      items,
      shipping,
      retail_costs
    };

    return await this.makeRequest('/orders', 'POST', orderPayload);
  }

  // Generate mockup
  async generateMockup(variantId, imageUrl) {
    const mockupPayload = {
      variant_ids: [variantId],
      format: 'jpg',
      files: [{ url: imageUrl }]
    };

    return await this.makeRequest('/mockup-generator/create-task', 'POST', mockupPayload);
  }

  // Helper method to convert base64 to file
  base64ToFile(base64Data) {
    // Implementation depends on your environment (Node.js vs browser)
    // This is a simplified example
    const byteCharacters = atob(base64Data.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/png' });
  }
}

// Integration with your existing workflow
class ScreenMerchPrintfulIntegration {
  constructor() {
    this.printful = new PrintfulAPI();
  }

  // Main method to handle automated product creation
  async createAutomatedProduct(userSelection) {
    try {
      const { image, productType, variants, customerInfo, videoUrl } = userSelection;
      
      console.log('Starting automated product creation...');
      
      // Step 1: Upload image to Printful
      console.log('Uploading image to Printful...');
      const uploadedImage = await this.printful.uploadImage(image);
      console.log('Image uploaded:', uploadedImage.url);
      
      // Step 2: Create product with variants
      console.log('Creating product in Printful...');
      const product = await this.printful.createProduct({
        name: `Custom ${productType.name} - ${this.generateProductName(videoUrl)}`,
        description: `Custom merchandise from ${videoUrl}`,
        thumbnail: uploadedImage.url,
        variants: this.mapVariantsToPrintful(productType, variants, uploadedImage.url)
      });
      
      console.log('Product created:', product.result.id);
      
      // Step 3: Generate mockups for preview
      console.log('Generating product mockups...');
      const mockups = await this.generateProductMockups(product.result.variants, uploadedImage.url);
      
      // Step 4: Return product info for order creation
      return {
        success: true,
        product_id: product.result.id,
        mockups: mockups,
        image_url: uploadedImage.url,
        printful_product: product.result
      };
      
    } catch (error) {
      console.error('Automated product creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create order when user completes purchase
  async createOrder(orderData) {
    try {
      const { customerInfo, items, shippingAddress } = orderData;
      
      const order = await this.printful.createOrder({
        recipient: {
          name: customerInfo.name,
          address1: shippingAddress.address1,
          city: shippingAddress.city,
          country_code: shippingAddress.country_code,
          state_code: shippingAddress.state_code,
          zip: shippingAddress.zip
        },
        items: items.map(item => ({
          variant_id: item.printful_variant_id,
          quantity: item.quantity,
          files: [{ url: item.image_url }]
        })),
        shipping: 'STANDARD',
        retail_costs: {
          currency: 'USD',
          subtotal: orderData.subtotal,
          total: orderData.total
        }
      });
      
      return {
        success: true,
        order_id: order.result.id,
        printful_order: order.result
      };
      
    } catch (error) {
      console.error('Order creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate mockups for product preview
  async generateProductMockups(variants, imageUrl) {
    const mockups = [];
    
    for (const variant of variants) {
      try {
        const mockup = await this.printful.generateMockup(variant.id, imageUrl);
        mockups.push({
          variant_id: variant.id,
          mockup_url: mockup.result.mockup_url
        });
      } catch (error) {
        console.error(`Failed to generate mockup for variant ${variant.id}:`, error);
      }
    }
    
    return mockups;
  }

  // Map your product variants to Printful format
  mapVariantsToPrintful(productType, variants, imageUrl) {
    // This would map your existing product types to Printful variant IDs
    const printfulVariants = [];
    
    // Example mapping for a t-shirt
    if (productType.name === 'Unisex Classic Tee') {
      const colorMap = {
        'Black': 4012,
        'White': 4013,
        'Gray': 4014,
        'Navy': 4015
      };
      
      const sizeMap = {
        'S': 'S',
        'M': 'M', 
        'L': 'L',
        'XL': 'XL'
      };
      
      for (const color of variants.colors || []) {
        for (const size of variants.sizes || []) {
          printfulVariants.push({
            printful_id: colorMap[color],
            files: [{ url: imageUrl }],
            options: {
              size: sizeMap[size],
              color: color
            }
          });
        }
      }
    }
    
    return printfulVariants;
  }

  // Generate product name from video URL
  generateProductName(videoUrl) {
    // Extract video ID and create a readable name
    const videoId = videoUrl.split('v=')[1]?.split('&')[0];
    return videoId ? `Video-${videoId.substring(0, 8)}` : 'Custom';
  }
}

// Export for use in your application
module.exports = {
  PrintfulAPI,
  ScreenMerchPrintfulIntegration
}; 