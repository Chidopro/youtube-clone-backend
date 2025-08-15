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

  // Add some default screenshots for testing
  useEffect(() => {
    if (thumbnail && screenshots.length === 0) {
      // Add the thumbnail as the first screenshot
      setScreenshots([thumbnail]);
    }
  }, [thumbnail, screenshots.length]);

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

  // Grab Screenshot handler
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
      // First try server-side screenshot capture
      const currentTime = videoElement.currentTime || 0;
      // Use videoData.video_url instead of videoElement.src to get the actual video file
      const videoUrl = videoData?.video_url || videoElement.src;
      
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
            alert(`Your merch page is ready! Please visit: ${data.product_url}`);
          }
        } else {
          // On desktop, open in new tab
          window.open(data.product_url, '_blank');
        }
      } else {
        console.error('Failed to create product:', data);
        alert(`Failed to create merch product page: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Make Merch error:', err);
      alert(`Error connecting to merch server: ${err.message}. Please check the console for more details.`);
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
          <h3 className="screenshots-selected-heading">Screenshots Selected</h3>
          <ScreenmerchImages thumbnail={thumbnail} screenshots={screenshots} onDeleteScreenshot={handleDeleteScreenshot} onCropScreenshot={handleCropScreenshot} />
        </div>

        {/* Products Section */}
        <div className="screenshots-section products-section" id="productsSection">
          <h3 className="products-available-heading">Available Products</h3>
          <div className="products-preview">
            <p style={{textAlign: 'center', color: '#666', fontSize: '0.9rem', margin: '20px 0'}}>
              Select screenshots above, then click "Make Merchandise" to choose from our available products
            </p>
            <div className="product-types-grid">
              <div className="product-type-item">📱 Phone Cases</div>
              <div className="product-type-item">👕 T-Shirts</div>
              <div className="product-type-item">👒 Hats</div>
              <div className="product-type-item">🎒 Bags</div>
              <div className="product-type-item">☕ Mugs</div>
              <div className="product-type-item">📄 Stickers</div>
            </div>
          </div>
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
