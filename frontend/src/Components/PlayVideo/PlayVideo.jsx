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

// Simple notification component
const Notification = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div 
            className="notification"
            style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: type === 'success' ? '#4CAF50' : '#f44336',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10000,
                animation: 'slideIn 0.3s ease-out',
                maxWidth: '300px',
                fontSize: '14px',
                fontWeight: '500'
            }}
        >
            ✅ {message}
        </div>
    );
};

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
    
    // Notification state
    const [notification, setNotification] = useState(null);
    
    // Crop tool state
    const [showCropTool, setShowCropTool] = useState(false);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isSelecting, setIsSelecting] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [canvasRef] = useState(useRef(null));

    // Show notification function
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
    };

    // Hide notification function
    const hideNotification = () => {
        setNotification(null);
    };
    
    // Crop tool functions
    const toggleCropTool = () => {
        setShowCropTool(!showCropTool);
        if (showCropTool) {
            setCropArea({ x: 0, y: 0, width: 0, height: 0 });
            setIsSelecting(false);
        }
    };
    
    const handleCropMouseDown = (e) => {
        if (!showCropTool || !videoRef.current) return;
        
        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setIsSelecting(true);
        setDragStart({ x, y });
        setCropArea({ x, y, width: 0, height: 0 });
    };
    
    const handleCropMouseMove = (e) => {
        if (!showCropTool || !isSelecting || !videoRef.current) return;
        
        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const left = Math.min(dragStart.x, x);
        const top = Math.min(dragStart.y, y);
        const width = Math.abs(x - dragStart.x);
        const height = Math.abs(y - dragStart.y);
        
        setCropArea({ x: left, y: top, width, height });
    };
    
    const handleCropMouseUp = () => {
        setIsSelecting(false);
    };
    
    // Capture actual screenshot from video
    const captureScreenshot = () => {
        if (!videoRef.current) return null;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        try {
            // Set canvas size to video size
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // If crop area is selected, crop the image
            if (cropArea.width > 0 && cropArea.height > 0) {
                const scaleX = video.videoWidth / video.offsetWidth;
                const scaleY = video.videoHeight / video.offsetHeight;
                
                const cropX = cropArea.x * scaleX;
                const cropY = cropArea.y * scaleY;
                const cropWidth = cropArea.width * scaleX;
                const cropHeight = cropArea.height * scaleY;
                
                // Create new canvas for cropped image
                const croppedCanvas = document.createElement('canvas');
                const croppedCtx = croppedCanvas.getContext('2d');
                croppedCanvas.width = cropWidth;
                croppedCanvas.height = cropHeight;
                
                // Draw cropped portion
                croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                
                try {
                    return croppedCanvas.toDataURL('image/png');
                } catch (error) {
                    console.error('CORS error when creating cropped data URL:', error);
                    // Fallback: create a blob URL instead
                    return new Promise((resolve) => {
                        croppedCanvas.toBlob((blob) => {
                            const blobUrl = URL.createObjectURL(blob);
                            resolve(blobUrl);
                        }, 'image/png');
                    });
                }
            }
            
            try {
                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('CORS error when creating data URL:', error);
                // Fallback: create a blob URL instead
                return new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        const blobUrl = URL.createObjectURL(blob);
                        resolve(blobUrl);
                    }, 'image/png');
                });
            }
        } catch (error) {
            console.error('Error capturing screenshot:', error);
            return null;
        }
    };
    
    const applyCrop = async () => {
        if (!videoRef.current || !showCropTool) {
            showNotification('Please select a crop area first', 'error');
            return;
        }
        
        // Minimum size for good product quality (300x300 pixels)
        const minSize = 300;
        const scaleX = videoRef.current.videoWidth / videoRef.current.offsetWidth;
        const scaleY = videoRef.current.videoHeight / videoRef.current.offsetHeight;
        const actualWidth = cropArea.width * scaleX;
        const actualHeight = cropArea.height * scaleY;
        
        if (actualWidth < minSize || actualHeight < minSize) {
            showNotification(`Selection too small. Minimum size is ${minSize}x${minSize} pixels for good product quality.`, 'error');
            return;
        }
        
        // Capture screenshot
        const screenshotDataUrl = await captureScreenshot();
        if (screenshotDataUrl) {
            setScreenshots(prev => prev.length < 6 ? [...prev, screenshotDataUrl] : prev);
            showNotification('Cropped screenshot captured successfully!');
            setShowCropTool(false);
            setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        } else {
            showNotification('Failed to capture screenshot', 'error');
        }
    };

    useEffect(() => {
        if (!videoId) {
            setError('No video selected.');
            setLoading(false);
            return;
        }
        

        
        const fetchVideo = async () => {
            setLoading(true);
            setError('');
            console.log('Fetching video with ID:', videoId);
            let { data, error } = await supabase
                .from('videos2')
                .select('*')
                .eq('id', videoId)
                .single();
            if (error) {
                console.error('Supabase error:', error);
                setError('Video not found.');
                setVideo(null);
            } else {
                console.log('Video data fetched:', data);
                console.log('Video URL:', data.video_url);
                console.log('Video thumbnail:', data.thumbnail);
                console.log('Video poster:', data.poster);
                
                // Validate video URL
                if (!data.video_url) {
                    console.error('No video URL found in data');
                    setError('Video URL is missing.');
                    setVideo(null);
                    setLoading(false);
                    return;
                }

                setVideo(data);
                console.log('Video data loaded:', data);
                console.log('Video URL:', data.video_url);
                
                // Test if video URL is accessible
                try {
                    const response = await fetch(data.video_url, { method: 'HEAD' });
                    console.log('Video URL accessibility test:', response.status, response.statusText);
                    if (!response.ok) {
                        console.warn('Video URL may not be accessible:', response.status);
                    }
                } catch (urlError) {
                    console.warn('Could not test video URL accessibility:', urlError);
                }
                
                // Automatically set thumbnail if available
                if (data.thumbnail || data.poster) {
                    const thumbnailUrl = data.thumbnail || data.poster;
                    console.log('Setting thumbnail:', thumbnailUrl);
                    setThumbnail(thumbnailUrl);
                    // Only add thumbnail as first screenshot if screenshots are empty
                    if (setScreenshots && screenshots.length === 0) {
                        console.log('Adding thumbnail as first screenshot');
                        setScreenshots([thumbnailUrl]);
                    }
                } else {
                    console.log('No thumbnail found in video data');
                }
                // Pass video data to parent component
                if (onVideoData) {
                    onVideoData(data);
                }
            }
            setLoading(false);
        };
        fetchVideo();
        
    }, [videoId, setThumbnail, setScreenshots]);

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

    // Fast Screenshot handler - captures actual video frame
    const handleGrabScreenshot = async () => {
        console.log('Grab Screenshot clicked');
        
        if (screenshots.length >= 6) {
            showNotification('Maximum 6 screenshots allowed. Please delete some screenshots first.', 'error');
            return;
        }

        const videoElement = videoRef.current;
        if (!videoElement) {
            showNotification('Video not loaded yet. Please wait for the video to load.', 'error');
            return;
        }

        // Capture actual screenshot from current video frame
        const screenshotDataUrl = await captureScreenshot();
        
        if (screenshotDataUrl) {
            console.log('Adding actual video screenshot');
            setScreenshots(prev => prev.length < 6 ? [...prev, screenshotDataUrl] : prev);
            
            const newScreenshotCount = screenshots.length + 1;
            showNotification(`Screenshot ${newScreenshotCount} captured successfully!`);
        } else {
            showNotification('Failed to capture screenshot from video.', 'error');
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
                showNotification(`Failed to create merch product page: ${data.error || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            console.error('Make Merch error:', err);
            showNotification(`Error connecting to merch server: ${err.message}`, 'error');
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

    // Test video playback function
    const testVideoPlayback = async () => {
        if (!videoRef.current) {
            alert('Video element not found');
            return;
        }

        const video = videoRef.current;
        console.log('Testing video playback...');
        console.log('Video URL:', video.src);
        console.log('Video ready state:', video.readyState);
        console.log('Video network state:', video.networkState);
        console.log('Video paused:', video.paused);
        console.log('Video current time:', video.currentTime);
        console.log('Video duration:', video.duration);

        try {
            // Try to play the video
            await video.play();
            console.log('Video play() successful');
            alert('Video playback test successful! Video should be playing now.');
        } catch (error) {
            console.error('Video play() failed:', error);
            alert(`Video playback test failed: ${error.message}`);
        }
    };

    // Test video URL accessibility
    const testVideoUrl = async () => {
        if (!video || !video.video_url) {
            alert('No video URL to test');
            return;
        }

        console.log('Testing video URL accessibility...');
        console.log('Video URL:', video.video_url);

        try {
            // Test with HEAD request first
            const headResponse = await fetch(video.video_url, { 
                method: 'HEAD',
                mode: 'cors'
            });
            console.log('HEAD request result:', headResponse.status, headResponse.statusText);
            console.log('Content-Type:', headResponse.headers.get('content-type'));
            console.log('Content-Length:', headResponse.headers.get('content-length'));

            if (headResponse.ok) {
                alert(`✅ Video URL is accessible!\nStatus: ${headResponse.status}\nContent-Type: ${headResponse.headers.get('content-type')}`);
            } else {
                alert(`❌ Video URL not accessible\nStatus: ${headResponse.status}\nError: ${headResponse.statusText}`);
            }
        } catch (error) {
            console.error('URL test failed:', error);
            alert(`❌ Video URL test failed: ${error.message}`);
        }
    };

    // Debug database data
    const debugVideoData = () => {
        console.log('=== VIDEO DATA DEBUG ===');
        console.log('Video ID:', videoId);
        console.log('Video object:', video);
        console.log('Video URL:', video?.video_url);
        console.log('Thumbnail:', video?.thumbnail);
        console.log('Poster:', video?.poster);
        console.log('Title:', video?.title);
        console.log('Description:', video?.description);
        console.log('Created at:', video?.created_at);
        
        if (videoRef.current) {
            console.log('=== VIDEO ELEMENT DEBUG ===');
            console.log('Video element src:', videoRef.current.src);
            console.log('Video element readyState:', videoRef.current.readyState);
            console.log('Video element networkState:', videoRef.current.networkState);
            console.log('Video element paused:', videoRef.current.paused);
            console.log('Video element currentTime:', videoRef.current.currentTime);
            console.log('Video element duration:', videoRef.current.duration);
            console.log('Video element videoWidth:', videoRef.current.videoWidth);
            console.log('Video element videoHeight:', videoRef.current.videoHeight);
            console.log('Video element display:', videoRef.current.style.display);
            console.log('Video element visibility:', videoRef.current.style.visibility);
            console.log('Video element opacity:', videoRef.current.style.opacity);
            console.log('Video element zIndex:', videoRef.current.style.zIndex);
        }
        
        alert('Check console for detailed debug information');
    };

    // Force video visibility
    const forceVideoVisibility = () => {
        if (videoRef.current) {
            videoRef.current.style.display = 'block';
            videoRef.current.style.visibility = 'visible';
            videoRef.current.style.opacity = '1';
            videoRef.current.style.zIndex = '1';
            videoRef.current.style.position = 'relative';
            videoRef.current.style.width = '100%';
            videoRef.current.style.height = '360px';
            videoRef.current.style.maxWidth = '100%';
            videoRef.current.style.objectFit = 'contain';
            
            console.log('Forced video visibility');
            console.log('Video element styles:', {
                display: videoRef.current.style.display,
                visibility: videoRef.current.style.visibility,
                opacity: videoRef.current.style.opacity,
                zIndex: videoRef.current.style.zIndex,
                position: videoRef.current.style.position,
                width: videoRef.current.style.width,
                height: videoRef.current.style.height
            });
            
            alert('Video visibility forced! Check if video is now visible.');
        } else {
            alert('Video element not found');
        }
    };

    if (loading) return (
        <div style={{
            padding: 24, 
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto'
            }}></div>
            <p>Loading video...</p>
            {video && <p style={{fontSize: '14px', color: '#6c757d'}}>URL: {video.video_url}</p>}
        </div>
    );
    
    if (error || !video) return (
        <div style={{
            padding: 24, 
            color: 'red',
            background: '#f8d7da',
            borderRadius: '8px',
            border: '1px solid #f5c6cb'
        }}>
            <h3>Video Error</h3>
            <p>{error || 'Video not found.'}</p>
            {video && (
                <div style={{marginTop: '12px', fontSize: '14px'}}>
                    <p><strong>Video URL:</strong> {video.video_url}</p>
                    <p><strong>Video ID:</strong> {videoId}</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="play-video">
            <div 
                className="video-container" 
                style={{ position: 'relative', display: 'block', background: 'transparent' }}
            >
                                 {/* Crop Tool Button - Upper Left Corner */}
                 <button
                     className="crop-tool-btn"
                     onClick={toggleCropTool}
                     style={{
                         position: 'absolute',
                         top: '10px',
                         left: '10px',
                         zIndex: 1000,
                         background: showCropTool ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                         color: 'white',
                         border: '2px solid white',
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
                         transition: 'all 0.2s ease',
                         boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                     }}
                    onMouseEnter={(e) => {
                        e.target.style.background = showCropTool ? 'rgba(255, 0, 0, 1)' : 'rgba(0, 0, 0, 0.9)';
                        e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = showCropTool ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)';
                        e.target.style.transform = 'scale(1)';
                    }}
                     title={showCropTool ? "Crop Tool - Active (Click to disable)" : "Crop Tool - Click to enable"}
                >
                    ✂️
                </button>

                                 <video 
                     key={videoId}
                     ref={videoRef} 
                     controls 
                     width="100%" 
                     height="360"
                     crossOrigin="anonymous"
                     style={{
                         background: 'transparent', 
                         cursor: showCropTool ? 'crosshair' : 'default',
                         width: '100%',
                         height: '360px',
                         borderRadius: '8px',
                         objectFit: 'cover'
                     }} 
                     src={video.video_url}
                     poster={video.thumbnail || video.poster}
                     onMouseDown={showCropTool ? handleCropMouseDown : undefined}
                     onMouseMove={showCropTool ? handleCropMouseMove : undefined}
                     onMouseUp={showCropTool ? handleCropMouseUp : undefined}
                     onMouseLeave={showCropTool ? handleCropMouseUp : undefined}
                     onError={(e) => console.error('Video error:', e)}
                     onLoadStart={() => console.log('Video loading started')}
                     onCanPlay={() => {
                         console.log('Video can play');
                         setLoading(false);
                     }}
                     onLoadedData={() => {
                         console.log('Video data loaded');
                         setLoading(false);
                     }}
                     onPlay={() => console.log('Video play event fired')}
                     onPause={() => console.log('Video pause event fired')}
                     onLoadedMetadata={() => console.log('Video metadata loaded')}
                     onCanPlayThrough={() => console.log('Video can play through')}
                     onWaiting={() => console.log('Video waiting for data')}
                     onStalled={() => console.log('Video stalled')}
                     preload="metadata"
                     playsInline
                     webkit-playsinline="true"
                 >
                     Your browser does not support the video tag.
                 </video>
                 
                 {/* Hidden canvas for screenshot capture */}
                 <canvas 
                     ref={canvasRef} 
                     style={{ display: 'none' }}
                 />
                 
                 {/* Crop Selection Overlay */}
                 {showCropTool && cropArea.width > 0 && cropArea.height > 0 && (
                     <div 
                         className="crop-selection"
                         style={{
                             position: 'absolute',
                             left: cropArea.x,
                             top: cropArea.y,
                             width: cropArea.width,
                             height: cropArea.height,
                             border: '3px solid #ff0000',
                             background: 'transparent',
                             pointerEvents: 'none',
                             zIndex: 1001
                         }}
                     />
                 )}
                 
                 {/* Crop Tool Controls */}
                 {showCropTool && (
                     <div 
                         style={{
                             position: 'absolute',
                             top: '10px',
                             right: '10px',
                             background: 'rgba(255, 255, 255, 0.98)',
                             color: 'black',
                             padding: '8px',
                             borderRadius: '4px',
                             zIndex: 1002,
                             fontSize: '11px',
                             border: '1px solid rgba(0, 0, 0, 0.2)',
                             boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                             minWidth: '120px',
                             maxWidth: '150px'
                         }}
                     >
                         {cropArea.width > 0 && cropArea.height > 0 ? (
                             <div>
                                 <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                                     Size: {Math.round(cropArea.width)}x{Math.round(cropArea.height)}
                                 </div>
                                 {cropArea.width < 300 || cropArea.height < 300 ? (
                                     <div style={{color: '#d32f2f', fontSize: '10px', marginBottom: '8px'}}>
                                         ⚠️ Selection too small - need 300x300 minimum
                                     </div>
                                 ) : (
                                     <button 
                                         onClick={applyCrop}
                                         style={{
                                             background: '#4CAF50',
                                             color: 'white',
                                             border: 'none',
                                             padding: '6px 12px',
                                             borderRadius: '4px',
                                             cursor: 'pointer',
                                             fontSize: '11px',
                                             fontWeight: 'bold',
                                             width: '100%'
                                         }}
                                     >
                                         ✅ Capture Screenshot
                                     </button>
                                 )}
                             </div>
                         ) : (
                             <div style={{textAlign: 'center'}}>
                                 <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Crop Tool Active</div>
                                 <div style={{fontSize: '10px', opacity: 0.8}}>Click and drag to select area</div>
                             </div>
                         )}
                     </div>
                 )}
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
            
            {/* Notification */}
            {notification && (
                <Notification 
                    message={notification.message} 
                    type={notification.type} 
                    onClose={hideNotification} 
                />
            )}
        </div>
    )
}

export default PlayVideo

export const ScreenmerchImages = ({ thumbnail, screenshots, onDeleteScreenshot }) => {
    console.log('ScreenmerchImages: Received screenshots:', screenshots);
    console.log('ScreenmerchImages: Received thumbnail:', thumbnail);
    
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
                                onError={(e) => console.error(`Failed to load screenshot ${idx + 1}:`, e.target.src)}
                                onLoad={() => console.log(`Screenshot ${idx + 1} loaded successfully:`, screenshots[idx])}
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
