# Printful API Integration for ScreenMerch Flask Backend
import os
import requests
import base64
import uuid
import logging
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class PrintfulAPI:
    """Printful API wrapper for ScreenMerch integration"""
    
    def __init__(self):
        self.api_key = os.getenv("PRINTFUL_API_KEY")
        self.base_url = "https://api.printful.com"
        
        if not self.api_key:
            raise ValueError("PRINTFUL_API_KEY environment variable is required")
    
    def _make_request(self, endpoint: str, method: str = "GET", data: dict = None) -> dict:
        """Make authenticated request to Printful API"""
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Printful API request failed: {str(e)}")
            raise
    
    def upload_image(self, image_data: str) -> dict:
        """Upload image to Printful CDN"""
        try:
            # Convert base64 to bytes
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            
            # Create temporary file for upload
            temp_filename = f"temp_{uuid.uuid4()}.png"
            with open(temp_filename, 'wb') as f:
                f.write(image_bytes)
            
            # Upload to Printful
            with open(temp_filename, 'rb') as f:
                files = {'file': f}
                data = {'type': 'image'}
                
                response = requests.post(
                    f"{self.base_url}/files",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files=files,
                    data=data
                )
            
            # Clean up temp file
            os.remove(temp_filename)
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Image uploaded successfully: {result['result']['url']}")
            return result['result']
            
        except Exception as e:
            logger.error(f"Failed to upload image: {str(e)}")
            raise
    
    def create_product(self, product_data: dict) -> dict:
        """Create product in Printful"""
        try:
            result = self._make_request("/products", "POST", product_data)
            logger.info(f"Product created successfully: {result['result']['id']}")
            return result['result']
        except Exception as e:
            logger.error(f"Failed to create product: {str(e)}")
            raise
    
    def get_shipping_rates(self, shipping_data: dict) -> dict:
        """Get shipping rates from Printful"""
        try:
            result = self._make_request("/shipping/rates", "POST", shipping_data)
            logger.info(f"Shipping rates retrieved successfully")
            return result
        except Exception as e:
            logger.error(f"Failed to get shipping rates: {str(e)}")
            raise
    
    def create_order(self, order_data: dict) -> dict:
        """Create order in Printful"""
        try:
            result = self._make_request("/orders", "POST", order_data)
            logger.info(f"Order created successfully: {result['result']['id']}")
            return result['result']
        except Exception as e:
            logger.error(f"Failed to create order: {str(e)}")
            raise
    
    def generate_mockup(self, variant_id: int, image_url: str) -> dict:
        """Generate product mockup"""
        try:
            mockup_data = {
                "variant_ids": [variant_id],
                "format": "jpg",
                "files": [{"url": image_url}]
            }
            
            result = self._make_request("/mockup-generator/create-task", "POST", mockup_data)
            logger.info(f"Mockup generation started: {result['result']['id']}")
            return result['result']
        except Exception as e:
            logger.error(f"Failed to generate mockup: {str(e)}")
            raise

