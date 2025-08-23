import React, { useEffect, useState, useRef } from "react";
import PlayVideo, { ScreenmerchImages } from "../../Components/PlayVideo/PlayVideo";
import Recommended from "../../Components/Recommended/Recommended";
import AuthModal from "../../Components/AuthModal/AuthModal";
import './Video.css'
import { useParams } from "react-router-dom";
import { API_CONFIG } from '../../config/apiConfig'

const Video = () => {

  const {videoId,categoryId} = useParams();
  // State for thumbnail/screenshots
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const videoRef = useRef(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add thumbnail as first screenshot when available
  useEffect(() => {
    if (thumbnail && screenshots.length === 0) {
      console.log('Video.jsx: Adding thumbnail as first screenshot:', thumbnail);
      // Add the thumbnail as the first screenshot
      setScreenshots([thumbnail]);
    }
  }, [thumbnail, screenshots.length]);

  // Reset screenshots when video changes and set thumbnail as first image
  useEffect(() => {
    if (videoId && thumbnail) {
      console.log('Video.jsx: Video changed, resetting screenshots with thumbnail:', thumbnail);
      // Clear existing screenshots and set thumbnail as first
      setScreenshots([thumbnail]);
    }
  }, [videoId, thumbnail]);

  const handleDeleteScreenshot = (idx) => {
    setScreenshots(screenshots => screenshots.filter((_, i) => i !== idx));
  };

  const handleCropScreenshot = (idx, croppedImageUrl) => {
    setScreenshots(screenshots => {
      const newScreenshots = [...screenshots];
      newScreenshots[idx] = croppedImageUrl;
      return newScreenshots;
    });
  };

  // Fast Screenshot handler - uses video thumbnail for instant capture
  const handleGrabScreenshot = () => {
    const videoElement = videoRef.current;
    console.log('Grab Screenshot clicked');
    
    if (!videoElement) {
      // Use a simple notification instead of alert
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
      `;
      notification.textContent = 'Video not loaded yet. Please wait for the video to load.';
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 3000);
      return;
    }
    
    if (screenshots.length >= 6) {
      // Use a simple notification instead of alert
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
      `;
      notification.textContent = 'Maximum 6 screenshots allowed. Please delete some screenshots first.';
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 3000);
      return;
    }

    // Use video thumbnail for instant screenshot capture
    const thumbnailUrl = thumbnail || videoElement.poster;
    
    if (thumbnailUrl) {
      console.log('Adding video thumbnail as screenshot');
      setScreenshots(prev => [...prev, thumbnailUrl]);
      
      const newScreenshotCount = screenshots.length + 1;
      // Use a simple notification instead of alert
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
      `;
      notification.textContent = `Screenshot ${newScreenshotCount} captured successfully!`;
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 3000);
    } else {
      // Use a simple notification instead of alert
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
      `;
      notification.textContent = 'No thumbnail available for this video.';
      document.body.appendChild(notification);
      setTimeout(() => document.body.removeChild(notification), 3000);
    }
  };

  // Make Merch handler
  const handleMakeMerch = async () => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('user_authenticated');
    
    if (!isAuthenticated) {
      // Show auth modal instead of redirecting
      setShowAuthModal(true);
      return;
    }
    
    // User is authenticated, proceed with merch creation
    await createMerchProduct();
  };

  // Create merch product function
  const createMerchProduct = async () => {
    try {
      console.log('Make Merch clicked, sending request to:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
      
      // Get authentication state from localStorage
      const isAuthenticated = localStorage.getItem('user_authenticated');
      const userEmail = localStorage.getItem('user_email');
      
      // Get video information from the video data (passed from PlayVideo component)
      const videoUrl = window.location.href;
      
      // Use the video data from state
      const videoTitle = videoData?.title || 'Unknown Video';
      const creatorName = videoData?.channelTitle || 'Unknown Creator';
      
      console.log('🔍 Video data found:', { videoTitle, creatorName, videoUrl });
      console.log('🔍 API URL being called:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
      
      const requestData = {
        thumbnail,
        videoUrl: videoUrl,
        videoTitle: videoTitle,
        creatorName: creatorName,
        screenshots: screenshots.slice(0, 6),
        isAuthenticated: isAuthenticated === 'true',
        userEmail: userEmail || ''
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
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
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
          // On mobile, try to open in same window or show a message
          try {
            window.location.href = data.product_url;
          } catch (e) {
                       // Fallback: show URL for user to copy
           const notification = document.createElement('div');
           notification.style.cssText = `
             position: fixed;
             top: 20px;
             right: 20px;
             background: #4CAF50;
             color: white;
             padding: 12px 20px;
             border-radius: 8px;
             box-shadow: 0 4px 12px rgba(0,0,0,0.15);
             z-index: 10000;
             animation: slideIn 0.3s ease-out;
             max-width: 300px;
             font-size: 14px;
             font-weight: 500;
           `;
           notification.textContent = `Your merch page is ready! Please visit: ${data.product_url}`;
           document.body.appendChild(notification);
           setTimeout(() => document.body.removeChild(notification), 5000);
          }
        } else {
          // On desktop, open in new tab
          window.open(data.product_url, '_blank');
        }
             } else {
         console.error('Failed to create product:', data);
         const notification = document.createElement('div');
         notification.style.cssText = `
           position: fixed;
           top: 20px;
           right: 20px;
           background: #f44336;
           color: white;
           padding: 12px 20px;
           border-radius: 8px;
           box-shadow: 0 4px 12px rgba(0,0,0,0.15);
           z-index: 10000;
           animation: slideIn 0.3s ease-out;
           max-width: 300px;
           font-size: 14px;
           font-weight: 500;
         `;
         notification.textContent = `Failed to create merch product page: ${data.error || 'Unknown error'}`;
         document.body.appendChild(notification);
         setTimeout(() => document.body.removeChild(notification), 5000);
       }
     } catch (err) {
       console.error('Make Merch error:', err);
       const notification = document.createElement('div');
       notification.style.cssText = `
         position: fixed;
         top: 20px;
         right: 20px;
         background: #f44336;
         color: white;
         padding: 12px 20px;
         border-radius: 8px;
         box-shadow: 0 4px 12px rgba(0,0,0,0.15);
         z-index: 10000;
         animation: slideIn 0.3s ease-out;
         max-width: 300px;
         font-size: 14px;
         font-weight: 500;
       `;
       notification.textContent = `Error connecting to merch server: ${err.message}`;
       document.body.appendChild(notification);
       setTimeout(() => document.body.removeChild(notification), 5000);
     }
  };

  // Scroll to screenshots section and grab screenshot
  const scrollToScreenshots = () => {
    const screenshotsSection = document.getElementById('screenshotsSection');
    if (screenshotsSection) {
      // On mobile, scroll more smoothly
      if (window.innerWidth <= 768) {
        screenshotsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        screenshotsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    // Also trigger screenshot capture
    setTimeout(() => handleGrabScreenshot(), 500);
  };

  // Scroll to products section and make merch
  const scrollToProducts = () => {
    // Just trigger merch creation since we removed the products section
    handleMakeMerch();
  };

  return (
    <div className="video-page-container">
      {/* User Flow Section - Matching Home Page */}
      <div className="user-flow-section">
        <div className="flow-steps">
          <div 
            className="flow-step" 
            onClick={scrollToScreenshots}
            style={{ 
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Pick Screenshot</h3>
              <p>Select the perfect moment to capture</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div 
            className="flow-step" 
            onClick={scrollToProducts}
            style={{ 
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Make Merchandise</h3>
              <p>Create custom products with your screenshot</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="main-container">
        {/* Left Column - Video Viewer */}
        <div className="video-viewer">
          {videoId ? (
            <PlayVideo videoId={videoId} 
              thumbnail={thumbnail} setThumbnail={setThumbnail}
              screenshots={screenshots} setScreenshots={setScreenshots}
              videoRef={videoRef}
              onVideoData={setVideoData}
            />
          ) : (
            <div style={{padding: 24, color: 'red'}}>No video selected.</div>
          )}
        </div>

        {/* Middle Column - Screenshots */}
        <div className="screenshots-section" id="screenshotsSection">
          <h3>Screenshot Selection</h3>
          <ScreenmerchImages thumbnail={thumbnail} screenshots={screenshots} onDeleteScreenshot={handleDeleteScreenshot} onCropScreenshot={handleCropScreenshot} />
        </div>
      </div>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={createMerchProduct}
      />


    </div>
  );
};

export default Video;
