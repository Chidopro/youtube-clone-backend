# Printful Integration Setup Guide

## 🚀 Quick Setup

### 1. Get Your Printful API Key

1. **Sign up for Printful**: Go to [https://www.printful.com](https://www.printful.com) and create an account
2. **Access API**: Go to your Printful dashboard → Settings → API
3. **Generate API Key**: Click "Generate API Key" and copy the key

### 2. Update Your Environment Variables

Add this line to your `.env` file:

```env
# Add this line to your existing .env file
PRINTFUL_API_KEY=your_printful_api_key_here
```

### 3. Install Dependencies

Make sure you have the required packages:

```bash
pip install requests
```

(You probably already have this since you're using it for other APIs)

## 🔧 Configuration

### Product Mappings

The integration includes mappings for all your current products:

- **T-Shirts**: Unisex Classic Tee, Soft Tee, Men's Tank Top, etc.
- **Hoodies**: Unisex Hoodie, Cropped Hoodie, Kids Hoodie, etc.
- **Women's Clothing**: Women's Ribbed Neck, Women's Shirt, Women's HD Shirt
- **Kids Clothing**: Kids Shirt, Kids Hoodie, Kids Long Sleeve
- **Accessories**: Canvas Tote, Tote Bag, Large Canvas Bag
- **Home Goods**: Greeting Card, Notebook, Coasters
- **Other**: Sticker Pack, Dog Bowl, Magnet Set

### Printful Variant IDs

The system maps your products to Printful's variant IDs:

- **4012**: Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt
- **4383**: Bella + Canvas 3710 Unisex Fleece Pullover Hoodie
- **1**: Canvas Tote Bag (and other accessories)

## 🧪 Testing the Integration

### 1. Test Product Creation

```bash
# Start your Flask server
python app.py
```

### 2. Test with a Sample Request

Use your browser extension or make a test request to:
```
POST http://localhost:5000/api/printful/create-product
```

### 3. Check Printful Dashboard

After testing, check your Printful dashboard to see if products are being created.

## 🔍 Troubleshooting

### Common Issues

1. **API Key Error**
   ```
   ValueError: PRINTFUL_API_KEY environment variable is required
   ```
   **Solution**: Make sure you've added the API key to your `.env` file

2. **Image Upload Error**
   ```
   Failed to upload image: [Error details]
   ```
   **Solution**: Check that your image is in a valid format (PNG, JPG) and under 50MB

3. **Product Creation Error**
   ```
   Failed to create product: [Error details]
   ```
   **Solution**: Verify that the product name exists in the mappings

### Debug Mode

Enable debug logging by setting the log level in `app.py`:

```python
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
```

## 📊 Monitoring

### Check Integration Status

1. **Logs**: Monitor your Flask application logs for Printful API calls
2. **Printful Dashboard**: Check your Printful dashboard for created products
3. **Database**: Check your Supabase database for stored product information

### Success Indicators

- ✅ Products appear in Printful dashboard
- ✅ Orders are created automatically
- ✅ Mockups are generated
- ✅ Tracking information is provided

## 🔄 Workflow

### Before Integration
```
User selects product → Add to cart → Checkout → Manual email → Manual processing
```

### After Integration
```
User selects product → Add to cart → Checkout → Automatic Printful processing → Order fulfilled
```

## 📞 Support

### Printful Support
- **API Documentation**: https://developers.printful.com/
- **Business Development**: business@printful.com
- **General Support**: https://www.printful.com/contact

### Your Integration
- Check the logs in your Flask application
- Verify environment variables are set correctly
- Test with a simple product first

## 🎯 Next Steps

1. **Contact Printful**: Reach out to their business development team
2. **Request Enhanced Limits**: Ask for higher API rate limits for automated operations
3. **Test Thoroughly**: Test with various products and scenarios
4. **Monitor Performance**: Track order processing times and success rates
5. **Scale Up**: Gradually increase automation as you validate the system

## 💡 Tips

- Start with a few test orders to validate the integration
- Monitor your Printful account for any rate limiting
- Keep your API key secure and never commit it to version control
- Consider implementing webhooks for real-time order updates
- Test the integration in a staging environment first 