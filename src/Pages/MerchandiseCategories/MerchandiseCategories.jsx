import React, { useState } from 'react';
import './MerchandiseCategories.css';
import '../Home/Home.css';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';

const MerchandiseCategories = ({ sidebar }) => {
  console.log('🎯 MerchandiseCategories component rendering - sidebar prop:', sidebar);
  const [isCreating, setIsCreating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Get data from localStorage with validation
  const pendingMerchData = (() => {
    try {
      const data = localStorage.getItem('pending_merch_data');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Invalid merch data in localStorage, clearing...');
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
  
  console.log('📸 Loaded from localStorage - Screenshots count:', screenshots.length);
  console.log('📸 Thumbnail present:', !!thumbnail);

  // Categories updated - Stickers removed, All Products added
  const categories = [
    { name: "Women's", emoji: "👩", category: "womens" },
    { name: "Men's", emoji: "👨", category: "mens" },
    { name: "Kids", emoji: "👶", category: "kids" },
    { name: "Mugs", emoji: "☕", category: "mugs" },
    { name: "Hats", emoji: "🧢", category: "hats" },
    { name: "Bags", emoji: "👜", category: "bags" },
    { name: "Pets", emoji: "🐕", category: "pets" },
    { name: "All Products", emoji: "🛍️", category: "all-products" },
    { name: "Miscellaneous", emoji: "📦", category: "misc" },
    { name: "Thumbnails", emoji: "🖼️", category: "thumbnails" }
  ];

  const handleCategoryClick = async (category) => {
    console.log('🎯 Category selected:', category);
    
    // Check authentication first
    const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
    
    if (!isAuthenticated) {
      // Store the selected category and show auth modal
      setSelectedCategory(category);
      setShowAuthModal(true);
      return;
    }
    
    // User is authenticated, proceed with product creation
    await createProduct(category);
  };

  const createProduct = async (category) => {
    setIsCreating(true);
    
    try {
      // Get authentication state from localStorage
      const isAuthenticated = localStorage.getItem('user_authenticated');
      const userEmail = localStorage.getItem('user_email');
      
      // Get video information
      const videoUrl = document.referrer || window.location.origin;
      const videoTitle = videoData?.title || 'Unknown Video';
      const creatorName = videoData?.channelTitle || 'Unknown Creator';
      
      console.log('🔍 Creating product with category:', category);
      console.log('🔍 Video data:', { videoTitle, creatorName, videoUrl });
      
      const requestData = {
        thumbnail,
        videoUrl: videoUrl,
        videoTitle: videoTitle,
        creatorName: creatorName,
        screenshots: screenshots.slice(0, 6),
        isAuthenticated: isAuthenticated === 'true',
        userEmail: userEmail || '',
        category: category // Add the selected category
      };
      
      console.log('Request data:', requestData);
      
      console.log('🔍 Making API call to:', `${API_CONFIG.BASE_URL}/api/create-product`);
      console.log('🔍 Request data:', requestData);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/create-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response ok:', response.ok);
      console.log('🔍 Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, text: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Product creation result:', result);

      if (result.success) {
        // Redirect to the product page
        window.location.href = result.product_url;
      } else {
        console.error('❌ Product creation failed:', result.error);
        alert('Failed to create product. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error creating product:', error);
      alert('Error creating product. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle successful authentication
  const handleAuthSuccess = async () => {
    if (selectedCategory) {
      // User authenticated, proceed with creating product for selected category
      await createProduct(selectedCategory);
      setSelectedCategory(null);
    }
  };

  return (
    <>
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

        <div className="merchandise-categories">
        <div className="categories-container">
          <h1 className="categories-title">Choose a Product Category</h1>
          <p className="categories-subtitle">Select a category to browse products for your custom merchandise</p>
      
        <div className="categories-grid">
          {categories.map((cat, index) => (
            <div
              key={index}
              className={`category-box ${isCreating ? 'disabled' : ''}`}
              onClick={(e) => {
                console.log('🖱️ Category clicked:', cat.name, cat.category);
                console.log('🖱️ Event:', e);
                console.log('🖱️ isCreating:', isCreating);
                if (!isCreating) {
                  console.log('🖱️ Calling handleCategoryClick');
                  handleCategoryClick(cat.category);
                } else {
                  console.log('🖱️ Click ignored - isCreating is true');
                }
              }}
              onMouseDown={() => console.log('🖱️ MOUSE DOWN on:', cat.name)}
              onMouseUp={() => console.log('🖱️ MOUSE UP on:', cat.name)}
              style={{ cursor: 'pointer' }}
            >
              <div className="category-emoji">{cat.emoji}</div>
              <div className="category-name">{cat.name}</div>
              {isCreating && (
                <div className="loading-overlay">
                  Creating...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

        {/* Authentication Modal */}
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
    </>
  );
};

export default MerchandiseCategories;