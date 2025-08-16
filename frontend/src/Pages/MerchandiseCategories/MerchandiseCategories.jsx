import React, { useState } from 'react';
import './MerchandiseCategories.css';
import { API_CONFIG } from '../../config/apiConfig';

const MerchandiseCategories = () => {
  console.log('🔍 MerchandiseCategories component loading...');
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 Component rendered at:', new Date().toLocaleTimeString());
  

  
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

  const handleCategoryClick = (category) => {
    console.log('🎯 Category clicked:', category);
    
    // Navigate to a product browsing page for this category
    // For now, redirect to the main site with a category filter
    const categoryParam = category.toLowerCase();
    window.location.href = `/?category=${categoryParam}`;
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
              className="category-box"
              onClick={() => handleCategoryClick(cat.category)}
            >
              <div className="category-emoji">{cat.emoji}</div>
              <div className="category-name">{cat.name}</div>

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