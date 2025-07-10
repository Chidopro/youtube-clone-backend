# Permanent Storage Setup Guide

This guide will help you set up permanent storage for your ScreenMerch images and product data so they don't disappear when you log out or restart the server.

## 🚨 **Problem Solved**
Currently, your images are stored in **in-memory storage** which gets wiped when:
- You log out and back in
- The server restarts
- The application crashes

## ✅ **Solution: Supabase Storage + Database**

### 1. **Install Python Dependencies**

Run this command in your project directory:

```bash
pip install -r requirements.txt
```

### 2. **Set Up Supabase Storage Bucket**

1. Go to your Supabase dashboard
2. Navigate to **Storage**
3. Click **Create a new bucket**
4. Name it: `product-images`
5. Set it to **Public**
6. Click **Create bucket**

### 3. **Create Products Table**

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `database_products_setup.sql`
3. Run the script

### 4. **Update Your Environment Variables**

Make sure your `.env` file includes:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. **Test the Setup**

1. Restart your Flask server
2. Create a new product with images
3. Log out and log back in
4. Check if the images are still there

## 🔧 **How It Works**

### **Before (In-Memory Storage)**:
```python
# Images stored in memory - lost on restart
product_data_store[product_id] = {
    "thumbnail": thumbnail,
    "screenshots": screenshots,
    "video_url": video_url
}
```

### **After (Permanent Storage)**:
```python
# Images saved to Supabase Storage
thumbnail_url = storage.save_image(thumbnail, f"thumbnail_{product_id}.png")
screenshots_urls = storage.save_multiple_images(screenshots, f"screenshots_{product_id}")

# Data saved to Supabase Database
product_data = {
    "product_id": product_id,
    "thumbnail_url": thumbnail_url,
    "video_url": video_url,
    "screenshots_urls": screenshots_urls
}
supabase.table('products').insert(product_data).execute()
```

## 📁 **Files Created/Modified**

1. **`backend/supabase_storage.py`** - Handles image uploads to Supabase Storage
2. **`database_products_setup.sql`** - Creates products table in database
3. **`requirements.txt`** - Python dependencies
4. **`app.py`** - Updated to use permanent storage (already done)

## 🎯 **Benefits**

- ✅ Images persist across sessions
- ✅ Data survives server restarts
- ✅ Scalable storage solution
- ✅ Automatic backups
- ✅ CDN delivery for fast loading

## 🐛 **Troubleshooting**

### **Images Not Saving**
- Check if `product-images` bucket exists in Supabase
- Verify environment variables are set correctly
- Check browser console for errors

### **Database Errors**
- Make sure you ran the SQL setup script
- Check Supabase dashboard for table creation
- Verify RLS policies are correct

### **Import Errors**
- Run `pip install -r requirements.txt`
- Check Python version compatibility
- Restart your Flask server

## 🔄 **Fallback System**

The updated code includes a fallback system:
1. **Primary**: Save to Supabase Storage + Database
2. **Fallback**: Use in-memory storage if Supabase fails
3. **Error Handling**: Logs errors but doesn't crash

## 📊 **Storage Limits**

- **Supabase Free Tier**: 1GB storage, 2GB bandwidth
- **Upgrade**: $25/month for 100GB storage
- **Custom**: Contact Supabase for enterprise plans

## 🚀 **Next Steps**

1. Install dependencies
2. Set up Supabase storage bucket
3. Create products table
4. Test with a new product
5. Verify images persist after logout/login

Your images will now be permanently saved! 🎉 