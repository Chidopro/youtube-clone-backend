import React, { useState, useEffect } from 'react';
import './MerchandiseCategories.css';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';

const MerchandiseCategories = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [thumbnail, setThumbnail] = useState('');
  const [videoData, setVideoData] = useState(null);

  // Product categories with emojis
  const categories = [
    { id: 'womens', name: "Women's", emoji: '👕', color: '#e91e63' },
    { id: 'mens', name: "Men's", emoji: '👔', color: '#2196f3' },
    { id: 'kids', name: 'Kids', emoji: '🧒', color: '#ff9800' },
    { id: 'mugs', name: 'Mugs', emoji: '☕', color: '#795548' },
    { id: 'hats', name: 'Hats', emoji: '👒', color: '#9c27b0' },
    { id: 'bags', name: 'Bags', emoji: '🎒', color: '#4caf50' },
    { id: 'pets', name: 'Pets', emoji: '🐕', color: '#ff5722' },
    { id: 'stickers', name: 'Stickers & Magnets', emoji: '🏷️', color: '#00bcd4' },
    { id: 'misc', name: 'Miscellaneous', emoji: '🎯', color: '#607d8b' }
  ];

  // Get data from localStorage that was passed from video page
  useEffect(() => {
    const storedScreenshots = localStorage.getItem('merch_screenshots');
    const storedThumbnail = localStorage.getItem('merch_thumbnail');
    const storedVideoData = localStorage.getItem('merch_video_data');

    if (storedScreenshots) {
      setScreenshots(JSON.parse(storedScreenshots));
    }
    if (storedThumbnail) {
      setThumbnail(storedThumbnail);
    }
    if (storedVideoData) {
      setVideoData(JSON.parse(storedVideoData));
    }
  }, []);

  // Categorize products based on their names and types
  const categorizeProduct = (productName) => {
    const name = productName.toLowerCase();
    
    if (name.includes('women') || name.includes('racerback') || name.includes('micro-rib')) {
      return 'womens';
    }
    if (name.includes('men') || name.includes('unisex') || name.includes('long sleeve')) {
      return 'mens';
    }
    if (name.includes('mug') || name.includes('coffee') || name.includes('cup')) {
      return 'mugs';
    }
    if (name.includes('hat') || name.includes('cap') || name.includes('snapback') || name.includes('trucker')) {
      return 'hats';
    }
    if (name.includes('bag') || name.includes('tote') || name.includes('backpack')) {
      return 'bags';
    }
    if (name.includes('pet') || name.includes('dog') || name.includes('bowl')) {
      return 'pets';
    }
    if (name.includes('sticker') || name.includes('magnet')) {
      return 'stickers';
    }
    if (name.includes('kid') || name.includes('youth') || name.includes('child')) {
      return 'kids';
    }
    
    // Default to miscellaneous
    return 'misc';
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    // Here you would load products for this category
    // For now, we'll just show the selection
  };

  const handleCreateMerch = async (categoryId) => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('user_authenticated');
    
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Proceed with merch creation for specific category
    await createMerchProduct(categoryId);
  };

  const createMerchProduct = async (categoryId) => {
    try {
      const isAuthenticated = localStorage.getItem('user_authenticated');
      const userEmail = localStorage.getItem('user_email');
      const videoUrl = document.referrer || window.location.href;
      
      const requestData = {
        thumbnail,
        videoUrl: videoUrl,
        videoTitle: videoData?.title || 'Unknown Video',
        creatorName: videoData?.channelTitle || 'Unknown Creator',
        screenshots: screenshots.slice(0, 6),
        isAuthenticated: isAuthenticated === 'true',
        userEmail: userEmail || '',
        category: categoryId // Pass the selected category
      };
      
      const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.product_url) {
        if (window.innerWidth <= 768) {
          window.location.href = data.product_url;
        } else {
          window.open(data.product_url, '_blank');
        }
      } else {
        alert(`Failed to create merch product: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Create Merch error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="merchandise-categories-page">
      <div className="merch-header">
        <h1>🛍️ Choose Your Product Category</h1>
        <p>Select a category to start creating your custom merchandise</p>
        
        {screenshots.length > 0 && (
          <div className="selected-screenshots">
            <h3>📸 Your Selected Screenshots ({screenshots.length})</h3>
            <div className="screenshot-preview">
              {screenshots.slice(0, 3).map((screenshot, idx) => (
                <img key={idx} src={screenshot} alt={`Screenshot ${idx + 1}`} className="screenshot-thumb" />
              ))}
              {screenshots.length > 3 && <span className="more-count">+{screenshots.length - 3} more</span>}
            </div>
          </div>
        )}
      </div>

      <div className="categories-grid">
        {categories.map((category) => (
          <div 
            key={category.id}
            className="category-box"
            style={{ '--category-color': category.color }}
            onClick={() => handleCreateMerch(category.id)}
          >
            <div className="category-emoji">{category.emoji}</div>
            <div className="category-name">{category.name}</div>
            <div className="category-description">
              Create custom {category.name.toLowerCase()} with your screenshots
            </div>
            <button className="category-button">
              Start Creating →
            </button>
          </div>
        ))}
      </div>

      <div className="back-to-video">
        <button onClick={() => window.history.back()}>
          ← Back to Video
        </button>
      </div>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => createMerchProduct(selectedCategory)}
      />
    </div>
  );
};

export default MerchandiseCategories;
