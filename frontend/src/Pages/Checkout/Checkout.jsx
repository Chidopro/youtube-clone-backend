import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Checkout = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);

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
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>Subtotal</div>
            <div style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</div>
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => navigate(-1)}>Continue Shopping</button>
            <button onClick={() => alert('Next: integrate Printify shipping + payment')}>Place Order</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Checkout;


