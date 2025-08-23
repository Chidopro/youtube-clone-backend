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
import AuthModal from '../AuthModal/AuthModal'
import { mobileAuthDebug } from '../../utils/mobileAuthDebug'

const PlayVideo = ({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots, videoRef: propVideoRef, onVideoData }) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const videoRef = propVideoRef || useRef(null);
    
    // Auth modal state
    const [showAuthModal, setShowAuthModal] = useState(false);

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
                console.log('Video data loaded:', data);
                console.log('Video URL:', data.video_url);
                
                // Test if video URL is accessible
                try {
                    const response = await fetch(data.video_url, { method: 'HEAD' });
                    console.log('Video URL accessibility test:', response.status, response.ok);
                } catch (err) {
                    console.error('Video URL accessibility test failed:', err);
                }
                
                // Automatically set thumbnail if available
                if (data.thumbnail || data.poster) {
                    setThumbnail(data.thumbnail || data.poster);
                }
                // Pass video data to parent component
                if (onVideoData) {
                    onVideoData(data);
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

    // Cleanup function to restore scrolling when component unmounts
    useEffect(() => {
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Grab Screenshot handler
    const handleGrabScreenshot = async () => {
        console.log('Grab Screenshot clicked');
        
        // Prevent page scrolling when screenshot is taken
        const currentScroll = window.scrollY;
        
        if (screenshots.length >= 6) {
            alert('Maximum 6 screenshots allowed. Please delete some screenshots first.');
            return;
        }

        // Otherwise, capture a new screenshot
        const videoElement = videoRef.current;
        if (!videoElement) {
            alert('Video not loaded yet. Please wait for the video to load.');
            return;
        }

        try {
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
                    quality: 85,
                    crop_area: null
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.screenshot) {
                console.log('Server-side screenshot captured successfully');
                
                if (result.fallback) {
                    console.log('Server returned fallback response, using thumbnail instead');
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
                // Restore scroll position
                window.scrollTo(0, currentScroll);
                return;
            } else {
                console.error('Server screenshot capture failed:', result.error);
                throw new Error(result.error || 'Server failed to capture screenshot');
            }
            
        } catch (error) {
            console.log('Server capture failed, using thumbnail fallback:', error);
            
            const thumbnailUrl = video.thumbnail || video.poster || videoElement.poster;
            
            if (thumbnailUrl) {
                console.log('Adding video thumbnail as screenshot');
                setScreenshots(prev => prev.length < 6 ? [...prev, thumbnailUrl] : prev);
                
                const newScreenshotCount = screenshots.length + 1;
                alert(`Screenshot ${newScreenshotCount} captured successfully! (using thumbnail)`);
            } else {
                alert('No thumbnail available for this video.');
            }
            // Restore scroll position
            window.scrollTo(0, currentScroll);
        }
    };

    // Make Merch handler
    const handleMakeMerch = async () => {
        // Debug logging for mobile
        if (mobileAuthDebug.isMobile()) {
            console.log('📱 Mobile Make Merch triggered');
            mobileAuthDebug.logAuthState();
        }
        
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
            
            // Show auth modal instead of redirecting
            console.log('User not authenticated, showing auth modal');
            setShowAuthModal(true);
            return;
        }
        
        // User is authenticated, proceed with merch creation
        console.log('User authenticated, proceeding with merch creation');
        await createMerchProduct();
    };

    // Create merch product function
    const createMerchProduct = async () => {
        try {
            console.log('Make Merch clicked, sending request to:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
            
            // Check if user is still authenticated
            const isAuthenticated = localStorage.getItem('user_authenticated');
            if (!isAuthenticated) {
                console.error('User not authenticated, showing auth modal');
                setShowAuthModal(true);
                return;
            }
            
            const requestData = {
                thumbnail,
                videoUrl: window.location.href,
                screenshots: screenshots.slice(0, 6),
                isAuthenticated: true,
                userEmail: localStorage.getItem('user_email') || ''
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
                // Mobile-friendly way to open the product URL
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                if (isMobile) {
                    // On mobile, try to open in same window or fallback to new tab
                    try {
                        window.location.href = data.product_url;
                    } catch (e) {
                        console.log('Failed to redirect, trying window.open');
                        window.open(data.product_url, '_blank');
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

    // handleAuthSuccess function to be called by AuthModal
    const handleAuthSuccess = () => {
        console.log('Auth success callback triggered');
        
        // Debug logging for mobile
        if (mobileAuthDebug.isMobile()) {
            console.log('📱 Mobile auth success callback');
            mobileAuthDebug.logAuthState();
        }
        
        setShowAuthModal(false);
        
        // Add a small delay for mobile devices to ensure state is updated
        setTimeout(() => {
            console.log('Proceeding with merch creation after auth success');
            createMerchProduct();
        }, 100);
    };

    if (loading) return <div style={{padding: 24}}>Loading video...</div>;
    if (error || !video) return <div style={{padding: 24, color: 'red'}}>{error || 'Video not found.'}</div>;

    return (
        <div className="play-video">
            <div 
                className="video-container" 
                style={{ position: 'relative', display: 'block' }}
            >
                {/* Crop Tool Button - Upper Left Corner */}
                <button
                    className="crop-tool-btn"
                    onClick={() => console.log('Crop tool clicked')}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        zIndex: 10,
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px',
                        minHeight: '32px',
                        backdropFilter: 'blur(4px)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(0, 0, 0, 0.9)';
                        e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(0, 0, 0, 0.7)';
                        e.target.style.transform = 'scale(1)';
                    }}
                    title="Crop Tool"
                >
                    ✂️
                </button>
                
                <video 
                    key={videoId}
                    ref={videoRef} 
                    controls 
                    width="100%" 
                    height="100%"
                    style={{
                        width: '100%',
                        height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        display: 'block'
                    }} 
                    src={video.video_url}
                    onError={(e) => console.error('Video error:', e)}
                    onLoadStart={() => console.log('Video loading started')}
                    onCanPlay={() => console.log('Video can play')}
                    onPlay={() => console.log('Video play event fired')}
                    onPause={() => console.log('Video pause event fired')}
                    onLoadedData={() => console.log('Video data loaded, URL:', video.video_url)}
                    onLoadedMetadata={() => console.log('Video metadata loaded')}
                    onCanPlayThrough={() => console.log('Video can play through')}
                    onWaiting={() => console.log('Video waiting for data')}
                    onStalled={() => console.log('Video stalled')}
                    poster={video.thumbnail || video.poster}
                    preload="metadata"
                    playsInline
                    webkit-playsinline="true"
                >
                    Your browser does not support the video tag.
                </video>
            </div>
            
            {/* Action buttons for screenshots and merchandise */}
            <div className="screenmerch-actions" style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '15px',
                flexWrap: 'wrap'
            }}>
                <button 
                    className="screenmerch-btn" 
                    onClick={handleGrabScreenshot}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Select Screenshot
                </button>
                <button 
                    className="screenmerch-btn" 
                    onClick={handleMakeMerch}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Make Merch
                </button>
            </div>
            
            <h3>{video.title}</h3>
            <div className="play-video-info">
                <p>{moment(video.created_at).fromNow()}</p>
            </div>
            <div className="vid-description">
                <p>{video.description}</p>
            </div>

            {/* Authentication Modal */}
            <AuthModal 
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />
        </div>
    )
}

export default PlayVideo

export const ScreenmerchImages = ({ thumbnail, screenshots, onDeleteScreenshot }) => {
    return (
        <div className="screenmerch-images-grid">
            {[0,1,2,3,4,5].map(idx => (
                <div className="screenmerch-image-box" key={idx}>
                    <h4>Screenshot {idx + 1}</h4>
                    {screenshots[idx] ? (
                        <div className="screenmerch-img-wrapper">
                            <img 
                                src={screenshots[idx]} 
                                alt={`Screenshot ${idx + 1}`} 
                                className="screenmerch-preview"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain'
                                }}
                            />
                            <div className="screenmerch-buttons">
                                <button className="screenmerch-delete-btn" onClick={() => onDeleteScreenshot(idx)} title="Delete screenshot">×</button>
                            </div>
                        </div>
                    ) : (
                        <div className="screenmerch-placeholder">No screenshot</div>
                    )}
                </div>
            ))}
        </div>
    );
};
