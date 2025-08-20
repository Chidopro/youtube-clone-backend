import React, { useEffect, useState, useRef } from "react";
import PlayVideo, { ScreenmerchImages } from "../../Components/PlayVideo/PlayVideo";
import Recommended from "../../Components/Recommended/Recommended";
import './Video.css'
import { useParams } from "react-router-dom";

const Video = () => {

  const {videoId,categoryId} = useParams();
  // State for thumbnail/screenshots
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  
  // Ref to access PlayVideo component methods
  const playVideoRef = useRef();

  const handleDeleteScreenshot = (idx) => {
    setScreenshots(screenshots => screenshots.filter((_, i) => i !== idx));
  };

  const handleStep2Click = () => {
    // Trigger screenshot capture when Step 2 is clicked
    console.log('Step 2 clicked - triggering screenshot capture - UPDATED');
    if (playVideoRef.current && playVideoRef.current.handleGrabScreenshot) {
      playVideoRef.current.handleGrabScreenshot();
    }
  };

  return (
      <div className="play-container">
        {/* Step Navigation Bar - Only Steps 2 and 3 on screenshot page */}
        <div className="user-flow-section">
          <div className="flow-steps">
            <div className="flow-step clickable-step" onClick={handleStep2Click}>
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Pick Screenshot</h3>
                <p>Click to capture screenshots</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Make Merchandise</h3>
                <p>Create custom products with your screenshot</p>
              </div>
            </div>
          </div>
        </div>

        <div className="main-video-col">
          {videoId ? (
            <PlayVideo 
              ref={playVideoRef}
              videoId={videoId} 
              thumbnail={thumbnail} setThumbnail={setThumbnail}
              screenshots={screenshots} setScreenshots={setScreenshots}
            />
          ) : (
            <div style={{padding: 24, color: 'red'}}>No video selected.</div>
          )}
        </div>
        <div className="screenmerch-sidebar">
          <ScreenmerchImages thumbnail={thumbnail} screenshots={screenshots} onDeleteScreenshot={handleDeleteScreenshot} />
        </div>
      </div>
  );
};

export default Video;
