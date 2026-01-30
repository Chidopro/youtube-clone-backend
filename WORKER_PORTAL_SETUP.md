# 🛠️ Worker Portal Setup Guide

## Overview

The Worker Portal allows outsourced workers to process orders **without needing access to credit card information**. The system automatically:

1. ✅ Processes images with proprietary 300 DPI algorithms (hidden from workers)
2. ✅ Uploads processed images to Printful
3. ✅ Creates products in Printful
4. ✅ Submits orders to Printful with customer addresses
5. ✅ **Automatically charges your Printful account's stored payment method** (no credit card needed!)

---

## 🔐 Security Features

### What Workers CAN Do:
- ✅ View assigned orders
- ✅ Process images (one-click button)
- ✅ Submit orders to Printful
- ✅ Add notes/comments

### What Workers CANNOT Do:
- ❌ See processing algorithms (300 DPI, edge feathering, corner radius)
- ❌ Modify processing parameters
- ❌ Access credit card information
- ❌ See other workers' orders
- ❌ Access system configuration

### Payment Security:
- **No credit card access needed!**
- Payment is automatically charged to your Printful account's stored payment method
- Workers never see or handle payment information
- All payment processing happens server-side via Printful API

---

## 🚀 Setup Instructions

### Step 1: Add Route to React Router

Add the Worker Portal route to your React router (usually in `App.jsx` or `routes.jsx`):

```jsx
import WorkerPortal from './Pages/WorkerPortal/WorkerPortal';

// In your routes:
<Route path="/worker-portal" element={<WorkerPortal />} />
```

### Step 2: Register Backend API Routes

In your `backend/app.py`, add:

```python
# At the top, import the modules
from worker_portal_api import register_worker_portal_routes
from printful_integration import ScreenMerchPrintfulIntegration

# After app initialization:
printful_integration = ScreenMerchPrintfulIntegration()
register_worker_portal_routes(app, supabase, supabase_admin, printful_integration)
```

### Step 3: Set Up Printful Account

1. **Create Printful Account** (if you don't have one)
2. **Add Payment Method** to your Printful account (credit/debit card)
   - This is stored securely in Printful
   - Workers never see this information
3. **Get API Key** from Printful Dashboard → Settings → API
4. **Add to Environment Variables**:
   ```bash
   PRINTFUL_API_KEY=your_api_key_here
   ```

### Step 4: Create Worker Accounts

In Supabase, grant processor permissions to workers:

```sql
-- Grant processor role to a user
INSERT INTO processor_permissions (user_id, role, is_active, max_orders_per_day)
VALUES ('user-uuid-here', 'processor', true, 50);
```

### Step 5: Test the System

1. Create a test order
2. Verify it appears in `order_processing_queue`
3. Log in as a worker
4. Navigate to `/worker-portal`
5. Click "Process & Submit to Printful"
6. Verify order is created in Printful

---

## 📋 Workflow

### For Workers:

1. **Log in** to ScreenMerch
2. **Navigate** to `/worker-portal`
3. **View** assigned orders
4. **Click** "Process & Submit to Printful" button
5. **System automatically**:
   - Processes image (300 DPI, edge feather, corner radius)
   - Uploads to Printful
   - Creates product
   - Submits order with customer address
   - Charges your Printful account automatically
6. **Done!** Order is submitted and payment is processed

### For You (Admin):

1. Orders automatically enter processing queue when paid
2. Assign orders to workers (or auto-assign)
3. Workers process and submit orders
4. Review completed orders in Printful dashboard
5. Track fulfillment status

---

## 🔄 API Endpoints

### Process and Submit Order
```http
POST /api/worker/process-and-submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_id": "uuid",
  "notes": "optional worker notes"
}
```

**Response:**
```json
{
  "success": true,
  "printful_order_id": "12345",
  "printful_order_status": "pending",
  "tracking_url": "https://...",
  "printful_image_url": "https://...",
  "message": "Order processed and submitted to Printful successfully. Payment automatically charged to account.",
  "processing_time_seconds": 3
}
```

---

## 💡 Key Features

### 1. **Automatic Payment Processing**
- Uses `confirm: true` in Printful API
- Automatically charges your stored payment method
- No credit card information needed by workers

### 2. **Proprietary Algorithm Protection**
- All processing happens server-side
- Workers only see "Process" button
- Algorithms remain completely hidden

### 3. **Complete Automation**
- Image processing → Printful upload → Product creation → Order submission
- All in one click
- No manual steps required

### 4. **Order Tracking**
- All orders tracked in database
- Printful order IDs stored
- Processing history logged

---

## 🎯 Benefits

### Security:
- ✅ No credit card access needed
- ✅ Algorithms protected
- ✅ Role-based access control
- ✅ Audit trail for all actions

### Efficiency:
- ✅ One-click processing
- ✅ Automatic payment
- ✅ No manual steps
- ✅ Scales to 100+ orders/day

### Cost Savings:
- ✅ No need to share credit card
- ✅ Automated workflow
- ✅ Reduced processing time
- ✅ Better quality control

---

## 📊 Monitoring

### Check Order Status:
```sql
-- View processing queue
SELECT * FROM order_processing_queue 
WHERE status = 'completed' 
ORDER BY completed_at DESC;

-- View processing history
SELECT * FROM processing_history 
ORDER BY processed_at DESC;
```

### Printful Dashboard:
- Log into Printful dashboard
- View all orders
- Track fulfillment status
- Monitor payment charges

---

## 🚨 Troubleshooting

### Issue: "Authentication required"
**Solution:** Make sure worker is logged in and has processor permissions

### Issue: "Order not found"
**Solution:** Verify order exists in database and has correct order_id

### Issue: "Failed to upload image to Printful"
**Solution:** 
- Check PRINTFUL_API_KEY is set correctly
- Verify image format is valid
- Check Printful API status

### Issue: "Failed to create Printful order"
**Solution:**
- Verify payment method is set in Printful account
- Check shipping address format
- Verify variant IDs are correct

---

## 📞 Support

If you encounter issues:
1. Check backend logs: `fly logs --app screenmerch`
2. Verify Printful API key is correct
3. Check database for order status
4. Review Printful dashboard for order status

---

## ✅ Next Steps

1. ✅ Set up Printful account with payment method
2. ✅ Add API key to environment variables
3. ✅ Register backend routes
4. ✅ Add React route
5. ✅ Create worker accounts
6. ✅ Test with sample order
7. ✅ Start processing orders!

---

## 🎉 Success!

Once set up, workers can process orders with a single click, and payment is automatically handled through your Printful account. No credit card sharing needed, and all your proprietary algorithms remain protected!