class ScreenMerchPrintfulIntegration:
    """Main integration class for ScreenMerch with Printful"""
    
    def __init__(self):
        self.printful = PrintfulAPI()
        
        # Product type mappings to Printful variant IDs
        self.product_mappings = {
            "Unisex Classic Tee": {
                "variant_id": 4012,  # Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014,
                    "Navy": 4015
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Unisex Hoodie": {
                "variant_id": 4383,  # Bella + Canvas 3710 Unisex Fleece Pullover Hoodie
                "colors": {
                    "Black": 4383,
                    "Gray": 4384
                },
                "sizes": ["S", "M", "L"]
            },
            "Canvas Tote": {
                "variant_id": 1,  # Canvas Tote Bag
                "colors": {
                    "Natural": 1,
                    "Black": 2
                },
                "sizes": []
            },
            "Soft Tee": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Men's Tank Top": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Cropped Hoodie": {
                "variant_id": 4383,
                "colors": {
                    "Black": 4383,
                    "Gray": 4384,
                    "Navy": 4385
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Women's Ribbed Neck": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014,
                    "Pink": 4016
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Women's Shirt": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014,
                    "Pink": 4016
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Women's HD Shirt": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014,
                    "Navy": 4015
                },
                "sizes": ["S", "M", "L", "XL"]
            },
            "Kids Shirt": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014,
                    "Pink": 4016
                },
                "sizes": ["XS", "S", "M", "L"]
            },
            "Kids Hoodie": {
                "variant_id": 4383,
                "colors": {
                    "Black": 4383,
                    "White": 4384,
                    "Gray": 4385,
                    "Navy": 4386
                },
                "sizes": ["XS", "S", "M", "L"]
            },
            "Kids Long Sleeve": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014,
                    "Pink": 4016
                },
                "sizes": ["XS", "S", "M", "L"]
            },
            "Tote Bag": {
                "variant_id": 1,
                "colors": {
                    "White": 1,
                    "Black": 2,
                    "Blue": 3
                },
                "sizes": []
            },
            "Large Canvas Bag": {
                "variant_id": 1,
                "colors": {
                    "Natural": 1,
                    "Black": 2,
                    "Navy": 3
                },
                "sizes": []
            },
            "Greeting Card": {
                "variant_id": 1,
                "colors": {
                    "White": 1,
                    "Cream": 2
                },
                "sizes": []
            },
            "Notebook": {
                "variant_id": 1,
                "colors": {
                    "Black": 1,
                    "Blue": 2
                },
                "sizes": []
            },
            "Coasters": {
                "variant_id": 1,
                "colors": {
                    "Wood": 1,
                    "Cork": 2,
                    "Black": 3
                },
                "sizes": []
            },
            "Sticker Pack": {
                "variant_id": 1,
                "colors": {},
                "sizes": []
            },
            "Dog Bowl": {
                "variant_id": 1,
                "colors": {},
                "sizes": []
            },
            "Magnet Set": {
                "variant_id": 1,
                "colors": {},
                "sizes": []
            },
            "Men's Long Sleeve": {
                "variant_id": 4012,
                "colors": {
                    "Black": 4012,
                    "White": 4013,
                    "Gray": 4014
                },
                "sizes": ["S", "M", "L", "XL"]
            }
        }
    
    def create_automated_product(self, user_selection: dict) -> dict:
        """Create automated product in Printful"""
        try:
            image = user_selection['image']
            product_type = user_selection['productType']
            variants = user_selection['variants']
            video_url = user_selection.get('videoUrl', '')
            
            logger.info("Starting automated product creation...")
            
            # Step 1: Upload image to Printful
            logger.info("Uploading image to Printful...")
            uploaded_image = self.printful.upload_image(image)
            
            # Step 2: Create product with variants
            logger.info("Creating product in Printful...")
            product_variants = self._map_variants_to_printful(product_type, variants, uploaded_image['url'])
            
            product_data = {
                "name": f"Custom {product_type['name']} - {self._generate_product_name(video_url)}",
                "description": f"Custom merchandise from {video_url}",
                "thumbnail": uploaded_image['url'],
                "variants": product_variants
            }
            
            product = self.printful.create_product(product_data)
            
            # Step 3: Generate mockups for preview
            logger.info("Generating product mockups...")
            mockups = self._generate_product_mockups(product['variants'], uploaded_image['url'])
            
            return {
                "success": True,
                "product_id": product['id'],
                "mockups": mockups,
                "image_url": uploaded_image['url'],
                "printful_product": product
            }
            
        except Exception as e:
            logger.error(f"Automated product creation failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def calculate_shipping_rates(self, recipient_data: dict, items: list) -> dict:
        """Calculate shipping rates for given items and destination"""
        try:
            # Format items for Printful shipping calculation
            shipping_items = []
            for item in items:
                # Get variant_id from your product mapping or use a default
                variant_id = item.get('printful_variant_id', 71)  # Default to basic t-shirt variant
                shipping_items.append({
                    "variant_id": variant_id,
                    "quantity": item.get('quantity', 1)
                })
            
            shipping_payload = {
                "recipient": {
                    "country_code": recipient_data['country_code'],
                    "state_code": recipient_data.get('state_code', ''),
                    "city": recipient_data.get('city', ''),
                    "zip": recipient_data.get('zip', '')
                },
                "items": shipping_items,
                "currency": "USD"
            }
            
            # Call Printful shipping rates API
            shipping_rates = self.printful.get_shipping_rates(shipping_payload)
            
            if shipping_rates and 'result' in shipping_rates:
                rates = shipping_rates['result']
                
                # Find the standard shipping rate
                standard_rate = None
                for rate in rates:
                    if rate['id'] == 'STANDARD':
                        standard_rate = rate
                        break
                
                if standard_rate:
                    return {
                        "success": True,
                        "shipping_cost": float(standard_rate['rate']),
                        "currency": "USD",
                        "delivery_days": standard_rate.get('minDeliveryDays', 5),
                        "all_rates": rates
                    }
                else:
                    # Fallback to first available rate
                    if rates:
                        fallback_rate = rates[0]
                        return {
                            "success": True,
                            "shipping_cost": float(fallback_rate['rate']),
                            "currency": "USD",
                            "delivery_days": fallback_rate.get('minDeliveryDays', 5),
                            "all_rates": rates
                        }
            
            # Fallback to default rates if API fails
            return self._get_default_shipping_rate(recipient_data['country_code'])
            
        except Exception as e:
            logger.error(f"Shipping calculation failed: {str(e)}")
            # Return default shipping rate based on country
            return self._get_default_shipping_rate(recipient_data.get('country_code', 'US'))
    
    def _get_default_shipping_rate(self, country_code: str) -> dict:
        """Fallback shipping rates when API is unavailable"""
        default_rates = {
            'US': 6.99,
            'MX': 6.99,
            'CA': 9.99,
            'GB': 9.99,
            'DE': 9.99,
            'FR': 9.99,
            'AU': 14.99,
            'JP': 14.99,
            'IN': 19.99,
            'BR': 19.99
        }
        
        shipping_cost = default_rates.get(country_code, 24.99)  # Default to highest rate
        
        return {
            "success": True,
            "shipping_cost": shipping_cost,
            "currency": "USD",
            "delivery_days": 7,
            "fallback": True
        }

    def create_order(self, order_data: dict) -> dict:
        """Create order in Printful"""
        try:
            customer_info = order_data['customerInfo']
            items = order_data['items']
            shipping_address = order_data['shippingAddress']
            
            # Format items for Printful
            printful_items = []
            for item in items:
                printful_items.append({
                    "variant_id": item['printful_variant_id'],
                    "quantity": item['quantity'],
                    "files": [{"url": item['image_url']}]
                })
            
            order_payload = {
                "recipient": {
                    "name": customer_info['name'],
                    "address1": shipping_address['address1'],
                    "city": shipping_address['city'],
                    "country_code": shipping_address['country_code'],
                    "state_code": shipping_address['state_code'],
                    "zip": shipping_address['zip']
                },
                "items": printful_items,
                "shipping": "STANDARD",
                "retail_costs": {
                    "currency": "USD",
                    "subtotal": order_data['subtotal'],
                    "total": order_data['total']
                }
            }
            
            order = self.printful.create_order(order_payload)
            
            return {
                "success": True,
                "order_id": order['id'],
                "printful_order": order
            }
            
        except Exception as e:
            logger.error(f"Order creation failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _map_variants_to_printful(self, product_type: dict, variants: dict, image_url: str) -> List[dict]:
        """Map product variants to Printful format"""
        printful_variants = []
        
        product_mapping = self.product_mappings.get(product_type['name'])
        if not product_mapping:
            logger.warning(f"No mapping found for product type: {product_type['name']}")
            return []
        
        colors = variants.get('colors', [])
        sizes = variants.get('sizes', [])
        
        # If no colors specified, use all available
        if not colors:
            colors = list(product_mapping['colors'].keys())
        
        # If no sizes specified, use all available
        if not sizes:
            sizes = product_mapping['sizes']
        
        for color in colors:
            for size in sizes:
                if color in product_mapping['colors']:
                    printful_variants.append({
                        "id": product_mapping['colors'][color],
                        "files": [{"url": image_url}],
                        "options": {
                            "size": size,
                            "color": color
                        }
                    })
        
        return printful_variants
    
    def _generate_product_mockups(self, variants: List[dict], image_url: str) -> List[dict]:
        """Generate mockups for product preview"""
        mockups = []
        
        for variant in variants:
            try:
                mockup = self.printful.generate_mockup(variant['id'], image_url)
                mockups.append({
                    "variant_id": variant['id'],
                    "mockup_url": mockup.get('mockup_url', '')
                })
            except Exception as e:
                logger.error(f"Failed to generate mockup for variant {variant['id']}: {str(e)}")
        
        return mockups
    
    def _generate_product_name(self, video_url: str) -> str:
        """Generate product name from video URL"""
        if not video_url:
            return "Custom"
        
        try:
            # Extract video ID from YouTube URL
            if 'v=' in video_url:
                video_id = video_url.split('v=')[1].split('&')[0]
                return f"Video-{video_id[:8]}"
            else:
                return "Custom"
        except:
            return "Custom"

# Example usage in your Flask app
def add_printful_routes(app, supabase):
    """Add Printful integration routes to Flask app"""
    
    printful_integration = ScreenMerchPrintfulIntegration()
    
    @app.route("/api/printful/create-product", methods=["POST"])
    def create_printful_product():
        try:
            data = request.get_json()
            thumbnail = data['thumbnail']
            video_url = data['videoUrl']
            product_type = data['productType']
            variants = data['variants']
            
            # Create automated product
            result = printful_integration.create_automated_product({
                'image': thumbnail,
                'productType': product_type,
                'variants': variants,
                'videoUrl': video_url
            })
            
            if result['success']:
                # Store Printful product info in database
                product_data = {
                    "product_id": str(uuid.uuid4()),
                    "printful_product_id": result['product_id'],
                    "thumbnail_url": result['image_url'],
                    "video_url": video_url,
                    "mockups": result['mockups']
                }
                
                # Save to Supabase
                supabase.table('products').insert(product_data).execute()
                
                return jsonify({
                    "success": True,
                    "product_url": f"http://127.0.0.1:5000/product/{product_data['product_id']}",
                    "mockups": result['mockups']
                })
            else:
                return jsonify({
                    "success": False,
                    "error": result['error']
                }), 500
                
        except Exception as e:
            logger.error(f"Printful product creation error: {str(e)}")
            return jsonify(success=False, error="Internal server error"), 500
    
    @app.route("/api/printful/create-order", methods=["POST"])
    def create_printful_order():
        try:
            data = request.get_json()
            cart = data['cart']
            customer_info = data['customerInfo']
            
            # Create order in Printful
            result = printful_integration.create_order({
                'customerInfo': customer_info,
                'items': cart,
                'shippingAddress': customer_info['shipping_address']
            })
            
            if result['success']:
                return jsonify({
                    "success": True,
                    "order_id": result['order_id'],
                    "tracking_url": result['printful_order'].get('tracking_url', '')
                })
            else:
                return jsonify({
                    "success": False,
                    "error": result['error']
                }), 500
                
        except Exception as e:
            logger.error(f"Printful order creation error: {str(e)}")
            return jsonify(success=False, error="Internal server error"), 500 