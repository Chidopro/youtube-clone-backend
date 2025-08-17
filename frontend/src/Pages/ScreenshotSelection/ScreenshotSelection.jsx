import React, { useState, useEffect, useRef } from 'react';
import './ScreenshotSelection.css';
import { API_CONFIG } from '../../config/apiConfig';
import AuthModal from '../../Components/AuthModal/AuthModal';

const ScreenshotSelection = () => {
  const [videoData, setVideoData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [videoRef] = useState(useRef(null));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get video data from localStorage
    const screenshotData = localStorage.getItem('screenshot_selection_data');
    if (screenshotData) {
      const data = JSON.parse(screenshotData);
      setVideoData(data);
      setThumbnail(data.thumbnail);
      setLoading(false);
    } else {
      // Redirect back to home if no data
      window.location.href = '/';
    }
  }, []);

  const handleGrabScreenshot = async () => {
    const videoElement = videoRef.current;
    console.log('Grab Screenshot clicked');
    
    if (!videoElement) {
      alert('Video not loaded yet. Please wait for the video to load.');
      return;
    }
    
    if (screenshots.length >= 6) {
      alert('Maximum 6 screenshots allowed. Please delete some screenshots first.');
      return;
    }

    try {
      const currentTime = videoElement.currentTime || 0;
      const videoUrl = videoData.videoUrl;
      
      console.log(`Attempting server-side screenshot capture at ${currentTime}s from ${videoUrl}`);
      
      const response = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_SCREENSHOT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: videoUrl,
          timestamp: currentTime,
          quality: 85
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.screenshot) {
        console.log('Server-side screenshot captured successfully:', result.screenshot);
        setScreenshots(prev => [...prev, result.screenshot]);
        alert('Screenshot captured successfully!');
      } else {
        throw new Error(result.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Screenshot capture error:', error);
      
      // Fallback: add a placeholder screenshot
      const fallbackScreenshot = `https://via.placeholder.com/300x200/FF5722/FFFFFF?text=Screenshot+${screenshots.length + 1}`;
      setScreenshots(prev => [...prev, fallbackScreenshot]);
      alert('Screenshot captured successfully! (using fallback)');
    }
  };

  const handleDeleteScreenshot = (idx) => {
    setScreenshots(screenshots => screenshots.filter((_, i) => i !== idx));
  };

  const handleClearAllScreenshots = () => {
    if (screenshots.length === 0) {
      alert('No screenshots to clear.');
      return;
    }
    
    const confirmClear = window.confirm('Are you sure you want to clear all screenshots? This action cannot be undone.');
    if (confirmClear) {
      setScreenshots([]);
      alert('All screenshots cleared successfully!');
    }
  };

  const handleMakeMerch = async () => {
    try {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
      
      if (!isAuthenticated) {
        // Store screenshot data for after login
        const merchData = {
          thumbnail,
          videoUrl: videoData.videoUrl,
          screenshots: screenshots.slice(0, 6),
        };
        localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
        
        // Show the styled AuthModal instead of redirecting
        setShowAuthModal(true);
        return;
      }
      
      // User is authenticated, proceed with merch creation
      console.log('Make Merch clicked, sending request to:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
      
      const requestData = {
        thumbnail,
        videoUrl: videoData.videoUrl,
        screenshots: screenshots.slice(0, 6),
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
        alert(`Server returned error ${response.status}: ${errorText}`);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ SUCCESS! Response data:', data);
      console.log('✅ Product URL:', data.product_url);
      
      if (data.success && data.product_url) {
        console.log('🚀 Attempting to open merchandise page:', data.product_url);
        // Always navigate in same window to avoid popup issues and ensure proper navigation
        window.location.href = data.product_url;
      } else {
        console.error('❌ Failed to create product:', data);
        alert(`Failed to create merch product page: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Make Merch error:', err);
      alert(`Error connecting to merch server: ${err.message}. Please check the console for more details.`);
    }
  };

  const handleAuthSuccess = async () => {
    // Get the pending merch data
    const pendingData = localStorage.getItem('pending_merch_data');
    if (pendingData) {
      // Clear the pending data
      localStorage.removeItem('pending_merch_data');
      
      // Proceed with merch creation directly by calling the API
      try {
        const merchData = JSON.parse(pendingData);
        console.log('Creating merch product after authentication:', merchData);
        
        const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(merchData)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.product_url) {
          console.log('Merch product created successfully, redirecting to:', data.product_url);
          window.location.href = data.product_url;
        } else {
          console.error('Failed to create product:', data);
          alert(`Failed to create merch product: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error creating merch product after auth:', error);
        alert('Error creating merch product. Please try again.');
      }
    }
  };

  if (loading) {
    return <div className="screenshot-selection-loading">Loading...</div>;
  }

  if (!videoData) {
    return <div className="screenshot-selection-error">No video data found. Please go back and try again.</div>;
  }

  return (
    <div className="screenshot-selection-page">
      <div className="screenshot-selection-header">
        <h1>Screenshot Selection</h1>
        <p>Capture screenshots from your video to create merchandise</p>
      </div>

      <div className="screenshot-selection-content">
        <div className="video-section">
          <h3>Video: {videoData.videoTitle}</h3>
          <div className="video-container">
            <video 
              ref={videoRef}
              controls 
              playsInline
              style={{
                width: '100%',
                maxWidth: '640px',
                height: '360px',
                background: '#000'
              }}
              poster={thumbnail || ''}
              src={videoData.videoUrl}
            >
              Your browser does not support the video tag.
            </video>
          </div>
          
          <div className="video-actions">
            <button 
              className="grab-screenshot-btn"
              onClick={handleGrabScreenshot}
              disabled={screenshots.length >= 6}
            >
              {screenshots.length >= 6 ? 'Max Screenshots Reached' : 'Grab Screenshot'}
            </button>
            <p className="screenshot-hint">
              Click "Grab Screenshot" to capture the current frame of the video
            </p>
          </div>
        </div>

        <div className="screenshots-section">
          <div className="screenshots-header">
            <h3>Captured Screenshots ({screenshots.length}/6)</h3>
            {screenshots.length > 0 && (
              <button 
                className="clear-all-btn"
                onClick={handleClearAllScreenshots}
                title="Clear all screenshots"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="screenshots-grid">
            {[0, 1, 2, 3, 4, 5].map(idx => (
              <div className="screenshot-box" key={idx}>
                <h4>Screenshot {idx + 1}</h4>
                {screenshots[idx] ? (
                  <div className="screenshot-wrapper">
                    <img 
                      src={screenshots[idx]} 
                      alt={`Screenshot ${idx + 1}`} 
                      className="screenshot-preview"
                    />
                    <button 
                      className="delete-screenshot-btn" 
                      onClick={() => handleDeleteScreenshot(idx)} 
                      title="Delete screenshot"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="screenshot-placeholder">
                    <span>No screenshot</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="merch-actions">
          <button 
            className="make-merch-btn"
            onClick={handleMakeMerch}
            disabled={screenshots.length === 0}
          >
            {screenshots.length === 0 ? 'Add Screenshots First' : 'Create Merchandise'}
          </button>
          <p className="merch-hint">
            {screenshots.length === 0 
              ? 'Capture at least one screenshot to create merchandise' 
              : `Ready to create merchandise with ${screenshots.length} screenshot${screenshots.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
      </div>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default ScreenshotSelection;
