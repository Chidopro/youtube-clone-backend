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
    }, [videoId, setScreenshots]);

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
                        setScreenshots(prev => prev.length < 8 ? [...prev, thumbnailUrl] : prev);
                        const newScreenshotCount = screenshots.length + 1;
                        alert(`Screenshot ${newScreenshotCount} captured successfully! (using thumbnail)`);
                    } else {
                        alert('No thumbnail available for this video.');
                    }
                } else {
                    setScreenshots(prev => prev.length < 8 ? [...prev, result.screenshot] : prev);
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
                setScreenshots(prev => prev.length < 8 ? [...prev, thumbnailUrl] : prev);
                
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
            <video 
                key={videoId} 
                ref={videoRef} 
                controls 
                width="100%" 
                style={{background: '#000'}} 
                poster={video.thumbnail || ''} 
                src={video.video_url}
                crossOrigin="anonymous"
            >
                Your browser does not support the video tag.
            </video>
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
        {[0,1,2,3,4].map(idx => (
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
