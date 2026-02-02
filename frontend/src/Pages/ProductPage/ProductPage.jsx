import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ToolsPage from '../ToolsPage/ToolsPage';
import { supabase } from '../../supabaseClient';
import { UserService } from '../../utils/userService';
import { getBackendUrl } from '../../config/apiConfig';
import { products } from '../../data/products';
import './ProductPage.css';

const IMG_BASE_FALLBACK = 'https://screenmerch.fly.dev/static/images';
const getImgBase = () => {
  const base = getBackendUrl();
  if (!base || typeof base !== 'string') return IMG_BASE_FALLBACK;
  return `${base.replace(/\/$/, '')}/static/images`;
};

// Ensure HTTPS to avoid Mixed Content on https://screenmerch.com
const ensureHttps = (url) => {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/^http:\/\//i, 'https://');
};

// Prefer full URL from API (main_image_url / preview_image_url) when present
const getProductImageUrl = (product, preferPreview = true) => {
  if (!product) return `${getImgBase()}/placeholder.png`;
  // Use normalized URL from setProductData so images persist across category switches
  if (product._displayImageUrl) return product._displayImageUrl;
  const url = preferPreview
    ? (product.preview_image_url || product.preview_image)
    : (product.main_image_url || product.main_image);
  if (!url) return `${getImgBase()}/placeholder.png`;
  if (url.startsWith('http')) return ensureHttps(url);
  // Backend may return relative path (e.g. /static/images/x.png) when image_base is empty
  if (url.startsWith('/')) return `${getBackendUrl().replace(/\/$/, '')}${url}`;
  return `${getImgBase()}/${url}`;
};

