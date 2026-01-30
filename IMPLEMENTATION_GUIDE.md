# 🚀 Implementation Guide: Secure Order Processing System

## Quick Start

### Step 1: Set Up Database
Run the SQL script to create the processing queue tables:
```bash
# In Supabase SQL Editor, run:
database_order_processing_queue.sql
```

### Step 2: Integrate API Routes
Add to your `backend/app.py`:

```python
# At the top, import the secure processing module
from secure_order_processing_api import register_secure_processing_routes

# After app initialization, register routes
register_secure_processing_routes(app, supabase, supabase_admin)
```

### Step 3: Create Worker Accounts
In Supabase, add processor permissions:

```sql
-- Grant processor role to a user
INSERT INTO processor_permissions (user_id, role, is_active, max_orders_per_day)
VALUES ('user-uuid-here', 'processor', true, 50);
```

### Step 4: Test the System
1. Create a test order
2. Verify it appears in `order_processing_queue` (auto-created)
3. Use the API to process it

---

## 🔐 Security Features

### What's Protected:
- ✅ All processing algorithms (DPI, edge feathering, corner radius)
- ✅ Processing parameters (hardcoded server-side)
- ✅ System configuration
- ✅ Other workers' orders

### What Workers Can Do:
- ✅ View assigned orders
- ✅ Process orders (one-click)
- ✅ Download processed images
- ✅ Add notes

### What Workers Cannot Do:
- ❌ See processing algorithms
- ❌ Modify processing parameters
- ❌ Access other workers' orders
- ❌ View system logs
- ❌ Export processing history

---

## 📋 API Endpoints

### 1. Process Order (Worker)
```http
POST /api/secure/process-order
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_id": "uuid",
  "notes": "Optional worker notes"
}
```

**Response:**
```json
{
  "success": true,
  "processed_image": "data:image/png;base64,...",
  "dimensions": {"width": 2400, "height": 3000, "dpi": 300},
  "file_size": 2048576,
  "format": "PNG",
  "quality": "Print Ready",
  "processing_time_seconds": 3
}
```

### 2. Get Queue (Worker)
```http
GET /api/secure/queue?status=assigned&limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "queue-uuid",
      "order_id": "order-uuid",
      "status": "assigned",
      "priority": 0,
      "created_at": "2025-01-01T00:00:00Z",
      "orders": {
        "order_id": "order-uuid",
        "cart": [...],
        "video_title": "...",
        "creator_name": "..."
      }
    }
  ]
}
```

### 3. Claim Order (Worker)
```http
POST /api/secure/claim-order
Authorization: Bearer <token>
Content-Type: application/json

{
  "queue_id": "queue-uuid"
}
```

---

## 🎨 Worker Portal Interface

### Simple React Component Example:

```jsx
// WorkerPortal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function WorkerPortal() {
  const [orders, setOrders] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch('/api/secure/queue?status=assigned', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    if (result.success) {
      setOrders(result.orders);
    }
  };

  const processOrder = async (orderId) => {
    setProcessing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch('/api/secure/process-order', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId })
      });

      const result = await response.json();
      if (result.success) {
        // Download processed image
        const link = document.createElement('a');
        link.href = result.processed_image;
        link.download = `processed-${orderId}.png`;
        link.click();
        
        alert('Order processed successfully!');
        loadQueue(); // Refresh queue
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="worker-portal">
      <h1>Order Processing Queue</h1>
      <div className="orders-list">
        {orders.map(order => (
          <div key={order.id} className="order-card">
            <h3>Order #{order.order_id.slice(0, 8)}</h3>
            <p>Status: {order.status}</p>
            <p>Priority: {order.priority === 2 ? 'Urgent' : order.priority === 1 ? 'High' : 'Normal'}</p>
            <button 
              onClick={() => processOrder(order.order_id)}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Process Order'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkerPortal;
```

---

## 🔄 Workflow

### For Admin:
1. Orders automatically enter queue when status = 'paid'
2. Assign orders to workers (or auto-assign)
3. Review completed orders
4. Approve for Printify upload

### For Worker:
1. Log into worker portal
2. See assigned orders
3. Click "Process Order"
4. System automatically:
   - Loads screenshot
   - Applies 300 DPI processing (hidden)
   - Applies edge feathering (hidden)
   - Applies corner radius (hidden)
   - Returns processed image
5. Download processed image
6. Upload to Printify
7. Mark as complete

---

## 📊 Monitoring & Quality Control

### Admin Dashboard Features:
- View all orders in queue
- See processing statistics
- Review processed orders
- Quality scoring
- Reassign orders if needed

### Metrics to Track:
- Orders processed per day
- Average processing time
- Quality scores
- Worker performance
- Failed processing attempts

---

## 🚨 Important Notes

1. **Authentication**: The current implementation uses a simplified auth check. In production, you should:
   - Verify JWT tokens properly
   - Check user roles from database
   - Implement proper session management

2. **Image Storage**: Currently, processed images are returned as base64. For production:
   - Upload processed images to Supabase Storage
   - Store URLs in database
   - Implement CDN for faster delivery

3. **Error Handling**: Add comprehensive error handling:
   - Retry logic for failed processing
   - Notification system for errors
   - Automatic queue reassignment

4. **Scaling**: For 100+ orders/day:
   - Consider batch processing
   - Implement worker load balancing
   - Add caching for frequently accessed data

---

## 💰 Cost Optimization

### Current Setup:
- Manual processing: ~8 hours/day for 100 orders
- Your time: 100% of processing

### With This System:
- Worker processing: ~6-8 hours/day
- Your time: 1-2 hours/day (quality control only)
- **Savings: 6+ hours/day**

### Scaling to 1000 orders/day:
- Multiple workers can process simultaneously
- Queue system handles any volume
- You still only do quality control
- **Potential: 10x scale with same time investment**

---

## 🔧 Customization

### Adjust Processing Parameters:
Edit `backend/secure_order_processing_api.py`:

```python
# In apply_proprietary_processing function:
PRINT_DPI = 300  # Change DPI if needed
SOFT_CORNERS = True  # Enable/disable corners
CORNER_RADIUS_PERCENT = 15  # Adjust radius
EDGE_FEATHER = True  # Enable/disable feathering
```

### Add Product-Specific Processing:
```python
# Check order product type and apply different settings
if order.get('product_type') == 't-shirt':
    CORNER_RADIUS_PERCENT = 15
elif order.get('product_type') == 'hoodie':
    CORNER_RADIUS_PERCENT = 20
```

---

## 📞 Support

If you need help:
1. Check the logs: `fly logs --app screenmerch`
2. Review database: Check `order_processing_queue` table
3. Test API endpoints: Use Postman/curl
4. Verify permissions: Check `processor_permissions` table

---

## ✅ Next Steps

1. ✅ Run database migration
2. ✅ Integrate API routes
3. ✅ Create worker accounts
4. ✅ Build worker portal UI
5. ✅ Test with sample orders
6. ✅ Onboard first worker
7. ✅ Monitor and optimize
8. ✅ Scale as needed

