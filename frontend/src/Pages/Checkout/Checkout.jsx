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
              <button className="btn-outline" onClick={() => navigate(-1)}>
                Continue Shopping
              </button>
              <button 
                className="btn-primary btn-large" 
                disabled={!address.zip || !address.zip.trim() || shipping.loading}
                style={{
                  opacity: (!address.zip || !address.zip.trim() || shipping.loading) ? 0.5 : 1,
                  cursor: (!address.zip || !address.zip.trim() || shipping.loading) ? 'not-allowed' : 'pointer'
                }}
                title={!address.zip || !address.zip.trim() 
                  ? 'Please enter ZIP code' 
                  : shipping.loading
                  ? 'Calculating shipping...'
                  : 'Ready to checkout'}
                onClick={async (event) => {
                // Only require ZIP code - that's the essential validation
                // Capture ZIP directly from input field as safeguard
                const zipInput = document.querySelector('input[aria-label="ZIP or Postal Code"]');
                
                // Ensure clean ZIP (coerce to string and trim)
                const zipValue = String(zipInput?.value ?? address.zip ?? '').trim();
                const countryValue = String(address.country_code || 'US').trim();
                
                if (!zipValue) {
                  alert('⚠️ Please enter your ZIP / Postal Code before proceeding.');
                  return;
                }
                
                // If shipping is currently being calculated, wait a moment
                if (shipping.loading) {
                  alert('⚠️ Please wait for shipping calculation to complete.');
                  return;
                }
                
                // Use calculated shipping cost if available, otherwise use 0 (backend will handle validation)
                const currentShipping = shippingRef.current;
                const shippingCost = currentShipping.cost || 0;
                console.log('🔍 Proceeding with checkout:', {
                  zip: zipValue,
                  shippingCost: shippingCost,
                  shippingCalculated: currentShipping.calculated
                });
                
                const button = event.target;
                const originalContent = button.innerHTML;
                button.innerHTML = '<span className="loading-spinner"></span>Processing Order...';
                button.disabled = true;
                
                try {
                  
                  // Validate ZIP before building payload
                  if (!zipValue) {
                    alert('⚠️ ZIP / Postal Code is required. Please enter your ZIP code.');
                    button.innerHTML = originalContent;
                    button.disabled = false;
                    return;
                  }
                  
                  // Ensure shipping address is built first and validated
                  const shippingAddress = {
                    zip: String(zipValue).trim(),
                    country_code: String(countryValue || 'US').trim()
                  };
                  
                  // Extract selected screenshot BEFORE cleaning cart
                  // Get the first available screenshot from cart items (for storage)
                  let selectedScreenshot = null;
                  for (const item of items) {
                    // Check multiple possible screenshot fields
                    selectedScreenshot = item.screenshot || item.selected_screenshot || item.thumbnail || item.img;
                    if (selectedScreenshot && selectedScreenshot.trim()) {
                      break; // Found one, use it
                    }
                  }
                  
                  // Also check localStorage for screenshot data
                  if (!selectedScreenshot) {
                    try {
                      const merchData = localStorage.getItem('pending_merch_data');
                      if (merchData) {
                        const parsed = JSON.parse(merchData);
                        // Check screenshots array - use first one if available
                        if (parsed.screenshots && Array.isArray(parsed.screenshots) && parsed.screenshots.length > 0) {
                          selectedScreenshot = parsed.screenshots[0];
                        } else if (parsed.thumbnail) {
                          selectedScreenshot = parsed.thumbnail;
                        }
                      }
                    } catch (e) {
                      console.warn('Could not load screenshot from localStorage:', e);
                    }
                  }
                  
                  console.log('📸 Selected screenshot found:', selectedScreenshot ? 'Yes' : 'No');
                  
                  // Create lean cart payload - preserve selected_screenshot but exclude other image fields
                  // This allows backend to retrieve the screenshot without breaking email notifications
                  // IMPORTANT: Always include screenshot in cart items (even base64) so backend can extract it
                  const stripeCart = items.map(it => {
                    // Get screenshot from item first, then fallback to selectedScreenshot from loop above
                    const itemScreenshot = it.screenshot || it.selected_screenshot || it.thumbnail || it.img;
                    const finalScreenshot = itemScreenshot || selectedScreenshot || null;
                    
                    const cleanItem = {
                      product: it.product || it.name,
                      variants: { 
                        color: it.color || 'Default', 
                        size: it.size || 'Default' 
                      },
                      price: it.price || 0,
                      // Preserve selected_screenshot so backend can store it in order
                      // Backend will extract it from cart items before they're enriched
                      // Include base64 screenshots here - backend will handle them properly
                      selected_screenshot: finalScreenshot
                    };
                    // Explicitly exclude img, thumbnail, image fields (but keep selected_screenshot)
                    return cleanItem;
                  });
                  
                  console.log('📸 Cart items with screenshots:', stripeCart.map(item => ({
                    product: item.product,
                    has_screenshot: !!item.selected_screenshot,
                    screenshot_type: item.selected_screenshot ? (item.selected_screenshot.startsWith('data:image') ? 'base64' : (item.selected_screenshot.startsWith('http') ? 'URL' : 'other')) : 'none'
                  })));
                  
                  // Get user email from URL params or localStorage
                  const userEmail = searchParams.get('email') || localStorage.getItem('user_email') || '';
                  
                  // Build payload with shipping_address FIRST to ensure it's included
                  const payload = {
                    shipping_address: shippingAddress,  // Put shipping_address FIRST
                    cart: stripeCart,
                    product_id: items[0]?.product_id || items[0]?.id || null,
                    sms_consent: false,
                    shipping_cost: shippingCost,
                    videoUrl: items[0]?.video_url || null,
                    videoTitle: items[0]?.video_title || null,
                    creatorName: items[0]?.creator_name || null,
                    user_email: userEmail,  // Add user email to payload
                  };
                  
                  // Add selected screenshot ONLY if it's a URL (never include base64 images in payload)
                  // Base64 images are too large and cause payload/email size issues
                  // Screenshot is stored in cart items above, so backend can extract it from there
                  if (selectedScreenshot) {
                    const screenshotStr = String(selectedScreenshot);
                    // Only include if it's a URL (not base64)
                    if (screenshotStr.startsWith('http') || screenshotStr.startsWith('https')) {
                      // URL - always safe to include
                      payload.selected_screenshot = selectedScreenshot;
                      console.log('📸 Added screenshot URL to payload');
                    } else if (screenshotStr.startsWith('data:image')) {
                      // Base64 image - DO NOT include in payload (too large, causes issues)
                      // Screenshot is stored in cart items (selected_screenshot field), backend will extract it from there
                      console.warn(`⚠️ Screenshot is base64 (${Math.round(screenshotStr.length/1024)}KB), excluding from payload. Backend will extract from cart items.`);
                    } else {
                      console.warn(`⚠️ Screenshot format unknown, excluding from payload: ${screenshotStr.substring(0, 50)}...`);
                    }
                  }
                  
                  // Verify payload has shipping_address before sending
                  if (!payload.shipping_address || !payload.shipping_address.zip) {
                    console.error('❌ CRITICAL: shipping_address missing from payload!', payload);
                    alert('⚠️ Error: Shipping address is missing. Please refresh and try again.');
                    button.innerHTML = originalContent;
                    button.disabled = false;
                    return;
                  }
                  
                  console.log('🔍 FINAL checkout payload to /api/create-checkout-session:', payload);
                  console.log('🔍 ZIP value being sent:', zipValue);
                  console.log('🔍 Country value being sent:', countryValue);
                  console.log('🔍 Shipping address object:', payload.shipping_address);
                  console.log('🔍 Shipping address keys:', Object.keys(payload.shipping_address || {}));
                  console.log('🔍 Shipping address zip check:', payload.shipping_address?.zip);
                  
                  // Create JSON string and verify shipping_address is in it
                  const payloadJSON = JSON.stringify(payload);
                  console.log('🔍 JSON payload length:', payloadJSON.length);
                  console.log('🔍 JSON string includes shipping_address:', payloadJSON.includes('shipping_address'));
                  console.log('🔍 JSON string includes zip:', payloadJSON.includes('zip'));
                  console.log('🔍 JSON string includes zip value:', payloadJSON.includes(zipValue));
                  
                  console.log('🔍 API Endpoint:', API_CONFIG.ENDPOINTS.CREATE_CHECKOUT_SESSION);
                  console.log('🔍 Sending POST request to backend...');
                  
                  const res = await fetch(API_CONFIG.ENDPOINTS.CREATE_CHECKOUT_SESSION, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Accept': 'application/json'
                    },
                    body: payloadJSON  // Use the verified JSON string directly
                  });
                  
                  console.log('🔍 Response status:', res.status);
                  console.log('🔍 Response URL:', res.url);
                  
                  if (!res.ok) {
                    const errorText = await res.text();
                    console.error('❌ Backend Error Response:', errorText);
                    console.error('❌ Response Status:', res.status);
                    console.error('❌ Response URL:', res.url);
                    console.error('❌ Response Headers:', Object.fromEntries(res.headers.entries()));
                    console.error('❌ Request Payload Sent:', payload);
                    console.error('❌ ZIP Code Sent:', zipValue);
                    console.error('❌ Shipping Address Sent:', payload.shipping_address);
                    let errorData;
                    try {
                      errorData = JSON.parse(errorText);
                      console.error('❌ Parsed Error Data:', errorData);
                    } catch (e) {
                      errorData = { error: errorText || `HTTP ${res.status}: ${res.statusText}` };
                      console.error('❌ Could not parse error as JSON:', e);
                    }
                    const errorMessage = errorData.error || errorData.message || errorData.details || `API returned status ${res.status}`;
                    console.error('❌ Final Error Message:', errorMessage);
                    alert(`⚠️ Checkout Error: ${errorMessage}`);
                    throw new Error(errorMessage);
                  }
                  
                  const data = await res.json();
                  if (data?.url) {
                    // Clear cart immediately when checkout session is created and redirecting to Stripe
                    // This ensures cart is cleared even if user doesn't return to success page
                    try {
                      localStorage.removeItem('cart');
                      localStorage.removeItem('cart_items');
                      localStorage.removeItem('cartData');
                      localStorage.removeItem('persistent_cart');
                      // Also clear any variations/case-insensitive matches for cart
                      Object.keys(localStorage).forEach(key => {
                        if (key.toLowerCase().includes('cart')) {
                          localStorage.removeItem(key);
                        }
                      });
                      Object.keys(sessionStorage).forEach(key => {
                        if (key.toLowerCase().includes('cart')) {
                          sessionStorage.removeItem(key);
                        }
                      });
                      console.log('🛒 Cart cleared before redirecting to Stripe checkout');
                    } catch (error) {
                      console.error('Error clearing cart:', error);
                    }
                    window.location.href = data.url;
                  } else {
                    // Fallback: hit legacy place-order which now returns next_url
                    try {
                      // Use the same payload (without thumbnail) for place-order
                      const res2 = await fetch(API_CONFIG.ENDPOINTS.PLACE_ORDER, {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Accept': 'application/json'
                        },
                        body: payloadJSON  // Use same verified JSON
                      });
                      
                      if (!res2.ok) {
                        const errorText = await res2.text();
                        let errorData;
                        try {
                          errorData = JSON.parse(errorText);
                        } catch (e) {
                          errorData = { error: errorText || `HTTP ${res2.status}: ${res2.statusText}` };
                        }
                        throw new Error(errorData.error || errorData.message || `API returned status ${res2.status}`);
                      }
                      
                      const data2 = await res2.json();
                      if (data2?.next_url) {
                        // Clear cart immediately when checkout session is created and redirecting to Stripe
                        // This ensures cart is cleared even if user doesn't return to success page
                        try {
                          localStorage.removeItem('cart');
                          localStorage.removeItem('cart_items');
                          localStorage.removeItem('cartData');
                          localStorage.removeItem('persistent_cart');
                          // Also clear any variations/case-insensitive matches for cart
                          Object.keys(localStorage).forEach(key => {
                            if (key.toLowerCase().includes('cart')) {
                              localStorage.removeItem(key);
                            }
                          });
                          Object.keys(sessionStorage).forEach(key => {
                            if (key.toLowerCase().includes('cart')) {
                              sessionStorage.removeItem(key);
                            }
                          });
                          console.log('🛒 Cart cleared before redirecting to Stripe checkout (fallback)');
                        } catch (error) {
                          console.error('Error clearing cart:', error);
                        }
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
                  console.error('❌ Checkout error:', e);
                  button.innerHTML = originalContent;
                  button.disabled = false;
                  alert(`⚠️ Checkout error: ${e.message || 'Network error starting checkout'}`);
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