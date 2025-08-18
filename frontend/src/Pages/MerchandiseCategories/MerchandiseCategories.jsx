import React, { useState } from 'react';
import './MerchandiseCategories.css';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';

const MerchandiseCategories = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Get data from localStorage with validation
  const screenshots = (() => {
    try {
      const data = localStorage.getItem('merch_screenshots');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Invalid screenshots data in localStorage, clearing...');
      localStorage.removeItem('merch_screenshots');
      return [];
    }
  })();
  
  const thumbnail = localStorage.getItem('merch_thumbnail');
  
  const videoData = (() => {
    try {
      const data = localStorage.getItem('merch_video_data');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Invalid video data in localStorage, clearing...');
      localStorage.removeItem('merch_video_data');
      return {};
    }
  })();

  const categories = [
    { name: "Women's", emoji: "👩", category: "womens" },
    { name: "Men's", emoji: "👨", category: "mens" },
    { name: "Kids", emoji: "👶", category: "kids" },
    { name: "Mugs", emoji: "☕", category: "mugs" },
    { name: "Hats", emoji: "🧢", category: "hats" },
    { name: "Bags", emoji: "👜", category: "bags" },
    { name: "Pets", emoji: "🐕", category: "pets" },
    { name: "Stickers & Magnets", emoji: "🌟", category: "stickers" },
    { name: "Miscellaneous", emoji: "📦", category: "misc" }
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
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/create_product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
    <div className="merchandise-categories">
      <div className="categories-container">
        <h1 className="categories-title">Choose Your Product Category</h1>
        <p className="categories-subtitle">Select a category to see available products</p>
      
        <div className="categories-grid">
          {categories.map((cat, index) => (
            <div
              key={index}
              className={`category-box ${isCreating ? 'disabled' : ''}`}
              onClick={() => !isCreating && handleCategoryClick(cat.category)}
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
        
        <div className="back-button-container">
          <button 
            className="back-button"
            onClick={() => window.history.back()}
          >
            ← Back to Video
          </button>
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
  );
};

export default MerchandiseCategories;