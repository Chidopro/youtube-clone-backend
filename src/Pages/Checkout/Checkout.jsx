import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import './Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [shipping, setShipping] = useState({ cost: 0, method: 'Standard Shipping', loading: false, error: '' });
  const [address, setAddress] = useState({ country_code: 'US', zip: '' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart_items');
      const parsed = raw ? JSON.parse(raw) : [];
      setItems(parsed);
      setSubtotal(parsed.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0));
    } catch (e) {
      setItems([]);
      setSubtotal(0);
    }
  }, []);

  const fetchShipping = async () => {
    if (items.length === 0) return;
    setShipping(s => ({ ...s, loading: true, error: '' }));
    try {
      const payload = {
        shipping_address: address,
        cart: items.map(it => ({
          variant_id: it.printify_variant_id || it.printful_variant_id || 1,
          quantity: it.qty || 1
        }))
      };
      const res = await fetch(API_CONFIG.ENDPOINTS.CALCULATE_SHIPPING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        setShipping({ cost: data.shipping_cost || 0, method: data.shipping_method || 'Standard Shipping', loading: false, error: '' });
      } else {
        setShipping({ cost: 5.99, method: 'Standard Shipping', loading: false, error: data?.error || 'Unable to fetch shipping' });
      }
    } catch (e) {
      setShipping({ cost: 5.99, method: 'Standard Shipping', loading: false, error: 'Network error' });
    }
  };

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <h1>Checkout</h1>
        <div className="checkout-progress">
          <div className="progress-step active">1. Review</div>
          <div className="progress-step">2. Payment</div>
          <div className="progress-step">3. Complete</div>
        </div>
      </div>
      
      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p>Add some items to your cart to continue</p>
          <button className="btn-primary" onClick={() => navigate(-1)}>Continue Shopping</button>
        </div>
      ) : (
        <div className="checkout-content">
          <div className="checkout-main">
            {/* Order Items */}
            <div className="order-section">
              <h2>Order Items</h2>
              <div className="items-list">
                {items.map((ci, i) => (
                  <div key={i} className="item-card">
                    {ci.image && (
                      <div className="item-image">
                        <img src={ci.image} alt={ci.name} />
                      </div>
                    )}
                    <div className="item-details">
                      <h3 className="item-name">{ci.name}</h3>
                      <div className="item-variants">{ci.color} • {ci.size}</div>
                    </div>
                    <div className="item-price">${(ci.price || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Section */}
            <div className="order-section">
              <h2>Shipping Information</h2>
              <div className="shipping-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>ZIP / Postal Code</label>
                    <input 
                      type="text" 
                      placeholder="Enter ZIP code" 
                      value={address.zip} 
                      onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))}
                      className="form-input"
                      aria-label="ZIP or Postal Code"
                      aria-describedby="zip-help"
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <select 
                      value={address.country_code} 
                      onChange={e => setAddress(a => ({ ...a, country_code: e.target.value }))}
                      className="form-select"
                      aria-label="Country"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button 
                      className="btn-secondary" 
                      onClick={fetchShipping} 
                      disabled={shipping.loading}
                    >
                      {shipping.loading ? (
                        <>
                          <span className="loading-spinner"></span>
                          Calculating…
                        </>
                      ) : (
                        <>
                          <span>🚚</span>
                          Calculate Shipping
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {shipping.error && <div className="error-message">{shipping.error}</div>}
                <div className="shipping-result">
                  <div className="shipping-method">{shipping.method}</div>
                  <div className="shipping-cost">${shipping.cost.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="order-summary">
            <h2>Order Summary</h2>
            <div className="summary-line">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-line">
              <span>Shipping</span>
              <span>${shipping.cost.toFixed(2)}</span>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <span>${(subtotal + (shipping.cost || 0)).toFixed(2)}</span>
            </div>
            
            <div className="checkout-actions">
              <button className="btn-outline" onClick={() => navigate(-1)}>
                Continue Shopping
              </button>
              <button className="btn-primary btn-large" onClick={async (event) => {
                const button = event.target;
                const originalContent = button.innerHTML;
                button.innerHTML = '<span className="loading-spinner"></span>Processing Order...';
                button.disabled = true;
                
                try {
                  // First item's selected screenshot is used for admin email and 300 DPI tools
                  const firstScreenshot = items[0]?.screenshot || items[0]?.selected_screenshot || items[0]?.img;
                  const payload = {
                    cart: items.map(it => ({
                      product: it.product || it.name,
                      variants: { color: it.color, size: it.size },
                      img: it.image,
                      price: it.price,
                      screenshot: it.screenshot,
                      selected_screenshot: it.screenshot || it.selected_screenshot
                    })),
                    product_id: items[0]?.product_id || items[0]?.id || '',
                    sms_consent: false,
                    shipping_cost: shipping.cost || 0,
                    videoUrl: items[0]?.video_url,
                    videoTitle: items[0]?.video_title,
                    creatorName: items[0]?.creator_name,
                    selected_screenshot: firstScreenshot,
                    screenshot: firstScreenshot
                  };
                  const res = await fetch(API_CONFIG.ENDPOINTS.CREATE_CHECKOUT_SESSION, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  const data = await res.json();
                  if (data?.url) {
                    window.location.href = data.url;
                  } else {
                    // Fallback: hit legacy place-order which now returns next_url
                    try {
                      const res2 = await fetch(API_CONFIG.ENDPOINTS.PLACE_ORDER, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      const data2 = await res2.json();
                      if (data2?.next_url) {
                        window.location.href = data2.next_url;
                      } else {
                        button.innerHTML = originalContent;
                        button.disabled = false;
                        alert(data?.error || data2?.error || 'Failed to start checkout');
                      }
                    } catch (e2) {
                      button.innerHTML = originalContent;
                      button.disabled = false;
                      alert('Network error starting checkout');
                    }
                  }
                } catch (e) {
                  button.innerHTML = originalContent;
                  button.disabled = false;
                  alert('Network error starting checkout');
                }
              }}>
                <span>Place Order</span>
                <span className="btn-icon">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;