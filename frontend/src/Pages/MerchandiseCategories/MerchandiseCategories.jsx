// frontend/src/Pages/Products/MerchandiseCategories.jsx
import React, { useState } from 'react';
import './MerchandiseCategories.css';
import '../Home/Home.css';
import AuthModal from '../../Components/AuthModal/AuthModal';
import { useCreator } from '../../contexts/CreatorContext';

const MerchandiseCategories = ({ sidebar }) => {
  const { creatorSettings } = useCreator();
  // Enable debug logs via ?debug=1
  if (new URLSearchParams(location.search).has('debug')) {
    window.__DEBUG__ = true;
  }

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

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

  if (window.__DEBUG__) {
    console.log('🎯 MerchandiseCategories render - sidebar:', !!sidebar);
    console.log('📸 screenshots:', screenshots.length, 'thumbnail?', !!thumbnail);
  }

  // Category definitions - All Products added
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

  const navigateToCategory = (category) => {
    const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    const userEmail = localStorage.getItem('user_email') || '';

    // Save a copy as a fallback for mobile
    localStorage.setItem('last_selected_category', category);

    const productUrl = `/product/browse?category=${encodeURIComponent(category)}&authenticated=${isAuthenticated}&email=${encodeURIComponent(userEmail)}`;
    if (window.__DEBUG__) console.log('🛍️ Navigating to product page:', productUrl);

    // Use window.location for reliable navigation on mobile
    window.location.href = window.location.origin + productUrl;
  };

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

    navigateToCategory(category);
  };

  const handleAuthSuccess = () => {
    if (window.__DEBUG__) console.log('🔓 Auth success');
    // Same path as an already-logged-in shopper — do not call legacy create-product
    // (that endpoint is unused by the browse flow and was causing a false error alert).
    if (selectedCategory) {
      const category = selectedCategory;
      setSelectedCategory(null);
      setShowAuthModal(false);
      navigateToCategory(category);
    }
  };

  return (
    <div className={`container merchandise-categories ${sidebar ? "" : " large-container"}`}>
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
                className="category-box"
                aria-label={`Open ${cat.name}`}
                onClick={() => handleCategoryClick(cat.category)}
                onTouchStart={() =>
                  window.__DEBUG__ && console.log('👆 touchstart:', cat.category)
                }
              >
                <div className="category-emoji" aria-hidden="true">{cat.emoji}</div>
                <div className="category-name">{cat.name}</div>
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
