import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import './PlayVideo.css'
import { value_converter } from '../../data'
import moment from 'moment'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { API_CONFIG } from '../../config/apiConfig'
import CropModal from '../CropModal/CropModal'
import AuthModal from '../AuthModal/AuthModal'

const PlayVideo = forwardRef(({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots, videoRef: propVideoRef, onVideoData }, ref) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const videoRef = propVideoRef || useRef(null);
    
    // Crop tool state
    const [showCropTool, setShowCropTool] = useState(false);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
    const [videoContainerRef] = useState(useRef(null));
    const [croppedImage, setCroppedImage] = useState(null);
    const [isCropApplied, setIsCropApplied] = useState(false);
    const [isApplyingCrop, setIsApplyingCrop] = useState(false);
    
    // Screenshot crop modal state
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(null);
    const [selectedScreenshotImage, setSelectedScreenshotImage] = useState(null);
    
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
        // Reset crop tool
        setShowCropTool(false);
        setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        setCroppedImage(null);
        setIsCropApplied(false);
    }, [videoId, setScreenshots]);

    // Pause video when crop tool is enabled and prevent playback during crop
    useEffect(() => {
        if (showCropTool && videoRef.current) {
            videoRef.current.pause();
            
            // Add event listener to prevent playback during crop
            const handlePlay = () => {
                if (showCropTool) {
                    videoRef.current.pause();
                }
            };
            
            // Prevent clicking on video from playing it
            const handleClick = (e) => {
                if (showCropTool) {
                    e.preventDefault();
                    e.stopPropagation();
                    videoRef.current.pause();
                }
            };
            
            videoRef.current.addEventListener('play', handlePlay);
            videoRef.current.addEventListener('click', handleClick);
            
            return () => {
                if (videoRef.current) {
                    videoRef.current.removeEventListener('play', handlePlay);
                    videoRef.current.removeEventListener('click', handleClick);
                }
            };
        }
    }, [showCropTool]);

    // Cleanup function to restore scrolling when component unmounts
    useEffect(() => {
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Maintain video size when crop tool state changes
    useEffect(() => {
        if (videoRef.current) {
            const video = videoRef.current;
            // Force video to maintain its exact size
            video.style.width = '100%';
            video.style.height = '360px';
            video.style.minWidth = '100%';
            video.style.minHeight = '360px';
            video.style.maxWidth = '100%';
            video.style.maxHeight = '360px';
            video.style.objectFit = 'contain';
            video.style.transition = 'none';
            video.style.flexShrink = '0';
            video.style.flexGrow = '0';
            
            // Also ensure the container maintains size
            const container = video.parentElement;
            if (container) {
                container.style.height = '360px';
                container.style.minHeight = '360px';
                container.style.maxHeight = '360px';
                container.style.transition = 'none';
                container.style.flexShrink = '0';
                container.style.flexGrow = '0';
            }
        }
    }, [showCropTool]);

    const handleCropMouseDown = (e) => {
        if (!showCropTool || !videoRef.current) return;
        
        // Prevent video from playing
        e.preventDefault();
        e.stopPropagation();
        
        // Ensure video stays paused
        if (videoRef.current) {
            videoRef.current.pause();
        }
        
        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        console.log('Crop mouse down at:', { x, y });
        
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setCropArea({ x, y, width: 0, height: 0 });
    };

    const handleCropMouseMove = (e) => {
        if (!showCropTool || !isSelecting || !videoRef.current) return;
        
        // Prevent video from playing
        e.preventDefault();
        e.stopPropagation();
        
        // Ensure video stays paused during selection
        if (videoRef.current) {
            videoRef.current.pause();
        }
        
        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const width = Math.abs(x - selectionStart.x);
        const height = Math.abs(y - selectionStart.y);
        const left = Math.min(x, selectionStart.x);
        const top = Math.min(y, selectionStart.y);
        
        const newCropArea = { x: left, y: top, width, height };
        console.log('Crop area updated:', newCropArea);
        setCropArea(newCropArea);
    };

    const handleCropMouseUp = () => {
        setIsSelecting(false);
        // Ensure video stays paused after selection
        if (videoRef.current) {
            videoRef.current.pause();
        }
        console.log('Crop selection finished. Final crop area:', cropArea);
    };

    // Touch counterparts to prevent page scroll on mobile during crop
    const handleCropTouchStart = (e) => {
        if (!showCropTool || !videoRef.current) return;
        if (!e.touches || e.touches.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.pause();
        }
        const touch = e.touches[0];
        const rect = videoRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setCropArea({ x, y, width: 0, height: 0 });
    };

    const handleCropTouchMove = (e) => {
        if (!showCropTool || !isSelecting || !videoRef.current) return;
        if (!e.touches || e.touches.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.pause();
        }
        const touch = e.touches[0];
        const rect = videoRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const width = Math.abs(x - selectionStart.x);
        const height = Math.abs(y - selectionStart.y);
        const left = Math.min(x, selectionStart.x);
        const top = Math.min(y, selectionStart.y);
        setCropArea({ x: left, y: top, width, height });
    };

    const handleCropTouchEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSelecting(false);
        if (videoRef.current) {
            videoRef.current.pause();
        }
    };

    const resetCropSelection = () => {
        setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        setCroppedImage(null);
        setIsCropApplied(false);
    };

    const applyCrop = async () => {
        console.log('Apply crop called with cropArea:', cropArea);
        if (!videoRef.current || !showCropTool) {
            alert('Please enable crop tool first');
            return;
        }
        
        // Minimum crop size for good print quality (at least 150x150 pixels)
        if (cropArea.width < 150 || cropArea.height < 150) {
            alert('Please select a larger crop area (minimum 150x150 pixels for good print quality and proper aspect ratio)');
            return;
        }

        // Show loading state
        setIsApplyingCrop(true);

        try {
            const currentTime = videoRef.current.currentTime || 0;
            const videoUrl = video.video_url;
            
            // Get the video element and its actual dimensions
            const videoElement = videoRef.current;
            
            // Wait for video metadata to load if not already loaded
            if (videoElement.readyState < 1) {
                await new Promise((resolve) => {
                    videoElement.addEventListener('loadedmetadata', resolve, { once: true });
                });
            }
            
            // Get actual video dimensions (not display dimensions)
            const videoWidth = videoElement.videoWidth;
            const videoHeight = videoElement.videoHeight;
            
            // Get the display dimensions (what user sees)
            const displayRect = videoElement.getBoundingClientRect();
            const displayWidth = displayRect.width;
            const displayHeight = displayRect.height;
            
            console.log('Video actual dimensions:', { videoWidth, videoHeight });
            console.log('Video display dimensions:', { displayWidth, displayHeight });
            console.log('Crop area (display pixels):', cropArea);
            
            // Calculate scale factors between display and actual video
            const scaleX = videoWidth / displayWidth;
            const scaleY = videoHeight / displayHeight;
            
            console.log('Scale factors:', { scaleX, scaleY });
            
            // Convert display coordinates to actual video coordinates
            const videoCropArea = {
                x: Math.round(cropArea.x * scaleX),
                y: Math.round(cropArea.y * scaleY),
                width: Math.round(cropArea.width * scaleX),
                height: Math.round(cropArea.height * scaleY)
            };
            
            // Ensure crop area is within video bounds
            videoCropArea.x = Math.max(0, Math.min(videoCropArea.x, videoWidth - 1));
            videoCropArea.y = Math.max(0, Math.min(videoCropArea.y, videoHeight - 1));
            videoCropArea.width = Math.max(1, Math.min(videoCropArea.width, videoWidth - videoCropArea.x));
            videoCropArea.height = Math.max(1, Math.min(videoCropArea.height, videoHeight - videoCropArea.y));
            
            // Convert to normalized coordinates (0-1)
            const normalizedCropArea = {
                x: videoCropArea.x / videoWidth,
                y: videoCropArea.y / videoHeight,
                width: videoCropArea.width / videoWidth,
                height: videoCropArea.height / videoHeight
            };
            
            console.log('Video crop area (pixels):', videoCropArea);
            console.log('Normalized crop area (0-1):', normalizedCropArea);
            
            const response = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_SCREENSHOT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    video_url: videoUrl,
                    timestamp: currentTime,
                    crop_area: normalizedCropArea
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('Crop applied successfully');
                
                // ONLY add the cropped image to screenshots - DO NOT change video player
                setScreenshots(prev => {
                    const newScreenshots = prev.length < 6 ? [...prev, result.screenshot] : prev;
                    console.log('Automatically added cropped image to screenshots');
                    return newScreenshots;
                });
                
                // Show success message
                const newScreenshotCount = screenshots.length + 1;
                alert(`Cropped screenshot ${newScreenshotCount} captured and added to grid!`);
                
                // Reset crop tool state immediately but maintain video size
                setShowCropTool(false);
                setCropArea({ x: 0, y: 0, width: 0, height: 0 });
                setIsSelecting(false);
                setSelectionStart({ x: 0, y: 0 });
                // DO NOT set cropped image or crop applied - keep video player unchanged
                setCroppedImage(null);
                setIsCropApplied(false);
                // Restore page scrolling
                document.body.style.overflow = 'auto';
                
            } else {
                console.error('Crop failed:', result.error);
                alert('Failed to apply crop: ' + result.error);
            }
        } catch (error) {
            console.error('Error applying crop:', error);
            alert('Error applying crop: ' + error.message);
        } finally {
            // Hide loading state
            setIsApplyingCrop(false);
        }
    };

    const handleCropToolToggle = () => {
        if (!showCropTool) {
            // Enable crop tool
            setShowCropTool(true);
            setCroppedImage(null);
            setIsCropApplied(false);
            // Pause video
            if (videoRef.current) {
                videoRef.current.pause();
            }
            // Prevent page scrolling when crop tool is activated
            document.body.style.overflow = 'hidden';
        } else {
            // Disable crop tool
            setShowCropTool(false);
            setCropArea({ x: 0, y: 0, width: 0, height: 0 });
            setCroppedImage(null);
            setIsCropApplied(false);
            // Restore page scrolling
            document.body.style.overflow = 'auto';
        }
    };

    // Grab Screenshot handler with crop support
    const handleGrabScreenshot = async () => {
        console.log('Grab Screenshot clicked');
        
        // Prevent page scrolling when screenshot is taken
        const currentScroll = window.scrollY;
        
        if (screenshots.length >= 6) {
            alert('Maximum 6 screenshots allowed. Please delete some screenshots first.');
            return;
        }

        // If we have a cropped image, use it directly
        if (isCropApplied && croppedImage) {
            console.log('Using cropped image for screenshot');
            setScreenshots(prev => prev.length < 6 ? [...prev, croppedImage] : prev);
            const newScreenshotCount = screenshots.length + 1;
            alert(`Cropped screenshot ${newScreenshotCount} captured successfully!`);
            // Reset crop state after successful capture
            setCroppedImage(null);
            setIsCropApplied(false);
            setShowCropTool(false);
            setCropArea({ x: 0, y: 0, width: 0, height: 0 });
            // Restore page scrolling
            document.body.style.overflow = 'auto';
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
                    crop_area: showCropTool && cropArea.width > 0 ? cropArea : null
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

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
        handleGrabScreenshot: handleGrabScreenshot
    }), [screenshots, isCropApplied, croppedImage, video, videoRef]);

    // Make Merch handler - Direct navigation to merchandise page
    const handleMakeMerch = async () => {
        try {
            // Check if user is authenticated using localStorage (consistent with AuthModal)
            const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
            
            if (!isAuthenticated) {
                // Store screenshot data for after login
                const merchData = {
                    thumbnail,
                    videoUrl: window.location.href,
                    screenshots: screenshots.slice(0, 6),
                };
                localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
                
                // Show the styled AuthModal instead of redirecting
                setShowAuthModal(true);
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
                alert(`Server returned error ${response.status}: ${errorText}`);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('✅ SUCCESS! Response data:', data);
            console.log('✅ Product URL:', data.product_url);
            
            if (data.success && data.product_url) {
                console.log('🚀 Copy 5 product URL generated:', data.product_url);
                // Show the local URL instead of redirecting for testing
                alert(`Copy 5 Product Created! Local URL: ${data.product_url}`);
                // window.location.href = data.product_url;
            } else {
                console.error('❌ Failed to create product:', data);
                alert(`Failed to create merch product page: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Make Merch error:', err);
            alert(`Error connecting to merch server: ${err.message}. Please check the console for more details.`);
        }
    };

    // Handle successful authentication - proceed with merch creation
    const handleAuthSuccess = async () => {
        // Get the pending merch data
        const pendingData = localStorage.getItem('pending_merch_data');
        if (pendingData) {
            // Clear the pending data
            localStorage.removeItem('pending_merch_data');
            
            // Proceed with merch creation directly by calling the API
            try {
                const merchData = JSON.parse(pendingData);
                console.log('Creating merch product after authentication:', merchData);
                
                const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(merchData)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success && data.product_url) {
                    console.log('Merch product created successfully, redirecting to:', data.product_url);
                    window.location.href = data.product_url;
                } else {
                    console.error('Failed to create product:', data);
                    alert(`Failed to create merch product: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error creating merch product after auth:', error);
                alert('Error creating merch product. Please try again.');
            }
        }
    };

    if (loading) return <div style={{padding: 24}}>Loading video...</div>;
    if (error || !video) return <div style={{padding: 24, color: 'red'}}>{error || 'Video not found.'}</div>;

    return (
        <div className="play-video">

            <div 
                className="video-container" 
                ref={videoContainerRef}
                style={{ position: 'relative', display: 'inline-block' }}
            >

                        <div style={{ 
                        position: 'relative', 
                        display: 'inline-block', 
                        width: '100%', 
                        maxWidth: '640px',
                        // Force fixed dimensions to prevent any size changes
                        height: '360px',
                        minHeight: '360px',
                        maxHeight: '360px',
                        // Prevent any layout shifts
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        // Disable any transitions that might cause size changes
                        transition: 'none',
                        // Ensure container never changes size
                            flexShrink: 0,
                            flexGrow: 0,
                            // Prevent scroll/pan gestures while cropping
                            touchAction: showCropTool ? 'none' : 'manipulation',
                            overscrollBehavior: 'contain'
                    }}>
                        <video 
                            key={videoId}
                            ref={videoRef} 
                            controls 
                            playsInline
                            webkit-playsinline="true"
                            disablePictureInPicture
                            controlsList="nodownload"
                            width="100%" 
                            style={{
                                background: '#000', 
                                cursor: showCropTool ? 'crosshair' : 'default',
                                width: '100%',
                                height: '360px',
                                maxWidth: '100%',
                                maxHeight: '360px',
                                minWidth: '100%',
                                minHeight: '360px',
                                // Force video to maintain exact size
                                objectFit: 'contain',
                                // Prevent any size changes
                                transition: 'none',
                                // Ensure video never changes size
                                    flexShrink: 0,
                                    flexGrow: 0,
                                    touchAction: showCropTool ? 'none' : 'manipulation'
                            }} 
                            poster={video.thumbnail || ''} 
                            src={video.video_url}
                            crossOrigin="anonymous"
                            onMouseDown={showCropTool ? handleCropMouseDown : undefined}
                            onMouseMove={showCropTool ? handleCropMouseMove : undefined}
                            onMouseUp={showCropTool ? handleCropMouseUp : undefined}
                            onMouseLeave={showCropTool ? handleCropMouseUp : undefined}
                            onClick={showCropTool ? (e) => e.preventDefault() : undefined}
                                onTouchStart={showCropTool ? handleCropTouchStart : undefined}
                                onTouchMove={showCropTool ? handleCropTouchMove : undefined}
                                onTouchEnd={showCropTool ? handleCropTouchEnd : undefined}
                        >
                            Your browser does not support the video tag.
                        </video>
                        
                        {/* Simple Crop Selection Overlay */}
                        {showCropTool && cropArea.width > 0 && cropArea.height > 0 && (
                            <div 
                                className="crop-selection"
                                style={{
                                    position: 'absolute',
                                    left: cropArea.x,
                                    top: cropArea.y,
                                    width: cropArea.width,
                                    height: cropArea.height,
                                    border: '2px solid #ff0000',
                                    background: 'rgba(255, 0, 0, 0.1)',
                                    pointerEvents: 'none',
                                    zIndex: 1000
                                }}
                            />
                        )}
                        
                                                 {/* Debug Info Overlay */}
                         {showCropTool && cropArea.width > 0 && cropArea.height > 0 && (
                             <div 
                                 style={{
                                     position: 'absolute',
                                     top: '5px',
                                     left: '5px',
                                     background: 'rgba(0, 0, 0, 0.9)',
                                     color: 'white',
                                     padding: '8px',
                                     fontSize: '12px',
                                     zIndex: 1001,
                                     fontFamily: 'monospace',
                                     borderRadius: '4px',
                                     border: '1px solid #fff'
                                 }}
                             >
                                 <div>Crop: {Math.round(cropArea.x)},{Math.round(cropArea.y)}</div>
                                 <div>Size: {Math.round(cropArea.width)}x{Math.round(cropArea.height)}</div>
                                 <div style={{ 
                                     color: cropArea.width >= 150 && cropArea.height >= 150 ? '#4CAF50' : '#FF9800',
                                     fontWeight: 'bold'
                                 }}>
                                     {cropArea.width >= 150 && cropArea.height >= 150 ? '✅ Good size' : '⚠️ Min 150x150px'}
                                 </div>
                             </div>
                         )}
                    </div>
                
                {/* Simple Crop Tool Button */}
                <div className="crop-tool-button" style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    <button 
                        onClick={handleCropToolToggle}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: 'none',
                            background: showCropTool ? '#dc3545' : '#28a745',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                        title={showCropTool ? 'Click and drag to select crop area' : 'Enable crop tool'}
                    >
                        {showCropTool ? '✂️ Crop Active' : '✂️ Crop'}
                    </button>
                    
                    {showCropTool && (
                        <>
                            <button 
                                onClick={resetCropSelection}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: '#6c757d',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                                title="Clear crop selection"
                            >
                                Clear
                            </button>
                                                         <button 
                                 onClick={applyCrop}
                                 disabled={isApplyingCrop}
                                 style={{
                                     padding: '8px 12px',
                                     borderRadius: '4px',
                                     border: 'none',
                                     background: isApplyingCrop ? '#6c757d' : '#007bff',
                                     color: 'white',
                                     cursor: isApplyingCrop ? 'not-allowed' : 'pointer',
                                     fontSize: '14px',
                                     display: 'flex',
                                     alignItems: 'center',
                                     gap: '6px'
                                 }}
                                 title={isApplyingCrop ? 'Applying crop...' : 'Apply crop to selected screenshot'}
                             >
                                 {isApplyingCrop ? (
                                     <>
                                         <div style={{
                                             width: '12px',
                                             height: '12px',
                                             border: '2px solid #ffffff',
                                             borderTop: '2px solid transparent',
                                             borderRadius: '50%',
                                             animation: 'spin 1s linear infinite'
                                         }} />
                                         Processing...
                                     </>
                                 ) : (
                                     'Apply Crop'
                                 )}
                             </button>
                        </>
                    )}
                </div>
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
            <hr />
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
});

export default PlayVideo



export const ScreenmerchImages = ({ thumbnail, screenshots, onDeleteScreenshot, onCropScreenshot }) => {
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(null);
    const [selectedScreenshotImage, setSelectedScreenshotImage] = useState(null);

    const handleScreenshotClick = (idx) => {
        if (screenshots[idx]) {
            setSelectedScreenshotIndex(idx);
            setSelectedScreenshotImage(screenshots[idx]);
            setShowCropModal(true);
        }
    };

    const handleCropComplete = (croppedImageUrl) => {
        if (selectedScreenshotIndex !== null && onCropScreenshot) {
            onCropScreenshot(selectedScreenshotIndex, croppedImageUrl);
        }
        setShowCropModal(false);
        setSelectedScreenshotIndex(null);
        setSelectedScreenshotImage(null);
    };

    const handleCropCancel = () => {
        setShowCropModal(false);
        setSelectedScreenshotIndex(null);
        setSelectedScreenshotImage(null);
    };

    return (
        <>
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
                                        objectFit: 'contain',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleScreenshotClick(idx)}
                                    title="Click to crop this screenshot"
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

            {/* Crop Modal */}
            <CropModal
                isOpen={showCropModal}
                image={selectedScreenshotImage}
                onCrop={handleCropComplete}
                onCancel={handleCropCancel}
            />
        </>
    );
};
