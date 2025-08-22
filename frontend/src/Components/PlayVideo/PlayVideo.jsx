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

const PlayVideo = ({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots, videoRef: propVideoRef, onVideoData }) => {
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
                
                setVideo(data);
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

    // Make Merch handler
    const handleMakeMerch = async () => {
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
            setShowAuthModal(true);
            return;
        }
        
        // User is authenticated, proceed with merch creation
        await createMerchProduct();
    };

    // Create merch product function
    const createMerchProduct = async () => {
        try {
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

    // handleAuthSuccess function to be called by AuthModal
    const handleAuthSuccess = () => {
        setShowAuthModal(false);
        // After successful authentication, try to create merch again
        createMerchProduct();
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
                ref={videoContainerRef}
                style={{ position: 'relative', display: 'inline-block' }}
            >

                                         <div style={{ 
                         position: 'relative', 
                         display: 'inline-block', 
                         width: '100%', 
                         maxWidth: '640px'
                     }}>
                                                                         <video 
                            key={videoId}
                            ref={videoRef} 
                            controls 
                            poster={video.thumbnail || ''}
                            width="100%" 
                            height="360"
                            style={{
                                background: '#000', 
                                cursor: showCropTool ? 'crosshair' : 'default',
                                width: '100%',
                                height: '360px'
                            }} 
                            src={video.video_url}
                            onMouseDown={showCropTool ? handleCropMouseDown : undefined}
                            onMouseMove={showCropTool ? handleCropMouseMove : undefined}
                            onMouseUp={showCropTool ? handleCropMouseUp : undefined}
                            onMouseLeave={showCropTool ? handleCropMouseUp : undefined}
                            onCanPlay={() => {
                                console.log('Video can play');
                                setLoading(false);
                            }}
                            onLoadedData={() => {
                                console.log('Video data loaded');
                                setLoading(false);
                            }}
                        />
                        
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
