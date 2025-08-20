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
  const playVideoRef = useRef(null);

  const handleDeleteScreenshot = (idx) => {
    setScreenshots(screenshots => screenshots.filter((_, i) => i !== idx));
  };

  const handleStep2Click = () => {
    if (playVideoRef.current && playVideoRef.current.handleGrabScreenshot) {
      playVideoRef.current.handleGrabScreenshot();
    }
  };

  return (
      <div className="play-container">
        {/* Purple Instruction Bar */}
        <div className="user-flow-section">
          <div className="flow-steps">
            <div className="flow-step">
              <div className="step-number">1</div>
              <div className="step-label">Upload Video</div>
            </div>
            <div className="flow-step clickable-step" onClick={handleStep2Click}>
              <div className="step-number">2</div>
              <div className="step-label">Pick Screenshot</div>
            </div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-label">Make Merchandise</div>
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