// Stable cache key per productData so img src doesn't change every render (prevents images never loading)
const getCacheBuster = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getStableImageQuery = (productData) => productData?.timestamp ? `v=${productData.timestamp}` : `v=0`;

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
  const [showAddedToCartModal, setShowAddedToCartModal] = useState(false);
  const [fallbackImages, setFallbackImages] = useState({ screenshots: [], thumbnail: '' });
  const [isCreator, setIsCreator] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [selectedScreenshotForFavorite, setSelectedScreenshotForFavorite] = useState(null);

  // Read from query first
  const qsCategory = searchParams.get('category');
  
  // Fallback to localStorage if query missing (mobile stale reloads)
  const category = useMemo(() => {
    const c = (qsCategory || localStorage.getItem('last_selected_category') || '').trim();
    return c || 'mens'; // final default if truly absent
  }, [qsCategory]);
  
  const authenticated = searchParams.get('authenticated') === 'true';
  const email = searchParams.get('email') || '';
  const openCart = searchParams.get('openCart') === 'true';
  const creatorMode = searchParams.get('creatorMode') === 'favorites';

  useEffect(() => {
    if (window.__DEBUG__) {
      console.log('🔎 browse: qsCategory=', qsCategory, 'resolved category=', category);
      console.log('🔗 full url:', window.location.href);
    }
    // keep the last used category current
    if (category) localStorage.setItem('last_selected_category', category);
    
    // Open cart modal if openCart parameter is present
    if (openCart) {
      setIsCartOpen(true);
      // Remove the parameter from URL to clean it up
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openCart');
      const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [qsCategory, category, openCart, searchParams]);

  // Categories for selection
  const categories = [
    { name: "Women's", emoji: "👩", category: "womens" },
    { name: "Men's", emoji: "👨", category: "mens" },
    { name: "Kids", emoji: "👶", category: "kids" },
    { name: "Mugs", emoji: "☕", category: "mugs" },
    { name: "Hats", emoji: "🧢", category: "hats" },
    { name: "Bags", emoji: "👜", category: "bags" },
    { name: "Pets", emoji: "🐕", category: "pets" },
    { name: "Misc", emoji: "📦", category: "misc" },
    { name: "Product Info", emoji: "🛍️", category: "all-products" },
    { name: "Image Tools", emoji: "🛠️", category: "thumbnails" }
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
        "Closed Back Cap",
        "Five Panel Trucker Hat",
        "Five Panel Baseball Cap"
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
      "Cropped Hoodie": { filename: "womenscroppedhoodiepreview.png", preview: "womenscroppedhoodiepreview.png", price: 43.15 },
      "Fitted Racerback Tank": { filename: "womenstankpreview.png", preview: "womenstankpreview.png", price: 20.95 },
      "Micro-Rib Tank Top": { filename: "womensmicroribtanktoppreview.png", preview: "womensmicroribtanktoppreview.png", price: 25.81 },
      "Women's Ribbed Neck": { filename: "womensribbedneckpreview.png", preview: "womensribbedneckpreview.png", price: 25.60 },
      "Women's Shirt": { filename: "womenshirtpreview.png", preview: "womenshirtpreview.png", price: 23.69 },
      "Unisex Heavyweight T-Shirt": { filename: "womenshdshirtpreview.png", preview: "womenshdshirtpreview.png", price: 25.29 },
      "Unisex Pullover Hoodie": { filename: "womensunisexpulloverhoodiepreview.png", preview: "womensunisexpulloverhoodiepreview.png", price: 41.06 },
      "Women's Crop Top": { filename: "womenscroptoppreview.png", preview: "womenscroptoppreview.png", price: 28.55 },
      "Youth Heavy Blend Hoodie": { filename: "kidhoodie.png", preview: "kidhoodiepreview.png", price: 29.33 },
      "Kids Shirt": { filename: "kidshirt.png", preview: "kidshirtpreview.png", price: 23.49 },
      "Kids Long Sleeve": { filename: "kidlongsleeve.png", preview: "kidlongsleevepreview.png", price: 26.49 },
      "Toddler Short Sleeve T-Shirt": { filename: "toddlershortsleevet.png", preview: "toddlershortsleevetpreview.png", price: 22.75 },
      "Toddler Jersey T-Shirt": { filename: "toddlerjerseytshirt.png", preview: "toddlerjerseytshirtpreview.png", price: 20.29 },
      "Baby Staple Tee": { filename: "babystapletshirt.png", preview: "babystapletshirtpreview.png", price: 22.19 },
      "Baby Jersey T-Shirt": { filename: "toddlershortsleevet.png", preview: "toddlershortsleevetpreview.png", price: 20.29 },
      "Baby Body Suit": { filename: "youthalloverprintswimsuit.png", preview: "youthalloverprintswimsuitpreview.png", price: 20.90 },
      "Kids Sweatshirt": { filename: "kidssweatshirt.png", preview: "kidssweatshirtpreview.png", price: 27.29 },
      "Youth All Over Print Swimsuit": { filename: "youthalloverprintswimsuit.png", preview: "youthalloverprintswimsuitpreview.png", price: 33.95 },
      "Girls Leggings": { filename: "girlsleggings.png", preview: "girlsleggingspreview.png", price: 28.31 },
      "Laptop Sleeve": { filename: "laptopsleeve.png", preview: "laptopsleevepreview.png", price: 31.16 },
      "All-Over Print Drawstring": { filename: "drawstringbag.png", preview: "drawstringbagpreview.png", price: 25.25 },
      "All-Over Print Utility Bag": { filename: "crossbodybag.png", preview: "crossbodybagpreview.png", price: 31.79 },
      "All Over Print Tote Pocket": { filename: "largecanvasbag.png", preview: "largecanvasbagpreview.png", price: 33.41 },
      "All-Over Print Crossbody Bag": { filename: "crossbodybag.png", preview: "crossbodybagpreview.png", price: 28.95 },
      "Distressed Dad Hat": { filename: "distresseddadhat.png", preview: "distresseddadhatpreview.png", price: 24.95 },
      "Closed Back Cap": { filename: "closedbackcap.png", preview: "hatsclosedbackcappreview.png", price: 25.19 },
      "Five Panel Trucker Hat": { filename: "fivepaneltruckerhat.png", preview: "fivepaneltruckerhatpreview.png", price: 24.95 },
      "Five Panel Baseball Cap": { filename: "youthbaseballcap.png", preview: "youthbaseballcappreview.png", price: 24.95 },
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
        main_image: `${getImgBase()}/${productData.filename}`,
        preview_image: `${getImgBase()}/${productData.preview}`,
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

  const handleToFavorite = async () => {
    if (!selectedScreenshotForFavorite) {
      alert('Please select a screenshot first.');
      return;
    }

    const screenshotUrl = getSelectedScreenshotUrl();
    if (!screenshotUrl) {
      alert('No screenshot selected.');
      return;
    }

    // Get screenshot label
    let screenshotLabel = 'Screenshot';
    if (selectedScreenshotForFavorite === 'thumbnail') {
      screenshotLabel = 'Thumbnail';
    } else if (typeof selectedScreenshotForFavorite === 'number') {
      screenshotLabel = `Screenshot ${selectedScreenshotForFavorite + 1}`;
    }

    await handleSaveToFavorites(screenshotUrl, screenshotLabel);
  };

  const handleSaveToFavorites = async (screenshotUrl, screenshotLabel) => {
    if (!isCreator) {
      alert('Only creators can save screenshots to favorites.');
      return;
    }

    try {
      setSavingFavorite(true);

      // Get current user
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      let user = null;
      let userId = null;
      
      if (isAuthenticated === 'true' && userData) {
        // Google OAuth user
        const googleUser = JSON.parse(userData);
        user = googleUser;
        userId = googleUser.id;
      } else {
        // Fallback to Supabase auth
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (!supabaseUser) {
          alert('Please sign in to save favorites.');
          return;
        }
        user = supabaseUser;
        userId = supabaseUser.id;
      }

      if (!userId) {
        alert('Unable to identify user. Please sign in again.');
        return;
      }

      // Get user profile for channel title
      const { data: profile } = await supabase
        .from('users')
        .select('display_name, username, channelTitle')
        .eq('id', userId)
        .single();

      const channelTitle = profile?.channelTitle || profile?.display_name || profile?.username || user?.name || 'Unknown Creator';

      // Get video metadata from localStorage if available
      const raw = localStorage.getItem('pending_merch_data');
      let videoTitle = screenshotLabel || 'Screenshot';
      if (raw) {
        try {
          const merchData = JSON.parse(raw);
          if (merchData.videoTitle) {
            videoTitle = `${merchData.videoTitle} - ${screenshotLabel}`;
          }
        } catch (e) {
          console.warn('Could not parse pending_merch_data');
        }
      }

      // Save to favorites
      const insertData = {
        user_id: userId,
        channelTitle: channelTitle,
        title: videoTitle,
        description: `Saved screenshot from product selection`,
        image_url: screenshotUrl,
        thumbnail_url: screenshotUrl
      };

      const { data, error } = await supabase
        .from('creator_favorites')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error saving favorite:', error);
        alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
      } else {
        console.log('Favorite saved successfully:', data);
        alert('Screenshot saved to favorites!');
        
        // Stay on the page so creator can select more screenshots
        // No navigation - creator can continue selecting and saving
      }
    } catch (error) {
      console.error('Error saving favorite:', error);
      alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingFavorite(false);
    }
  };

  // Get available sizes for a product and color based on availability data
  const getAvailableSizes = (product, color) => {
    if (!product || !color) {
      return product?.options?.size || [];
    }
    
    // Find product in products.js by name (case-insensitive, trim whitespace)
    const productName = (product.name || '').trim().toLowerCase();
    const productKey = Object.keys(products).find(key => {
      const localProductName = (products[key].name || '').trim().toLowerCase();
      return localProductName === productName;
    });
    
    if (!productKey) {
      // Product not found in local data, return all sizes
      return product.options?.size || [];
    }
    
    const localProduct = products[productKey];
    if (!localProduct.variables?.availability) {
      // No availability data, return all sizes
      return product.options?.size || [];
    }
    
    const availability = localProduct.variables.availability;
    const allSizes = localProduct.variables.sizes || product.options?.size || [];
    
    // Filter sizes where this color is available (explicitly true)
    const availableSizes = allSizes.filter(size => {
      const sizeAvailability = availability[size];
      if (!sizeAvailability || typeof sizeAvailability !== 'object') return false;
      // Check if color exists and is explicitly true
      return sizeAvailability[color] === true;
    });
    
    // If no sizes are available, fall back to all sizes (shouldn't happen, but defensive)
    return availableSizes.length > 0 ? availableSizes : (product.options?.size || []);
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

    // Get video metadata from localStorage (including screenshot_timestamp for email/order)
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
          thumbnail: merchData.thumbnail,
          screenshot_timestamp: merchData.screenshot_timestamp
        };
        console.log('🔍 Video metadata extracted:', videoMetadata);
      }
    } catch (e) {
      console.warn('Could not load video metadata from localStorage:', e);
    }

    const item = {
      name: product?.name || 'Product',
      price: calculatePrice(product, index),
      image: getProductImageUrl(product, true),
      color: chosenColor,
      size: chosenSize,
      screenshot: screenshotUrl,
      selected_screenshot: screenshotUrl,
      qty: 1,
      // Include video metadata in cart item (screenshot_timestamp for email/Print Quality)
      ...videoMetadata
    };
    const next = [...cartItems, item];
    persistCart(next);
    console.log('✅ Item added to cart, showing modal...');
    setShowAddedToCartModal(true);
  };

  // Check if user is a creator
  useEffect(() => {
    const checkCreatorStatus = async () => {
      const creatorStatus = await UserService.isCreator();
      setIsCreator(creatorStatus);
      
      // If in creator mode, set initial selected screenshot
      if (creatorMode && creatorStatus) {
        // Set thumbnail as default selection
        setSelectedScreenshot('thumbnail');
        setSelectedScreenshotForFavorite('thumbnail');
      }
    };
    checkCreatorStatus();
  }, [creatorMode]);

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
        
        // In creator mode, if we have video data, set up productData structure
        if (creatorMode && d?.thumbnail) {
          // Create a minimal productData structure for screenshot selection
          setProductData({
            success: true,
            product: {
              thumbnail_url: d.thumbnail,
              screenshots: Array.isArray(d.screenshots) ? d.screenshots : []
            },
            products: [],
            category: category
          });
        }
      }
    } catch (e) {
      console.warn('Invalid pending_merch_data in localStorage, ignoring');
    }
  }, [productId, creatorMode, category]);

  useEffect(() => {
    const wantedCategory = category;
    const wantedProductId = productId || 'browse';
    const controller = new AbortController();

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

        const apiBase = getBackendUrl().replace(/\/$/, '');
        const url = isBrowseMode
          ? `${apiBase}/api/product/browse?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}&v=${Date.now()}&mobile=${Date.now()}&cache=${Math.random()}`
          : `${apiBase}/api/product/${actualProductId}?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}&v=${Date.now()}&mobile=${Date.now()}&cache=${Math.random()}`;

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
        let timeoutId;
        try {
          if (window.__DEBUG__ || isMobile) {
            console.log('🚀 Starting fetch request...');
            console.log('📱 Mobile detection:', isMobile);
            console.log('📱 URL:', url);
          }
          timeoutId = setTimeout(() => controller.abort(), 30000);
          response = await fetch(url, {
          method: 'GET',
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            signal: controller.signal
        });
          clearTimeout(timeoutId);
        } catch (e) {
          if (timeoutId) clearTimeout(timeoutId);
          throw e;
        }

          if (window.__DEBUG__ || isMobile) {
            console.log('✅ Fetch completed, status:', response.status);
            console.log('✅ Response headers:', Object.fromEntries(response.headers.entries()));
          }

        if (window.__DEBUG__) {
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
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

        // Ignore stale response if user already switched category
        if (data.category !== wantedCategory) {
          setLoading(false);
          return;
        }
        // Normalize products with stable image URLs so they persist across re-renders/category switches
        const base = getBackendUrl().replace(/\/$/, '');
        const imgBase = `${base}/static/images`;
        const productsWithUrls = (data.products || []).map((p) => {
          if (!p) return p;
          const previewUrl = p.preview_image_url || (p.preview_image ? (p.preview_image.startsWith('/') ? base + p.preview_image : (p.preview_image.startsWith('http') ? ensureHttps(p.preview_image) : `${imgBase}/${p.preview_image}`)) : '');
          const mainUrl = p.main_image_url || (p.main_image ? (p.main_image.startsWith('/') ? base + p.main_image : (p.main_image.startsWith('http') ? ensureHttps(p.main_image) : `${imgBase}/${p.main_image}`)) : '');
          return { ...p, _displayImageUrl: previewUrl || mainUrl || `${imgBase}/placeholder.png` };
        });
        setProductData({ ...data, products: productsWithUrls });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('Error fetching product data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
    return () => controller.abort();
  }, [productId, category, authenticated, email]);

  // Validate and reset sizes when products or colors change
  useEffect(() => {
    if (!productData?.products || productData.products.length === 0) return;
    
    setSelectedSizes(prevSizes => {
      const newSelectedSizes = { ...prevSizes };
      let hasChanges = false;
      
      productData.products.forEach((product, index) => {
        if (!product || !product.options) return;
        
        // Bags "All Over Print Tote Pocket" has handle_color but no color
        const selectedColor = selectedColors[index] || product.options?.color?.[0] || product.options?.handle_color?.[0];
        if (!selectedColor && (!product.options?.size?.length)) return;
        
        const availableSizes = getAvailableSizes(product, selectedColor);
        if (availableSizes.length === 0) {
          // If no available sizes found, use first size from product options as fallback
          if (product.options?.size?.[0] && !prevSizes[index]) {
            newSelectedSizes[index] = product.options?.size[0];
            hasChanges = true;
          }
          return;
        }
        
        const currentSize = prevSizes[index];
        
        // If no size is selected yet, or current size is not available, set to first available
        if (!currentSize || !availableSizes.includes(currentSize)) {
          newSelectedSizes[index] = availableSizes[0];
          hasChanges = true;
        }
      });
      
      return hasChanges ? newSelectedSizes : prevSizes;
    });
  }, [productData, selectedColors]);

  // Only show full-screen loading on initial load (no productData yet). When switching category, keep showing current products so images persist.
  if (loading && !productData) {
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
                const apiBase = getBackendUrl().replace(/\/$/, '');
                const url =
                  `${apiBase}/api/product/${actualProductId}` +
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

  // Show ToolsPage when category is thumbnails
  if (category === 'thumbnails') {
    return <ToolsPage />;
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
        
        // Only log for debugging when debug mode is enabled
        if (window.__DEBUG__) {
          console.log('🔍 All Products Check:', { 
            category, 
            isAllProducts, 
            hasProducts, 
            productCount: productData?.products?.length,
            productDataExists: !!productData
          });
        }
        
        if (isAllProducts && hasProducts) {
          if (window.__DEBUG__) {
            console.log('✅ Showing All Products informational layout');
          }
          return true;
        } else {
          // Only log when debug mode is enabled - this is normal behavior, not an error
          if (window.__DEBUG__) {
            console.log('ℹ️ Not showing All Products layout (normal for specific categories):', { 
              reason: !isAllProducts ? 'viewing specific category' : 'no products' 
            });
          }
          return false;
        }
      })() && (
        <div className="all-products-info-container">
          <h1 className="product-information-title">Product Information</h1>
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
              'kids': ["Youth Heavy Blend Hoodie", "Kids Shirt", "Kids Long Sleeve", "Toddler Jersey T-Shirt", "Kids Sweatshirt", "Baby Staple Tee", "Baby Jersey T-Shirt", "Baby Body Suit"],
              'mugs': ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"],
              'hats': ["Distressed Dad Hat", "Closed Back Cap", "Five Panel Trucker Hat", "Five Panel Baseball Cap"],
              'bags': ["Laptop Sleeve", "All-Over Print Drawstring", "All Over Print Tote Pocket", "All-Over Print Utility Bag"],
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
                        <div className="info-col-name">
                          {product.name}
                          {product.name && product.name.includes('Jigsaw Puzzle with Tin') && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666', display: 'block', marginTop: '4px' }}>
                              (Ages 4+ only)
                            </span>
                          )}
                        </div>
                        <div className="info-col-image">
                          <img 
                            src={getProductImageUrl(product, true)}
                            alt={product.name}
                            className="info-product-image"
                            onError={(e) => {
                              e.currentTarget.src = `${getImgBase()}/placeholder.png`;
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
            <h2 className="screenshots-title">{creatorMode ? 'Select Screenshot to Add to Favorites' : 'Select Your Screenshot'}</h2>
            <p className="screenshots-subtitle">{creatorMode ? 'Choose which screenshot to save to your favorites' : 'Choose which screenshot to use for your custom merchandise'}</p>
            <div className="screenshots-preview">
              <div className="screenshot-grid">
                {/* Thumbnail */}
                {(() => {
                  const thumbnailUrl = productData?.product?.thumbnail_url || fallbackImages.thumbnail;
                  return thumbnailUrl ? (
                  <div 
                    className={`screenshot-item ${selectedScreenshot === 'thumbnail' ? 'selected' : ''}`}
                  >
                    <div onClick={() => {
                      setSelectedScreenshot('thumbnail');
                      if (creatorMode) setSelectedScreenshotForFavorite('thumbnail');
                    }} style={{ cursor: 'pointer' }}>
                      <img 
                        src={thumbnailUrl} 
                        alt="Thumbnail" 
                        className="screenshot-image"
                      />
                      <div className="screenshot-label">Thumbnail</div>
                    </div>
                    {/* Only show individual save buttons when NOT in creator mode */}
                    {isCreator && !creatorMode && (
                      <button
                        className="save-to-favorites-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveToFavorites(thumbnailUrl, 'Thumbnail');
                        }}
                        disabled={savingFavorite}
                        title="Save to Favorites"
                      >
                        {savingFavorite ? 'Saving...' : '⭐ Save to Favorites'}
                      </button>
                    )}
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
                      >
                        <div onClick={() => {
                          setSelectedScreenshot(originalIndex);
                          if (creatorMode) setSelectedScreenshotForFavorite(originalIndex);
                        }} style={{ cursor: 'pointer' }}>
                          <img 
                            src={screenshot} 
                            alt={`Screenshot ${index + 1}`} 
                            className="screenshot-image"
                          />
                          <div className="screenshot-label">Screenshot {index + 1}</div>
                        </div>
                        {/* Only show individual save buttons when NOT in creator mode */}
                        {isCreator && !creatorMode && (
                          <button
                            className="save-to-favorites-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveToFavorites(screenshot, `Screenshot ${index + 1}`);
                            }}
                            disabled={savingFavorite}
                            title="Save to Favorites"
                          >
                            {savingFavorite ? 'Saving...' : '⭐ Save to Favorites'}
                          </button>
                        )}
                      </div>
                    );
                  }) : null;
                })()}
              </div>
            </div>
          </div>

          {/* Save Favorite Button - Only in creator mode */}
          {creatorMode && (
            <div className="tools-button-container">
              <button 
                className="to-favorite-btn"
                onClick={handleToFavorite}
                disabled={savingFavorite || !selectedScreenshotForFavorite}
              >
                {savingFavorite ? 'Saving...' : '⭐ Save Favorite'}
              </button>
            </div>
          )}

          {/* Tools Page Button - Underneath screenshots, above cart/checkout - Hidden in creator mode */}
          {!creatorMode && (
            <div className="tools-button-container">
              <button 
                className="tools-page-btn"
                onClick={() => {
                  // Save the selected screenshot URL before navigating to tools
                  const selectedScreenshotUrl = getSelectedScreenshotUrl();
                  if (selectedScreenshotUrl) {
                    try {
                      const raw = localStorage.getItem('pending_merch_data');
                      const data = raw ? JSON.parse(raw) : {};
                      data.selected_screenshot = selectedScreenshotUrl;
                      localStorage.setItem('pending_merch_data', JSON.stringify(data));
                    } catch (e) {
                      console.warn('Could not save selected screenshot:', e);
                    }
                  }
                  navigate('/tools');
                }}
              >
                🛠️ Tools Page
              </button>
            </div>
          )}

          {/* Product Selection - Hidden in creator mode */}
          {!creatorMode && (
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
                <div key={product?.name ? `${product.name}-${index}` : index} className="product-card">
                  {/* Product Image - always show; stable URL so images load despite re-renders */}
                  {(() => {
                    const isApparelCategory = category === 'womens' || category === 'mens' || category === 'kids';
                    const imgUrl = getProductImageUrl(product, true);
                    const safeUrl = (imgUrl && typeof imgUrl === 'string') ? imgUrl : `${getImgBase()}/placeholder.png`;
                    return (
                      <div className="product-image">
                        <div className="product-image-wrapper">
                          <img
                            className={isApparelCategory ? "product-image-clear" : "product-image-normal"}
                            src={safeUrl + (safeUrl.includes('?') ? '&' : '?') + getStableImageQuery(productData)}
                            alt={product.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const fallback = getProductImageUrl(product, false);
                              if (fallback && e.currentTarget.src !== fallback) {
                                const q = getStableImageQuery(productData);
                                e.currentTarget.src = fallback + (fallback.includes('?') ? '&' : '?') + q;
                              } else {
                                e.currentTarget.src = `${getImgBase()}/placeholder.png`;
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  <h3>
                    {product.name}
                    {product.name && product.name.includes('Jigsaw Puzzle with Tin') && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666', display: 'block', marginTop: '4px' }}>
                        (Ages 4+ only)
                      </span>
                    )}
                  </h3>
                  {/* Reserved: product price from API - do not edit price or color variables */}
                  <p className="product-price">${calculatePrice(product, index).toFixed(2)}</p>
                  
                  <div className="product-options">
                    {/* Color Options - reserved: use product.options.color / selectedColors only */}
                    {product.options && product.options.color && product.options.color.length > 0 && (
                      <div className="option-group">
                        <label>Color:</label>
                        <select 
                          className="color-select"
                          value={selectedColors[index] || product.options?.color?.[0] || ''}
                          onChange={(e) => {
                            const newSelectedColors = { ...selectedColors };
                            const newColor = e.target.value;
                            newSelectedColors[index] = newColor;
                            setSelectedColors(newSelectedColors);
                            
                            // Check if current size is available for new color, if not reset to first available
                            const availableSizes = getAvailableSizes(product, newColor);
                            const currentSize = selectedSizes[index] || product.options?.size?.[0];
                            if (availableSizes.length > 0 && !availableSizes.includes(currentSize)) {
                              const newSelectedSizes = { ...selectedSizes };
                              newSelectedSizes[index] = availableSizes[0];
                              setSelectedSizes(newSelectedSizes);
                            }
                          }}
                        >
                          {(product.options?.color || []).map((color, colorIndex) => (
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
                    {product.options && product.options.size && product.options.size.length > 0 && (() => {
                      // Bags "All Over Print Tote Pocket" has handle_color but no color - use optional chaining
                      const selectedColor = selectedColors[index] || product.options?.color?.[0] || product.options?.handle_color?.[0];
                      const availableSizes = getAvailableSizes(product, selectedColor);
                      const currentSize = selectedSizes[index];
                      
                      // Determine the size to display - use current if available, otherwise first available
                      let displaySize;
                      if (currentSize && availableSizes.includes(currentSize)) {
                        displaySize = currentSize;
                      } else if (availableSizes.length > 0) {
                        displaySize = availableSizes[0];
                      } else {
                        displaySize = product.options?.size?.[0];
                      }
                      
                      return (
                        <div className="option-group">
                          <label>Size:</label>
                          <select 
                            className="size-select"
                            value={displaySize}
                            onChange={(e) => {
                              const newSelectedSizes = { ...selectedSizes };
                              newSelectedSizes[index] = e.target.value;
                              setSelectedSizes(newSelectedSizes);
                            }}
                          >
                            {availableSizes.map((size, sizeIndex) => (
                              <option key={sizeIndex} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
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
          )}
        </>
      )}
      
      {/* Simple Cart Modal - Always available, hidden in creator mode */}
      {!creatorMode && isCartOpen && (
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
                    <div className="cart-item-image-wrapper">
                      {ci.image && <img src={ci.image.includes('?') ? `${ci.image}&v=${getCacheBuster()}` : `${ci.image}?v=${getCacheBuster()}`} alt={ci.name} />}
                      <div className="cart-item-meta">{ci.color} • {ci.size}</div>
                    </div>
                    <div className="cart-item-info">
                      <div className="cart-item-name">{ci.name}</div>
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
                  <button className="edit-tools-btn" onClick={() => navigate('/tools')}>Edit Tools</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Added to Cart Modal with Tools Reminder - Always available, hidden in creator mode */}
      {!creatorMode && showAddedToCartModal && (
        <div className="added-to-cart-modal-overlay" onClick={() => setShowAddedToCartModal(false)}>
          <div className="added-to-cart-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="added-to-cart-modal-close" 
              onClick={() => setShowAddedToCartModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            
            <div className="added-to-cart-modal-content">
              <div className="added-to-cart-success-icon">✓</div>
              <h2 className="added-to-cart-title">Added to Cart!</h2>
              <p className="added-to-cart-message">Your item has been added successfully.</p>
              
              <div className="tools-reminder-section">
                <h3 className="tools-reminder-title">✨ Enhance Your Design with Our Tools</h3>
                <p className="tools-reminder-subtitle">Customize your screenshot before checkout:</p>
                
                <div className="tools-list">
                  <div className="tool-item">
                    <div className="tool-icon">🪶</div>
                    <div className="tool-info">
                      <h4 className="tool-name">Feather Edge</h4>
                      <p className="tool-description">Softens the edges of your screenshot</p>
                    </div>
                  </div>
                  
                  <div className="tool-item">
                    <div className="tool-icon">⭕</div>
                    <div className="tool-info">
                      <h4 className="tool-name">Corner Radius</h4>
                      <p className="tool-description">Round corners (max = perfect circle)</p>
                    </div>
                  </div>
                  
                  <div className="tool-item">
                    <div className="tool-icon">🖼️</div>
                    <div className="tool-info">
                      <h4 className="tool-name">Framed Border</h4>
                      <p className="tool-description">Add a colored frame around your screenshot</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="added-to-cart-modal-actions">
                <button 
                  className="checkout-btn-modal"
                  onClick={() => {
                    setShowAddedToCartModal(false);
                    navigate('/checkout');
                  }}
                >
                  Checkout
                </button>
                <button 
                  className="go-to-tools-btn"
                  onClick={() => {
                    setShowAddedToCartModal(false);
                    navigate('/tools');
                  }}
                >
                  Go to Tools Page
                </button>
                <button 
                  className="continue-shopping-btn"
                  onClick={() => setShowAddedToCartModal(false)}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
