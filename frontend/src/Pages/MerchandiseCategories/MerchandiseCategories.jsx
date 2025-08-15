import React, { useState } from 'react';
import './MerchandiseCategories.css';
import { API_CONFIG } from '../../config/apiConfig';

const MerchandiseCategories = () => {
  console.log('🔍 MerchandiseCategories component loading...');
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 Component rendered at:', new Date().toLocaleTimeString());
  
  const [isCreating, setIsCreating] = useState(false);
  
  // Get data from localStorage
  const screenshots = JSON.parse(localStorage.getItem('merch_screenshots') || '[]');
  const thumbnail = localStorage.getItem('merch_thumbnail');
  const videoData = JSON.parse(localStorage.getItem('merch_video_data') || '{}');

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

  // Add error handling for rendering
  try {
    console.log('🔍 About to render component...');
    
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '3rem',
            fontWeight: '700',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
            marginBottom: '1rem'
          }}>Choose Your Product Category</h1>
          <p style={{
            fontSize: '1.2rem',
            color: 'rgba(255, 255, 255, 0.9)',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
            marginBottom: '3rem'
          }}>Select a category to see available products</p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          {categories.map((cat, index) => (
            <div 
              key={index}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                padding: '2.5rem 1.5rem',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.5 : 1,
                minHeight: '160px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative'
              }}
              onClick={() => !isCreating && handleCategoryClick(cat.category)}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{cat.emoji}</div>
              <div style={{ 
                fontSize: '1.3rem',
                fontWeight: '600',
                color: 'white',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
              }}>{cat.name}</div>
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
        
        {isCreating && (
          <div style={{
            textAlign: 'center',
            color: 'white',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '15px',
            padding: '1.5rem',
            margin: '2rem 0'
          }}>
            <p style={{ margin: '0.5rem 0', fontSize: '1.2rem', fontWeight: '600' }}>🎨 Creating your custom merchandise page...</p>
            <p style={{ margin: '0.5rem 0' }}>This may take a few moments.</p>
          </div>
        )}
        
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