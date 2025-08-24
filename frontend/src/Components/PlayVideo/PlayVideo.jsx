import React, { useEffect, useState, useRef, useCallback } from 'react'
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

const PlayVideo = ({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots, videoRef: propVideoRef, onVideoData, onScreenshotFunction }) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const videoRef = propVideoRef || useRef(null);
    
    // Video container ref
    const [videoContainerRef] = useState(useRef(null));
    
    // Auth modal state
    const [showAuthModal, setShowAuthModal] = useState(false);
    
    // Crop tool state
    const [isCropMode, setIsCropMode] = useState(false);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
    const cropContainerRef = useRef(null);

    // Minimum crop size (20% of video dimensions)
    const MIN_CROP_WIDTH = 0.2;
    const MIN_CROP_HEIGHT = 0.2;

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
    }, [videoId, setScreenshots]);

    // Update video dimensions when video loads
    useEffect(() => {
        const updateVideoDimensions = () => {
            if (videoRef.current) {
                const rect = videoRef.current.getBoundingClientRect();
                setVideoDimensions({
                    width: rect.width,
                    height: rect.height
                });
            }
        };

        const videoElement = videoRef.current;
        if (videoElement) {
            videoElement.addEventListener('loadedmetadata', updateVideoDimensions);
            videoElement.addEventListener('resize', updateVideoDimensions);
            
            // Initial update
            updateVideoDimensions();
        }

        return () => {
            if (videoElement) {
                videoElement.removeEventListener('loadedmetadata', updateVideoDimensions);
                videoElement.removeEventListener('resize', updateVideoDimensions);
            }
        };
    }, [videoRef]);

    // Initialize crop area when entering crop mode
    useEffect(() => {
        if (isCropMode && videoDimensions.width > 0 && videoDimensions.height > 0) {
            const minWidth = videoDimensions.width * MIN_CROP_WIDTH;
            const minHeight = videoDimensions.height * MIN_CROP_HEIGHT;
            
            // Set initial crop area to center with minimum size
            setCropArea({
                x: (videoDimensions.width - minWidth) / 2,
                y: (videoDimensions.height - minHeight) / 2,
                width: minWidth,
                height: minHeight
            });
        }
    }, [isCropMode, videoDimensions]);

    // Mouse event handlers for crop tool
    const handleMouseDown = useCallback((e) => {
        if (!isCropMode) return;
        
        const rect = cropContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setIsDragging(true);
        setDragStart({ x, y });
        
        // Update crop area to start from this point
        setCropArea(prev => ({
            ...prev,
            x,
            y,
            width: 0,
            height: 0
        }));
    }, [isCropMode]);

    const handleMouseMove = useCallback((e) => {
        if (!isCropMode || !isDragging) return;
        
        const rect = cropContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;
        
        // Calculate new crop area
        let newX = dragStart.x;
        let newY = dragStart.y;
        let newWidth = Math.abs(deltaX);
        let newHeight = Math.abs(deltaY);
        
        // Handle negative drag (dragging left/up)
        if (deltaX < 0) {
            newX = x;
            newWidth = Math.abs(deltaX);
        }
        if (deltaY < 0) {
            newY = y;
            newHeight = Math.abs(deltaY);
        }
        
        // Apply minimum size constraints
        const minWidth = videoDimensions.width * MIN_CROP_WIDTH;
        const minHeight = videoDimensions.height * MIN_CROP_HEIGHT;
        
        if (newWidth < minWidth) {
            newWidth = minWidth;
            if (deltaX < 0) {
                newX = x - minWidth;
            }
        }
        if (newHeight < minHeight) {
            newHeight = minHeight;
            if (deltaY < 0) {
                newY = y - minHeight;
            }
        }
        
        // Constrain to video boundaries
        newX = Math.max(0, Math.min(newX, videoDimensions.width - newWidth));
        newY = Math.max(0, Math.min(newY, videoDimensions.height - newHeight));
        
        setCropArea({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
        });
    }, [isCropMode, isDragging, dragStart, videoDimensions]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Touch event handlers for mobile
    const handleTouchStart = useCallback((e) => {
        if (!isCropMode) return;
        e.preventDefault();
        
        const rect = cropContainerRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        setIsDragging(true);
        setDragStart({ x, y });
        
        // Update crop area to start from this point
        setCropArea(prev => ({
            ...prev,
            x,
            y,
            width: 0,
            height: 0
        }));
    }, [isCropMode]);

    const handleTouchMove = useCallback((e) => {
        if (!isCropMode || !isDragging) return;
        e.preventDefault();
        
        const rect = cropContainerRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;
        
        // Calculate new crop area
        let newX = dragStart.x;
        let newY = dragStart.y;
        let newWidth = Math.abs(deltaX);
        let newHeight = Math.abs(deltaY);
        
        // Handle negative drag (dragging left/up)
        if (deltaX < 0) {
            newX = x;
            newWidth = Math.abs(deltaX);
        }
        if (deltaY < 0) {
            newY = y;
            newHeight = Math.abs(deltaY);
        }
        
        // Apply minimum size constraints
        const minWidth = videoDimensions.width * MIN_CROP_WIDTH;
        const minHeight = videoDimensions.height * MIN_CROP_HEIGHT;
        
        if (newWidth < minWidth) {
            newWidth = minWidth;
            if (deltaX < 0) {
                newX = x - minWidth;
            }
        }
        if (newHeight < minHeight) {
            newHeight = minHeight;
            if (deltaY < 0) {
                newY = y - minHeight;
            }
        }
        
        // Constrain to video boundaries
        newX = Math.max(0, Math.min(newX, videoDimensions.width - newWidth));
        newY = Math.max(0, Math.min(newY, videoDimensions.height - newHeight));
        
        setCropArea({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
        });
    }, [isCropMode, isDragging, dragStart, videoDimensions]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Add/remove event listeners
    useEffect(() => {
        if (isCropMode && cropContainerRef.current) {
            const container = cropContainerRef.current;
            
            // Mouse events
            container.addEventListener('mousedown', handleMouseDown);
            container.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            // Touch events
            container.addEventListener('touchstart', handleTouchStart, { passive: false });
            container.addEventListener('touchmove', handleTouchMove, { passive: false });
            container.addEventListener('touchend', handleTouchEnd);
            
            return () => {
                container.removeEventListener('mousedown', handleMouseDown);
                container.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                container.removeEventListener('touchstart', handleTouchStart);
                container.removeEventListener('touchmove', handleTouchMove);
                container.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [isCropMode, handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

    // Crop tool functions
    const startCropMode = () => {
        console.log('=== STARTING CROP MODE ===');
        setIsCropMode(true);
        console.log('Crop mode set to:', true);
    };

    const cancelCropMode = () => {
        console.log('=== CANCELLING CROP MODE ===');
        setIsCropMode(false);
        setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        console.log('Crop mode cancelled');
    };

    const applyCrop = async () => {
        console.log('=== APPLYING CROP ===');
        console.log('Crop area:', cropArea);
        
        if (!videoRef.current || cropArea.width === 0 || cropArea.height === 0) {
            console.log('Invalid crop area or video not ready');
            return;
        }

        try {
            console.log('Creating canvas for crop...');
            // Create a canvas to capture the cropped area
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to crop dimensions
            canvas.width = cropArea.width;
            canvas.height = cropArea.height;
            
            console.log('Canvas size set to:', canvas.width, 'x', canvas.height);
            
            // Create a temporary video element for capturing
            const tempVideo = document.createElement('video');
            tempVideo.src = video.video_url;
            tempVideo.currentTime = videoRef.current.currentTime;
            
            console.log('Loading temporary video...');
            await new Promise((resolve) => {
                tempVideo.addEventListener('loadeddata', resolve, { once: true });
                tempVideo.load();
            });
            
            console.log('Drawing cropped area to canvas...');
            // Draw the cropped portion to canvas
            ctx.drawImage(
                tempVideo,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );
            
            // Convert to data URL
            const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
            
            console.log('Cropped image created, length:', croppedImageData.length);
            
            // Add to screenshots
            if (setScreenshots && screenshots.length < 6) {
                setScreenshots(prev => [...prev, croppedImageData]);
                showGreenFlagConfirmation();
                console.log('Cropped image added to screenshots');
            }
            
            // Exit crop mode
            setIsCropMode(false);
            setCropArea({ x: 0, y: 0, width: 0, height: 0 });
            console.log('Crop mode exited');
            
        } catch (error) {
            console.error('Error applying crop:', error);
            alert('Failed to crop image. Please try again.');
        }
    };

    // Create a function that can be called from parent component
    const captureScreenshotFromParent = async () => {
        console.log('Capture screenshot called from parent component');
        
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

        // Capture a new screenshot
        const videoElement = videoRef.current;
        if (!videoElement) {
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

        // Use client-side capture as primary method
        console.log('Attempting client-side capture from parent...');
        const clientScreenshot = await captureCurrentVideoFrame();
        
        if (clientScreenshot) {
            console.log('✅ Client-side screenshot captured successfully from parent');
            setScreenshots(prev => prev.length < 6 ? [...prev, clientScreenshot] : prev);
            showGreenFlagConfirmation();
        } else {
            console.log('❌ Client-side capture failed, trying server-side...');
            
            // Fallback to server-side capture
            try {
                const currentTime = videoElement.currentTime || 0;
                const videoUrl = video?.video_url || videoElement.src;
                
                if (!videoUrl) {
                    throw new Error('No video URL available');
                }
                
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
                    console.log('✅ Server-side screenshot captured successfully');
                    setScreenshots(prev => prev.length < 6 ? [...prev, result.screenshot] : prev);
                    showGreenFlagConfirmation();
                } else {
                    throw new Error(result.error || 'Server failed to capture screenshot');
                }
                
            } catch (error) {
                console.log('❌ Server capture failed, using thumbnail as last resort:', error);
                
                // Last resort: use thumbnail
                const thumbnailUrl = video?.thumbnail || video?.poster || videoElement.poster;
                
                if (thumbnailUrl) {
                    console.log('Using thumbnail as last resort:', thumbnailUrl);
                    setScreenshots(prev => prev.length < 6 ? [...prev, thumbnailUrl] : prev);
                    showGreenFlagConfirmation();
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
                    notification.textContent = 'Failed to capture screenshot. Please try again.';
                    document.body.appendChild(notification);
                    setTimeout(() => document.body.removeChild(notification), 3000);
                }
            }
        }
    };

    // Pass the screenshot function to parent component
    useEffect(() => {
        if (onScreenshotFunction && video && !loading) {
            console.log('Passing screenshot function to parent component');
            onScreenshotFunction(captureScreenshotFromParent);
        }
    }, [onScreenshotFunction, video, loading]);

    // Grab Screenshot handler for the button in PlayVideo
    const handleGrabScreenshot = async () => {
        console.log('Grab Screenshot clicked from PlayVideo button');
        await captureScreenshotFromParent();
    };

    // Client-side video frame capture function
    const captureCurrentVideoFrame = async () => {
        const videoElement = videoRef.current;
        if (!videoElement) {
            console.error('Video element not found');
            return null;
        }

        try {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match video display size
            const videoRect = videoElement.getBoundingClientRect();
            canvas.width = videoRect.width;
            canvas.height = videoRect.height;
            
            // Ensure video is loaded and ready
            if (videoElement.readyState < 2) {
                console.log('Video not ready, waiting for loadeddata event');
                await new Promise((resolve) => {
                    const handleLoadedData = () => {
                        videoElement.removeEventListener('loadeddata', handleLoadedData);
                        resolve();
                    };
                    videoElement.addEventListener('loadeddata', handleLoadedData);
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        videoElement.removeEventListener('loadeddata', handleLoadedData);
                        resolve();
                    }, 5000);
                });
            }
            
            // Draw the current video frame to canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Convert to data URL with high quality
            const screenshotData = canvas.toDataURL('image/jpeg', 0.9);
            
            console.log('Client-side screenshot captured successfully');
            return screenshotData;
            
        } catch (error) {
            console.error('Error capturing video frame:', error);
            return null;
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

    // Green flag confirmation function
    const showGreenFlagConfirmation = () => {
        const newScreenshotCount = screenshots.length + 1;
        // Use the same notification style as Video.jsx
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
                            width: '100%',
                            height: '360px'
                        }} 
                        src={video.video_url}
                        onCanPlay={() => {
                            console.log('Video can play');
                            setLoading(false);
                        }}
                        onLoadedData={() => {
                            console.log('Video data loaded');
                            setLoading(false);
                        }}
                    />
                    
                    {/* Crop Tool Overlay */}
                    {isCropMode && (
                        <div 
                            ref={cropContainerRef}
                            className="crop-overlay"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'crosshair',
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                zIndex: 1000
                            }}
                        >
                            {/* Crop Area Selection */}
                            {cropArea.width > 0 && cropArea.height > 0 && (
                                <div
                                    className="crop-selection"
                                    style={{
                                        position: 'absolute',
                                        left: cropArea.x,
                                        top: cropArea.y,
                                        width: cropArea.width,
                                        height: cropArea.height,
                                        border: '2px solid #ff0000',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                        pointerEvents: 'none'
                                    }}
                                />
                            )}
                            
                            {/* Crop Instructions */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'rgba(0, 0, 0, 0.8)',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    pointerEvents: 'none'
                                }}
                            >
                                Drag to select crop area (minimum 20% of video size)
                            </div>
                        </div>
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
                    onClick={startCropMode}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: isCropMode ? '#dc3545' : '#ff6b35',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {isCropMode ? 'Exit Crop' : 'Crop Tool'}
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

            {/* Crop Tool Controls */}
            {isCropMode && (
                <div className="crop-controls" style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '15px',
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6'
                }}>
                    <button 
                        onClick={applyCrop}
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
                        Apply Crop
                    </button>
                    <button 
                        onClick={cancelCropMode}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Cancel
                    </button>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#6c757d'
                    }}>
                        <span>Crop Size: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}</span>
                        <span>Min: {Math.round(videoDimensions.width * MIN_CROP_WIDTH)} × {Math.round(videoDimensions.height * MIN_CROP_HEIGHT)}</span>
                    </div>
                </div>
            )}
            
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
