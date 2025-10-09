import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';

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
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <select 
                      value={address.country_code} 
                      onChange={e => setAddress(a => ({ ...a, country_code: e.target.value }))}
                      className="form-select"
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
                      {shipping.loading ? 'Calculating…' : 'Calculate Shipping'}
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
              <button className="btn-primary btn-large" onClick={async () => {
              try {
                const payload = {
                  cart: items.map(it => ({
                    product: it.product || it.name,
                    variants: { color: it.color, size: it.size },
                    img: it.image,
                    price: it.price
                  })),
                  product_id: items[0]?.product_id || items[0]?.id || '',
                  sms_consent: false,
                  shipping_cost: shipping.cost || 0,
                  videoUrl: items[0]?.video_url,
                  videoTitle: items[0]?.video_title,
                  creatorName: items[0]?.creator_name
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
                      alert(data?.error || data2?.error || 'Failed to start checkout');
                    }
                  } catch (e2) {
                    alert('Network error starting checkout');
                  }
                }
              } catch (e) {
                alert('Network error starting checkout');
              }
            }}>
              <span>Place Order</span>
              <span className="btn-icon">→</span>
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .checkout-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .checkout-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .checkout-header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 20px;
        }

        .checkout-progress {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-bottom: 20px;
        }

        .progress-step {
          padding: 12px 24px;
          border-radius: 25px;
          background: #e2e8f0;
          color: #64748b;
          font-weight: 600;
          position: relative;
        }

        .progress-step.active {
          background: #3b82f6;
          color: white;
        }

        .progress-step:not(:last-child)::after {
          content: '';
          position: absolute;
          right: -20px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 2px;
          background: #e2e8f0;
        }

        .empty-cart {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .empty-cart-icon {
          font-size: 4rem;
          margin-bottom: 20px;
        }

        .empty-cart h2 {
          font-size: 1.5rem;
          color: #1a202c;
          margin-bottom: 10px;
        }

        .empty-cart p {
          color: #64748b;
          margin-bottom: 30px;
        }

        .checkout-content {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 40px;
        }

        .checkout-main {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .order-section {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .order-section h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 24px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 12px;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .item-card {
          display: grid;
          grid-template-columns: 80px 1fr auto;
          gap: 16px;
          align-items: center;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .item-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
        }

        .item-image {
          width: 80px;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
        }

        .item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .item-details {
          flex: 1;
        }

        .item-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 4px;
        }

        .item-variants {
          color: #64748b;
          font-size: 0.9rem;
        }

        .item-price {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1a202c;
        }

        .shipping-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 16px;
          align-items: end;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          color: #374151;
          font-size: 0.9rem;
        }

        .form-input, .form-select {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .error-message {
          color: #dc2626;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .shipping-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .shipping-method {
          font-weight: 600;
          color: #1a202c;
        }

        .shipping-cost {
          font-weight: 700;
          color: #1a202c;
          font-size: 1.1rem;
        }

        .order-summary {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          height: fit-content;
          position: sticky;
          top: 24px;
        }

        .order-summary h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 24px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 12px;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .summary-line.total {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1a202c;
          border-top: 2px solid #e2e8f0;
          border-bottom: none;
          margin-top: 8px;
          padding-top: 16px;
        }

        .checkout-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 32px;
        }

        .btn-primary, .btn-secondary, .btn-outline {
          padding: 16px 24px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #374151;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .btn-outline {
          background: transparent;
          color: #3b82f6;
          border: 2px solid #3b82f6;
        }

        .btn-outline:hover {
          background: #3b82f6;
          color: white;
        }

        .btn-large {
          padding: 20px 32px;
          font-size: 1.1rem;
        }

        .btn-icon {
          font-size: 1.2rem;
          transition: transform 0.2s;
        }

        .btn-primary:hover .btn-icon {
          transform: translateX(4px);
        }

        @media (max-width: 768px) {
          .checkout-content {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          
          .form-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          
          .checkout-progress {
            gap: 20px;
          }
          
          .progress-step {
            padding: 8px 16px;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Checkout;


