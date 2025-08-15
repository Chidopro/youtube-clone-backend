import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';

const MerchandiseCategories = () => {
  console.log('🔍 MerchandiseCategories component loading...');
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
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
    console.log('🔍 useEffect running...');
    const storedScreenshots = localStorage.getItem('merch_screenshots');
    const storedThumbnail = localStorage.getItem('merch_thumbnail');
    const storedVideoData = localStorage.getItem('merch_video_data');

    console.log('🔍 Stored data:', { storedScreenshots, storedThumbnail, storedVideoData });

    if (storedScreenshots) {
      const parsed = JSON.parse(storedScreenshots);
      setScreenshots(parsed);
      console.log('🔍 Set screenshots:', parsed);
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

  // Error boundary fallback
  if (!categories || categories.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
        <h1>Loading Categories...</h1>
        <p>If this persists, please go back and try again.</p>
        <button onClick={() => window.history.back()}>← Back to Video</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>🛍️ Choose Your Product Category</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>Select a category to start creating your custom merchandise</p>
      
      {screenshots.length > 0 && (
        <div style={{ background: 'white', borderRadius: '10px', padding: '20px', marginBottom: '30px' }}>
          <h3>📸 Your Selected Screenshots ({screenshots.length})</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
            {screenshots.slice(0, 3).map((screenshot, idx) => (
              <img 
                key={idx} 
                src={screenshot} 
                alt={`Screenshot ${idx + 1}`} 
                style={{ width: '80px', height: '60px', borderRadius: '5px', objectFit: 'cover' }}
              />
            ))}
            {screenshots.length > 3 && (
              <span style={{ 
                background: '#666', 
                color: 'white', 
                padding: '20px 15px', 
                borderRadius: '5px',
                display: 'flex',
                alignItems: 'center'
              }}>
                +{screenshots.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '20px', 
        maxWidth: '1000px', 
        margin: '0 auto' 
      }}>
        {categories.map((category) => (
          <div 
            key={category.id}
            onClick={() => handleCreateMerch(category.id)}
            style={{
              background: 'white',
              borderRadius: '15px',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
              border: `3px solid ${category.color}`
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{category.emoji}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
              {category.name}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
              Create custom {category.name.toLowerCase()} with your screenshots
            </div>
            <button style={{
              background: category.color,
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}>
              Start Creating →
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '40px' }}>
        <button 
          onClick={() => window.history.back()}
          style={{
            background: '#666',
            color: 'white',
            border: 'none',
            padding: '12px 25px',
            borderRadius: '20px',
            cursor: 'pointer'
          }}
        >
          ← Back to Video
        </button>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => createMerchProduct(selectedCategory)}
        />
      )}
    </div>
  );
};

export default MerchandiseCategories;
