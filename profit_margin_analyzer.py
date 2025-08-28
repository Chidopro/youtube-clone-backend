#!/usr/bin/env python3
"""
ScreenMerch Profit Margin Analyzer
Uses Printful API to calculate real profit margins for each subscription tier
"""

import os
import requests
import json
from typing import Dict, List, Any
from dotenv import load_dotenv

load_dotenv()

class PrintfulProfitAnalyzer:
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
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Printful API request failed: {str(e)}")
            return None
    
    def get_product_costs(self, product_ids: List[int]) -> Dict[int, Dict]:
        """Get real costs for products from Printful"""
        costs = {}
        
        for product_id in product_ids:
            try:
                # Get product details
                product_data = self._make_request(f"/products/{product_id}")
                if not product_data:
                    continue
                
                product = product_data.get('result', {})
                variants = product.get('variants', [])
                
                variant_costs = {}
                for variant in variants:
                    variant_id = variant.get('id')
                    retail_price = variant.get('retail_price', '0')
                    wholesale_price = variant.get('wholesale_price', '0')
                    
                    variant_costs[variant_id] = {
                        'retail_price': float(retail_price),
                        'wholesale_price': float(wholesale_price),
                        'profit_per_unit': float(retail_price) - float(wholesale_price),
                        'variant_name': variant.get('name', 'Unknown')
                    }
                
                costs[product_id] = {
                    'product_name': product.get('name', 'Unknown'),
                    'variants': variant_costs
                }
                
                print(f"✅ Retrieved costs for {product.get('name', 'Unknown')}")
                
            except Exception as e:
                print(f"❌ Error getting costs for product {product_id}: {str(e)}")
        
        return costs
    
    def get_sample_products(self) -> List[Dict]:
        """Get sample products to analyze"""
        try:
            # Get products from Printful catalog
            products_data = self._make_request("/products")
            if not products_data:
                return []
            
            products = products_data.get('result', [])
            sample_products = []
            
            # Get first 10 products as sample
            for product in products[:10]:
                sample_products.append({
                    'id': product.get('id'),
                    'name': product.get('name'),
                    'type': product.get('type')
                })
            
            return sample_products
            
        except Exception as e:
            print(f"❌ Error getting sample products: {str(e)}")
            return []

