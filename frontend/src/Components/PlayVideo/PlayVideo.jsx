import React, { useEffect, useState, useRef } from 'react'
import './PlayVideo.css'
import like from '../../assets/like.png'
import dislike from '../../assets/dislike.png'
import share from '../../assets/share.png'
import save from '../../assets/save.png'
import { value_converter } from '../../data'
import moment from 'moment'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { API_CONFIG } from '../../config/apiConfig'

const PlayVideo = ({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots, videoRef: propVideoRef }) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const videoRef = propVideoRef || useRef(null);
    
    // Crop functionality state
    const [videoOrientation, setVideoOrientation] = useState('landscape'); // 'landscape' or 'portrait'
    const [cropMode, setCropMode] = useState('fit'); // 'fit', 'fill', 'crop'
    const [showCropControls, setShowCropControls] = useState(false);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!videoId) {
            setError('No video selected.');
            setLoading(false);
            return;
        }
        const fetchVideo = async () => {
            setLoading(true);
            setError('');
            let { data, error } = await supabase
                .from('videos2')
                .select('*')
                .eq('id', videoId)
                .single();
            if (error) {
                setError('Video not found.');
                setVideo(null);
            } else {
                setVideo(data);
                // Automatically set thumbnail if available
                if (data.thumbnail || data.poster) {
                    setThumbnail(data.thumbnail || data.poster);
                }
            }
            setLoading(false);
        };
        fetchVideo();
    }, [videoId, setThumbnail]);

    // Reset video element when videoId changes
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.load();
        }
        // Clear screenshots when video changes
        setScreenshots([]);
        // Reset crop settings
        setCropMode('fit');
        setShowCropControls(false);
    }, [videoId, setScreenshots]);

    // Detect video orientation when video loads
    const handleVideoLoad = () => {
        const videoElement = videoRef.current;
        if (videoElement) {
            const { videoWidth, videoHeight } = videoElement;
            setVideoDimensions({ width: videoWidth, height: videoHeight });
            
            // Determine orientation
            const isPortrait = videoHeight > videoWidth;
            setVideoOrientation(isPortrait ? 'portrait' : 'landscape');
            setShowCropControls(isPortrait);
            
            console.log(`Video loaded: ${videoWidth}x${videoHeight}, orientation: ${isPortrait ? 'portrait' : 'landscape'}`);
        }
    };

    // Get video container styles based on crop mode
    const getVideoContainerStyles = () => {
        const baseStyles = {
            width: '100%',
            maxHeight: '405px',
            background: '#000',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '8px'
        };

        if (videoOrientation === 'portrait') {
            switch (cropMode) {
                case 'fit':
                    return {
                        ...baseStyles,
                        objectFit: 'contain',
                        aspectRatio: '9/16',
                        maxHeight: '600px'
                    };
                case 'fill':
                    return {
                        ...baseStyles,
                        objectFit: 'cover',
                        aspectRatio: '16/9',
                        maxHeight: '405px'
                    };
                case 'crop':
                    return {
                        ...baseStyles,
                        objectFit: 'cover',
                        aspectRatio: '16/9',
                        maxHeight: '405px'
                    };
                default:
                    return baseStyles;
            }
        } else {
            // Landscape videos always use fit mode
            return {
                ...baseStyles,
                objectFit: 'contain',
                aspectRatio: '16/9'
            };
        }
    };

    // Get video element styles based on crop mode
    const getVideoStyles = () => {
        if (videoOrientation === 'portrait') {
            switch (cropMode) {
                case 'fit':
                    return {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                    };
                case 'fill':
                    return {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    };
                case 'crop':
                    return {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    };
                default:
                    return {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                    };
            }
        } else {
            return {
                width: '100%',
                height: '100%',
                objectFit: 'contain'
            };
        }
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
            const videoUrl = video.video_url;
            
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
                console.log('Server-side screenshot captured successfully');
                
                // Check if this is a fallback response
                if (result.fallback) {
                    console.log('Server returned fallback response, using thumbnail instead');
                    // Use thumbnail as fallback
                    const thumbnailUrl = video.thumbnail || video.poster || videoElement.poster;
                    if (thumbnailUrl) {
                        setScreenshots(prev => prev.length < 6 ? [...prev, thumbnailUrl] : prev);
                        const newScreenshotCount = screenshots.length + 1;
                        alert(`Screenshot ${newScreenshotCount} captured successfully! (using thumbnail)`);
                    } else {
                        alert('No thumbnail available for this video.');
                    }
                } else {
                    setScreenshots(prev => prev.length < 6 ? [...prev, result.screenshot] : prev);
                    const newScreenshotCount = screenshots.length + 1;
                    alert(`Screenshot ${newScreenshotCount} captured successfully!`);
                }
                return;
            } else {
                console.error('Server screenshot capture failed:', result.error);
                throw new Error(result.error || 'Server failed to capture screenshot');
            }
            
        } catch (error) {
            console.log('Server capture failed, using thumbnail fallback:', error);
            
            // Fallback to thumbnail if server capture fails
            const thumbnailUrl = video.thumbnail || video.poster || videoElement.poster;
            
            if (thumbnailUrl) {
                console.log('Adding video thumbnail as screenshot');
                setScreenshots(prev => prev.length < 6 ? [...prev, thumbnailUrl] : prev);
                
                const newScreenshotCount = screenshots.length + 1;
                alert(`Screenshot ${newScreenshotCount} captured successfully! (using thumbnail)`);
            } else {
                alert('No thumbnail available for this video.');
            }
        }
    };

    // Make Merch handler
    const handleMakeMerch = async () => {
        try {
            // Check if user is authenticated
            const isAuthenticated = localStorage.getItem('user_authenticated');
            
            if (!isAuthenticated) {
                // Store screenshot data for after login
                const merchData = {
                    thumbnail,
                    videoUrl: window.location.href,
                    screenshots: screenshots.slice(0, 6),
                };
                localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
                
                // Redirect to login page
                window.location.href = '/login?redirect=merch';
                return;
            }
            
            // User is authenticated, proceed with merch creation
            console.log('Make Merch clicked, sending request to:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
            
            const requestData = {
                thumbnail,
                videoUrl: window.location.href,
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
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success && data.product_url) {
                window.open(data.product_url, '_blank');
            } else {
                console.error('Failed to create product:', data);
                alert(`Failed to create merch product page: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Make Merch error:', err);
            alert(`Error connecting to merch server: ${err.message}. Please check the console for more details.`);
        }
    };

    if (loading) return <div style={{padding: 24}}>Loading video...</div>;
    if (error || !video) return <div style={{padding: 24, color: 'red'}}>{error || 'Video not found.'}</div>;

    return (
        <div className="play-video">
            {/* Crop Controls for Portrait Videos */}
            {showCropControls && (
                <div className="crop-controls">
                    <div className="crop-controls-header">
                        <span className="crop-label">Portrait Video - Choose Display Mode:</span>
                        <button 
                            className="crop-toggle-btn"
                            onClick={() => setShowCropControls(!showCropControls)}
                        >
                            {showCropControls ? 'Hide' : 'Show'} Controls
                        </button>
                    </div>
                    <div className="crop-mode-buttons">
                        <button 
                            className={`crop-mode-btn ${cropMode === 'fit' ? 'active' : ''}`}
                            onClick={() => setCropMode('fit')}
                        >
                            Fit (Show Full Video)
                        </button>
                        <button 
                            className={`crop-mode-btn ${cropMode === 'fill' ? 'active' : ''}`}
                            onClick={() => setCropMode('fill')}
                        >
                            Fill (Crop to Fit)
                        </button>
                        <button 
                            className={`crop-mode-btn ${cropMode === 'crop' ? 'active' : ''}`}
                            onClick={() => setCropMode('crop')}
                        >
                            Crop (Center Focus)
                        </button>
                    </div>
                </div>
            )}

            {/* Video Container */}
            <div className="video-container" style={getVideoContainerStyles()}>
                <video 
                    key={videoId} 
                    ref={videoRef} 
                    controls 
                    style={getVideoStyles()}
                    poster={video.thumbnail || ''} 
                    src={video.video_url}
                    crossOrigin="anonymous"
                    onLoadedMetadata={handleVideoLoad}
                >
                    Your browser does not support the video tag.
                </video>
                
                {/* Show crop controls toggle for portrait videos */}
                {videoOrientation === 'portrait' && !showCropControls && (
                    <button 
                        className="crop-toggle-overlay"
                        onClick={() => setShowCropControls(true)}
                    >
                        ⚙️ Crop Options
                    </button>
                )}
            </div>

            {/* Action Buttons */}
            <div className="screenmerch-actions">
                <button className="screenmerch-btn" onClick={handleGrabScreenshot}>Grab Screenshot</button>
                <button className="screenmerch-btn" onClick={handleMakeMerch}>Make Merch</button>
            </div>

            <h3>{video.title}</h3>
            <div className="play-video-info">
                <p>{moment(video.created_at).fromNow()}</p>
                <div>
                    <span><img src={like} alt="" />Like</span>
                    <span><img src={dislike} alt="" />Dislike</span>
                    <span><img src={share} alt="" />Share</span>
                    <span><img src={save} alt="" />Save</span>
                </div>
            </div>
            <hr />
            <div className="publisher">
                <div>
                    <p>Approved Creator</p>
                </div>
                <button type="button">Subscribe</button>
            </div>
            <div className="vid-description">
                <p>{video.description}</p>
            </div>
        </div>
    )
}

export default PlayVideo

export const ScreenmerchImages = ({ thumbnail, screenshots, onDeleteScreenshot }) => (
    <div className="screenmerch-images-grid">
        {[0,1,2,3,4,5].map(idx => (
            <div className="screenmerch-image-box" key={idx}>
                <h4>Screenshot {idx + 1}</h4>
                {screenshots[idx] ? (
                    <div className="screenmerch-img-wrapper">
                        <img src={screenshots[idx]} alt={`Screenshot ${idx + 1}`} className="screenmerch-preview" />
                        <button className="screenmerch-delete-btn" onClick={() => onDeleteScreenshot(idx)} title="Delete screenshot">×</button>
                    </div>
                ) : (
                    <div className="screenmerch-placeholder">No screenshot</div>
                )}
            </div>
        ))}
    </div>
);
