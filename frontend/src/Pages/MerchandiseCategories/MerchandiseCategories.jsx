import React from 'react';

const MerchandiseCategories = () => {
  console.log('🔍 MerchandiseCategories component loading...');
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 Component rendered at:', new Date().toLocaleTimeString());

  return (
    <div style={{ 
      padding: '50px', 
      background: 'red', 
      color: 'white', 
      fontSize: '24px',
      minHeight: '100vh',
      textAlign: 'center'
    }}>
      <h1>MERCHANDISE CATEGORIES TEST</h1>
      <p>If you can see this, the component is working!</p>
      <p>Current URL: {window.location.href}</p>
      <button onClick={() => window.history.back()}>← Back to Video</button>
    </div>
  );
};

export default MerchandiseCategories;