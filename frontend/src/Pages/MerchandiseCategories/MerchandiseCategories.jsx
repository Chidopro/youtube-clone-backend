import React, { useState } from 'react';
import './MerchandiseCategories.css';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';

const MerchandiseCategories = () => {
  console.log('🔍 MerchandiseCategories component loading...');
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 Component rendered at:', new Date().toLocaleTimeString());
  
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

  console.log('📸 Screenshots:', screenshots.length);
  console.log('🎬 Video data:', videoData);

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
      
      const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success && data.product_url) {
        // Check if we're on mobile and handle accordingly
        if (window.innerWidth <= 768) {
          window.location.href = data.product_url;
        } else {
          window.open(data.product_url, '_blank');
        }
      } else {
        console.error('Failed to create product:', data);
        alert(`Failed to create merch product page: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Make Merch error:', err);
      alert(`Error connecting to merch server: ${err.message}. Please check the console for more details.`);
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

  // Add error handling for rendering
  try {
    console.log('🔍 About to render component...');
    
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
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(147, 51, 234, 0.8)',
                  backdropFilter: 'blur(5px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1.1rem',
                  borderRadius: '20px'
                }}>Creating...</div>
              )}
            </div>
          ))}
        </div>
        

        
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '12px 24px',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            onClick={() => window.history.back()}
          >
            ← Back to Video
          </button>
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
    );
  } catch (error) {
    console.error('🚨 Error rendering MerchandiseCategories:', error);
    return (
      <div style={{ 
        padding: '50px', 
        background: 'red', 
        color: 'white', 
        fontSize: '24px',
        minHeight: '100vh',
        textAlign: 'center'
      }}>
        <h1>ERROR CAUGHT!</h1>
        <p>Component failed to render: {error.message}</p>
        <button onClick={() => window.history.back()}>← Back to Video</button>
      </div>
    );
  }
};

export default MerchandiseCategories;