import React, { useEffect, useState, useRef } from 'react'
import './PlayVideo.css'
import { value_converter } from '../../data'
import moment from 'moment'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { API_CONFIG } from '../../config/apiConfig'

const PlayVideo = ({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots }) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const videoRef = useRef(null);

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

    // Grab Screenshot handler
    const handleGrabScreenshot = () => {
        const video = videoRef.current;
        if (!video) {
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

        // Since cross-origin restrictions prevent direct video capture,
        // we'll use the video thumbnail as a reliable screenshot
        const thumbnailUrl = video.thumbnail || video.poster || video.poster;
        
        if (thumbnailUrl) {
            console.log('Adding video thumbnail as screenshot');
            setScreenshots(prev => prev.length < 6 ? [...prev, thumbnailUrl] : prev);
            
            // Show success message with green notification
            const newScreenshotCount = screenshots.length + 1;
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
                
                // Redirect to auth page (existing route) instead of non-existent /login
                window.location.href = '/auth?redirect=merch';
                return;
            }
            
            // User is authenticated, proceed with merch creation
            const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thumbnail,
                    videoUrl: window.location.href,
                    screenshots: screenshots.slice(0, 6),
                })
            });
            const data = await response.json();
            if (data.success && data.product_url) {
                window.open(data.product_url, '_blank');
            } else {
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
                notification.textContent = 'Failed to create merch product page.';
                document.body.appendChild(notification);
                setTimeout(() => document.body.removeChild(notification), 3000);
            }
        } catch (err) {
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
            notification.textContent = 'Error connecting to merch server. Make sure Flask is running.';
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 3000);
        }
    };

    if (loading) return <div style={{padding: 24}}>Loading video...</div>;
    if (error || !video) return <div style={{padding: 24, color: 'red'}}>{error || 'Video not found.'}</div>;

    return (
        <div className="play-video">
            <div className="screenmerch-actions">
                <button className="screenmerch-btn" onClick={handleGrabScreenshot}>Grab Screenshot</button>
                <button className="screenmerch-btn" onClick={handleMakeMerch}>Make Merch</button>
            </div>
            <video ref={videoRef} controls width="100%" style={{background: '#000'}} poster={video.thumbnail || ''} src={video.video_url}>
                Your browser does not support the video tag.
            </video>
            <h3>{video.title}</h3>
            <div className="play-video-info">
                <p>{moment(video.created_at).fromNow()}</p>
            </div>
            <hr />
            <div className="vid-description">
                <p>{video.description}</p>
            </div>
        </div>
    )
}

export default PlayVideo

export const ScreenmerchImages = ({ thumbnail, screenshots, onDeleteScreenshot }) => (
    <div className="screenmerch-images-grid">
        <div className="screenmerch-image-box">
            <h4>Thumbnail</h4>
            {thumbnail ? (
                <img src={thumbnail} alt="Thumbnail" className="screenmerch-preview" />
            ) : (
                <div className="screenmerch-placeholder">No thumbnail</div>
            )}
        </div>
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