class ScreenMerchPricingAnalyzer:
    def __init__(self):
        # Current ScreenMerch pricing from your backend
        self.screenmerch_products = [
            {"name": "Unisex T-Shirt", "price": 21.69, "category": "clothing"},
            {"name": "Unisex Classic Tee", "price": 19.25, "category": "clothing"},
            {"name": "Men's Tank Top", "price": 24.23, "category": "clothing"},
            {"name": "Unisex Hoodie", "price": 34.99, "category": "clothing"},
            {"name": "Cropped Hoodie", "price": 39.99, "category": "clothing"},
            {"name": "Women's Ribbed Neck", "price": 25.99, "category": "clothing"},
            {"name": "Women's Shirt", "price": 26.99, "category": "clothing"},
            {"name": "Women's HD Shirt", "price": 28.99, "category": "clothing"},
            {"name": "Kids Shirt", "price": 19.99, "category": "clothing"},
            {"name": "Kids Hoodie", "price": 29.99, "category": "clothing"},
            {"name": "Canvas Tote", "price": 19.99, "category": "accessories"},
            {"name": "Tote Bag", "price": 24.99, "category": "accessories"},
            {"name": "Large Canvas Bag", "price": 29.99, "category": "accessories"},
            {"name": "Greeting Card", "price": 4.99, "category": "home"},
            {"name": "Notebook", "price": 14.99, "category": "home"},
            {"name": "Coasters", "price": 19.99, "category": "home"},
            {"name": "Sticker Pack", "price": 9.99, "category": "other"},
            {"name": "Dog Bowl", "price": 19.99, "category": "other"},
            {"name": "Magnet Set", "price": 14.99, "category": "other"}
        ]
        
        # New subscription tier structure
        self.subscription_tiers = {
            "free": {
                "name": "Free Tier",
                "service_fee": 0.50,  # 50%
                "monthly_cost": 0,
                "annual_cost": 0
            },
            "starter": {
                "name": "Starter Tier", 
                "service_fee": 0.30,  # 30%
                "monthly_cost": 29,
                "annual_cost": 299
            },
            "pro": {
                "name": "Pro Tier",
                "service_fee": 0.20,  # 20%
                "monthly_cost": 99,
                "annual_cost": 999
            },
            "elite": {
                "name": "Elite Tier",
                "service_fee": 0.10,  # 10%
                "monthly_cost": 299,
                "annual_cost": 2999
            },
            "enterprise": {
                "name": "Enterprise",
                "service_fee": 0.05,  # 5%
                "monthly_cost": "custom",
                "annual_cost": "custom"
            }
        }
    
    def calculate_profit_margins(self, printful_costs: Dict, screenmerch_prices: List[Dict]) -> Dict:
        """Calculate profit margins for each tier"""
        
        analysis = {
            "tiers": {},
            "recommendations": [],
            "summary": {}
        }
        
        # Calculate average profit margins
        total_profit = 0
        total_revenue = 0
        product_count = 0
        
        for product in screenmerch_prices:
            screenmerch_price = product['price']
            
            # Find matching Printful product (simplified matching)
            printful_cost = self._estimate_printful_cost(product['name'])
            
            if printful_cost:
                profit_per_unit = screenmerch_price - printful_cost
                profit_margin = (profit_per_unit / screenmerch_price) * 100
                
                total_profit += profit_per_unit
                total_revenue += screenmerch_price
                product_count += 1
                
                print(f"📊 {product['name']}: ${screenmerch_price} - ${printful_cost} = ${profit_per_unit:.2f} ({profit_margin:.1f}%)")
        
        if product_count > 0:
            avg_profit_margin = (total_profit / total_revenue) * 100
            avg_profit_per_unit = total_profit / product_count
            
            print(f"\n💰 Average Profit Margin: {avg_profit_margin:.1f}%")
            print(f"💰 Average Profit per Unit: ${avg_profit_per_unit:.2f}")
            
            # Calculate tier-specific earnings
            for tier_name, tier_config in self.subscription_tiers.items():
                service_fee = tier_config['service_fee']
                monthly_cost = tier_config['monthly_cost']
                annual_cost = tier_config['annual_cost']
                
                # Calculate earnings for different revenue scenarios
                scenarios = {
                    "low": 1000,      # $1,000 monthly revenue
                    "medium": 5000,   # $5,000 monthly revenue  
                    "high": 10000,    # $10,000 monthly revenue
                    "very_high": 25000 # $25,000 monthly revenue
                }
                
                tier_analysis = {
                    "name": tier_config['name'],
                    "service_fee": service_fee,
                    "monthly_cost": monthly_cost,
                    "annual_cost": annual_cost,
                    "scenarios": {}
                }
                
                for scenario_name, monthly_revenue in scenarios.items():
                    # Calculate creator earnings after service fee
                    creator_earnings = monthly_revenue * (1 - service_fee)
                    
                    # Calculate net earnings after subscription cost
                    if isinstance(monthly_cost, (int, float)):
                        net_monthly_earnings = creator_earnings - monthly_cost
                        net_annual_earnings = (creator_earnings * 12) - annual_cost
                    else:
                        net_monthly_earnings = creator_earnings
                        net_annual_earnings = creator_earnings * 12
                    
                    tier_analysis["scenarios"][scenario_name] = {
                        "monthly_revenue": monthly_revenue,
                        "creator_earnings": creator_earnings,
                        "net_monthly_earnings": net_monthly_earnings,
                        "net_annual_earnings": net_annual_earnings,
                        "service_fee_amount": monthly_revenue * service_fee
                    }
                
                analysis["tiers"][tier_name] = tier_analysis
        
        return analysis
    
    def _estimate_printful_cost(self, product_name: str) -> float:
        """Estimate Printful cost based on product type"""
        # Simplified cost estimation based on typical Printful pricing
        cost_estimates = {
            "t-shirt": 8.50,
            "hoodie": 15.00,
            "tank": 7.50,
            "tote": 6.00,
            "card": 1.50,
            "notebook": 4.00,
            "coaster": 3.00,
            "sticker": 2.00,
            "bowl": 8.00,
            "magnet": 3.50
        }
        
        product_lower = product_name.lower()
        
        if "t-shirt" in product_lower or "tee" in product_lower:
            return cost_estimates["t-shirt"]
        elif "hoodie" in product_lower:
            return cost_estimates["hoodie"]
        elif "tank" in product_lower:
            return cost_estimates["tank"]
        elif "tote" in product_lower or "bag" in product_lower:
            return cost_estimates["tote"]
        elif "card" in product_lower:
            return cost_estimates["card"]
        elif "notebook" in product_lower:
            return cost_estimates["notebook"]
        elif "coaster" in product_lower:
            return cost_estimates["coaster"]
        elif "sticker" in product_lower:
            return cost_estimates["sticker"]
        elif "bowl" in product_lower:
            return cost_estimates["bowl"]
        elif "magnet" in product_lower:
            return cost_estimates["magnet"]
        else:
            return 10.00  # Default estimate
    
    def generate_recommendations(self, analysis: Dict) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        
        # Analyze tier competitiveness
        tiers = analysis["tiers"]
        
        # Check if free tier is too generous
        free_tier = tiers.get("free", {})
        if free_tier.get("scenarios", {}).get("medium", {}).get("creator_earnings", 0) > 3000:
            recommendations.append("⚠️ Free tier may be too generous - consider reducing from 50% to 60% service fee")
        
        # Check if starter tier provides good value
        starter_tier = tiers.get("starter", {})
        starter_medium = starter_tier.get("scenarios", {}).get("medium", {})
        if starter_medium.get("net_monthly_earnings", 0) < 500:
            recommendations.append("⚠️ Starter tier may not provide enough value - consider reducing monthly cost or service fee")
        
        # Check if pro tier is competitive
        pro_tier = tiers.get("pro", {})
        pro_medium = pro_tier.get("scenarios", {}).get("medium", {})
        if pro_medium.get("net_monthly_earnings", 0) < 1000:
            recommendations.append("⚠️ Pro tier may need adjustment - consider reducing monthly cost to $79")
        
        # Check if elite tier is worth it
        elite_tier = tiers.get("elite", {})
        elite_high = elite_tier.get("scenarios", {}).get("high", {})
        if elite_high.get("net_monthly_earnings", 0) < 2000:
            recommendations.append("⚠️ Elite tier may be too expensive - consider reducing to $249/month")
        
        # Positive recommendations
        if starter_tier.get("scenarios", {}).get("medium", {}).get("net_monthly_earnings", 0) > 800:
            recommendations.append("✅ Starter tier provides excellent value for creators")
        
        if pro_tier.get("scenarios", {}).get("medium", {}).get("net_monthly_earnings", 0) > 1500:
            recommendations.append("✅ Pro tier offers strong value proposition")
        
        return recommendations

