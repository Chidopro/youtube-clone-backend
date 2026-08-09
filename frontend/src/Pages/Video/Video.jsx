import React, { useEffect, useState, useRef } from "react";
import PlayVideo, { ScreenmerchImages } from "../../Components/PlayVideo/PlayVideo";
import Recommended from "../../Components/Recommended/Recommended";
import AuthModal from "../../Components/AuthModal/AuthModal";
import './Video.css'
import { useParams } from "react-router-dom";
import { useCreator } from '../../contexts/CreatorContext';
import { savePendingMerchData } from '../../utils/merchSession';

const Video = ({ sidebar }) => {

  const {videoId,categoryId} = useParams();
  // State for thumbnail/screenshots
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  /** Seconds in video for each captured frame (aligned with PlayVideo); required for orders/admin timestamp */
  const [screenshotTimestamps, setScreenshotTimestamps] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const videoRef = useRef(null);
  const captureScreenshotRef = useRef(null);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [videoHasPlayed, setVideoHasPlayed] = useState(false); // Track if video has been played
  const [pulseStep2, setPulseStep2] = useState(false); // Step 2 only pulses after video is played
  const [pulseStep3, setPulseStep3] = useState(false); // Step 3 starts not pulsing
  const [userHasTakenScreenshot, setUserHasTakenScreenshot] = useState(false); // Track if user manually took screenshot
  const lastResetVideoIdRef = useRef(null); // Only reset play state when videoId changes, not when thumbnail loads late
  const { creatorSettings } = useCreator();

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
          const row = document.querySelector('.video-page-container .main-container');
          const navbar = document.querySelector('nav');
          if (row) {
            const navbarHeight = navbar ? navbar.offsetHeight : 80;
            const rowTop = row.getBoundingClientRect().top + window.scrollY;
            const targetScrollPosition = Math.max(0, rowTop - navbarHeight - 20);
            window.scrollTo({
              top: targetScrollPosition,
              behavior: 'smooth'
            });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
    } else if (videoHasPlayed) {
      // If video has been played but no screenshots yet, keep step 2 active
      setPulseStep2(true);
      setPulseStep3(false);
    } else {
      // If video hasn't been played yet, don't activate step 2
      setPulseStep2(false);
      setPulseStep3(false);
    }
  }, [screenshots, userHasTakenScreenshot, videoHasPlayed]);

  // Reset only when videoId changes (not when thumbnail loads late, so step 2 pulse is not cleared after play)
  useEffect(() => {
    if (!videoId) return;
    if (lastResetVideoIdRef.current !== videoId) {
      lastResetVideoIdRef.current = videoId;
      setUserHasTakenScreenshot(false);
      setVideoHasPlayed(false);
      setPulseStep2(false);
      setPulseStep3(false);
    }
  }, [videoId]);

  // Set screenshots to [thumbnail] when we have both (can run when thumbnail loads late)
  useEffect(() => {
    if (videoId && thumbnail) {
      setScreenshots([thumbnail]);
    }
  }, [videoId, thumbnail]);

  // Handle video played callback
  const handleVideoPlayed = () => {
    console.log('Video played - activating step 2 red pulse');
    setVideoHasPlayed(true);
    setPulseStep2(true); // Activate step 2 red effect after video is played
    setPulseStep3(false);
  };

  // Ensure step 2 pulses when video is played (backup effect)
  useEffect(() => {
    if (videoHasPlayed && !userHasTakenScreenshot && screenshots.length <= 1) {
      setPulseStep2(true);
      setPulseStep3(false);
    }
  }, [videoHasPlayed, userHasTakenScreenshot, screenshots.length]);

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

  const handleGrabScreenshot = async () => {
    if (typeof captureScreenshotRef.current === 'function') {
      await captureScreenshotRef.current();
      setUserHasTakenScreenshot(true);
      return;
    }
    console.log('Screenshot capture is not ready yet');
  };

  // Make Merch handler
  const goToMerchandiseCategories = () => {
    try {
      const currentTime = videoRef.current ? videoRef.current.currentTime || 0 : 0;
      const frameSeconds =
        screenshotTimestamps.length > 0 ? screenshotTimestamps[0] : screenshots.length > 0 ? 0 : currentTime;
      const merchData = {
        thumbnail,
        videoUrl: window.location.href,
        screenshots: screenshots.slice(0, 6),
        screenshot_timestamp: frameSeconds,
        timestamp: frameSeconds,
        videoTitle: videoData?.title || 'Unknown Video',
        creatorName: videoData?.channelTitle || 'Unknown Creator'
      };
      savePendingMerchData(merchData);
    } catch (e) {
      console.warn('Failed saving pending_merch_data:', e);
    }

    const email = localStorage.getItem('user_email') || '';
    const qs = email ? `?authenticated=true&email=${encodeURIComponent(email)}` : '';
    window.location.href = `/merchandise${qs}`;
  };

  const handleMakeMerch = async () => {
    const isAuthenticated = localStorage.getItem('user_authenticated');
    const googleAuthenticated = localStorage.getItem('isAuthenticated');
    const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');

    // Persist screenshots first so category page can use them
    try {
      const currentTime = videoRef.current ? videoRef.current.currentTime || 0 : 0;
      const frameSeconds =
        screenshotTimestamps.length > 0 ? screenshotTimestamps[0] : screenshots.length > 0 ? 0 : currentTime;
      savePendingMerchData({
          thumbnail,
          videoUrl: window.location.href,
          screenshots: screenshots.slice(0, 6),
          screenshot_timestamp: frameSeconds,
          timestamp: frameSeconds,
          videoTitle: videoData?.title || 'Unknown Video',
          creatorName: videoData?.channelTitle || 'Unknown Creator'
        });
    } catch (e) {
      console.warn('Failed saving pending_merch_data:', e);
    }

    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    // Always go to category page (do not wait on create-product — large screenshots can hang)
    goToMerchandiseCategories();
  };

  // After login from Make Merch modal — go straight to categories
  const createMerchProduct = async () => {
    goToMerchandiseCategories();
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
       {/* User Flow Section - Matching Home Page (creator colors) */}
       <div
         className="user-flow-section"
         style={
           creatorSettings?.primary_color && creatorSettings?.secondary_color
             ? {
                 background: `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)`,
               }
             : undefined
         }
       >
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
             <div className={`step-number ${pulseStep2 ? 'pulse step-red' : ''}`}>2</div>
             <div className="step-content">
               <h3>Select Screenshot</h3>
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
             <div className={`step-number ${pulseStep3 ? 'pulse step-green' : ''}`}>3</div>
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
               screenshotTimestamps={screenshotTimestamps}
               setScreenshotTimestamps={setScreenshotTimestamps}
               videoRef={videoRef}
               onVideoData={setVideoData}
               onVideoPlayed={handleVideoPlayed}
               onMakeMerch={handleMakeMerch}
               onScreenshotFunction={(fn) => { captureScreenshotRef.current = fn; }}
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
          
          {!isMobile && (
            <div className="screenmerch-actions screenmerch-actions--sidebar">
              <button
                type="button"
                className="screenmerch-btn screenshot-btn"
                onClick={handleGrabScreenshot}
                disabled={screenshots.length >= 6}
              >
                {screenshots.length >= 6 ? 'Max Screenshots' : 'Select Screenshot'}
              </button>
              <button
                type="button"
                className="screenmerch-btn make-merch-btn"
                onClick={scrollToProducts}
              >
                Make Merch
              </button>
            </div>
          )}
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