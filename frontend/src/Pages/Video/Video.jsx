import React, { useEffect, useState, useRef } from "react";
import PlayVideo, { ScreenmerchImages } from "../../Components/PlayVideo/PlayVideo";
import Recommended from "../../Components/Recommended/Recommended";
import './Video.css'
import { useParams } from "react-router-dom";
import { API_CONFIG } from '../../config/apiConfig'

const Video = () => {

  const {videoId,categoryId} = useParams();
  // State for thumbnail/screenshots
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
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

  const handleDeleteScreenshot = (idx) => {
    setScreenshots(screenshots => screenshots.filter((_, i) => i !== idx));
  };

  // Grab Screenshot handler
  const handleGrabScreenshot = async () => {
    const videoElement = videoRef.current;
    console.log('Grab Screenshot clicked');
    
    if (!videoElement) {
      alert('Video not loaded yet. Please wait for the video to load.');
      return;
    }
    
    if (screenshots.length >= 8) {
      alert('Maximum 8 screenshots allowed. Please delete some screenshots first.');
      return;
    }

    try {
      // First try server-side screenshot capture
      const currentTime = videoElement.currentTime || 0;
      const videoUrl = videoElement.src;
      
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
      alert(`Failed to capture screenshot: ${error.message}`);
    }
  };

  // Make Merch handler
  const handleMakeMerch = async () => {
    try {
      console.log('Make Merch clicked, sending request to:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
      
      const requestData = {
        thumbnail,
        videoUrl: window.location.href,
        screenshots: screenshots.slice(0, 5),
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
            />
          ) : (
            <div style={{padding: 24, color: 'red'}}>No video selected.</div>
          )}
        </div>

        {/* Middle Column - Screenshots */}
        <div className="screenshots-section" id="screenshotsSection">
          <h3>Screenshot Selection</h3>
          <ScreenmerchImages thumbnail={thumbnail} screenshots={screenshots} onDeleteScreenshot={handleDeleteScreenshot} />
        </div>
      </div>
    </div>
  );
};

export default Video;