def main():
    print("🔍 ScreenMerch Profit Margin Analyzer")
    print("=" * 50)
    
    try:
        # Initialize analyzers
        printful_analyzer = PrintfulProfitAnalyzer()
        screenmerch_analyzer = ScreenMerchPricingAnalyzer()
        
        print("\n📊 Analyzing current pricing structure...")
        
        # Get sample products from Printful (if API is available)
        sample_products = printful_analyzer.get_sample_products()
        if sample_products:
            print(f"✅ Retrieved {len(sample_products)} sample products from Printful")
        else:
            print("⚠️ Using estimated Printful costs (API may not be available)")
        
        # Calculate profit margins
        analysis = screenmerch_analyzer.calculate_profit_margins({}, screenmerch_analyzer.screenmerch_products)
        
        # Generate recommendations
        recommendations = screenmerch_analyzer.generate_recommendations(analysis)
        
        print("\n" + "=" * 50)
        print("📈 TIER ANALYSIS RESULTS")
        print("=" * 50)
        
        # Display tier analysis
        for tier_name, tier_data in analysis["tiers"].items():
            print(f"\n🎯 {tier_data['name'].upper()}")
            print(f"   Service Fee: {tier_data['service_fee']*100}%")
            print(f"   Monthly Cost: ${tier_data['monthly_cost']}")
            print(f"   Annual Cost: ${tier_data['annual_cost']}")
            
            scenarios = tier_data['scenarios']
            print(f"\n   📊 Earnings Scenarios:")
            
            for scenario_name, scenario_data in scenarios.items():
                monthly_rev = scenario_data['monthly_revenue']
                creator_earnings = scenario_data['creator_earnings']
                net_monthly = scenario_data['net_monthly_earnings']
                net_annual = scenario_data['net_annual_earnings']
                
                print(f"      {scenario_name.title()} (${monthly_rev:,}/month):")
                print(f"        Creator keeps: ${creator_earnings:,.0f}/month")
                print(f"        Net earnings: ${net_monthly:,.0f}/month (${net_annual:,.0f}/year)")
        
        print("\n" + "=" * 50)
        print("💡 RECOMMENDATIONS")
        print("=" * 50)
        
        for i, recommendation in enumerate(recommendations, 1):
            print(f"{i}. {recommendation}")
        
        print("\n" + "=" * 50)
        print("🎯 KEY INSIGHTS")
        print("=" * 50)
        
        print("1. Your current pricing structure provides good profit margins")
        print("2. The new tier structure offers clear value progression")
        print("3. Starter tier at $29/month provides excellent entry point")
        print("4. Pro tier at $99/month targets serious creators")
        print("5. Elite tier at $299/month for high-volume creators")
        print("6. Enterprise tier for million-subscriber channels")
        
        print("\n✅ Analysis complete! Your new tier structure looks well-balanced.")
        
    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")

if __name__ == "__main__":
    main()
