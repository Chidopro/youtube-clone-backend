// frontend/src/Pages/Products/MerchandiseCategories.jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MerchandiseCategories.css';
import '../Home/Home.css';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';
import { useCreator } from '../../contexts/CreatorContext';

const MerchandiseCategories = ({ sidebar }) => {
  const { creatorSettings } = useCreator();
  // Enable debug logs via ?debug=1
  if (new URLSearchParams(location.search).has('debug')) {
    window.__DEBUG__ = true;
  }

  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const creatingRef = useRef(false); // prevents double taps

  // Read pending merch data from localStorage (safely)
  const pendingMerchData = (() => {
    try {
      const raw = localStorage.getItem('pending_merch_data');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('Invalid pending_merch_data. Clearing…');
      localStorage.removeItem('pending_merch_data');
      return {};
    }
  })();

  const screenshots = pendingMerchData.screenshots || [];
  const thumbnail = pendingMerchData.thumbnail || '';
  const videoData = {
    title: pendingMerchData.videoTitle || 'Unknown Video',
    channelTitle: pendingMerchData.creatorName || 'Unknown Creator',
    url: pendingMerchData.videoUrl || ''
  };

  if (window.__DEBUG__) {
    console.log('🎯 MerchandiseCategories render - sidebar:', !!sidebar);
    console.log('📸 screenshots:', screenshots.length, 'thumbnail?', !!thumbnail);
    console.log('🔧 API_CONFIG.BASE_URL:', API_CONFIG?.BASE_URL);
  }

  // Category definitions - Stickers removed, All Products added
  const categories = [
    { name: "Women's", emoji: "👩", category: "womens" },
    { name: "Men's", emoji: "👨", category: "mens" },
    { name: "Kids", emoji: "👶", category: "kids" },
    { name: "Mugs", emoji: "☕", category: "mugs" },
    { name: "Hats", emoji: "🧢", category: "hats" },
    { name: "Bags", emoji: "👜", category: "bags" },
    { name: "Pets", emoji: "🐕", category: "pets" },
    { name: "Miscellaneous", emoji: "📦", category: "misc" },
    { name: "Product Info", emoji: "🛍️", category: "all-products" },
    { name: "Image Tools", emoji: "🛠️", category: "thumbnails" }
  ];

  const handleCategoryClick = (category) => {
    if (window.__DEBUG__) console.log('🖱️ Category selected:', category);

    const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const userEmail = localStorage.getItem('user_email') || '';
    
    if (window.__DEBUG__) {
      console.log('🔐 Auth check:', { isAuthenticated, userEmail });
      console.log('📱 User Agent:', navigator.userAgent);
    }
    
    if (!isAuthenticated) {
      if (window.__DEBUG__) console.log('🔒 Not authenticated, showing auth modal');
      setSelectedCategory(category);
      setShowAuthModal(true);
      return;
    }

    // Save a copy as a fallback for mobile
    localStorage.setItem('last_selected_category', category);

    // Navigate directly to a product page with the selected category
    const productUrl = `/product/browse?category=${encodeURIComponent(category)}&authenticated=${isAuthenticated}&email=${encodeURIComponent(userEmail)}`;
    if (window.__DEBUG__) console.log('🛍️ Navigating to product page:', productUrl);

    // Use full URL for mobile reliability
    const fullUrl = window.location.origin + productUrl;
    if (window.__DEBUG__) console.log('🌐 Full URL:', fullUrl);
    
    // Use window.location for reliable navigation on mobile
    window.location.href = fullUrl;
  };

  const createProduct = async (category) => {
    setIsCreating(true);
    creatingRef.current = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s safety

    try {
      const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
      const userEmail = localStorage.getItem('user_email') || '';
      const videoUrl = document.referrer || window.location.origin;
      const videoTitle = videoData?.title || 'Unknown Video';
      const creatorName = videoData?.channelTitle || 'Unknown Creator';

      const payload = {
        thumbnail,
        videoUrl,
        videoTitle,
        creatorName,
        screenshots: screenshots.slice(0, 6),
        isAuthenticated,
        userEmail,
        category
      };

      const endpoint = `${API_CONFIG.BASE_URL}/api/create-product`;
      if (window.__DEBUG__) {
        console.log('🚀 POST', endpoint);
        console.log('📦 payload:', payload);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      if (window.__DEBUG__) console.log('🔍 status:', res.status, 'ok:', res.ok);

      if (!res.ok) {
        const txt = await res.text().catch(() => '(no body)');
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const result = await res.json();
      if (window.__DEBUG__) console.log('✅ result:', result);

      if (result?.success && result?.product_url) {
        // Hard redirect (SPA hydrates on product page)
        window.location.assign(result.product_url);
      } else {
        throw new Error(result?.error || 'Unknown create-product failure');
      }
    } catch (err) {
      console.error('❌ createProduct error:', err);
      alert('Error creating product. Please try again.');
    } finally {
      clearTimeout(timeout);
      setIsCreating(false);
      creatingRef.current = false;
    }
  };

  const handleAuthSuccess = async () => {
    if (window.__DEBUG__) console.log('🔓 Auth success');
    if (selectedCategory) {
      await createProduct(selectedCategory);
      setSelectedCategory(null);
    }
  };

  return (
    <div className={`container ${sidebar ? "" : " large-container"}`}>
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
              <p>Create custom products with your screenshot</p>
            </div>
          </div>
        </div>
      </div>

      <div className="merchandise-categories">
        <div className="categories-container">
          <h1 className="categories-title">Choose a Product Category</h1>
          <p className="categories-subtitle">
            Select a category to browse products for your custom merchandise
          </p>

          <div className="categories-grid">
            {categories.map((cat, i) => (
              <button
                type="button"
                key={cat.category || i}
                className={`category-box ${isCreating ? 'disabled' : ''}`}
                aria-label={`Open ${cat.name}`}
                onClick={() => handleCategoryClick(cat.category)}
                onTouchStart={() =>
                  window.__DEBUG__ && console.log('👆 touchstart:', cat.category)
                }
                disabled={isCreating}
              >
                <div className="category-emoji" aria-hidden="true">{cat.emoji}</div>
                <div className="category-name">{cat.name}</div>
                {isCreating && (
                  <div className="loading-overlay" aria-hidden="true">
                    Creating...
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setSelectedCategory(null);
          }}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </div>
  );
};

export default MerchandiseCategories;
