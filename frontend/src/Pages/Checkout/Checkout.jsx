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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h2>Checkout</h2>
      {items.length === 0 ? (
        <div>
          <p>Your cart is empty.</p>
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((ci, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 90px', gap: 12, alignItems: 'center', border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                {ci.image && <img src={ci.image} alt={ci.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6 }} />}
                <div>
                  <div style={{ fontWeight: 600 }}>{ci.name}</div>
                  <div style={{ color: '#666' }}>{ci.color} • {ci.size}</div>
                </div>
                <div style={{ fontWeight: 600 }}>${(ci.price || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>Shipping</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="ZIP / Postal Code" value={address.zip} onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))} />
              <select value={address.country_code} onChange={e => setAddress(a => ({ ...a, country_code: e.target.value }))}>
                <option value="US">US</option>
                <option value="CA">CA</option>
                <option value="GB">GB</option>
                <option value="AU">AU</option>
                <option value="DE">DE</option>
              </select>
              <button onClick={fetchShipping} disabled={shipping.loading}> {shipping.loading ? 'Calculating…' : 'Calculate Shipping'} </button>
              {shipping.error && <span style={{ color: 'red' }}>{shipping.error}</span>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div>{shipping.method}</div>
              <div>${shipping.cost.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>Subtotal</div>
            <div style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <div>Shipping</div>
            <div>${shipping.cost.toFixed(2)}</div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <div>Total</div>
            <div>${(subtotal + (shipping.cost || 0)).toFixed(2)}</div>
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => navigate(-1)}>Continue Shopping</button>
            <button onClick={async () => {
              // Build payload compatible with backend place-order
              const payload = {
                cart: items.map(it => ({
                  name: it.name,
                  product: it.product || it.name,
                  variants: { color: it.color, size: it.size },
                  img: it.image,
                  price: it.price
                })),
                shipping: address,
                shipping_cost: shipping.cost,
                total: subtotal + (shipping.cost || 0),
                selected_screenshot: items[0]?.image || null
              };
              try {
                const res = await fetch(API_CONFIG.ENDPOINTS.PLACE_ORDER, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data?.success && data?.order_id) {
                  localStorage.removeItem('cart_items');
                  navigate('/success');
                } else {
                  alert(data?.error || 'Failed to place order');
                }
              } catch (e) {
                alert('Network error placing order');
              }
            }}>Place Order</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Checkout;


