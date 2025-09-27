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
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const videoRef = useRef(null);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [pulseStep2, setPulseStep2] = useState(true); // Start with step 2 pulsing
  const [pulseStep3, setPulseStep3] = useState(false); // Step 3 starts not pulsing
  const [userHasTakenScreenshot, setUserHasTakenScreenshot] = useState(false); // Track if user manually took screenshot

  // Check if device is mobile and orientation
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      const portrait = mobile && window.innerHeight > window.innerWidth;
      setIsMobile(mobile);
      setIsMobilePortrait(portrait);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Auto-scroll to position video player consistently
  useEffect(() => {
    if (videoId) {
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        if (isMobile) {
          // Mobile positioning - position video just below navbar
          const videoContainer = document.querySelector('.video-container');
          const navbar = document.querySelector('nav');
          
          if (videoContainer && navbar) {
            // Calculate navbar height to position video just below it
            const navbarHeight = navbar.offsetHeight;
            const videoTop = videoContainer.getBoundingClientRect().top + window.scrollY;
            const targetScrollPosition = videoTop - navbarHeight - 10; // Position just below navbar with small padding
            
            window.scrollTo({
              top: targetScrollPosition,
              behavior: 'smooth'
            });
          } else if (videoContainer) {
            // Fallback: position video at top with navbar height estimate
            const videoTop = videoContainer.getBoundingClientRect().top + window.scrollY;
            const targetScrollPosition = videoTop - 70; // Estimate navbar height (~60px) + padding
            
            window.scrollTo({
              top: targetScrollPosition,
              behavior: 'smooth'
            });
          } else {
            // Final fallback: scroll to top of page
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }
        } else {
          // Desktop positioning - position video player right below white header
          const videoContainer = document.querySelector('.video-container');
          const navbar = document.querySelector('nav');
          
          if (videoContainer && navbar) {
            // Calculate navbar height to position video player right below header
            const navbarHeight = navbar.offsetHeight;
            const videoTop = videoContainer.getBoundingClientRect().top + window.scrollY;
            const targetScrollPosition = videoTop - navbarHeight; // Video player right below header
            
            window.scrollTo({
              top: targetScrollPosition,
              behavior: 'smooth'
            });
          } else if (videoContainer) {
            // Fallback: position video player with estimated header height
            const videoTop = videoContainer.getBoundingClientRect().top + window.scrollY;
            const targetScrollPosition = videoTop - 80; // Estimate header height (~80px)
            
            window.scrollTo({
              top: targetScrollPosition,
              behavior: 'smooth'
            });
          } else {
            // Final fallback: scroll to top
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }
        }
      }, 500); // 500ms delay to ensure video player is loaded
      
      return () => clearTimeout(timer);
    }
  }, [isMobile, videoId]);

  // Add thumbnail as first screenshot when available
  useEffect(() => {
    if (thumbnail && screenshots.length === 0) {
      // Add the thumbnail as the first screenshot
      setScreenshots([thumbnail]);
    }
  }, [thumbnail, screenshots.length]);

  // Update screenshot count when screenshots change
  useEffect(() => {
    setScreenshotCount(screenshots.length);
    
    // Check if user has manually taken screenshots (more than just the automatic thumbnail)
    const hasUserScreenshots = userHasTakenScreenshot || screenshots.length > 1;
    
    if (hasUserScreenshots) {
      // If user has taken screenshots, stop pulsing step 2 and start pulsing step 3
      setPulseStep2(false);
      setPulseStep3(true);
    } else {
      // If no user screenshots yet, pulse step 2 and stop pulsing step 3
      setPulseStep2(true);
      setPulseStep3(false);
    }
  }, [screenshots, userHasTakenScreenshot]);

  // Reset screenshots when video changes and set thumbnail as first image
  useEffect(() => {
    if (videoId && thumbnail) {
      // Clear existing screenshots and set thumbnail as first
      setScreenshots([thumbnail]);
      // Reset user screenshot flag when video changes
      setUserHasTakenScreenshot(false);
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

  // Fast Screenshot handler - directly trigger the screenshot button click
  const handleGrabScreenshot = async () => {
    console.log('Step 2 clicked - attempting screenshot capture');
    
    const beforeCount = screenshots.length;
    
    // Find the working screenshot button and click it directly
    const screenshotButton = document.querySelector('.screenmerch-btn');
    if (screenshotButton && screenshotButton.textContent.includes('Select Screenshot')) {
      console.log('Clicking working screenshot button...');
      screenshotButton.click();
      
      // Mark that user has manually taken a screenshot
      setUserHasTakenScreenshot(true);
      console.log('Screenshot function completed');
      
      // Wait a bit for the screenshot to be added, then check
      setTimeout(() => {
        if (screenshots.length > beforeCount) {
          console.log('Screenshot successfully added, switching pulse states');
        }
      }, 500);
    } else {
      console.log('Screenshot button not found or not ready yet');
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
      
      // Get authentication state from localStorage
      const isAuthenticated = localStorage.getItem('user_authenticated');
      const userEmail = localStorage.getItem('user_email');
      
      // Get video information from the video data (passed from PlayVideo component)
      const videoUrl = window.location.href;
      
      // Use the video data from state
      const videoTitle = videoData?.title || 'Unknown Video';
      const creatorName = videoData?.channelTitle || 'Unknown Creator';
      
      
      const requestData = {
        thumbnail,
        videoUrl: videoUrl,
        videoTitle: videoTitle,
        creatorName: creatorName,
        screenshots: screenshots.slice(0, 6),
        isAuthenticated: isAuthenticated === 'true',
        userEmail: userEmail || ''
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
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
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

       // Scroll to screenshots section and grab screenshot - DISABLED TO STOP LOOPS
    const scrollToScreenshots = () => {
      return;
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
             className="flow-step clickable-step" 
             onClick={handleGrabScreenshot}
             style={{ 
               cursor: 'pointer',
               userSelect: 'none',
               WebkitTapHighlightColor: 'transparent'
             }}
           >
             <div className={`step-number ${pulseStep2 ? 'pulse' : ''}`}>2</div>
             <div className="step-content">
               <h3>Play The Video</h3>
               <p>Select the perfect screenshot to capture</p>
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
             <div className={`step-number ${pulseStep3 ? 'pulse' : ''}`}>3</div>
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
             <PlayVideo 
               videoId={videoId} 
               thumbnail={thumbnail} 
               setThumbnail={setThumbnail}
               screenshots={screenshots} 
               setScreenshots={setScreenshots}
               videoRef={videoRef}
               onVideoData={setVideoData}
             />
           ) : (
             <div style={{padding: 24, color: 'red'}}>No video selected.</div>
           )}
         </div>

        {/* Middle Column - Screenshots */}
        <div className="screenshots-section" id="screenshotsSection" style={{ position: 'relative' }}>
          {/* Screenshot Counter - Mobile Only on Video Page */}
          {isMobile && videoId && (
            <div 
              id="screenshotCounter"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: screenshotCount >= 6 ? '#ff4444' : '#fff',
                border: `2px solid ${screenshotCount >= 6 ? '#ff4444' : '#ddd'}`,
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '16px',
                color: screenshotCount >= 6 ? '#fff' : '#333',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 100
              }}
            >
              {screenshotCount}
            </div>
          )}
          
          {/* Removed "Screenshot Selection" title - it's obvious from context */}
          <ScreenmerchImages 
            thumbnail={thumbnail} 
            screenshots={screenshots} 
            onDeleteScreenshot={handleDeleteScreenshot} 
            onCropScreenshot={handleCropScreenshot} 
          />
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