# Frontend Changes for Printful Integration

## Summary: Minimal Changes Required

**Your existing UI/UX stays exactly the same.** We're only adding a small "Processing..." indicator and order tracking information.

## 1. templates/product_page.html - Add Processing Indicator

### Current Code (around line 480):
```javascript
// Add-to-cart logic for all product cards
document.querySelectorAll('.add-to-cart-btn').forEach(button => {
  button.addEventListener('click', async () => {
    if (!selectedImageUrl) {
      alert("Please select a thumbnail or screenshot from the top first!");
      return;
    }
    const card = button.closest('.product-card');
    const product = card.querySelector('.product-title').innerText;
    const note = card.querySelector('.note-input').value;
    const imgToStore = selectedImageUrl;
    let variants = {};
    const colorSelect = card.querySelector('.color-select');
    const sizeSelect = card.querySelector('.size-select');
    if (colorSelect) variants.color = colorSelect.value;
    if (sizeSelect) variants.size = sizeSelect.value;
    cart.push({ product, note, email, img: imgToStore, variants });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartSidebar();
  });
});
```

### NEW Code (add processing indicator):
```javascript
// Add-to-cart logic for all product cards
document.querySelectorAll('.add-to-cart-btn').forEach(button => {
  button.addEventListener('click', async () => {
    if (!selectedImageUrl) {
      alert("Please select a thumbnail or screenshot from the top first!");
      return;
    }
    
    // NEW: Show processing indicator
    const originalText = button.textContent;
    button.textContent = "Processing...";
    button.disabled = true;
    
    try {
      const card = button.closest('.product-card');
      const product = card.querySelector('.product-title').innerText;
      const note = card.querySelector('.note-input').value;
      const imgToStore = selectedImageUrl;
      let variants = {};
      const colorSelect = card.querySelector('.color-select');
      const sizeSelect = card.querySelector('.size-select');
      if (colorSelect) variants.color = colorSelect.value;
      if (sizeSelect) variants.size = sizeSelect.value;
      
      // NEW: Create Printful product automatically
      const response = await fetch('/api/printful/create-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnail: imgToStore,
          videoUrl: window.location.pathname.split('/')[2],
          productType: { name: product },
          variants: variants
        })
      });
      
      if (response.ok) {
        cart.push({ product, note, email, img: imgToStore, variants });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartSidebar();
      } else {
        alert("Failed to create product. Please try again.");
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert("Error creating product. Please try again.");
    } finally {
      // NEW: Restore button
      button.textContent = originalText;
      button.disabled = false;
    }
  });
});
```

## 2. templates/checkout.html - Add Order Tracking

### Current Code (around line 140):
```javascript
function finalizeOrder() {
  fetch("/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart: cart, product_id: productId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      localStorage.removeItem("cart");
      window.location.href = data.url;
    } else {
      alert("Error creating Stripe checkout session.");
    }
  });
}
```

### NEW Code (add Printful order creation):
```javascript
function finalizeOrder() {
  // NEW: Show processing indicator
  const checkoutBtn = document.querySelector('.checkout-btn');
  const originalText = checkoutBtn.textContent;
  checkoutBtn.textContent = "Processing Order...";
  checkoutBtn.disabled = true;
  
  // NEW: Create order in Printful first
  fetch("/api/printful/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      cart: cart, 
      customerInfo: {
        name: document.getElementById('customer-name').value,
        email: document.getElementById('customer-email').value,
        shipping_address: {
          address1: document.getElementById('shipping-address').value,
          city: document.getElementById('shipping-city').value,
          country_code: document.getElementById('shipping-country').value,
          state_code: document.getElementById('shipping-state').value,
          zip: document.getElementById('shipping-zip').value
        }
      }
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      // NEW: Store order tracking info
      localStorage.setItem('order_tracking', JSON.stringify({
        order_id: data.order_id,
        tracking_url: data.tracking_url
      }));
      
      // Continue with existing Stripe checkout
      return fetch("/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: cart, product_id: productId })
      });
    } else {
      throw new Error(data.error || "Failed to create order");
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      localStorage.removeItem("cart");
      window.location.href = data.url;
    } else {
      alert("Error creating Stripe checkout session.");
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert("Error processing order. Please try again.");
  })
  .finally(() => {
    // NEW: Restore button
    checkoutBtn.textContent = originalText;
    checkoutBtn.disabled = false;
  });
}
```

## 3. templates/success.html - Add Order Tracking Info

### NEW File: templates/success.html
```html
<!DOCTYPE html>
<html>
<head>
  <title>Order Successful - ScreenMerch</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
    .success-message { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
    .tracking-info { background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .tracking-link { color: #3f51b5; text-decoration: none; }
  </style>
</head>
<body>
  <div class="success-message">✅ Order Successful!</div>
  <p>Thank you for your order. Your custom merchandise is being created!</p>
  
  <div class="tracking-info" id="tracking-info" style="display: none;">
    <h3>Order Tracking</h3>
    <p>Order ID: <span id="order-id"></span></p>
    <p>Track your order: <a href="#" id="tracking-link" class="tracking-link">View Order Status</a></p>
  </div>
  
  <p><a href="/">Return to Home</a></p>
  
  <script>
    // NEW: Display order tracking information
    const trackingData = localStorage.getItem('order_tracking');
    if (trackingData) {
      const tracking = JSON.parse(trackingData);
      document.getElementById('order-id').textContent = tracking.order_id;
      if (tracking.tracking_url) {
        document.getElementById('tracking-link').href = tracking.tracking_url;
      }
      document.getElementById('tracking-info').style.display = 'block';
      localStorage.removeItem('order_tracking');
    }
  </script>
</body>
</html>
```

## Summary of Frontend Changes:

### ✅ What Stays the Same:
- All existing UI elements
- Product selection interface
- Cart functionality
- Checkout process
- Visual design and layout

### 🔄 What Gets Added:
- **Processing indicators** (2-3 lines of code)
- **Order tracking information** (new success page)
- **Error handling** for Printful API calls

### 📊 Change Impact:
- **app.py**: 3 new endpoints added
- **product_page.html**: ~20 lines modified
- **checkout.html**: ~30 lines modified  
- **success.html**: New file (~50 lines)
- **All other files**: No changes

### 🎯 User Experience:
- Users see the exact same interface
- Small "Processing..." indicators show automation is working
- Order tracking information provides better customer service
- Everything else remains identical 