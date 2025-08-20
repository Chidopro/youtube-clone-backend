import React, { useEffect, useState } from "react";
import PlayVideo, { ScreenmerchImages } from "../../Components/PlayVideo/PlayVideo";
import Recommended from "../../Components/Recommended/Recommended";
import './Video.css'
import { useParams } from "react-router-dom";

const Video = () => {

  const {videoId,categoryId} = useParams();
  // State for thumbnail/screenshots
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);

  const handleDeleteScreenshot = (idx) => {
    setScreenshots(screenshots => screenshots.filter((_, i) => i !== idx));
  };

  return (
      <div className="play-container">
        <div className="main-video-col">
          {videoId ? (
            <PlayVideo videoId={videoId} 
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
