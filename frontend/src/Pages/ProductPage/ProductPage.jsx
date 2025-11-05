import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import './ProductPage.css';

const IMG_BASE = 'https://screenmerch.fly.dev/static/images';

// Generate a unique cache-busting parameter
const getCacheBuster = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    { name: "All Products", emoji: "🛍️", category: "all-products" },
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
    if (window.__DEBUG__) {
    console.log('🔄 Category clicked:', newCategory);
    console.log('🔄 Current category:', category);
    console.log('🔄 Product ID:', productId);
    console.log('🔄 Authenticated:', authenticated);
    console.log('🔄 Email:', email);
    }

    const needsBrowse =
      !productId ||
      productId === 'browse' ||
      productId === 'undefined' ||
      productId === 'null';

    const base = needsBrowse ? '/product/browse' : `/product/${productId}`;

    const newUrl =
      `${base}?category=${encodeURIComponent(newCategory)}` +
      `&authenticated=${authenticated}` +
      `&email=${encodeURIComponent(email || '')}`;

    // Persist for mobile reloads
    try { localStorage.setItem('last_selected_category', newCategory); } catch {}

    // Navigate (iOS-safe fallback)
    try {
      navigate(newUrl);
      if (window.__DEBUG__) console.log('✅ Navigate called successfully to', newUrl);
    } catch (error) {
      console.error('❌ Navigate failed, falling back:', error);
      window.location.assign(newUrl);
    }
  };

  const getStaticProductsForCategory = (category) => {
    // Use same category_mappings logic as backend
    const category_mappings = {
      'mens': [
        "Unisex Hoodie",
        "Men's Tank Top", 
        "Mens Fitted T-Shirt",
        "Men's Fitted Long Sleeve",
        "Unisex T-Shirt",
        "Unisex Oversized T-Shirt",
        "Men's Long Sleeve Shirt",
        "Unisex Champion Hoodie"
      ],
      'womens': [
        "Cropped Hoodie",
        "Fitted Racerback Tank",
        "Micro-Rib Tank Top", 
        "Women's Ribbed Neck",
        "Women's Shirt",
        "Unisex Heavyweight T-Shirt",
        "Unisex Pullover Hoodie",
        "Women's Crop Top"
      ],
      'kids': [
        "Youth Heavy Blend Hoodie",
        "Kids Shirt",
        "Kids Long Sleeve",
        "Toddler Short Sleeve T-Shirt",
        "Toddler Jersey T-Shirt",
        "Kids Sweatshirt",
        "Youth All Over Print Swimsuit",
        "Girls Leggings",
        "Baby Staple Tee",
        "Baby Jersey T-Shirt",
        "Baby Body Suit"
      ],
      'bags': [
        "Laptop Sleeve",
        "All-Over Print Drawstring", 
        "All Over Print Tote Pocket",
        "All-Over Print Crossbody Bag",
        "All-Over Print Utility Bag"
      ],
      'hats': [
        "Distressed Dad Hat",
        "Snapback Hat",
        "Five Panel Trucker Hat",
        "5 Panel Baseball Cap"
      ],
      'mugs': [
        "White Glossy Mug",
        "Travel Mug",
        "Enamel Mug",
        "Colored Mug"
      ],
      'pets': [
        "Pet Bowl All-Over Print",
        "Pet Bandana Collar",
        "All Over Print Leash",
        "All Over Print Collar"
      ],
      'misc': [
        "Bandana",
        "Hardcover Bound Notebook", 
        "Coasters",
        "Apron",
        "Jigsaw Puzzle with Tin",
        "Greeting Card",
        "Kiss-Cut Stickers",
        "Die-Cut Magnets"
      ],
      'all-products': [],  // All Products category - will contain all products eventually
      'thumbnails': []  // Coming Soon - no products yet
    };

    // Get product names for the selected category
    const category_products = category_mappings[category] || [];
    
    // For "all" or "all-products", return empty array - backend will handle it
    if (!category || category === "all" || category === "all-products") {
      return [];
    }
    
    // Map product names to actual product data from backend (using exact filenames from PRODUCTS list)
    const productImageMap = {
      "Unisex Hoodie": { filename: "tested.png", preview: "testedpreview.png", price: 36.95 },
      "Men's Tank Top": { filename: "random.png", preview: "randompreview.png", price: 24.23 },
      "Mens Fitted T-Shirt": { filename: "mensfittedtshirt.png", preview: "mensfittedtshirtpreview.png", price: 26.58 },
      "Men's Fitted Long Sleeve": { filename: "mensfittedlongsleeve.png", preview: "mensfittedlongsleevepreview.png", price: 29.33 },
      "Unisex T-Shirt": { filename: "guidontee.png", preview: "guidonteepreview.png", price: 21.69 },
      "Unisex Oversized T-Shirt": { filename: "unisexoversizedtshirt.png", preview: "unisexoversizedtshirtpreview.png", price: 26.49 },
      "Men's Long Sleeve Shirt": { filename: "menslongsleeve.png", preview: "menslongsleevepreview.png", price: 24.79 },
      "Unisex Champion Hoodie": { filename: "hoodiechampion.png", preview: "hoodiechampionpreview.png", price: 45.00 },
      "Cropped Hoodie": { filename: "croppedhoodie.png", preview: "croppedhoodiepreview.png", price: 43.15 },
      "Fitted Racerback Tank": { filename: "womenstank.png", preview: "womenstankpreview.png", price: 20.95 },
      "Micro-Rib Tank Top": { filename: "womenstee.png", preview: "womensteepreview.png", price: 25.81 },
      "Women's Ribbed Neck": { filename: "womensribbedneck.png", preview: "womensribbedneckpreview.png", price: 25.60 },
      "Women's Shirt": { filename: "womensshirt.png", preview: "womensshirtpreview.png", price: 23.69 },
      "Unisex Heavyweight T-Shirt": { filename: "womenshdshirt.png", preview: "womenshdshirtpreview.png", price: 25.29 },
      "Unisex Pullover Hoodie": { filename: "unisexpulloverhoodie.png", preview: "unisexpulloverhoodiepreview.png", price: 41.06 },
      "Women's Crop Top": { filename: "womens-crop-top.png", preview: "womenscroptoppreview.png", price: 28.55 },
      "Youth Heavy Blend Hoodie": { filename: "kidhoodie.png", preview: "kidhoodiepreview.png", price: 29.33 },
      "Kids Shirt": { filename: "kidshirt.png", preview: "kidshirtpreview.png", price: 23.49 },
      "Kids Long Sleeve": { filename: "kidlongsleeve.png", preview: "kidlongsleevepreview.png", price: 26.49 },
      "Toddler Short Sleeve T-Shirt": { filename: "toddlershortsleevet.png", preview: "toddlershortsleevetpreview.png", price: 22.75 },
      "Toddler Jersey T-Shirt": { filename: "toddlerjerseytshirt.png", preview: "toddlerjerseytshirtpreview.png", price: 20.29 },
      "Baby Staple Tee": { filename: "babystapletshirt.png", preview: "babystapletshirtpreview.png", price: 22.19 },
      "Baby Jersey T-Shirt": { filename: "toddlerjerseytshirt.png", preview: "toddlerjerseytshirtpreview.png", price: 20.29 },
      "Baby Body Suit": { filename: "infantbodysuit.png", preview: "infantbodysuit.png", price: 20.90 },
      "Kids Sweatshirt": { filename: "kidssweatshirt.png", preview: "kidssweatshirtpreview.png", price: 27.29 },
      "Youth All Over Print Swimsuit": { filename: "youthalloverprintswimsuit.png", preview: "youthalloverprintswimsuitpreview.png", price: 33.95 },
      "Girls Leggings": { filename: "girlsleggings.png", preview: "girlsleggingspreview.png", price: 28.31 },
      "Laptop Sleeve": { filename: "laptopsleeve.png", preview: "laptopsleevepreview.png", price: 31.16 },
      "All-Over Print Drawstring": { filename: "drawstringbag.png", preview: "drawstringbagpreview.png", price: 25.25 },
      "All-Over Print Utility Bag": { filename: "crossbodybag.png", preview: "crossbodybagpreview.png", price: 31.79 },
      "All Over Print Tote Pocket": { filename: "largecanvasbag.png", preview: "largecanvasbagpreview.png", price: 33.41 },
      "All-Over Print Crossbody Bag": { filename: "crossbodybag.png", preview: "crossbodybagpreview.png", price: 28.95 },
      "Distressed Dad Hat": { filename: "distresseddadhat.png", preview: "distresseddadhatpreview.png", price: 24.95 },
      "Snapback Hat": { filename: "snapbackhat.png", preview: "snapbackhatpreview.png", price: 24.95 },
      "Five Panel Trucker Hat": { filename: "fivepaneltruckerhat.png", preview: "fivepaneltruckerhatpreview.png", price: 24.95 },
      "5 Panel Baseball Cap": { filename: "youthbaseballcap.png", preview: "youthbaseballcappreview.png", price: 24.95 },
      "White Glossy Mug": { filename: "mug1.png", preview: "mug1preview.png", price: 15.95 },
      "Travel Mug": { filename: "travelmug.png", preview: "travelmugpreview.png", price: 19.95 },
      "Enamel Mug": { filename: "enamalmug.png", preview: "enamalmugpreview.png", price: 18.95 },
      "Colored Mug": { filename: "coloredmug.png", preview: "coloredmugpreview.png", price: 17.95 },
      "Pet Bowl All-Over Print": { filename: "dogbowl.png", preview: "dogbowlpreview.png", price: 31.49 },
      "Pet Bandana Collar": { filename: "scarfcollar.png", preview: "scarfcollarpreview.png", price: 19.95 },
      "All Over Print Leash": { filename: "leash.png", preview: "leashpreview.png", price: 24.95 },
      "All Over Print Collar": { filename: "collar.png", preview: "collarpreview.png", price: 23.08 },
      "Kiss-Cut Stickers": { filename: "stickers.png", preview: "stickerspreview.png", price: 4.29 },
      "Die-Cut Magnets": { filename: "magnet.png", preview: "magnetpreview.png", price: 5.32 },
      "Greeting Card": { filename: "greetingcard.png", preview: "greetingcardpreview.png", price: 5.00 },
      "Hardcover Bound Notebook": { filename: "hardcovernotebook.png", preview: "hardcovernotebookpreview.png", price: 23.21 },
      "Coasters": { filename: "coaster.png", preview: "coasterpreview.png", price: 33.99 },
      "Apron": { filename: "apron.png", preview: "apronpreview.png", price: 19.99 },
      "Bandana": { filename: "bandana.png", preview: "bandanapreview.png", price: 19.95 },
      "Jigsaw Puzzle with Tin": { filename: "jigsawpuzzle.png", preview: "jigsawpuzzlepreview.png", price: 27.65 }
    };

    // Return products with actual image paths from backend
    return category_products.map(productName => {
      const productData = productImageMap[productName] || { filename: "placeholder.png", preview: "placeholder.png", price: 25.00 };
      return {
        name: productName,
        price: productData.price,
        main_image: `${IMG_BASE}/${productData.filename}`,
        preview_image: `${IMG_BASE}/${productData.preview}`,
        options: { color: ["Black", "White", "Hazy Pink", "Pale Pink", "Orchid", "Ecru", "White", "Bubblegum", "Bone", "Mineral", "Natural"], size: ["XS", "S", "M", "L", "XL"] }
      };
    });
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

  // Calculate price based on selected size
  const calculatePrice = (product, productIndex) => {
    const basePrice = product.price || 0;
    const selectedSize = selectedSizes[productIndex] || product?.options?.size?.[0];
    
    if (product.size_pricing && product.size_pricing[selectedSize] !== undefined) {
      return basePrice + product.size_pricing[selectedSize];
    }
    
    return basePrice;
  };

  const persistCart = (items) => {
    setCartItems(items);
    try { localStorage.setItem('cart_items', JSON.stringify(items)); } catch (e) {}
  };

  const handleAddToCart = (product, index) => {
    const chosenColor = selectedColors[index] || (product?.options?.color?.[0] || 'Default');
    const chosenSize = selectedSizes[index] || (product?.options?.size?.[0] || 'One Size');
    const screenshotUrl = getSelectedScreenshotUrl();

    // Get video metadata from localStorage
    let videoMetadata = {};
    try {
      const raw = localStorage.getItem('pending_merch_data');
      console.log('🔍 Raw localStorage data:', raw);
      if (raw) {
        const merchData = JSON.parse(raw);
        console.log('🔍 Parsed merch data:', merchData);
        videoMetadata = {
          video_url: merchData.videoUrl,
          video_title: merchData.videoTitle,
          creator_name: merchData.creatorName,
          thumbnail: merchData.thumbnail
        };
        console.log('🔍 Video metadata extracted:', videoMetadata);
      }
    } catch (e) {
      console.warn('Could not load video metadata from localStorage:', e);
    }

    const item = {
      name: product?.name || 'Product',
      price: calculatePrice(product, index),
      image: product?.preview_image
        ? (product.preview_image.startsWith('http') ? product.preview_image : `${IMG_BASE}/${product.preview_image}`)
        : (product?.main_image ? (product.main_image.startsWith('http') ? product.main_image : `${IMG_BASE}/${product.main_image}`) : ''),
      color: chosenColor,
      size: chosenSize,
      screenshot: screenshotUrl,
      qty: 1,
      // Include video metadata in cart item
      ...videoMetadata
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
    if (window.__DEBUG__) {
    console.log('🔄 useEffect triggered with:', { productId, category, authenticated, email });
    }
    
    const fetchProductData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Handle browse mode - use 'browse' when productId is undefined or 'dynamic'
        const actualProductId = productId || 'browse';
        const isBrowseMode = !productId || productId === 'browse' || productId === 'dynamic';
        
        const url = isBrowseMode
          ? `https://screenmerch.fly.dev/api/product/browse?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}&v=${Date.now()}&mobile=${Date.now()}&cache=${Math.random()}`
          : `https://screenmerch.fly.dev/api/product/${actualProductId}?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}&v=${Date.now()}&mobile=${Date.now()}&cache=${Math.random()}`;

        // Enable debug for mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (window.__DEBUG__ || isMobile) {
        console.log('🌐 Fetching product data from:', url);
        console.log('📱 User Agent:', navigator.userAgent);
          console.log('📱 Is Mobile:', isMobile);
          console.log('🔧 Debug mode enabled for mobile');
          console.log('🔧 ProductId:', productId);
          console.log('🔧 Category:', category);
          console.log('🔧 IsBrowseMode:', isBrowseMode);
          
          // Mobile debugging (console only, no alerts)
          if (isMobile) {
            console.log(`Mobile Debug:\nProductId: ${productId}\nCategory: ${category}\nIsBrowseMode: ${isBrowseMode}\nURL: ${url}`);
          }
        }

        // Fetch product data from backend API with mobile-friendly settings
        let response;
        try {
          if (window.__DEBUG__ || isMobile) {
            console.log('🚀 Starting fetch request...');
            console.log('📱 Mobile detection:', isMobile);
            console.log('📱 URL:', url);
          }
          
          response = await fetch(url, {
          method: 'GET',
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            // Longer timeout for mobile networks
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
          if (window.__DEBUG__ || isMobile) {
            console.log('✅ Fetch completed, status:', response.status);
            console.log('✅ Response headers:', Object.fromEntries(response.headers.entries()));
          }
        } catch (fetchError) {
          console.error('❌ Fetch failed:', fetchError);
          console.error('❌ Error name:', fetchError.name);
          console.error('❌ Error message:', fetchError.message);
          
          // Mobile debugging (console only)
          if (isMobile) {
            console.log(`Fetch Failed!\nError: ${fetchError.message}\nURL: ${url}`);
          }
          
          // Only use mobile fallback if the API call actually failed
          if (isMobile) {
            console.log('📱 API call failed, using mobile fallback with static data');
            console.log('📱 This should NOT happen if API call succeeded');
            console.log('📱 Error details:', fetchError.message);
            const staticProducts = getStaticProductsForCategory(category);
            console.log('📱 Static products:', staticProducts);
            
            const staticData = {
              success: true,
              product: {
                thumbnail_url: '',
                screenshots: []
              },
              products: staticProducts,
              category: category
            };
            
            console.log('📱 Setting static data:', staticData);
            setProductData(staticData);
            setLoading(false);
            setError(null);
            
            // Mobile debugging (console only)
            console.log(`Mobile Fallback Active!\nProducts: ${staticProducts.length}\nCategory: ${category}`);
            return; // Skip the rest of the error handling
          }
          
          // For non-mobile, try a simpler fetch as fallback
          if (window.__DEBUG__) {
            console.log('🔄 Trying fallback fetch...');
          }
          
          try {
            response = await fetch(url, {
              method: 'GET',
              cache: 'no-cache'
            });
            if (window.__DEBUG__) {
              console.log('✅ Fallback fetch succeeded, status:', response.status);
            }
          } catch (fallbackError) {
            console.error('❌ Fallback fetch also failed:', fallbackError);
            throw new Error(`Network error: ${fetchError.message} | Fallback: ${fallbackError.message}`);
          }
        }

        if (window.__DEBUG__) {
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          throw new Error(`Failed to fetch product data: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();

        if (window.__DEBUG__) {
        console.log('📦 Product Data Received:', data);
        console.log('📸 Thumbnail URL:', data.product?.thumbnail_url);
        console.log('📸 Screenshots:', data.product?.screenshots);
        console.log('📸 Screenshots Length:', data.product?.screenshots?.length || 0);
        console.log('📦 Products Count:', data.products?.length || 0);
        console.log('📦 Category:', data.category);
        console.log('📦 Success:', data.success);
        }

        // Debug the data structure
        if (window.__DEBUG__ || isMobile) {
          console.log('📦 Raw API Response:', data);
          console.log('📦 Products array:', data.products);
          console.log('📦 Products length:', data.products?.length);
          console.log('📦 Success flag:', data.success);
        }
        
        // Cache the products data for offline use
        try {
          localStorage.setItem('cached_products', JSON.stringify(data.products));
          if (window.__DEBUG__) console.log('💾 Cached products data for offline use');
        } catch (e) {
          console.warn('Could not cache products data');
        }
        
        // Use real backend data when API call succeeds
        if (window.__DEBUG__ || isMobile) {
          console.log('✅ Using real backend data - API call succeeded');
          console.log('✅ Products from backend:', data.products?.length || 0);
          console.log('✅ First product image:', data.products?.[0]?.main_image);
          console.log('✅ First product preview:', data.products?.[0]?.preview_image);
          console.log('✅ Mobile fallback should NOT be used - API succeeded');
        }
        
        setProductData(data);
      } catch (err) {
        console.error('Error fetching product data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Call fetchProductData for both specific products and browse mode
    fetchProductData();
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
                const url =
                  `https://screenmerch.fly.dev/api/product/${actualProductId}` +
                  `?category=${encodeURIComponent(category)}` +
                  `&authenticated=${authenticated}` +
                  `&email=${encodeURIComponent(email || '')}`;

                const response = await fetch(url, {
                  method: 'GET',
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
    // Debug why productData is falsy
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (window.__DEBUG__ || isMobile) {
      console.log('❌ ProductData is falsy:', productData);
      console.log('❌ Loading state:', loading);
      console.log('❌ Error state:', error);
    }
    
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Product Not Found</h2>
          <p>The requested product could not be found.</p>
          <p>Debug: productData = {JSON.stringify(productData)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${sidebar ? "" : " large-container"}`}>
      {/* User Flow Section - Step 3 Only - Hide for All Products */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        return categoryNormalized !== 'all' && categoryNormalized !== 'all-products';
      })() && (
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
      )}


      {/* All Products - Informational Layout - MUST BE FIRST */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        const isAllProducts = categoryNormalized === 'all' || categoryNormalized === 'all-products';
        const hasProducts = productData?.products && productData.products.length > 0;
        
        // Always log for debugging
        console.log('🔍 All Products Check:', { 
          category, 
          isAllProducts, 
          hasProducts, 
          productCount: productData?.products?.length,
          productDataExists: !!productData
        });
        
        if (isAllProducts && hasProducts) {
          console.log('✅ Showing All Products informational layout');
          return true;
        } else {
          console.log('❌ NOT showing All Products layout:', { 
            reason: !isAllProducts ? 'category mismatch' : 'no products' 
          });
          return false;
        }
      })() && (
        <div className="all-products-info-container">
          {(() => {
            if (window.__DEBUG__) {
              console.log('✅ Rendering All Products informational layout');
            }
            // Group products by category
            const categoryGroups = {
              'womens': [],
              'mens': [],
              'kids': [],
              'mugs': [],
              'hats': [],
              'bags': [],
              'pets': [],
              'misc': []
            };

            // Map product names to categories
            const productCategoryMap = {
              'womens': ["Cropped Hoodie", "Fitted Racerback Tank", "Micro-Rib Tank Top", "Women's Ribbed Neck", "Women's Shirt", "Unisex Heavyweight T-Shirt", "Unisex Pullover Hoodie", "Women's Crop Top"],
              'mens': ["Unisex Hoodie", "Men's Tank Top", "Mens Fitted T-Shirt", "Men's Fitted Long Sleeve", "Unisex T-Shirt", "Unisex Oversized T-Shirt", "Men's Long Sleeve Shirt", "Unisex Champion Hoodie"],
              'kids': ["Youth Heavy Blend Hoodie", "Kids Shirt", "Kids Long Sleeve", "Toddler Short Sleeve T-Shirt", "Toddler Jersey T-Shirt", "Kids Sweatshirt", "Youth All Over Print Swimsuit", "Girls Leggings", "Baby Staple Tee", "Baby Jersey T-Shirt", "Baby Body Suit"],
              'mugs': ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"],
              'hats': ["Distressed Dad Hat", "Snapback Hat", "Five Panel Trucker Hat", "5 Panel Baseball Cap"],
              'bags': ["Laptop Sleeve", "All-Over Print Drawstring", "All Over Print Tote Pocket", "All-Over Print Crossbody Bag", "All-Over Print Utility Bag"],
              'pets': ["Pet Bowl All-Over Print", "Pet Bandana Collar", "All Over Print Leash", "All Over Print Collar"],
              'misc': ["Bandana", "Hardcover Bound Notebook", "Coasters", "Apron", "Jigsaw Puzzle with Tin", "Greeting Card", "Kiss-Cut Stickers", "Die-Cut Magnets"]
            };

            // Group products
            productData.products.forEach(product => {
              for (const [cat, products] of Object.entries(productCategoryMap)) {
                if (products.includes(product.name)) {
                  categoryGroups[cat].push(product);
                  break;
                }
              }
            });

            const categoryTitles = {
              'womens': "Women's",
              'mens': "Men's",
              'kids': "Kids",
              'mugs': "Mugs",
              'hats': "Hats",
              'bags': "Bags",
              'pets': "Pets",
              'misc': "Miscellaneous"
            };

            return ['womens', 'mens', 'kids', 'mugs', 'hats', 'bags', 'pets', 'misc'].map(cat => {
              if (categoryGroups[cat].length === 0) return null;
              return (
                <div key={cat} className="category-section">
                  <h2 className="category-section-title">{categoryTitles[cat]}</h2>
                  <div className="products-info-table">
                    <div className="info-table-header">
                      <div className="info-col-name">Name</div>
                      <div className="info-col-image">Image</div>
                      <div className="info-col-description">Description</div>
                    </div>
                    {categoryGroups[cat].map((product, index) => (
                      <div key={index} className="info-table-row">
                        <div className="info-col-name">{product.name}</div>
                        <div className="info-col-image">
                          <img 
                            src={
                              (product.preview_image || product.main_image)
                                ? ((product.preview_image || product.main_image).startsWith('http') 
                                    ? (product.preview_image || product.main_image)
                                    : `${IMG_BASE}/${product.preview_image || product.main_image}`)
                                : `${IMG_BASE}/placeholder.png`
                            }
                            alt={product.name}
                            className="info-product-image"
                            onError={(e) => {
                              e.currentTarget.src = `${IMG_BASE}/placeholder.png`;
                            }}
                          />
                        </div>
                        <div className="info-col-description">
                          {product.description || "No description available."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Products Section - Only show when specific category is selected (not "all") and has products */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        return categoryNormalized !== 'all' && categoryNormalized !== 'all-products';
      })() && productData.products && productData.products.length > 0 && (
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
                  return shots && shots.length > 0 ? shots.map((screenshot, index) => {
                    // Find the original index in the unfiltered array to match it correctly
                    const originalIndex = baseShots.findIndex(s => s === screenshot);
                    return (
                      <div 
                        key={index}
                        className={`screenshot-item ${selectedScreenshot === originalIndex ? 'selected' : ''}`}
                        onClick={() => setSelectedScreenshot(originalIndex)}
                      >
                        <img 
                          src={screenshot} 
                          alt={`Screenshot ${index + 1}`} 
                          className="screenshot-image"
                        />
                        <div className="screenshot-label">Screenshot {index + 1}</div>
                      </div>
                    );
                  }) : null;
                })()}
              </div>
            </div>
          </div>

          <div className="product-page-container">
        <div className="product-main">
          <div className="product-image-section">
            {productData.img_url && (
              <img 
                src={productData.img_url.includes('?') ? `${productData.img_url}&v=${getCacheBuster()}` : `${productData.img_url}?v=${getCacheBuster()}`} 
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
                  {(product.preview_image || product.main_image) && (() => {
                    const isApparelCategory = category === 'womens' || category === 'mens' || category === 'kids';
                    return (
                      <div className="product-image">
                        <div className="product-image-wrapper">
                          <img
                            className={isApparelCategory ? "product-image-clear" : "product-image-normal"}
                            src={
                              product.preview_image
                                ? (product.preview_image.startsWith('http') 
                                    ? (product.preview_image.includes('?') ? `${product.preview_image}&v=${getCacheBuster()}` : `${product.preview_image}?v=${getCacheBuster()}`)
                                    : (product.preview_image.includes('?') ? `${IMG_BASE}/${product.preview_image}&v=${getCacheBuster()}` : `${IMG_BASE}/${product.preview_image}?v=${getCacheBuster()}`))
                                : (product.main_image.startsWith('http') 
                                    ? (product.main_image.includes('?') ? `${product.main_image}&v=${getCacheBuster()}` : `${product.main_image}?v=${getCacheBuster()}`)
                                    : (product.main_image.includes('?') ? `${IMG_BASE}/${product.main_image}&v=${getCacheBuster()}` : `${IMG_BASE}/${product.main_image}?v=${getCacheBuster()}`))
                            }
                            alt={product.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // Fallback to main_image if preview fails
                              const fallback = product.main_image
                                ? (product.main_image.startsWith('http') 
                                    ? (product.main_image.includes('?') ? `${product.main_image}&v=${getCacheBuster()}` : `${product.main_image}?v=${getCacheBuster()}`)
                                    : (product.main_image.includes('?') ? `${IMG_BASE}/${product.main_image}&v=${getCacheBuster()}` : `${IMG_BASE}/${product.main_image}?v=${getCacheBuster()}`))
                                : '';
                              if (fallback && e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  <h3>{product.name}</h3>
                  {product.description && (
                    <p className="product-description">{product.description}</p>
                  )}
                  <p className="product-price">${calculatePrice(product, index).toFixed(2)}</p>
                  
                  <div className="product-options">
                    {/* Color Options */}
                    {product.options && product.options.color && product.options.color.length > 0 && (
                      <div className="option-group">
                        <label>Color:</label>
                        <select 
                          className="color-select"
                          value={selectedColors[index] || product.options.color[0]}
                          onChange={(e) => {
                            const newSelectedColors = { ...selectedColors };
                            newSelectedColors[index] = e.target.value;
                            setSelectedColors(newSelectedColors);
                          }}
                        >
                          {product.options.color.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Handle Color Options */}
                    {product.options && product.options.handle_color && product.options.handle_color.length > 0 && (
                      <div className="option-group">
                        <label>Handle Color:</label>
                        <select 
                          className="color-select"
                          value={selectedColors[index] || product.options.handle_color[0]}
                          onChange={(e) => {
                            const newSelectedColors = { ...selectedColors };
                            newSelectedColors[index] = e.target.value;
                            setSelectedColors(newSelectedColors);
                          }}
                        >
                          {product.options.handle_color.map((color, colorIndex) => (
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
                        <select 
                          className="size-select"
                          value={selectedSizes[index] || product.options.size[0]}
                          onChange={(e) => {
                            const newSelectedSizes = { ...selectedSizes };
                            newSelectedSizes[index] = e.target.value;
                            setSelectedSizes(newSelectedSizes);
                          }}
                        >
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
            {cartItems.length === 0 ? (
              <div className="empty-cart-message">
                <div className="empty-cart-icon">🛒</div>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <div className="cart-items-wrapper">
                <h2 className="cart-section-title">Cart Items</h2>
                <div className="cart-items">
                  {cartItems.map((ci, i) => (
                  <div key={i} className="cart-item">
                    {ci.image && <img src={ci.image.includes('?') ? `${ci.image}&v=${getCacheBuster()}` : `${ci.image}?v=${getCacheBuster()}`} alt={ci.name} />}
                    <div className="cart-item-info">
                      <div className="cart-item-name">{ci.name}</div>
                      <div className="cart-item-meta">{ci.color} • {ci.size}</div>
                      <div className="cart-item-price">${(ci.price || 0).toFixed(2)}</div>
                    </div>
                    {ci.screenshot && <img className="cart-item-shot" src={ci.screenshot} alt="screenshot" />}
                    <button 
                      className="cart-item-delete" 
                      onClick={() => {
                        const updatedItems = cartItems.filter((_, index) => index !== i);
                        setCartItems(updatedItems);
                        localStorage.setItem('cart_items', JSON.stringify(updatedItems));
                      }}
                      title="Remove item"
                    >
                      🗑️
                    </button>
                  </div>
                  ))}
                </div>
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
