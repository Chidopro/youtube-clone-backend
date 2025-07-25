# 🛍️ ScreenMerch Product Update Guide

## 📊 Current Product Summary

You have **22 products** across **4 categories**:

### 👕 Clothing (13 items)
- **Soft Tee** - $24.99
- **Unisex Classic Tee** - $24.99  
- **Men's Tank Top** - $19.99
- **Unisex Hoodie** - $22.99
- **Cropped Hoodie** - $39.99
- **Unisex Champion Hoodie** - $29.99
- **Women's Ribbed Neck** - $25.99
- **Women's Shirt** - $26.99
- **Women's HD Shirt** - $28.99
- **Kids Shirt** - $19.99
- **Kids Hoodie** - $29.99
- **Kids Long Sleeve** - $24.99
- **Men's Long Sleeve** - $29.99

### 👜 Accessories (3 items)
- **Canvas Tote** - $18.99
- **Tote Bag** - $21.99
- **Large Canvas Bag** - $24.99

### 🏠 Home & Other (6 items)
- **Greeting Card** - $22.99
- **Notebook** - $14.99
- **Coasters** - $13.99
- **Sticker Pack** - $8.99
- **Dog Bowl** - $12.99
- **Magnet Set** - $11.99

## 💰 Profit Margin Recommendations

| Category | Suggested Margin | Example |
|----------|------------------|---------|
| **Clothing** | 30-50% | $20 cost → $33.33 retail |
| **Accessories** | 35-55% | $20 cost → $36.36 retail |
| **Home** | 40-60% | $20 cost → $40.00 retail |
| **Other** | 45-65% | $20 cost → $44.44 retail |

## 🔧 How to Update Your Products

### Step 1: Review Current Prices
1. Check your current prices against market competition
2. Verify Printful costs for each product
3. Calculate desired profit margins

### Step 2: Edit the Template
1. Open `product_update_template.json`
2. For each product, update:
   - `suggested_price`: Your new retail price
   - `cost_estimate`: Your Printful cost
   - `available`: Set to `false` if product unavailable
   - `notes`: Any special notes

### Step 3: Run the Update Script
```bash
python update_products.py
```

This will automatically update:
- `backend/app.py`
- `app.py`
- `frontend_app.py`
- `frontend/src/data/products.js`
- `src/data/products.js`

### Step 4: Deploy Changes
```bash
# Deploy backend
flyctl deploy

# Deploy frontend
cd frontend
npm run build
npx netlify-cli deploy --dir=dist --prod
```

## 📋 Pre-Launch Checklist

### ✅ Product Verification
- [ ] All products available in Printful
- [ ] Prices competitive with market
- [ ] Profit margins calculated (target 40-50%)
- [ ] Product images uploaded
- [ ] Product descriptions updated

### ✅ Technical Setup
- [ ] Order fulfillment process tested
- [ ] Email notifications working
- [ ] Payment processing tested
- [ ] Inventory tracking configured

### ✅ Business Setup
- [ ] Shipping costs configured
- [ ] Tax settings configured
- [ ] Customer support ready
- [ ] Return policy established

## 🎯 Quick Actions

### To view current catalog:
```bash
python -c "import product_review_tool; product_review_tool.display_product_summary()"
```

### To check profit margins:
```bash
python -c "import product_review_tool; product_review_tool.calculate_profit_margins()"
```

### To generate new template:
```bash
python -c "import product_review_tool; product_review_tool.generate_product_update_template()"
```

## 💡 Tips for Success

1. **Start with your bestsellers** - Focus on products you expect to sell most
2. **Test pricing** - Consider A/B testing different price points
3. **Monitor competition** - Keep an eye on similar products
4. **Track performance** - Monitor which products sell best
5. **Adjust inventory** - Remove slow-moving items, add trending products

## 🚀 Ready to Launch?

Once you've updated your product catalog:

1. **Review all changes** in the updated files
2. **Test the product pages** on your site
3. **Deploy the changes** to production
4. **Verify Printful integration** works correctly
5. **Monitor first orders** to ensure everything works

---

**Need help?** Check the product review tool for detailed analysis and recommendations. 