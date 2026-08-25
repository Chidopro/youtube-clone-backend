import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ToolsPage from '../ToolsPage/ToolsPage';
import { supabase } from '../../supabaseClient';
import { UserService, claimSessionTokenIfNeeded } from '../../utils/userService';
import { getBackendUrl } from '../../config/apiConfig';
import { favoriteListsJson } from '../../utils/favoriteListsApi';
import { useCreator } from '../../contexts/CreatorContext';
import { resolvePrintfulVariantId } from '../../utils/printfulVariants';
import { setToolsFocusCartIndex, writeCartItems, readPendingMerchData, savePendingMerchData, readCartItems, applySelectedScreenshot } from '../../utils/merchSession';
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

// Cart screenshots still need a unique query when the same URL is reused.
const getCacheBuster = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const categoryBrowseCache = new Map();

const preloadImageUrls = (urls) => {
  (urls || []).forEach((url) => {
    if (!url || typeof url !== 'string') return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  });
};

const ProductPage = ({ sidebar }) => {
  const { productId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { creatorSettings } = useCreator();
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  /** Actual URL/data of the selected screenshot (set on click). Used for add-to-cart so the exact chosen image is sent, not a fallback. */
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState(null);
  const [selectedColors, setSelectedColors] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [variantAvailability, setVariantAvailability] = useState({});
  const availabilityReqSeqByIndex = useRef({});
  const [cartItems, setCartItems] = useState(() => {
    try {
      return readCartItems();
    } catch (e) {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAddedToCartModal, setShowAddedToCartModal] = useState(false);
  const [cartModalMode, setCartModalMode] = useState('add');
  const [fallbackImages, setFallbackImages] = useState({ screenshots: [], thumbnail: '' });
  const [isCreator, setIsCreator] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [selectedScreenshotForFavorite, setSelectedScreenshotForFavorite] = useState(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(null);
  const productCardRefs = useRef([]);
  const editPrefillKeyRef = useRef('');
  const lastTouchedCartIndexRef = useRef(null);

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
  const editCartParam = searchParams.get('editCart');
  const editingCartIndex = Number.parseInt(editCartParam, 10);
  const isEditingCart = Number.isInteger(editingCartIndex) && editingCartIndex >= 0 && editingCartIndex < cartItems.length;
  const editingCartItem = isEditingCart ? cartItems[editingCartIndex] : null;

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
      `&email=${encodeURIComponent(email || '')}` +
      (isEditingCart ? `&editCart=${editingCartIndex}` : '');

    // Persist for mobile reloads
    try { localStorage.setItem('last_selected_category', newCategory); } catch {}
    try {
      const staticProducts = getStaticProductsForCategory(newCategory);
      preloadImageUrls(staticProducts.map((p) => p.preview_image || p.main_image));
    } catch {}

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
        "Hoodie",
        "Men's Tank Top", 
        "Mens Fitted T-Shirt",
        "Men's Fitted Long Sleeve",
        "T-Shirt",
        "Oversized T-Shirt",
        "Men's Long Sleeve Shirt",
        "Champion Hoodie"
      ],
      'womens': [
        "Women's Shirt",
        "Heavyweight T-Shirt",
        "Women's Ribbed Neck",
        "Micro-Rib Tank Top",
        "Racerback Tank",
        "Women's Crop Top",
        "Pullover Hoodie",
        "Cropped Hoodie"
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
        "Pet Bandana Collar"
      ],
      'misc': [
        "Hardcover Bound Notebook", 
        "Apron",
        "Jigsaw Puzzle with Tin",
        "Greeting Card"
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
      "Hoodie": { filename: "tested.png", preview: "testedpreview.png", price: 35.35 },
      "Men's Tank Top": { filename: "random.png", preview: "randompreview.png", price: 26.23 },
      "Mens Fitted T-Shirt": { filename: "mensfittedtshirt.png", preview: "mensfittedtshirtpreview.png", price: 28.58 },
      "Men's Fitted Long Sleeve": { filename: "mensfittedlongsleeve.png", preview: "mensfittedlongsleevepreview.png", price: 31.33 },
      "T-Shirt": { filename: "guidontee.png", preview: "guidonteepreview.png", price: 23.69 },
      "Oversized T-Shirt": { filename: "unisexoversizedtshirt.png", preview: "unisexoversizedtshirtpreview.png", price: 28.49 },
      "Men's Long Sleeve Shirt": { filename: "menslongsleeve.png", preview: "menslongsleevepreview.png", price: 26.79 },
      "Champion Hoodie": { filename: "hoodiechampion.png", preview: "hoodiechampionpreview.png", price: 47.00 },
      "Cropped Hoodie": { filename: "womenscroppedhoodiepreview.png", preview: "womenscroppedhoodiepreview.png", price: 45.15 },
      "Racerback Tank": { filename: "womenstankpreview.png", preview: "womenstankpreview.png", price: 22.95 },
      "Micro-Rib Tank Top": { filename: "womensmicroribtanktoppreview.png", preview: "womensmicroribtanktoppreview.png", price: 27.81 },
      "Women's Ribbed Neck": { filename: "womensribbedneckpreview.png", preview: "womensribbedneckpreview.png", price: 27.60 },
      "Women's Shirt": { filename: "womenshirtpreview.png", preview: "womenshirtpreview.png", price: 25.69 },
      "Heavyweight T-Shirt": { filename: "womenshdshirtpreview.png", preview: "womenshdshirtpreview.png", price: 27.29 },
      "Pullover Hoodie": { filename: "womensunisexpulloverhoodiepreview.png", preview: "womensunisexpulloverhoodiepreview.png", price: 43.06 },
      "Women's Crop Top": { filename: "womenscroptoppreview.png", preview: "womenscroptoppreview.png", price: 30.55 },
      "Youth Heavy Blend Hoodie": { filename: "kidhoodie.png", preview: "kidhoodiepreview.png", price: 31.33 },
      "Kids Shirt": { filename: "kidshirt.png", preview: "kidshirtpreview.png", price: 25.49 },
      "Kids Long Sleeve": { filename: "kidlongsleeve.png", preview: "kidlongsleevepreview.png", price: 28.49 },
      "Toddler Short Sleeve T-Shirt": { filename: "toddlershortsleevet.png", preview: "toddlershortsleevetpreview.png", price: 24.75 },
      "Toddler Jersey T-Shirt": { filename: "toddlerjerseytshirt.png", preview: "toddlerjerseytshirtpreview.png", price: 22.29 },
      "Baby Staple Tee": { filename: "babystapletshirt.png", preview: "babystapletshirtpreview.png", price: 24.19 },
      "Baby Jersey T-Shirt": { filename: "toddlershortsleevet.png", preview: "toddlershortsleevetpreview.png", price: 22.29 },
      "Baby Body Suit": { filename: "youthalloverprintswimsuit.png", preview: "youthalloverprintswimsuitpreview.png", price: 22.90 },
      "Kids Sweatshirt": { filename: "kidssweatshirt.png", preview: "kidssweatshirtpreview.png", price: 29.29 },
      "Youth All Over Print Swimsuit": { filename: "youthalloverprintswimsuit.png", preview: "youthalloverprintswimsuitpreview.png", price: 35.95 },
      "Girls Leggings": { filename: "girlsleggings.png", preview: "girlsleggingspreview.png", price: 30.31 },
      "Laptop Sleeve": { filename: "laptopsleeve.png", preview: "laptopsleevepreview.png", price: 33.16 },
      "All-Over Print Drawstring": { filename: "drawstringbag.png", preview: "drawstringbagpreview.png", price: 27.25 },
      "All-Over Print Utility Bag": { filename: "crossbodybag.png", preview: "crossbodybagpreview.png", price: 33.79 },
      "All Over Print Tote Pocket": { filename: "largecanvasbag.png", preview: "largecanvasbagpreview.png", price: 35.41 },
      "All-Over Print Crossbody Bag": { filename: "crossbodybag.png", preview: "crossbodybagpreview.png", price: 30.95 },
      "Distressed Dad Hat": { filename: "distresseddadhat.png", preview: "distresseddadhatpreview.png", price: 26.95 },
      "Closed Back Cap": { filename: "closedbackcap.png", preview: "hatsclosedbackcappreview.png", price: 24.91 },
      "Five Panel Trucker Hat": { filename: "fivepaneltruckerhat.png", preview: "fivepaneltruckerhatpreview.png", price: 26.95 },
      "Five Panel Baseball Cap": { filename: "youthbaseballcap.png", preview: "youthbaseballcappreview.png", price: 26.95 },
      "White Glossy Mug": { filename: "mug1.png", preview: "mug1preview.png", price: 17.95 },
      "Travel Mug": { filename: "travelmug.png", preview: "travelmugpreview.png", price: 21.95 },
      "Enamel Mug": { filename: "enamalmug.png", preview: "enamalmugpreview.png", price: 20.95 },
      "Colored Mug": { filename: "coloredmug.png", preview: "coloredmugpreview.png", price: 19.95 },
      "Pet Bowl All-Over Print": { filename: "dogbowl.png", preview: "dogbowlpreview.png", price: 33.49 },
      "Pet Bandana Collar": { filename: "scarfcollar.png", preview: "scarfcollarpreview.png", price: 21.95 },
      "Greeting Card": { filename: "greetingcard.png", preview: "greetingcardpreview.png", price: 9.99 },
      "Hardcover Bound Notebook": { filename: "hardcovernotebook.png", preview: "hardcovernotebookpreview.png", price: 23.05 },
      "Apron": { filename: "apron.png", preview: "apronpreview.png", price: 28.90 },
      "Jigsaw Puzzle with Tin": { filename: "jigsawpuzzle.png", preview: "jigsawpuzzlepreview.png", price: 25.40 }
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
      alert('Only creators can save screenshots to Pages.');
      return;
    }

    try {
      setSavingFavorite(true);

      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');

      let user = null;
      let userId = null;

      if (isAuthenticated === 'true' && userData) {
        const googleUser = JSON.parse(userData);
        user = googleUser;
        userId = googleUser.id;
      } else {
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

      await claimSessionTokenIfNeeded(userId);

      let channelTitle = user?.name || user?.email?.split('@')[0] || 'Unknown Creator';
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('display_name, username, channelTitle')
          .eq('id', userId)
          .single();
        channelTitle =
          profile?.channelTitle ||
          profile?.display_name ||
          profile?.username ||
          channelTitle;
      } catch (_) {
        /* profile optional — backend fills channel title if missing */
      }

      const merchData = readPendingMerchData();
      let videoTitle = screenshotLabel || 'Screenshot';
      if (merchData?.videoTitle) {
        videoTitle = `${merchData.videoTitle} - ${screenshotLabel}`;
      }

      let listId = null;
      try {
        listId = localStorage.getItem('sm_favorite_list_id') || null;
      } catch (_) {}

      const { ok, data } = await favoriteListsJson('/api/favorites/save-url', {
        method: 'POST',
        body: JSON.stringify({
          image_url: screenshotUrl,
          title: videoTitle,
          description: 'Saved screenshot from product selection',
          channel_title: channelTitle,
          ...(listId ? { list_id: listId } : {}),
        }),
      });

      if (!ok || !data?.success) {
        alert(data?.error || 'Failed to save favorite');
        return;
      }

      if (data.list_id) {
        try {
          localStorage.setItem('sm_favorite_list_id', data.list_id);
        } catch (_) {}
      }

      alert('Screenshot saved to Pages!');
    } catch (error) {
      console.error('Error saving favorite:', error);
      alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingFavorite(false);
    }
  };

  // Get available sizes for a product and color based on availability data.
  // API product.options.size is the source of truth (never use stale products.js).
  const getAvailableSizes = (product, color) => {
    const apiSizes = product?.options?.size || [];
    if (!product || !color) {
      return apiSizes;
    }

    // Prefer API size_color_availability (size -> colors[]) from catalog
    const sca = product.size_color_availability;
    if (sca && typeof sca === 'object' && Object.keys(sca).length > 0) {
      const sizesFromApi = apiSizes.filter((size) => {
        const colorsForSize = sca[size];
        return Array.isArray(colorsForSize) && colorsForSize.includes(color);
      });
      if (sizesFromApi.length > 0) return sizesFromApi;
    }
    return apiSizes;
  };

  // Colors available for a selected size (size_color_availability from API).
  const getAvailableColors = (product, size) => {
    const apiColors = product?.options?.color || [];
    if (!product || !size) return apiColors;
    const sca = product.size_color_availability;
    if (sca && typeof sca === 'object' && Array.isArray(sca[size]) && sca[size].length > 0) {
      return apiColors.filter((c) => sca[size].includes(c));
    }
    return apiColors;
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
    writeCartItems(items);
    if (!items.length) {
      setSelectedScreenshot(null);
      setSelectedScreenshotUrl(null);
    }
  };

  const checkSelectionAvailability = async (product, index, color, size) => {
    const effectiveColor = (color && String(color).trim())
      ? String(color).trim()
      : (selectedColors[index] || product?.options?.color?.[0] || product?.options?.handle_color?.[0] || '');
    const effectiveSize = (size && String(size).trim())
      ? String(size).trim()
      : (selectedSizes[index] || product?.options?.size?.[0] || 'One Size');
    const variantId = resolvePrintfulVariantId(product, effectiveColor, effectiveSize);
    const nextReqId = (availabilityReqSeqByIndex.current[index] || 0) + 1;
    availabilityReqSeqByIndex.current[index] = nextReqId;
    setVariantAvailability((prev) => ({
      ...prev,
      [index]: { checking: true, available: true, message: '' },
    }));
    try {
      const apiBase = getBackendUrl().replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/check-variant-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product?.name || '',
          color: effectiveColor,
          size: effectiveSize,
          variant_id: variantId,
        }),
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}
      if (availabilityReqSeqByIndex.current[index] !== nextReqId) return true;
      if (res.ok && data?.success && data?.available === false) {
        const msg = data?.error || 'This selection is currently unavailable. Please choose another option.';
        setVariantAvailability((prev) => ({
          ...prev,
          [index]: { checking: false, available: false, message: msg },
        }));
        return false;
      }
      setVariantAvailability((prev) => ({
        ...prev,
        [index]: { checking: false, available: true, message: '' },
      }));
      return true;
    } catch (e) {
      setVariantAvailability((prev) => ({
        ...prev,
        [index]: { checking: false, available: true, message: '' },
      }));
      return true;
    }
  };

  const handleAddToCart = async (product, index) => {
    const chosenColor = selectedColors[index] || (product?.options?.color?.[0] || 'Default');
    const chosenSize = selectedSizes[index] || (product?.options?.size?.[0] || 'One Size');
    const isAvailable = await checkSelectionAvailability(product, index, chosenColor, chosenSize);
    if (!isAvailable) return;
    // Use the URL stored when user clicked a screenshot so we send the exact image they selected (not thumbnail by mistake)
    const screenshotUrl = selectedScreenshotUrl || getSelectedScreenshotUrl()
      || editingCartItem?.selected_screenshot || editingCartItem?.screenshot;

    // Get video metadata from merch session (including screenshot_timestamp for email/order)
    let videoMetadata = {};
    try {
      const merchData = readPendingMerchData();
      if (merchData && typeof merchData === 'object') {
        videoMetadata = {
          video_url: merchData.videoUrl,
          video_title: merchData.videoTitle,
          creator_name: merchData.creatorName,
          thumbnail: merchData.thumbnail,
          screenshot_timestamp: merchData.screenshot_timestamp
        };
      }
    } catch (e) {
      console.warn('Could not load video metadata from merch session:', e);
    }
    const filledVideoMetadata = Object.fromEntries(
      Object.entries(videoMetadata).filter(([, value]) => value != null && value !== '')
    );

    const printful_variant_id = resolvePrintfulVariantId(product, chosenColor, chosenSize);
    const item = {
      ...(isEditingCart && editingCartItem ? editingCartItem : {}),
      name: product?.name || 'Product',
      price: calculatePrice(product, index),
      image: getProductImageUrl(product, true),
      color: chosenColor,
      size: chosenSize,
      screenshot: screenshotUrl || editingCartItem?.screenshot,
      selected_screenshot: screenshotUrl || editingCartItem?.selected_screenshot,
      qty: isEditingCart && editingCartItem?.qty ? editingCartItem.qty : 1,
      category: category || '', // womens, mens, kids = shirts (need portrait/landscape); others skip design modal
      printful_catalog_product_id: product?.printful_catalog_product_id ?? null,
      printful_variant_id: printful_variant_id != null ? printful_variant_id : undefined,
      // Include video metadata in cart item (screenshot_timestamp for email/Print Quality)
      ...filledVideoMetadata
    };
    const next = [...cartItems];
    if (isEditingCart) {
      next[editingCartIndex] = item;
    } else {
      next.push(item);
    }
    persistCart(next);
    const focusIndex = isEditingCart ? editingCartIndex : next.length - 1;
    lastTouchedCartIndexRef.current = focusIndex;
    setToolsFocusCartIndex(focusIndex);
    if (isEditingCart) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('editCart');
      setSearchParams(nextParams, { replace: true });
      setHighlightedProductIndex(null);
    }
    console.log(isEditingCart ? '✅ Cart item updated' : '✅ Item added to cart, showing modal...');
    setCartModalMode(isEditingCart ? 'update' : 'add');
    setShowAddedToCartModal(true);
  };

  const goToToolsPage = () => {
    // Prefer the item being edited or last updated, then the most recently added cart item.
    try {
      if (isEditingCart) {
        setToolsFocusCartIndex(editingCartIndex);
      } else if (lastTouchedCartIndexRef.current != null) {
        setToolsFocusCartIndex(lastTouchedCartIndexRef.current);
      } else {
        const items = readCartItems();
        if (Array.isArray(items) && items.length > 0) {
          setToolsFocusCartIndex(items.length - 1);
        }
      }
      const urlToSave = selectedScreenshotUrl || getSelectedScreenshotUrl();
      if (urlToSave) {
        applySelectedScreenshot(urlToSave);
      }
    } catch (e) {
      console.warn('Could not prepare tools focus:', e);
    }
    navigate('/tools');
  };

  // Check if user is a creator
  useEffect(() => {
    const checkCreatorStatus = async () => {
      const creatorStatus = await UserService.isCreator();
      setIsCreator(creatorStatus);
      
      // If in creator mode, set initial selected screenshot
      if (creatorMode && creatorStatus) {
        // Set thumbnail as default selection (URL will be set when fallbackImages load)
        setSelectedScreenshot('thumbnail');
        setSelectedScreenshotForFavorite('thumbnail');
      }
    };
    checkCreatorStatus();
  }, [creatorMode]);

  // Load fallback screenshots/thumbnail from merch session in case backend data is empty
  useEffect(() => {
    try {
      const d = readPendingMerchData();
      if (d && (d.screenshots?.length || d.thumbnail)) {
        setFallbackImages({
          screenshots: Array.isArray(d?.screenshots) ? d.screenshots.slice(0, 6) : [],
          thumbnail: d?.thumbnail || ''
        });
        
        // In creator mode, if we have video data, set up productData structure
        if (creatorMode && d?.thumbnail) {
          setSelectedScreenshotUrl((prev) => prev ?? d.thumbnail);
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
      console.warn('Invalid pending_merch_data, ignoring');
    }
  }, [productId, creatorMode, category]);

  useEffect(() => {
    const wantedCategory = category;
    const controller = new AbortController();

    if (window.__DEBUG__) {
    console.log('🔄 useEffect triggered with:', { productId, category, authenticated, email });
    }

    const withDisplayUrls = (data) => {
      const base = getBackendUrl().replace(/\/$/, '');
      const imgBase = `${base}/static/images`;
      const productsWithUrls = (data.products || []).map((p) => {
        if (!p) return p;
        const previewUrl = p.preview_image_url || (p.preview_image ? (p.preview_image.startsWith('/') ? base + p.preview_image : (p.preview_image.startsWith('http') ? ensureHttps(p.preview_image) : `${imgBase}/${p.preview_image}`)) : '');
        const mainUrl = p.main_image_url || (p.main_image ? (p.main_image.startsWith('/') ? base + p.main_image : (p.main_image.startsWith('http') ? ensureHttps(p.main_image) : `${imgBase}/${p.main_image}`)) : '');
        return { ...p, _displayImageUrl: previewUrl || mainUrl || `${imgBase}/placeholder.png` };
      });
      return { ...data, products: productsWithUrls };
    };

    const paintProducts = (data) => {
      const next = withDisplayUrls(data);
      setProductData(next);
      preloadImageUrls((next.products || []).map((p) => p._displayImageUrl));
    };

    const cached = categoryBrowseCache.get(wantedCategory);
    if (cached) {
      paintProducts(cached);
      setLoading(false);
      setError(null);
    } else {
      const staticProducts = getStaticProductsForCategory(wantedCategory);
      if (staticProducts.length) {
        setProductData((prev) => withDisplayUrls({
          success: true,
          products: staticProducts,
          category: wantedCategory,
          product: prev?.product || { thumbnail_url: '', screenshots: [] }
        }));
        preloadImageUrls(staticProducts.map((p) => p.preview_image || p.main_image));
        setLoading(false);
      } else if (!productData) {
        setLoading(true);
      }
    }

    const fetchProductData = async () => {
      try {
        setError(null); // Clear any previous errors

        // Handle browse mode - use 'browse' when productId is undefined or 'dynamic'
        const actualProductId = productId || 'browse';
        const isBrowseMode = !productId || productId === 'browse' || productId === 'dynamic';

        const apiBase = getBackendUrl().replace(/\/$/, '');
        const url = isBrowseMode
          ? `${apiBase}/api/product/browse?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}`
          : `${apiBase}/api/product/${actualProductId}?category=${encodeURIComponent(category)}&authenticated=${authenticated}&email=${encodeURIComponent(email || '')}`;

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
            cache: 'default',
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
        categoryBrowseCache.set(wantedCategory, data);
        paintProducts(data);
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

  useEffect(() => {
    if (!isEditingCart || !editingCartItem) return;
    const shot = editingCartItem.selected_screenshot || editingCartItem.screenshot;
    if (shot) setSelectedScreenshotUrl(shot);
  }, [isEditingCart, editingCartIndex]);

  useEffect(() => {
    if (!isEditingCart || !editingCartItem) {
      setHighlightedProductIndex(null);
      return;
    }
    const products = productData?.products;
    if (!Array.isArray(products) || products.length === 0) return;

    const key = `${category}:${editingCartIndex}:${editingCartItem.name || ''}:${editingCartItem.size || ''}:${editingCartItem.color || ''}`;
    if (editPrefillKeyRef.current === key) return;

    let matchIndex = -1;
    const catalogId = editingCartItem.printful_catalog_product_id;
    if (catalogId != null && catalogId !== '') {
      matchIndex = products.findIndex((p) => p && p.printful_catalog_product_id === catalogId);
    }
    if (matchIndex < 0) {
      const name = (editingCartItem.name || editingCartItem.product || '').trim().toLowerCase();
      if (name) {
        matchIndex = products.findIndex((p) => (p?.name || '').trim().toLowerCase() === name);
      }
    }
    if (matchIndex < 0) {
      setHighlightedProductIndex(null);
      return;
    }

    editPrefillKeyRef.current = key;
    setHighlightedProductIndex(matchIndex);
    if (editingCartItem.color) {
      setSelectedColors((prev) => ({ ...prev, [matchIndex]: editingCartItem.color }));
    }
    if (editingCartItem.size) {
      setSelectedSizes((prev) => ({ ...prev, [matchIndex]: editingCartItem.size }));
    }
    const frame = window.requestAnimationFrame(() => {
      productCardRefs.current[matchIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isEditingCart, editingCartIndex, editingCartItem, productData, category]);

  // Only show full-screen loading on initial load (no productData yet). When switching category, keep showing current products so images persist.
  if (loading && !productData) {
    return (
      <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
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
      <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
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
    const shotKey = cartItems
      .map((c) => `${c.name}:${String(c.screenshot || '').length}:${String(c.image || '').slice(-24)}`)
      .join('|');
    return <ToolsPage key={`thumb-tools-${shotKey}`} />;
  }

  return (
    <div className={`container product-page ${sidebar ? "" : " large-container"}`}>
      {/* User Flow Section - Step 3 Only - Hide for All Products; storefronts hide via CSS */}
      {(() => {
        const categoryNormalized = (category || '').trim().toLowerCase();
        return categoryNormalized !== 'all' && categoryNormalized !== 'all-products';
      })() && (
        <div
          className="user-flow-section"
          style={
            creatorSettings?.primary_color && creatorSettings?.secondary_color
              ? { background: `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)` }
              : undefined
          }
        >
          <div className="flow-steps">
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Make Merchandise</h3>
                <p>Create custom products with your selection</p>
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
              'womens': ["Women's Shirt", "Heavyweight T-Shirt", "Women's Ribbed Neck", "Micro-Rib Tank Top", "Racerback Tank", "Women's Crop Top", "Pullover Hoodie", "Cropped Hoodie"],
              'mens': ["Hoodie", "Men's Tank Top", "Mens Fitted T-Shirt", "Men's Fitted Long Sleeve", "T-Shirt", "Oversized T-Shirt", "Men's Long Sleeve Shirt", "Champion Hoodie"],
              'kids': ["Youth Heavy Blend Hoodie", "Kids Shirt", "Kids Long Sleeve", "Toddler Jersey T-Shirt", "Kids Sweatshirt", "Baby Staple Tee", "Baby Jersey T-Shirt", "Baby Body Suit"],
              'mugs': ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"],
              'hats': ["Distressed Dad Hat", "Closed Back Cap", "Five Panel Trucker Hat", "Five Panel Baseball Cap"],
              'bags': ["Laptop Sleeve", "All-Over Print Drawstring", "All Over Print Tote Pocket", "All-Over Print Utility Bag"],
              'pets': ["Pet Bowl All-Over Print", "Pet Bandana Collar"],
              'misc': ["Hardcover Bound Notebook", "Apron", "Jigsaw Puzzle with Tin", "Greeting Card"]
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
            <h2 className="screenshots-title">{creatorMode ? 'Select Screenshot to Add to Pages' : 'Select Your Screenshot'}</h2>
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
                      setSelectedScreenshotUrl(thumbnailUrl);
                      applySelectedScreenshot(thumbnailUrl);
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
                        title="Save to Pages"
                      >
                        {savingFavorite ? 'Saving...' : '⭐ Save to Pages'}
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
                          setSelectedScreenshotUrl(screenshot);
                          applySelectedScreenshot(screenshot);
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
                            title="Save to Pages"
                          >
                            {savingFavorite ? 'Saving...' : '⭐ Save to Pages'}
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
                onClick={goToToolsPage}
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
              <div className="cart-section-buttons">
                <button className="view-cart-btn" onClick={() => setIsCartOpen(true)}>View Cart</button>
                <button className="checkout-btn" onClick={() => navigate('/checkout')}>Checkout</button>
              </div>
              {(category === 'womens' || category === 'mens' || category === 'kids') && (
                <p className="product-mockup-color-notice product-mockup-color-notice-center">
                  Product mockups show representative colors. Your order will be made in the colors you select.
                </p>
              )}
            </div>

            {isEditingCart && editingCartItem && (
              <div className="edit-cart-banner">
                <p className="edit-cart-banner-text">
                  Editing <strong>{editingCartItem.name || editingCartItem.product || 'item'}</strong>
                  {editingCartItem.size ? ` · ${editingCartItem.size}` : ''}
                  {editingCartItem.color ? ` · ${editingCartItem.color}` : ''}.
                  {' '}Change product, size, or color, then Update Cart.
                </p>
                <button
                  type="button"
                  className="edit-cart-banner-cancel"
                  onClick={() => navigate('/checkout')}
                >
                  Back to Checkout
                </button>
              </div>
            )}

            <div className="products-grid">
              {productData.products && productData.products.map((product, index) => (
                <div
                  key={product?.name ? `${product.name}-${index}` : index}
                  className={`product-card${highlightedProductIndex === index ? ' product-card-editing' : ''}`}
                  ref={(el) => { productCardRefs.current[index] = el; }}
                >
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
                            src={safeUrl}
                            alt={product.name}
                            loading={index < 8 ? 'eager' : 'lazy'}
                            fetchPriority={index < 4 ? 'high' : 'auto'}
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const fallback = getProductImageUrl(product, false);
                              if (fallback && e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
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
                    {product.options && product.options.color && product.options.color.length > 0 && (() => {
                      const selectedSize = selectedSizes[index] || product.options?.size?.[0];
                      const availableColors = getAvailableColors(product, selectedSize);
                      const currentColor = selectedColors[index] || product.options?.color?.[0] || '';
                      const displayColor = availableColors.includes(currentColor)
                        ? currentColor
                        : (availableColors[0] || currentColor);
                      return (
                      <div className="option-group">
                        <label>Color:</label>
                        <select 
                          className="color-select"
                          value={displayColor}
                          onChange={async (e) => {
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
                              await checkSelectionAvailability(product, index, newColor, availableSizes[0]);
                            } else {
                              await checkSelectionAvailability(product, index, newColor, currentSize || '');
                            }
                          }}
                        >
                          {availableColors.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                      );
                    })()}
                    
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
                            onChange={async (e) => {
                              const newSelectedSizes = { ...selectedSizes };
                              const nextSize = e.target.value;
                              newSelectedSizes[index] = nextSize;
                              setSelectedSizes(newSelectedSizes);
                              const colorsForSize = getAvailableColors(product, nextSize);
                              let nextColor = selectedColors[index] || product.options?.color?.[0] || product.options?.handle_color?.[0];
                              if (colorsForSize.length > 0 && !colorsForSize.includes(nextColor)) {
                                nextColor = colorsForSize[0];
                                setSelectedColors({ ...selectedColors, [index]: nextColor });
                              }
                              await checkSelectionAvailability(product, index, nextColor, nextSize);
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
                  
                  {variantAvailability[index]?.message && !variantAvailability[index]?.available && (
                    <div className="variant-unavailable-note">{variantAvailability[index].message}</div>
                  )}
                  <button 
                    className="add-to-cart-btn"
                    disabled={variantAvailability[index]?.checking || variantAvailability[index]?.available === false}
                    onClick={() => handleAddToCart(product, index)}
                  >
                    {variantAvailability[index]?.checking ? 'Checking...' : (isEditingCart ? 'Update Cart' : 'Add to Cart')}
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
                <p className="cart-mockup-remark">Product mockup, your item will be made in the color you selected.</p>
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
                        persistCart(updatedItems);
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
                  <button className="edit-tools-btn" onClick={goToToolsPage}>Edit Tools</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Added to Cart Modal - portal to body so navbar/overflow never clip it */}
      {!creatorMode && showAddedToCartModal && createPortal(
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
              <h2 className="added-to-cart-title">{cartModalMode === 'update' ? 'Cart Updated!' : 'Added to Cart!'}</h2>
              <p className="added-to-cart-message">{cartModalMode === 'update' ? 'Your item has been updated successfully.' : 'Your item has been added successfully.'}</p>
              
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
                    goToToolsPage();
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductPage;
