import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import './Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [shipping, setShipping] = useState({ cost: 0, method: 'Standard Shipping', loading: false, error: '', calculated: false });
  const [address, setAddress] = useState({ country_code: 'US', zip: '' });
  const shippingRef = useRef(shipping);
  // Design preferences modal – per-item (orientation + tools) so each cart item can have its own style
  const [showDesignModal, setShowDesignModal] = useState(false);
  /** One entry per cart item: { orientation: ''|'portrait'|'landscape', feather: 'yes'|'no', cornerRadius: 'yes'|'no', frame: 'yes'|'no' } */
  const [designPreferences, setDesignPreferences] = useState([]);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  /** Set true when user completes design modal with "Continue to Checkout" (all tools No). Required before Place Order. */
  const [designConfirmed, setDesignConfirmed] = useState(false);
  const designModalShownOnLoadRef = useRef(false);

  // Portrait/landscape confirmation only for shirts (Womens, Mens, Kids). Other categories go straight to checkout.
  const SHIRT_CATEGORIES = ['womens', 'mens', 'kids'];
  const cartNeedsDesignModal = (itemList) => (itemList || items).some(it => SHIRT_CATEGORIES.includes(it.category));

  // Keep ref in sync with state
  useEffect(() => {
    shippingRef.current = shipping;
  }, [shipping]);

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

  // Show design modal only when cart has shirt items (Womens, Mens, Kids). Other categories go straight to checkout.
  useEffect(() => {
    if (items.length > 0 && !designModalShownOnLoadRef.current) {
      designModalShownOnLoadRef.current = true;
      if (cartNeedsDesignModal(items)) {
        setShowDesignModal(true);
      } else {
        setDesignConfirmed(true);
      }
    }
  }, [items.length]);

  // When design modal opens, init per-item preferences from current items (or empty)
  useEffect(() => {
    if (showDesignModal && items.length > 0) {
      setDesignPreferences(items.map(it => ({
        orientation: (it.toolSettings && (it.toolSettings.imageOrientation === 'portrait' || it.toolSettings.imageOrientation === 'landscape')) ? it.toolSettings.imageOrientation : '',
        feather: 'no',
        cornerRadius: 'no',
        frame: 'no',
      })));
    }
  }, [showDesignModal, items.length]);

  const fetchShipping = useCallback(async () => {
    if (items.length === 0) return;
    setShipping(s => ({ ...s, loading: true, error: '' }));
    try {
      // Ensure clean ZIP and country (same format as checkout)
      const zipValue = String(address.zip || '').trim();
      const countryValue = String(address.country_code || 'US').trim();
      
      const payload = {
        shipping_address: {
          zip: zipValue,
          country_code: countryValue,
        },
        cart: items.map(it => ({
          variant_id: it.printify_variant_id || it.printful_variant_id || 1,
          quantity: it.qty || 1
        }))
      };
      console.log('🚀 Calling shipping API:', API_CONFIG.ENDPOINTS.CALCULATE_SHIPPING);
      console.log('🚀 Payload:', payload);
      
      const res = await fetch(API_CONFIG.ENDPOINTS.CALCULATE_SHIPPING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('📦 Response status:', res.status);
      console.log('📦 Response URL:', res.url);
      
      // Handle 404 errors specifically
      if (res.status === 404) {
        throw new Error(`Shipping API endpoint not found (404). Please verify the backend is deployed and the endpoint exists at: ${API_CONFIG.ENDPOINTS.CALCULATE_SHIPPING}`);
      }
      
      // Handle other error statuses
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error Response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `HTTP ${res.status}: ${res.statusText}` };
        }
        throw new Error(errorData.error || `API returned status ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📦 Shipping calculation response:', data);
      console.log('📦 Response success:', data?.success);
      console.log('📦 Response shipping_cost:', data?.shipping_cost);
      console.log('📦 Response type:', typeof data?.shipping_cost);
      
      // Check if response indicates success
      if (data && data.success === true) {
        // Get shipping cost - handle different formats
        let shippingCost = data.shipping_cost;
        if (shippingCost === null || shippingCost === undefined) {
          // Try alternative field names
          shippingCost = data.cost || data.price || data.amount;
        }
        
        // Convert to number and validate
        shippingCost = parseFloat(shippingCost);
        
        console.log('📦 Parsed shipping cost:', shippingCost);
        console.log('📦 Is valid number?', !isNaN(shippingCost));
        console.log('📦 Is greater than 0?', shippingCost > 0);
        
        if (!isNaN(shippingCost) && shippingCost > 0) {
          console.log('✅ Shipping calculated successfully:', shippingCost);
          const newShippingState = { 
            cost: shippingCost, 
            method: data.shipping_method || data.method || 'Standard Shipping', 
            loading: false, 
            error: '', 
            calculated: true 
          };
          console.log('✅ Setting shipping state:', newShippingState);
          setShipping(newShippingState);
          // Force update ref immediately
          setTimeout(() => {
            shippingRef.current = newShippingState;
            console.log('✅ Shipping ref updated:', shippingRef.current);
          }, 100);
        } else {
          // Success response but invalid cost
          const errorMsg = data?.error || `Invalid shipping cost received: ${data.shipping_cost}. Please verify your ZIP code and try again.`;
          console.error('❌ Shipping cost invalid:', shippingCost);
          console.error('❌ Full response:', data);
          const errorState = { 
            cost: 0, 
            method: '', 
            loading: false, 
            error: errorMsg, 
            calculated: false 
          };
          setShipping(errorState);
          shippingRef.current = errorState;
        }
      } else {
        // Calculation failed or success is false
        const errorMsg = data?.error || 'Unable to calculate shipping. Please verify your ZIP code and try again.';
        console.error('❌ Shipping calculation failed:', errorMsg);
        console.error('❌ Response data:', data);
        console.error('❌ Response success field:', data?.success);
        const errorState = { 
          cost: 0, 
          method: '', 
          loading: false, 
          error: errorMsg, 
          calculated: false 
        };
        setShipping(errorState);
        shippingRef.current = errorState;
      }
    } catch (e) {
      // Network error - do not allow checkout
      const errorMsg = e.message.includes('404') || e.message.includes('Not found')
        ? 'Shipping API endpoint not found. The backend may not be deployed. Please contact support.'
        : `Network error: ${e.message}. Please check your connection and try again.`;
      console.error('❌ Shipping calculation exception:', e);
      const errorState = { 
        cost: 0, 
        method: '', 
        loading: false, 
        error: errorMsg, 
        calculated: false 
      };
      setShipping(errorState);
      shippingRef.current = errorState;
      // Don't show alert here - let the error display inline to avoid duplicate messages
    }
  }, [items, address]);

  // Auto-calculate shipping when ZIP is entered (with debounce)
  useEffect(() => {
    if (address.zip && address.zip.trim() && address.zip.length >= 5 && !shipping.calculated && !shipping.loading && items.length > 0) {
      console.log('⏱️ Auto-calculating shipping in 800ms for ZIP:', address.zip);
      const timer = setTimeout(() => {
        console.log('🚀 Triggering auto-calculate shipping...');
        fetchShipping();
      }, 800); // Wait 800ms after typing stops (reduced from 1000ms)
      return () => clearTimeout(timer);
    } else {
      console.log('⏸️ Skipping auto-calculate:', {
        hasZip: !!(address.zip && address.zip.trim()),
        zipLength: address.zip?.length,
        calculated: shipping.calculated,
        loading: shipping.loading,
        itemsCount: items.length
      });
    }
  }, [address.zip, items.length, shipping.calculated, shipping.loading, fetchShipping]);

  /** Run actual checkout (build payload, POST, redirect). Call after design modal "Continue" when all tools are No. */
  const runCheckout = useCallback(async (cartOverride = null) => {
    const cartToUse = Array.isArray(cartOverride) ? cartOverride : items;
    const zipValue = String(address.zip || '').trim();
    const countryValue = String(address.country_code || 'US').trim();
    const currentShipping = shippingRef.current;
    const shippingCost = currentShipping.cost || 0;

    let selectedScreenshot = null;
    for (const it of cartToUse) {
      selectedScreenshot = it.screenshot || it.selected_screenshot || it.thumbnail || it.img;
      if (selectedScreenshot && selectedScreenshot.trim()) break;
    }
    let screenshotTimestampFromStorage = null;
    try {
      const merchData = localStorage.getItem('pending_merch_data');
      if (merchData) {
        const parsed = JSON.parse(merchData);
        screenshotTimestampFromStorage = parsed.screenshot_timestamp ?? parsed.timestamp ?? null;
        if (!selectedScreenshot) {
          selectedScreenshot = parsed.edited_screenshot || parsed.selected_screenshot ||
            (parsed.screenshots && Array.isArray(parsed.screenshots) && parsed.screenshots.length > 0 ? parsed.screenshots[0] : null) ||
            parsed.thumbnail || null;
        }
      }
    } catch (e) { /* ignore */ }

    const stripeCart = cartToUse.map(it => {
      const itemScreenshot = it.screenshot || it.selected_screenshot || it.thumbnail || it.img;
      const finalScreenshot = itemScreenshot || selectedScreenshot || null;
      const cleanItem = {
        product: it.product || it.name,
        variants: { color: it.color || 'Default', size: it.size || 'Default' },
        price: it.price || 0,
        selected_screenshot: finalScreenshot,
        note: it.note || ''
      };
      if (it.toolSettings && typeof it.toolSettings === 'object') {
        cleanItem.toolSettings = it.toolSettings;
      }
      return cleanItem;
    });

    const shippingAddress = { zip: zipValue, country_code: countryValue };
    const userEmail = searchParams.get('email') || localStorage.getItem('user_email') || '';
    const payload = {
      shipping_address: shippingAddress,
      cart: stripeCart,
      product_id: cartToUse[0]?.product_id || cartToUse[0]?.id || null,
      sms_consent: false,
      shipping_cost: shippingCost,
      videoUrl: cartToUse[0]?.video_url || null,
      videoTitle: cartToUse[0]?.video_title || null,
      creatorName: cartToUse[0]?.creator_name || null,
      user_email: userEmail,
      screenshot_timestamp: cartToUse[0]?.screenshot_timestamp ?? screenshotTimestampFromStorage ?? null,
      timestamp: cartToUse[0]?.screenshot_timestamp ?? screenshotTimestampFromStorage ?? null,
    };
    if (selectedScreenshot) payload.selected_screenshot = selectedScreenshot;

    if (!payload.shipping_address?.zip) {
      alert('⚠️ Error: Shipping address is missing. Please refresh and try again.');
      return;
    }

    setIsCheckoutLoading(true);
    const payloadJSON = JSON.stringify(payload);
    try {
      const res = await fetch(API_CONFIG.ENDPOINTS.CREATE_CHECKOUT_SESSION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payloadJSON,
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { error: errorText }; }
        throw new Error(errorData.error || errorData.message || `API returned status ${res.status}`);
      }
      const data = await res.json();
      if (data?.url) {
        try {
          localStorage.removeItem('cart');
          localStorage.removeItem('cart_items');
          localStorage.removeItem('cartData');
          localStorage.removeItem('persistent_cart');
          Object.keys(localStorage).forEach(key => { if (key.toLowerCase().includes('cart')) localStorage.removeItem(key); });
          Object.keys(sessionStorage).forEach(key => { if (key.toLowerCase().includes('cart')) sessionStorage.removeItem(key); });
        } catch (err) { /* ignore */ }
        window.location.href = data.url;
        return;
      }
      const res2 = await fetch(API_CONFIG.ENDPOINTS.PLACE_ORDER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payloadJSON,
      });
      if (!res2.ok) {
        const errorText = await res2.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { error: errorText }; }
        throw new Error(errorData.error || errorData.message || `API returned status ${res2.status}`);
      }
      const data2 = await res2.json();
      if (data2?.next_url) {
        try {
          localStorage.removeItem('cart');
          localStorage.removeItem('cart_items');
          localStorage.removeItem('cartData');
          localStorage.removeItem('persistent_cart');
          Object.keys(localStorage).forEach(key => { if (key.toLowerCase().includes('cart')) localStorage.removeItem(key); });
          Object.keys(sessionStorage).forEach(key => { if (key.toLowerCase().includes('cart')) sessionStorage.removeItem(key); });
        } catch (err) { /* ignore */ }
        window.location.href = data2.next_url;
      } else {
        alert(data?.error || data2?.error || 'Failed to start checkout');
      }
    } catch (e) {
      alert(`⚠️ Checkout error: ${e.message || 'Network error starting checkout'}`);
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [items, address, searchParams]);

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
          <button className="btn-primary" onClick={() => navigate('/merchandise')}>Continue Shopping</button>
        </div>
      ) : (
        <div className="checkout-content">
          <div className="checkout-main">
            {/* Order Items */}
            <div className="order-section">
              <div className="order-section-header">
                <h2>Order Items</h2>
                <button 
                  className="back-to-cart-btn" 
                  onClick={() => {
                    // Navigate to product page with flag to open cart modal
                    const category = localStorage.getItem('last_selected_category') || 'mens';
                    const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
                    const userEmail = localStorage.getItem('user_email') || '';
                    navigate(`/product/browse?category=${encodeURIComponent(category)}&authenticated=${isAuthenticated}&email=${encodeURIComponent(userEmail)}&openCart=true`);
                  }}
                  aria-label="Back to Cart"
                >
                  <span className="back-to-cart-text">BACK TO CART</span>
                </button>
              </div>
              <div className="items-list">
                {items.map((ci, i) => {
                  // Get product image and screenshot separately (matching cart display)
                  const productImage = ci.image || ci.img;
                  const screenshot = ci.screenshot || ci.selected_screenshot || ci.thumbnail;
                  
                  return (
                    <div key={i} className="item-card">
                      <div className="item-image-wrapper">
                        {productImage && (
                          <img 
                            src={productImage.includes('?') ? `${productImage}&v=${Date.now()}` : `${productImage}?v=${Date.now()}`} 
                            alt={ci.name || ci.product}
                          />
                        )}
                        <div className="item-variants">
                          {ci.color} • {ci.size}
                        </div>
                      </div>
                      <div className="item-info">
                        <h3 className="item-name">{ci.name || ci.product}</h3>
                        <div className="item-price">${(ci.price || 0).toFixed(2)}</div>
                      </div>
                      {screenshot && (
                        <img 
                          src={screenshot} 
                          alt="Screenshot" 
                          className="item-screenshot"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="checkout-mockup-remark">Product mockup, your item will be made in the color you selected.</p>
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
                      className="btn-primary" 
                      onClick={() => {
                        if (!address.zip || !address.zip.trim()) {
                          alert('⚠️ Please enter your ZIP / Postal Code first.');
                          return;
                        }
                        // Clear any previous errors before calculating
                        setShipping(s => ({ ...s, error: '', loading: true }));
                        fetchShipping();
                      }}
                      id="calc-shipping-btn" 
                      disabled={shipping.loading || !address.zip || !address.zip.trim()}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: '700',
                        border: 'none',
                        fontSize: '1rem',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                        cursor: (shipping.loading || !address.zip || !address.zip.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (shipping.loading || !address.zip || !address.zip.trim()) ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!shipping.loading && address.zip && address.zip.trim()) {
                          e.target.style.transform = 'translateY(-3px)';
                          e.target.style.boxShadow = '0 12px 48px rgba(102, 126, 234, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!shipping.loading && address.zip && address.zip.trim()) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
                        }
                      }}
                    >
                      {shipping.loading ? (
                        <>
                          <span className="loading-spinner"></span>
                          Calculating…
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '1rem', marginRight: '6px' }}>🚚</span>
                          Calculate Shipping
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {shipping.error && (
                  <div className="error-message" style={{ 
                    background: '#f8d7da', 
                    color: '#721c24', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    marginTop: '10px',
                    border: '1px solid #f5c6cb'
                  }}>
                    ❌ {shipping.error}
                  </div>
                )}
                {shipping.loading && (
                  <div style={{ 
                    background: '#d1ecf1', 
                    color: '#0c5460', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    marginTop: '10px',
                    border: '1px solid #bee5eb',
                    textAlign: 'center'
                  }}>
                    ⏳ Calculating shipping...
                  </div>
                )}
                {shipping.calculated && shipping.cost > 0 && (
                  <div className="shipping-result" style={{
                    background: '#d4edda',
                    color: '#155724',
                    padding: '12px',
                    borderRadius: '8px',
                    marginTop: '10px',
                    border: '1px solid #c3e6cb'
                  }}>
                    <div className="shipping-method">✓ {shipping.method}</div>
                  <div className="shipping-cost">${shipping.cost.toFixed(2)}</div>
                </div>
                )}
                {!shipping.calculated && !shipping.loading && !shipping.error && address.zip && address.zip.trim() && (
                  <div style={{ 
                    color: '#856404', 
                    padding: '8px', 
                    fontSize: '0.9rem',
                    textAlign: 'center'
                  }}>
                    ⚠️ Click "Calculate Shipping" or wait for auto-calculation...
                  </div>
                )}
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
              <button className="btn-outline" onClick={() => navigate('/merchandise')}>
                Continue Shopping
              </button>
              <button 
                className="btn-primary btn-large" 
                disabled={!address.zip || !address.zip.trim() || shipping.loading || isCheckoutLoading}
                style={{
                  opacity: (!address.zip || !address.zip.trim() || shipping.loading || isCheckoutLoading) ? 0.5 : 1,
                  cursor: (!address.zip || !address.zip.trim() || shipping.loading || isCheckoutLoading) ? 'not-allowed' : 'pointer'
                }}
                title={!address.zip || !address.zip.trim() 
                  ? 'Please enter ZIP code' 
                  : shipping.loading
                  ? 'Calculating shipping...'
                  : 'Ready to checkout'}
                onClick={() => {
                // Require design preferences only for shirts (Womens, Mens, Kids). Other categories skip modal.
                if (!designConfirmed) {
                  if (cartNeedsDesignModal(items)) {
                    setShowDesignModal(true);
                    return;
                  }
                  setDesignConfirmed(true);
                }
                const zipInput = document.querySelector('input[aria-label="ZIP or Postal Code"]');
                const zipValue = String(zipInput?.value ?? address.zip ?? '').trim();
                const countryValue = String(address.country_code || 'US').trim();
                if (!zipValue) {
                  alert('⚠️ Please enter your ZIP / Postal Code before proceeding.');
                  return;
                }
                if (shipping.loading) {
                  alert('⚠️ Please wait for shipping calculation to complete.');
                  return;
                }
                runCheckout();
              }}>
                {isCheckoutLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Place Order</span>
                    <span className="btn-icon">→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Design preferences safeguard modal – per-item so each cart item has its own style */}
      {showDesignModal && items.length > 0 && (
        <div className="design-modal-overlay" onClick={() => setShowDesignModal(false)}>
          <div className="design-modal design-modal--multi" onClick={e => e.stopPropagation()}>
            <h2>Design preferences</h2>

            <div className="design-modal-items">
              {items.map((item, i) => {
                const prefs = designPreferences[i] ?? { orientation: '', feather: 'no', cornerRadius: 'no', frame: 'no' };
                const setPref = (key, value) => {
                  setDesignPreferences(prev => {
                    const next = prev.slice(0, items.length);
                    while (next.length <= i) next.push({ orientation: '', feather: 'no', cornerRadius: 'no', frame: 'no' });
                    next[i] = { ...next[i], [key]: value };
                    return next;
                  });
                };
                const itemName = item.name || item.product || `Item ${i + 1}`;
                const isShirt = SHIRT_CATEGORIES.includes(item.category);
                return (
                  <div key={i} className="design-modal-item-block">
                    <h3 className="design-modal-item-title">{itemName}</h3>
                    {isShirt && (
                    <div className="design-modal-field design-modal-field--orientation">
                      <label>Image orientation</label>
                      <div className="design-modal-orientation-options">
                        <label className={`design-modal-orientation-card ${prefs.orientation === 'portrait' ? 'design-modal-orientation-card--selected' : ''}`}>
                          <input type="radio" name={`orientation-${i}`} checked={prefs.orientation === 'portrait'} onChange={() => setPref('orientation', 'portrait')} className="design-modal-orientation-radio" />
                          <div className="design-modal-orientation-visual design-modal-orientation-visual--portrait" aria-hidden="true">
                            <span className="design-modal-orientation-visual-label">Portrait</span>
                          </div>
                        </label>
                        <label className={`design-modal-orientation-card ${prefs.orientation === 'landscape' ? 'design-modal-orientation-card--selected' : ''}`}>
                          <input type="radio" name={`orientation-${i}`} checked={prefs.orientation === 'landscape'} onChange={() => setPref('orientation', 'landscape')} className="design-modal-orientation-radio" />
                          <div className="design-modal-orientation-visual design-modal-orientation-visual--landscape" aria-hidden="true">
                            <span className="design-modal-orientation-visual-label">Landscape</span>
                          </div>
                        </label>
                      </div>
                    </div>
                    )}
                    <div className="design-modal-field">
                      <label>Feather edge?</label>
                      <div className="design-modal-options">
                        <label>
                          <input type="radio" name={`feather-${i}`} checked={prefs.feather === 'yes'} onChange={() => setPref('feather', 'yes')} />
                          <span className="design-modal-option-text">Yes</span>
                        </label>
                        <label>
                          <input type="radio" name={`feather-${i}`} checked={prefs.feather === 'no'} onChange={() => setPref('feather', 'no')} />
                          <span className="design-modal-option-text">No</span>
                        </label>
                      </div>
                    </div>
                    <div className="design-modal-field">
                      <label>Corner radius tool?</label>
                      <div className="design-modal-options">
                        <label>
                          <input type="radio" name={`corner-${i}`} checked={prefs.cornerRadius === 'yes'} onChange={() => setPref('cornerRadius', 'yes')} />
                          <span className="design-modal-option-text">Yes</span>
                        </label>
                        <label>
                          <input type="radio" name={`corner-${i}`} checked={prefs.cornerRadius === 'no'} onChange={() => setPref('cornerRadius', 'no')} />
                          <span className="design-modal-option-text">No</span>
                        </label>
                      </div>
                    </div>
                    <div className="design-modal-field">
                      <label>Frame tool?</label>
                      <div className="design-modal-options">
                        <label>
                          <input type="radio" name={`frame-${i}`} checked={prefs.frame === 'yes'} onChange={() => setPref('frame', 'yes')} />
                          <span className="design-modal-option-text">Yes</span>
                        </label>
                        <label>
                          <input type="radio" name={`frame-${i}`} checked={prefs.frame === 'no'} onChange={() => setPref('frame', 'no')} />
                          <span className="design-modal-option-text">No</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="design-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setShowDesignModal(false)}>
                Cancel
              </button>
              {(() => {
                const anyToolYes = items.some((_, i) => {
                  const p = designPreferences[i] ?? {};
                  return p.feather === 'yes' || p.cornerRadius === 'yes' || p.frame === 'yes';
                });
                const allShirtItemsHaveOrientation = items.every((it, i) => {
                  if (!SHIRT_CATEGORIES.includes(it.category)) return true;
                  const o = (designPreferences[i] ?? {}).orientation;
                  return o === 'portrait' || o === 'landscape';
                });
                const handleContinue = () => {
                  if (!allShirtItemsHaveOrientation) {
                    alert('Please choose Image orientation (Portrait or Landscape) for each shirt item before continuing.');
                    return;
                  }
                  const updated = items.map((it, idx) => ({
                    ...it,
                    toolSettings: {
                      ...(it.toolSettings || {}),
                      imageOrientation: (designPreferences[idx] ?? {}).orientation === 'landscape' ? 'landscape' : 'portrait',
                    },
                  }));
                  setItems(updated);
                  try { localStorage.setItem('cart_items', JSON.stringify(updated)); } catch (e) { /* ignore */ }
                  setDesignConfirmed(true);
                  setShowDesignModal(false);
                };
                const handleGoToTools = () => {
                  if (!allShirtItemsHaveOrientation) {
                    alert('Please choose Image orientation (Portrait or Landscape) for each shirt item before continuing.');
                    return;
                  }
                  setShowDesignModal(false);
                  navigate('/tools');
                };
                if (anyToolYes) {
                  return (
                    <button type="button" className="btn-primary" onClick={handleGoToTools}>
                      Go to Edit Tools
                    </button>
                  );
                }
                return (
                  <button type="button" className="btn-primary" onClick={handleContinue}>
                    Continue to Checkout
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Checkout;