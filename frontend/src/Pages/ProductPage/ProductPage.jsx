import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import './ProductPage.css';

const ProductPage = ({ sidebar }) => {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [selectedColors, setSelectedColors] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [cartItems, setCartItems] = useState(() => {
    try {
      const raw = localStorage.getItem('cart_items');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [fallbackImages, setFallbackImages] = useState({ screenshots: [], thumbnail: '' });

  // Read from query first
  const qsCategory = searchParams.get('category');
  
  // Fallback to localStorage if query missing (mobile stale reloads)
  const category = useMemo(() => {
    const c = (qsCategory || localStorage.getItem('last_selected_category') || '').trim();
    return c || 'mens'; // final default if truly absent
  }, [qsCategory]);
  
  const authenticated = searchParams.get('authenticated') === 'true';
  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (window.__DEBUG__) {
      console.log('🔎 browse: qsCategory=', qsCategory, 'resolved category=', category);
      console.log('🔗 full url:', window.location.href);
    }
    // keep the last used category current
    if (category) localStorage.setItem('last_selected_category', category);
  }, [qsCategory, category]);

  // Categories for selection
  const categories = [
    { name: "All Products", emoji: "🛍️", category: "all" },
    { name: "Women's", emoji: "👩", category: "womens" },
    { name: "Men's", emoji: "👨", category: "mens" },
    { name: "Kids", emoji: "👶", category: "kids" },
    { name: "Mugs", emoji: "☕", category: "mugs" },
    { name: "Hats", emoji: "🧢", category: "hats" },
    { name: "Bags", emoji: "👜", category: "bags" },
    { name: "Pets", emoji: "🐕", category: "pets" },
    { name: "Misc", emoji: "📦", category: "misc" },
    { name: "Thumbnails", emoji: "🖼️", category: "thumbnails" }
  ];

  const handleCategoryClick = (newCategory) => {
    console.log('🔄 Category clicked:', newCategory);
    console.log('🔄 Current category:', category);
    console.log('🔄 Product ID:', productId);
    console.log('🔄 Authenticated:', authenticated);
    console.log('🔄 Email:', email);
    
    // Update URL with new category
    const newUrl = `/product/${productId}?category=${newCategory}&authenticated=${authenticated}&email=${email}`;
    console.log('🔄 Navigating to:', newUrl);
    
    // Add alert for mobile debugging
    alert(`Category clicked: ${newCategory}\nNavigating to: ${newUrl}`);
    
    // Try different navigation methods
    try {
      navigate(newUrl);
      console.log('✅ Navigate called successfully');
    } catch (error) {
      console.error('❌ Navigate failed:', error);
      // Fallback to window.location
      window.location.href = newUrl;
    }
  };

  const getSelectedScreenshotUrl = () => {
    const allShots = (productData?.product?.screenshots && productData.product.screenshots.length > 0)
      ? productData.product.screenshots
      : fallbackImages.screenshots;
    if (selectedScreenshot === 'thumbnail') {
      return productData?.product?.thumbnail_url || fallbackImages.thumbnail || '';
    }
    if (typeof selectedScreenshot === 'number' && allShots && allShots[selectedScreenshot]) {
      return allShots[selectedScreenshot];
    }
    return '';
  };

  const persistCart = (items) => {
    setCartItems(items);
    try { localStorage.setItem('cart_items', JSON.stringify(items)); } catch (e) {}
  };

  const handleAddToCart = (product, index) => {
    const chosenColor = selectedColors[index] || (product?.options?.color?.[0] || 'Default');
    const chosenSize = selectedSizes[index] || (product?.options?.size?.[0] || 'One Size');
    const screenshotUrl = getSelectedScreenshotUrl();

    const item = {
      name: product?.name || 'Product',
      price: product?.price || 0,
      image: product?.preview_image ? `https://screenmerch.fly.dev/static/images/${product.preview_image}` : (product?.main_image ? `https://screenmerch.fly.dev/static/images/${product.main_image}` : ''),
      color: chosenColor,
      size: chosenSize,
      screenshot: screenshotUrl,
      qty: 1
    };
    const next = [...cartItems, item];
    persistCart(next);
    alert('Added to cart!');
  };

  // Load fallback screenshots/thumbnail from localStorage in case backend data is empty
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const d = JSON.parse(raw);
        setFallbackImages({
          screenshots: Array.isArray(d?.screenshots) ? d.screenshots.slice(0, 6) : [],
          thumbnail: d?.thumbnail || ''
        });
      }
    } catch (e) {
      console.warn('Invalid pending_merch_data in localStorage, ignoring');
    }
  }, [productId]);

  useEffect(() => {
    console.log('🔄 useEffect triggered with:', { productId, category, authenticated, email });
    
    const fetchProductData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Handle browse mode - use 'browse' when productId is undefined
        const actualProductId = productId || 'browse';
        const url = `https://screenmerch.fly.dev/api/product/${actualProductId}?category=${category}&authenticated=${authenticated}&email=${email}`;
        console.log('🌐 Fetching product data from:', url);
        console.log('📱 User Agent:', navigator.userAgent);
        console.log('📱 Is Mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        
        // Fetch product data from backend API
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          // Add timeout for mobile networks
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          throw new Error(`Failed to fetch product data: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📦 Product Data Received:', data);
        console.log('📸 Thumbnail URL:', data.product?.thumbnail_url);
        console.log('📸 Screenshots:', data.product?.screenshots);
        console.log('📸 Screenshots Length:', data.product?.screenshots?.length || 0);
        console.log('📦 Products Count:', data.products?.length || 0);
        console.log('📦 Category:', data.category);
        console.log('📦 Success:', data.success);
        
        // Cache the products data for offline use
        try {
          localStorage.setItem('cached_products', JSON.stringify(data.products));
          console.log('💾 Cached products data for offline use');
        } catch (e) {
          console.warn('Could not cache products data');
        }
        
        setProductData(data);
      } catch (err) {
        console.error('❌ Error fetching product data:', err);
        console.error('❌ Error type:', err.name);
        console.error('❌ Error message:', err.message);
        console.error('❌ Error stack:', err.stack);
        
        // Create fallback data structure to allow category selection
        // First try to get cached products, then use basic fallback
        let fallbackProducts = [];
        
        // Try to load products from localStorage first
        try {
          const storedProducts = localStorage.getItem('cached_products');
          if (storedProducts) {
            const parsedProducts = JSON.parse(storedProducts);
            console.log('📦 Using cached products for fallback:', parsedProducts.length, 'products');
            
            // If we have cached products, try to filter them by category
            if (category !== 'all' && parsedProducts.length > 0) {
              // Apply the same category filtering logic as the backend
              const categoryMappings = {
                'mens': ["Unisex Hoodie", "Men's Tank Top", "Mens Fitted T-Shirt", "Men's Fitted Long Sleeve", "Unisex T-Shirt", "Unisex Oversized T-Shirt", "Men's Long Sleeve Shirt", "Unisex Champion Hoodie"],
                'womens': ["Cropped Hoodie", "Women's Fitted Racerback Tank", "Women's Micro-Rib Tank Top", "Women's Ribbed Neck", "Women's Shirt", "Unisex Heavyweight T-Shirt", "Unisex Pullover Hoodie", "Pajama Shorts"],
                'kids': ["Youth Heavy Blend Hoodie", "Kids Shirt", "Kids Long Sleeve", "Toddler Short Sleeve T-Shirt", "Toddler Jersey Shirt", "Kids Sweatshirt", "Youth All Over Print Swimsuit", "Girls Leggings"],
                'bags': ["Laptop Sleeve", "All-Over Print Drawstring Bag", "All Over Print Tote Pocket", "All-Over Print Crossbody Bag"],
                'hats': ["Distressed Dad Hat", "Snapback Hat", "Five Panel Trucker Hat", "5 Panel Baseball Cap"],
                'mugs': ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"],
                'pets': ["Pet Bowl All-Over Print", "Pet Bandana Collar", "All Over Print Leash", "All Over Print Collar"],
                'misc': ["Greeting Card", "Hardcover Bound Notebook", "Coasters", "Apron", "Bandana"]
              };
              
              const categoryProducts = categoryMappings[category] || [];
              const filteredProducts = parsedProducts.filter(product => 
                categoryProducts.includes(product.name)
              );
              
              if (filteredProducts.length > 0) {
                fallbackProducts = filteredProducts;
                console.log('📦 Filtered cached products by category:', category, '->', filteredProducts.length, 'products');
              } else {
                fallbackProducts = parsedProducts;
                console.log('📦 No category-specific products found, using all cached products');
              }
            } else {
              fallbackProducts = parsedProducts;
            }
          }
        } catch (e) {
          console.warn('Could not load cached products from localStorage');
        }
        
        // If no cached products, use basic fallback
        if (fallbackProducts.length === 0) {
          console.log('📦 No cached products, using basic fallback');
          fallbackProducts = [
            {
              "name": "Unisex T-Shirt",
              "price": 21.69,
              "filename": "guidontee.png",
              "main_image": "guidontee.png",
              "preview_image": "guidonteepreview.png",
              "options": {"color": ["Black", "White", "Dark Grey Heather", "Navy", "Red", "Athletic Heather"], "size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]},
              "size_pricing": {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 2, "XXXL": 4, "XXXXL": 6, "XXXXXL": 8}
            },
            {
              "name": "Unisex Hoodie",
              "price": 36.95,
              "filename": "tested.png",
              "main_image": "tested.png",
              "preview_image": "testedpreview.png",
              "options": {"color": ["Black", "Navy Blazer", "Carbon Grey", "White", "Maroon", "Charcoal Heather", "Vintage Black", "Forest Green", "Military Green", "Team Red", "Dusty Rose", "Sky Blue", "Purple", "Team Royal"], "size": ["S", "M", "L", "XL", "XXL", "XXXL"]},
              "size_pricing": {"S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 2, "XXXL": 4}
            }
          ];
        }
        
        const fallbackData = {
          success: true,
          product: {
            product_id: productId,
            thumbnail_url: '',
            video_title: 'Unknown Video',
            creator_name: 'Unknown Creator',
            video_url: 'Not provided',
            screenshots: []
          },
          products: fallbackProducts,
          category: category
        };
        
        console.log('🔄 Using fallback data structure');
        console.log('🔄 Fallback category:', category);
        console.log('🔄 Fallback products count:', fallbackProducts.length);
        
        setProductData(fallbackData);
        // Don't set error state, let the component render with fallback data
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProductData();
    }
  }, [productId, category, authenticated, email]);

  if (loading) {
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          <h2>Error Loading Product</h2>
          <p>{error}</p>
          <button onClick={() => {
            setError(null);
            setLoading(true);
            // Retry the fetch
            const fetchProductData = async () => {
              try {
                // Handle browse mode - use 'browse' when productId is undefined
                const actualProductId = productId || 'browse';
                const url = `https://screenmerch.fly.dev/api/product/${actualProductId}?category=${category}&authenticated=${authenticated}&email=${email}`;
                const response = await fetch(url, {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                  },
                  signal: AbortSignal.timeout(30000)
                });
                
                if (!response.ok) {
                  throw new Error(`Failed to fetch product data: ${response.status}`);
                }
                
                const data = await response.json();
                setProductData(data);
              } catch (err) {
                console.error('Retry failed:', err);
                setError(err.message);
              } finally {
                setLoading(false);
              }
            };
            fetchProductData();
          }}>Retry</button>
          <div style={{ marginTop: '1rem' }}>
            <p>If the error persists, you can still browse products by category:</p>
            <div className="categories-grid" style={{ marginTop: '1rem' }}>
              {categories.map((cat, index) => (
                <div
                  key={index}
                  className={`category-box ${cat.category === category ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat.category)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="category-emoji">{cat.emoji}</div>
                  <div className="category-name">{cat.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Product Not Found</h2>
          <p>The requested product could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${sidebar ? "" : " large-container"}`}>
      {/* User Flow Section - Step 3 Only */}
      <div className="user-flow-section">
        <div className="flow-steps">
          <div className="flow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Make Merchandise</h3>
              <p>Create custom products with your screenshot</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Selection Section - Only show when category is "all" or no specific category */}
      {(category === 'all' || !productData.products || productData.products.length === 0) && (
        <div className="merchandise-categories">
          <div className="categories-container">
            <h1 className="categories-title">Choose a Product Category</h1>
            
            <div className="categories-grid">
              {categories.map((cat, index) => (
                <div
                  key={index}
                  className={`category-box ${cat.category === category ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat.category)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="category-emoji">{cat.emoji}</div>
                  <div className="category-name">{cat.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products Section - Only show when specific category is selected (not "all") and has products */}
      {category !== 'all' && productData.products && productData.products.length > 0 && (
        <>
          {/* Screenshot Selection Section */}
          <div className="screenshots-section">
            <h2 className="screenshots-title">Select Your Screenshot</h2>
            <p className="screenshots-subtitle">Choose which screenshot to use for your custom merchandise</p>
            <div className="screenshots-preview">
              <div className="screenshot-grid">
                {/* Thumbnail */}
                {(() => {
                  const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
                  return thumbnailUrl ? (
                  <div 
                    className={`screenshot-item ${selectedScreenshot === 'thumbnail' ? 'selected' : ''}`}
                    onClick={() => setSelectedScreenshot('thumbnail')}
                  >
                    <img 
                      src={thumbnailUrl} 
                      alt="Thumbnail" 
                      className="screenshot-image"
                    />
                    <div className="screenshot-label">Thumbnail</div>
                  </div>
                  ) : null;
                })()}
                
                {/* Screenshots */}
                {(() => {
                  const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
                  const baseShots = (productData?.product?.screenshots && productData.product.screenshots.length > 0)
                    ? productData.product.screenshots
                    : fallbackImages.screenshots;
                  // Ensure we don't duplicate the thumbnail in the screenshots grid
                  const shots = (baseShots || []).filter((s) => s && s !== thumbnailUrl);
                  return shots && shots.length > 0 ? shots.map((screenshot, index) => (
                    <div 
                      key={index}
                      className={`screenshot-item ${selectedScreenshot === index ? 'selected' : ''}`}
                      onClick={() => setSelectedScreenshot(index)}
                    >
                      <img 
                        src={screenshot} 
                        alt={`Screenshot ${index + 1}`} 
                        className="screenshot-image"
                      />
                      <div className="screenshot-label">Screenshot {index + 1}</div>
                    </div>
                  )) : null;
                })()}
              </div>
            </div>
          </div>

          <div className="product-page-container">
        <div className="product-main">
          <div className="product-image-section">
            {productData.img_url && (
              <img 
                src={productData.img_url} 
                alt="Product Preview" 
                className="product-preview-image"
              />
            )}
          </div>

          <div className="product-options-section">
            {/* Cart Buttons Above Products */}
            <div className="cart-section">
              <button className="view-cart-btn" onClick={() => setIsCartOpen(true)}>View Cart</button>
              <button className="checkout-btn" onClick={() => navigate('/checkout')}>Checkout</button>
            </div>

            <div className="products-grid">
              {productData.products && productData.products.map((product, index) => (
                <div key={index} className="product-card">
                  {/* Product Image */}
                  {product.preview_image && (
                    <div className="product-image">
                      <img 
                        src={`https://screenmerch.fly.dev/static/images/${product.preview_image}`}
                        alt={product.name}
                        onError={(e) => {
                          // Fallback to main_image if preview fails
                          e.target.src = `https://screenmerch.fly.dev/static/images/${product.main_image}`;
                        }}
                      />
                    </div>
                  )}
                  
                  <h3>{product.name}</h3>
                  <p className="product-price">${product.price.toFixed(2)}</p>
                  
                  <div className="product-options">
                    {/* Color Options */}
                    {product.options && product.options.color && product.options.color.length > 0 && (
                      <div className="option-group">
                        <label>Color:</label>
                        <select className="color-select">
                          {product.options.color.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Size Options */}
                    {product.options && product.options.size && product.options.size.length > 0 && (
                      <div className="option-group">
                        <label>Size:</label>
                        <select className="size-select">
                          {product.options.size.map((size, sizeIndex) => (
                            <option key={sizeIndex} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    className="add-to-cart-btn"
                    onClick={() => handleAddToCart(product, index)}
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>

            {/* Cart Buttons Below Products */}
            <div className="cart-section cart-section-bottom">
              <button className="view-cart-btn" onClick={() => setIsCartOpen(true)}>View Cart</button>
              <button className="checkout-btn" onClick={() => navigate('/checkout')}>Checkout</button>
            </div>
          </div>
        </div>
      </div>
      {/* Simple Cart Modal */}
      {isCartOpen && (
        <div className="cart-modal" onClick={() => setIsCartOpen(false)}>
          <div className="cart-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Your Cart</h3>
            {cartItems.length === 0 ? (
              <p>Your cart is empty.</p>
            ) : (
              <div className="cart-items">
                {cartItems.map((ci, i) => (
                  <div key={i} className="cart-item">
                    {ci.image && <img src={ci.image} alt={ci.name} />}
                    <div className="cart-item-info">
                      <div className="cart-item-name">{ci.name}</div>
                      <div className="cart-item-meta">{ci.color} • {ci.size}</div>
                      <div className="cart-item-price">${(ci.price || 0).toFixed(2)}</div>
                    </div>
                    {ci.screenshot && <img className="cart-item-shot" src={ci.screenshot} alt="screenshot" />}
                  </div>
                ))}
                <div className="cart-actions">
                  <button className="view-cart-btn" onClick={() => setIsCartOpen(false)}>Continue Shopping</button>
                  <button className="checkout-btn" onClick={() => navigate('/checkout')}>Checkout</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default ProductPage;