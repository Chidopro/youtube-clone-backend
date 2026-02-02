import React, { useEffect, useState, useRef, useCallback } from 'react'
import './PlayVideo.css'
import { value_converter } from '../../data'
import moment from 'moment'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { API_CONFIG } from '../../config/apiConfig'
import { UserService } from '../../utils/userService'
import AuthModal from '../AuthModal/AuthModal'

// Mobile detection hook
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isMobilePortrait, setIsMobilePortrait] = useState(false);
    
    useEffect(() => {
        const checkIsMobile = () => {
            const mobile = window.innerWidth <= 768;
            const portrait = mobile && window.innerHeight > window.innerWidth;
            setIsMobile(mobile);
            setIsMobilePortrait(portrait);
        };
        
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        window.addEventListener('orientationchange', checkIsMobile);
        
        return () => {
            window.removeEventListener('resize', checkIsMobile);
            window.removeEventListener('orientationchange', checkIsMobile);
        };
    }, []);
    
    return { isMobile, isMobilePortrait };
};

const PlayVideo = ({ videoId: propVideoId, thumbnail, setThumbnail, screenshots, setScreenshots, videoRef: propVideoRef, onVideoData, onScreenshotFunction, onVideoPlayed, onMakeMerch }) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const { isMobile, isMobilePortrait } = useIsMobile();
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [videoError, setVideoError] = useState(null);
    const videoRef = propVideoRef || useRef(null);
    
    // Video container ref
    const [videoContainerRef] = useState(useRef(null));
    
    // Track if video has been played
    const [videoHasPlayed, setVideoHasPlayed] = useState(false);
    
    // Auth modal state
    const [showAuthModal, setShowAuthModal] = useState(false);
    
    // Check authentication state on component mount
    useEffect(() => {
        const isAuthenticated = localStorage.getItem('user_authenticated');
        const googleAuthenticated = localStorage.getItem('isAuthenticated');
        const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');
        
        console.log('🔄 PlayVideo mounted - Auth check:', {
            user_authenticated: isAuthenticated,
            isAuthenticated: googleAuthenticated,
            isLoggedIn: isLoggedIn,
            allLocalStorage: Object.keys(localStorage).filter(key => key.includes('auth') || key.includes('user'))
        });
        
        // If user is authenticated, close any open auth modal
        if (isLoggedIn && showAuthModal) {
            console.log('✅ User is authenticated, closing auth modal');
            setShowAuthModal(false);
        }
    }, [showAuthModal]);
    
    // Ref to track if screenshot function has been passed to prevent loops
    const screenshotFunctionPassedRef = useRef(false);
    
    // Screenshot protection state
    const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
    const [lastAlertTime, setLastAlertTime] = useState(0);
    
    // Inline crop tool state
    const [isCropMode, setIsCropMode] = useState(false);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Screenshot timestamps state
    const [screenshotTimestamps, setScreenshotTimestamps] = useState([]);
    
    // Safe alert function to prevent rapid-fire alerts - DISABLED TO STOP LOOPS
    const safeAlert = useCallback((message) => {
        // DISABLED TO STOP ENDLESS LOOPS
        return;
    }, []);

    // Configure video for mobile inline playback
    useEffect(() => {
        if (videoRef.current && isMobile) {
            const video = videoRef.current;
            
            // Set attributes for mobile inline playback
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.setAttribute('x-webkit-airplay', 'allow');
            video.setAttribute('preload', 'metadata');
            
            // Prevent fullscreen on mobile
            video.addEventListener('webkitbeginfullscreen', (e) => {
                e.preventDefault();
                video.webkitExitFullscreen();
            });
            
            video.addEventListener('webkitendfullscreen', (e) => {
                e.preventDefault();
            });
            
            // Ensure video stays inline
            const preventFullscreen = (e) => {
                if (video.webkitPresentationMode === 'fullscreen') {
                    video.webkitSetPresentationMode('inline');
                }
            };
            
            video.addEventListener('webkitpresentationmodechanged', preventFullscreen);
            
            return () => {
                video.removeEventListener('webkitbeginfullscreen', preventFullscreen);
                video.removeEventListener('webkitendfullscreen', preventFullscreen);
                video.removeEventListener('webkitpresentationmodechanged', preventFullscreen);
            };
        }
    }, [isMobile, videoRef.current]);
    


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
                console.error('Supabase error:', error);
                setError('Video not found.');
                setVideo(null);
            } else {
                // console.log('Video data fetched:', data);
                // console.log('Video URL:', data.video_url);
                // console.log('Video thumbnail:', data.thumbnail);
                // console.log('Video poster:', data.poster);
                
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
                    // console.log('Video URL accessibility test:', response.status, response.statusText);
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
                    // console.log('Setting thumbnail:', thumbnailUrl);
                    setThumbnail(thumbnailUrl);
                    // Only add thumbnail as first screenshot if screenshots are empty
                    if (setScreenshots && screenshots.length === 0) {
                        // console.log('Adding thumbnail as first screenshot');
                        setScreenshots([thumbnailUrl]);
                    }
                } else {
                    // console.log('No thumbnail found in video data');
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
        // Clear screenshot timestamps when video changes
        setScreenshotTimestamps([]);
        // Reset capturing state and alert timer
        setIsCapturingScreenshot(false);
        setLastAlertTime(0);
        // Reset screenshot function passed flag
        screenshotFunctionPassedRef.current = false;
        // Clear video errors when video changes
        setVideoError(null);
        // Reset video played state when video changes
        setVideoHasPlayed(false);
    }, [videoId, setScreenshots]);

    // Listen for video play event using addEventListener for reliability
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        const handlePlay = () => {
            if (!videoHasPlayed) {
                console.log('Video play event detected - activating step 2 red pulse');
                setVideoHasPlayed(true);
                // Safely call onVideoPlayed if it exists (capture current value)
                const callback = onVideoPlayed;
                if (typeof callback === 'function') {
                    callback();
                }
            }
        };
        
        videoElement.addEventListener('play', handlePlay);
        
        return () => {
            videoElement.removeEventListener('play', handlePlay);
        };
    }, [videoRef, videoHasPlayed, onVideoPlayed]);







    // Create a function that can be called from parent component
    // Note: This function is memoized to prevent endless loops when passed to parent
    const captureScreenshotFromParent = useCallback(async () => {
        // console.log('Capture screenshot called from parent component');
        
        // Get current screenshots length from state
        const currentScreenshotsLength = screenshots.length;
        if (currentScreenshotsLength >= 6) {
            safeAlert('Maximum 6 screenshots allowed. Please delete some screenshots first.');
            return;
        }

        // Capture a new screenshot
        const videoElement = videoRef.current;
        if (!videoElement) {
            safeAlert('Video not loaded yet. Please wait for the video to load.');
            return;
        }

        // Get current timestamp
        const currentTime = videoElement.currentTime || 0;
        const videoUrl = video?.video_url || videoElement.src;

        // Step 1: Instant client-side capture for immediate feedback
        const clientScreenshot = await captureCurrentVideoFrame();
        
        if (clientScreenshot) {
            // Add client-side screenshot immediately for instant response
            const tempIndex = screenshots.length;
            setScreenshots(prev => {
                const newScreenshots = prev.length < 6 ? [...prev, clientScreenshot] : prev;
                showGreenFlagConfirmation(prev.length);
                return newScreenshots;
            });
            setScreenshotTimestamps(prev => {
                return prev.length < 6 ? [...prev, currentTime] : prev;
            });
            
            // Step 2: Upgrade to print quality in the background (non-blocking)
            if (videoUrl) {
                // Mark upgrade as starting in localStorage so Tools page knows
                try {
                    const raw = localStorage.getItem('pending_merch_data');
                    if (raw) {
                        const data = JSON.parse(raw);
                        data.print_quality_upgrade_timestamp = Date.now();
                        delete data.print_quality_upgrade_failed; // Clear any previous failure
                        localStorage.setItem('pending_merch_data', JSON.stringify(data));
                        window.dispatchEvent(new Event('localStorageUpdated'));
                    }
                } catch (e) {
                    console.warn('Failed to mark upgrade as starting:', e);
                }
                
                // Don't await - let it run in background and replace when ready
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    console.warn('⚠️ Print quality upgrade timed out after 60 seconds');
                    // Mark upgrade as failed in localStorage so Tools page knows
                    try {
                        const raw = localStorage.getItem('pending_merch_data');
                        if (raw) {
                            const data = JSON.parse(raw);
                            data.print_quality_upgrade_failed = true;
                            localStorage.setItem('pending_merch_data', JSON.stringify(data));
                            window.dispatchEvent(new Event('localStorageUpdated'));
                        }
                    } catch (e) {
                        console.warn('Failed to mark upgrade as failed:', e);
                    }
                }, 60000); // 60 second timeout
                
                fetch(API_CONFIG.ENDPOINTS.CAPTURE_PRINT_QUALITY, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        video_url: videoUrl,
                        timestamp: currentTime,
                        print_dpi: 300
                    }),
                    signal: controller.signal
                })
                .then(response => {
                    clearTimeout(timeoutId);
                    if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
                    return response.json();
                })
                .then(result => {
                    if (result.success && result.screenshot) {
                        // Replace client-side screenshot with print quality version
                        setScreenshots(prev => {
                            const updated = [...prev];
                            if (updated[tempIndex]) {
                                updated[tempIndex] = result.screenshot;
                            }
                            return updated;
                        });
                        
                        // Also update localStorage so Tools page gets the upgraded version
                        try {
                            const raw = localStorage.getItem('pending_merch_data');
                            if (raw) {
                                const data = JSON.parse(raw);
                                if (data.screenshots && Array.isArray(data.screenshots) && data.screenshots[tempIndex]) {
                                    data.screenshots[tempIndex] = result.screenshot;
                                    // Also update selected_screenshot if this is the selected one
                                    if (data.selected_screenshot === clientScreenshot) {
                                        data.selected_screenshot = result.screenshot;
                                    }
                                    // Clear upgrade failure flag if it exists
                                    delete data.print_quality_upgrade_failed;
                                    delete data.print_quality_upgrade_timestamp;
                                    localStorage.setItem('pending_merch_data', JSON.stringify(data));
                                    // Trigger custom event for same-tab updates (storage event only fires cross-tab)
                                    window.dispatchEvent(new Event('localStorageUpdated'));
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to update localStorage with print quality screenshot:', e);
                        }
                        
                        console.log('✅ Screenshot upgraded to print quality and saved to localStorage');
                    } else {
                        throw new Error(result.error || 'Server failed to capture print quality screenshot');
                    }
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        console.warn('⚠️ Print quality upgrade aborted (timeout)');
                    } else {
                        console.warn('⚠️ Print quality upgrade failed, keeping client-side capture:', error);
                    }
                    // Mark upgrade as failed in localStorage so Tools page knows
                    try {
                        const raw = localStorage.getItem('pending_merch_data');
                        if (raw) {
                            const data = JSON.parse(raw);
                            data.print_quality_upgrade_failed = true;
                            data.print_quality_upgrade_timestamp = Date.now();
                            localStorage.setItem('pending_merch_data', JSON.stringify(data));
                            window.dispatchEvent(new Event('localStorageUpdated'));
                        }
                    } catch (e) {
                        console.warn('Failed to mark upgrade as failed:', e);
                    }
                    // Keep the client-side capture - it's better than nothing
                });
            }
            return; // Success with instant capture
        }
        
        // Fallback: If client-side capture fails, use server-side
        if (!videoUrl) {
            safeAlert('No video URL available for screenshot capture.');
            return;
        }
        
        try {
            // Try print quality first
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // Shorter timeout for responsiveness
            
            const response = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_PRINT_QUALITY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    video_url: videoUrl,
                    timestamp: currentTime,
                    print_dpi: 300
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.screenshot) {
                setScreenshots(prev => {
                    const newScreenshots = prev.length < 6 ? [...prev, result.screenshot] : prev;
                    showGreenFlagConfirmation(prev.length);
                    return newScreenshots;
                });
                setScreenshotTimestamps(prev => {
                    const newTimestamps = prev.length < 6 ? [...prev, currentTime] : newTimestamps;
                    return newTimestamps;
                });
                return;
            } else {
                throw new Error(result.error || 'Server failed to capture print quality screenshot');
            }
            
        } catch (error) {
            console.error('❌ Print quality capture failed, trying regular screenshot endpoint:', error);
            
            // Fallback to regular screenshot endpoint
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // Quick timeout
                
                const fallbackResponse = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_SCREENSHOT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        video_url: videoUrl,
                        timestamp: currentTime,
                        quality: 95
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (fallbackResponse.ok) {
                    const fallbackResult = await fallbackResponse.json();
                    
                    if (fallbackResult.success && fallbackResult.screenshot) {
                        setScreenshots(prev => {
                            const newScreenshots = prev.length < 6 ? [...prev, fallbackResult.screenshot] : prev;
                            showGreenFlagConfirmation(prev.length);
                            return newScreenshots;
                        });
                        setScreenshotTimestamps(prev => {
                            const newTimestamps = prev.length < 6 ? [...prev, currentTime] : newTimestamps;
                            return newTimestamps;
                        });
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('❌ Fallback screenshot capture also failed:', fallbackError);
            }
            
            // Last resort: use thumbnail
            const thumbnailUrl = video?.thumbnail || video?.poster || videoElement.poster;
            
            if (thumbnailUrl) {
                console.warn('⚠️ Using thumbnail as last resort - screenshot capture failed');
                setScreenshots(prev => {
                    const newScreenshots = prev.length < 6 ? [...prev, thumbnailUrl] : prev;
                    showGreenFlagConfirmation(prev.length);
                    return newScreenshots;
                });
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
    }, [video, videoRef, setScreenshots]);

    // Pass the screenshot function to parent component
    useEffect(() => {
        if (onScreenshotFunction && video && !loading && !screenshotFunctionPassedRef.current) {
            // console.log('Passing screenshot function to parent component');
            onScreenshotFunction(captureScreenshotFromParent);
            screenshotFunctionPassedRef.current = true;
        }
    }, [onScreenshotFunction, video, loading]);

    // Grab Screenshot handler for the button in PlayVideo
    const handleGrabScreenshot = async () => {
        // console.log('Grab Screenshot clicked from PlayVideo button');
        
        // Prevent multiple simultaneous captures
        if (isCapturingScreenshot) {
            // console.log('Screenshot capture already in progress, ignoring click');
            return;
        }
        
        // Minimal protection against rapid clicks (reduced from 1000ms to 100ms)
        const now = Date.now();
        if (now - lastAlertTime < 100) { // Prevent calls within 100ms of last alert
            // console.log('Too soon since last screenshot attempt, ignoring click');
            return;
        }
        
        // Check if we're already at max screenshots
        if (screenshots.length >= 6) {
            safeAlert('Maximum 6 screenshots allowed. Please delete some screenshots first.');
            return;
        }

        // Set capturing state to prevent multiple calls
        setIsCapturingScreenshot(true);
        
        try {
            await captureScreenshotFromParent();
        } finally {
            // Always reset capturing state
            setIsCapturingScreenshot(false);
        }
    };

    // Client-side video frame capture function
    const captureCurrentVideoFrame = useCallback(async () => {
        const videoElement = videoRef.current;
        if (!videoElement) {
            console.error('Video element not found');
            return null;
        }

        try {
            // crossOrigin is now set in JSX to avoid canvas taint issues
            
            // Quick check - if video is ready, proceed immediately
            if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                // console.log('Video ready for instant capture');
            } else {
                // console.log('Video not ready, using fallback');
                return null; // Let it fall back to server-side capture
            }
            
            // Create a canvas element
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match video display size
            const videoRect = videoElement.getBoundingClientRect();
            canvas.width = videoRect.width;
            canvas.height = videoRect.height;
            
            // No waiting - instant capture for maximum speed
            
            // Draw the current video frame to canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Convert to data URL with high quality
            const screenshotData = canvas.toDataURL('image/jpeg', 0.9);
            
            // console.log('Client-side screenshot captured successfully');
            return screenshotData;
            
        } catch (error) {
            console.error('Error capturing video frame:', error);
            return null;
        }
    }, [isMobile]);

    // Make Merch handler
    const handleMakeMerch = async () => {
        // Check if user is authenticated (check both auth types)
        const isAuthenticated = localStorage.getItem('user_authenticated');
        const googleAuthenticated = localStorage.getItem('isAuthenticated');
        const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');
        
        console.log('🛍️ Make Merch - Auth check after login:', {
            user_authenticated: isAuthenticated,
            isAuthenticated: googleAuthenticated,
            isLoggedIn: isLoggedIn,
            allLocalStorage: Object.keys(localStorage).filter(key => key.includes('auth') || key.includes('user'))
        });
        
        console.log('🛍️ Make Merch - Auth check:', {
            user_authenticated: isAuthenticated,
            isAuthenticated: googleAuthenticated,
            isLoggedIn: isLoggedIn
        });
        
        if (!isLoggedIn) {
            // Store screenshot data for after login (include timestamp for email/order)
            const currentTime = videoRef.current ? videoRef.current.currentTime || 0 : (screenshotTimestamps[0] ?? 0);
            const merchData = {
                thumbnail,
                videoUrl: video?.video_url || window.location.href,
                screenshots: screenshots.slice(0, 6),
                screenshot_timestamp: screenshotTimestamps[0] ?? currentTime,
                videoTitle: video?.title || 'Unknown Video',
                creatorName: video?.channelTitle || 'Unknown Creator'
            };
            localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
            
            // Show simple auth modal instead of redirecting to complex login page
            setShowAuthModal(true);
            return;
        }
        
        // Check if user is a creator
        const isCreator = await UserService.isCreator();
        
        if (isCreator) {
            // For creators, navigate directly to screenshot selection page (skip category selection)
            const currentTime = videoRef.current ? videoRef.current.currentTime || 0 : (screenshotTimestamps[0] ?? 0);
            const merchData = {
                thumbnail,
                videoUrl: video?.video_url || window.location.href,
                screenshots: screenshots.slice(0, 6),
                screenshot_timestamp: screenshotTimestamps[0] ?? currentTime,
                videoTitle: video?.title || 'Unknown Video',
                creatorName: video?.channelTitle || 'Unknown Creator'
            };
            localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
            localStorage.setItem('creator_favorites_mode', 'true');
            // Navigate directly to screenshot selection page in creator mode
            window.location.href = '/product/browse?category=mens&creatorMode=favorites';
            return;
        }
        
        // console.log('✅ Authenticated - proceeding with merch creation');
        // User is authenticated but not creator, use regular flow
        const currentTime = videoRef.current ? videoRef.current.currentTime || 0 : (screenshotTimestamps[0] ?? 0);
        const merchData = {
            thumbnail,
            videoUrl: video?.video_url || window.location.href,
            screenshots: screenshots.slice(0, 6),
            screenshot_timestamp: screenshotTimestamps[0] ?? currentTime,
            videoTitle: video?.title || 'Unknown Video',
            creatorName: video?.channelTitle || 'Unknown Creator'
        };
        localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
        
        await createMerchProduct();
    };
    
    // Inline crop tool functions
    const handleToggleCropMode = () => {
        setIsCropMode(!isCropMode);
        if (!isCropMode) {
            // Initialize crop area in center of video
            const videoElement = videoRef.current;
            if (videoElement) {
                const rect = videoElement.getBoundingClientRect();
                const centerX = rect.width / 2 - 100;
                const centerY = rect.height / 2 - 100;
                setCropArea({ x: centerX, y: centerY, width: 200, height: 200 });
            }
        }
    };

    const handleCropMouseDown = (e) => {
        if (!isCropMode) return;
        
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        const rect = videoElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking inside crop area
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
        }
    };

    const handleCropMouseMove = (e) => {
        if (!isCropMode || (!isDragging && !isResizing)) return;
        
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        const rect = videoElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isDragging) {
            const newX = Math.max(0, Math.min(rect.width - cropArea.width, x - dragStart.x));
            const newY = Math.max(0, Math.min(rect.height - cropArea.height, y - dragStart.y));
            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            // Handle resizing based on direction
            let newWidth = cropArea.width;
            let newHeight = cropArea.height;
            let newX = cropArea.x;
            let newY = cropArea.y;
            
            if (resizeDirection.includes('right')) {
                newWidth = Math.max(50, x - cropArea.x);
            }
            if (resizeDirection.includes('left')) {
                const maxLeft = cropArea.x + cropArea.width - 50;
                newX = Math.min(maxLeft, x);
                newWidth = cropArea.x + cropArea.width - newX;
            }
            if (resizeDirection.includes('bottom')) {
                newHeight = Math.max(50, y - cropArea.y);
            }
            if (resizeDirection.includes('top')) {
                const maxTop = cropArea.y + cropArea.height - 50;
                newY = Math.min(maxTop, y);
                newHeight = cropArea.y + cropArea.height - newY;
            }
            
            setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
        }
    };

    const handleCropMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
    };

    // Mobile touch event handlers
    const handleCropTouchStart = (e) => {
        if (!isCropMode) return;
        e.preventDefault(); // Prevent scrolling
        e.stopPropagation(); // Stop event bubbling
        
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        const touch = e.touches[0];
        const rect = videoElement.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Check if touching inside crop area
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
        }
    };

    const handleCropTouchMove = (e) => {
        if (!isCropMode || (!isDragging && !isResizing)) return;
        e.preventDefault(); // Prevent scrolling
        e.stopPropagation(); // Stop event bubbling
        
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        const touch = e.touches[0];
        const rect = videoElement.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        if (isDragging) {
            const newX = Math.max(0, Math.min(rect.width - cropArea.width, x - dragStart.x));
            const newY = Math.max(0, Math.min(rect.height - cropArea.height, y - dragStart.y));
            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            // Handle resizing based on direction
            let newWidth = cropArea.width;
            let newHeight = cropArea.height;
            let newX = cropArea.x;
            let newY = cropArea.y;
            
            if (resizeDirection.includes('right')) {
                newWidth = Math.max(50, x - cropArea.x);
            }
            if (resizeDirection.includes('left')) {
                const maxLeft = cropArea.x + cropArea.width - 50;
                newX = Math.min(maxLeft, x);
                newWidth = cropArea.x + cropArea.width - newX;
            }
            if (resizeDirection.includes('bottom')) {
                newHeight = Math.max(50, y - cropArea.y);
            }
            if (resizeDirection.includes('top')) {
                const maxTop = cropArea.y + cropArea.height - 50;
                newY = Math.min(maxTop, y);
                newHeight = cropArea.y + cropArea.height - newY;
            }
            
            setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
        }
    };

    const handleCropTouchEnd = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
    };

    const handleResizeStart = (direction, e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        setResizeDirection(direction);
    };

    const handleResizeTouchStart = (direction, e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        setResizeDirection(direction);
    };

    const handleResizeTouchMove = (e) => {
        if (!isResizing) return;
        e.preventDefault();
        e.stopPropagation();
        
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        const touch = e.touches[0];
        const rect = videoElement.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Handle resizing based on direction
        let newWidth = cropArea.width;
        let newHeight = cropArea.height;
        let newX = cropArea.x;
        let newY = cropArea.y;
        
        if (resizeDirection.includes('right')) {
            newWidth = Math.max(50, x - cropArea.x);
        }
        if (resizeDirection.includes('left')) {
            const maxLeft = cropArea.x + cropArea.width - 50;
            newX = Math.min(maxLeft, x);
            newWidth = cropArea.x + cropArea.width - newX;
        }
        if (resizeDirection.includes('bottom')) {
            newHeight = Math.max(50, y - cropArea.y);
        }
        if (resizeDirection.includes('top')) {
            const maxTop = cropArea.y + cropArea.height - 50;
            newY = Math.min(maxTop, y);
            newHeight = cropArea.y + cropArea.height - newY;
        }
        
        setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
    };

    const handleResizeTouchEnd = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setIsResizing(false);
        setResizeDirection(null);
    };

    const handleApplyCrop = async () => {
        if (!isCropMode) return;
        
        const videoElement = videoRef.current;
        if (!videoElement) return;
        
        try {
            // Try server-side screenshot capture first, but fallback to client-side if it fails
            let fullScreenshot = null;
            let useServerScreenshot = false;
            
            if (video?.video_url) {
                try {
                    const currentTime = videoElement.currentTime || 0;
                    const videoUrl = video.video_url;
                    
                    console.log(`Requesting server-side screenshot at ${currentTime}s from ${videoUrl}`);
                    
                    const response = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_PRINT_QUALITY, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            video_url: videoUrl,
                            timestamp: currentTime,
                            print_dpi: 300
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.success && result.screenshot) {
                            fullScreenshot = result.screenshot;
                            useServerScreenshot = true;
                            console.log('Server screenshot captured successfully');
                        } else {
                            console.warn('Server returned unsuccessful result:', result.error || 'Unknown error');
                        }
                    } else {
                        const errorText = await response.text();
                        console.warn(`Server error ${response.status}: ${errorText}`);
                    }
                } catch (serverError) {
                    console.warn('Server screenshot capture failed, using fallback:', serverError);
                }
            }
            
            // Fallback to client-side screenshot capture if server failed
            if (!fullScreenshot) {
                console.log('Using client-side screenshot capture as fallback');
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Get video dimensions
                const videoWidth = videoElement.videoWidth || videoElement.clientWidth;
                const videoHeight = videoElement.videoHeight || videoElement.clientHeight;
                
                // Set canvas to video dimensions
                tempCanvas.width = videoWidth;
                tempCanvas.height = videoHeight;
                
                // Draw current video frame to canvas
                tempCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
                
                // Convert to data URL
                fullScreenshot = tempCanvas.toDataURL('image/png');
                useServerScreenshot = false;
            }
            
            // Create a new canvas to crop the screenshot
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Get the display dimensions of the video
                    const displayRect = videoElement.getBoundingClientRect();
                    const displayWidth = displayRect.width;
                    const displayHeight = displayRect.height;
                    
                    // Calculate scale factors between screenshot and display
                    // If using server screenshot, it might be scaled differently
                    const scaleX = img.width / displayWidth;
                    const scaleY = img.height / displayHeight;
                    
                    // Convert display crop coordinates to screenshot coordinates
                    const screenshotCropX = Math.round(cropArea.x * scaleX);
                    const screenshotCropY = Math.round(cropArea.y * scaleY);
                    const screenshotCropWidth = Math.round(cropArea.width * scaleX);
                    const screenshotCropHeight = Math.round(cropArea.height * scaleY);
                    
                    // Ensure crop area is within image bounds
                    const finalCropX = Math.max(0, Math.min(img.width - screenshotCropWidth, screenshotCropX));
                    const finalCropY = Math.max(0, Math.min(img.height - screenshotCropHeight, screenshotCropY));
                    const finalCropWidth = Math.min(screenshotCropWidth, img.width - finalCropX);
                    const finalCropHeight = Math.min(screenshotCropHeight, img.height - finalCropY);
                    
                    // console.log('Crop coordinates:', {
                    //     display: cropArea,
                    //     screenshot: { x: finalCropX, y: finalCropY, width: finalCropWidth, height: finalCropHeight },
                    //     scale: { x: scaleX, y: scaleY },
                    //     imageSize: { width: img.width, height: img.height },
                    //     displaySize: { width: displayWidth, height: displayHeight }
                    // });
                    
                    // Set canvas size to crop area
                    canvas.width = finalCropWidth;
                    canvas.height = finalCropHeight;
                    
                    // Clear canvas
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw the cropped portion from the screenshot
                    ctx.drawImage(
                        img,
                        finalCropX, finalCropY, finalCropWidth, finalCropHeight,  // Source rectangle
                        0, 0, finalCropWidth, finalCropHeight  // Destination rectangle
                    );
                    
                    // Convert to data URL
                    const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
                    
                    // console.log('Crop successful, image size:', finalCropWidth, 'x', finalCropHeight);
                    
                    // Add to screenshots
                    setScreenshots(prev => {
                        const newScreenshots = prev.length < 6 ? [...prev, croppedImageUrl] : prev;
                        return newScreenshots;
                    });
                    
                    // Exit crop mode
                    setIsCropMode(false);
                    
                } catch (error) {
                    console.error('Error cropping screenshot:', error);
                    alert('Failed to crop image. Please try again.');
                }
            };
            
            img.onerror = () => {
                console.error('Failed to load screenshot for cropping');
                alert('Failed to load screenshot for cropping. Please try again.');
            };
            
            // Load the screenshot
            img.src = fullScreenshot;
            
        } catch (error) {
            console.error('Error applying crop:', error);
            console.error('Error details:', {
                videoElement: !!videoElement,
                videoReadyState: videoElement?.readyState,
                cropArea,
                errorMessage: error.message
            });
            alert(`Failed to crop image: ${error.message || 'Unknown error'}. Please try again.`);
        }
    };

    const handleCancelCrop = () => {
        setIsCropMode(false);
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
    };

    // Create merch product function
    const createMerchProduct = async () => {
        try {
            // console.log('🎯 CreateMerchProduct function called');
            // console.log('Make Merch clicked, sending request to:', API_CONFIG.ENDPOINTS.CREATE_PRODUCT);
            
            const requestData = {
                thumbnail,
                videoUrl: video?.video_url || window.location.href,
                screenshots: screenshots.slice(0, 6),
                screenshot_timestamp: screenshotTimestamps[0] || 0, // Use first screenshot timestamp
                videoTitle: video?.title || 'Unknown Video',
                creatorName: video?.channelTitle || 'Unknown Creator'
            };
            
            // console.log('Request data:', requestData);
            
            const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            // console.log('Response status:', response.status);
            // console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            // console.log('Response data:', data);
            
            if (data.success) {
                if (isMobile) {
                    // For mobile, redirect to merchandise categories page instead of specific product
                    setTimeout(() => {
                        window.location.href = '/merchandise';
                    }, 1000);
                } else {
                    // For desktop, also redirect to merchandise categories page
                    window.location.href = '/merchandise';
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
        setShowAuthModal(false);
        
        // After successful authentication, try to create merch again
        // Small delay to ensure auth state is properly set
        setTimeout(() => {
            createMerchProduct();
        }, 1000);
    };

    // Test video playback function
    const testVideoPlayback = async () => {
        if (!videoRef.current) {
            alert('Video element not found');
            return;
        }

        const video = videoRef.current;
        // console.log('Testing video playback...');
        // console.log('Video URL:', video.src);
        // console.log('Video ready state:', video.readyState);
        // console.log('Video network state:', video.networkState);
        // console.log('Video paused:', video.paused);
        // console.log('Video current time:', video.currentTime);
        // console.log('Video duration:', video.duration);

        try {
            // Try to play the video
            await video.play();
            // console.log('Video play() successful');
            alert('Video playback test successful! Video should be playing now.');
        } catch (error) {
            console.error('Video play() failed:', error);
            alert(`Video playback test failed: ${error.message}`);
        }
    };

    // Green flag confirmation function - DISABLED TO STOP LOOPS
    const showGreenFlagConfirmation = useCallback((screenshotCount) => {
        // DISABLED TO STOP ENDLESS LOOPS
        // console.log('Green flag disabled for screenshot:', screenshotCount + 1);
        return;
    }, []);

    // Test video URL accessibility
    const testVideoUrl = async () => {
        if (!video || !video.video_url) {
            alert('No video URL to test');
            return;
        }

        // console.log('Testing video URL accessibility...');
        // console.log('Video URL:', video.video_url);

        try {
            // Test with HEAD request first
            const headResponse = await fetch(video.video_url, { 
                method: 'HEAD',
                mode: 'cors'
            });
            // console.log('HEAD request result:', headResponse.status, headResponse.statusText);
            // console.log('Content-Type:', headResponse.headers.get('content-type'));
            // console.log('Content-Length:', headResponse.headers.get('content-length'));

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
        <div className={`play-video ${isCropMode ? 'crop-mode-active' : ''}`}>
            <div 
                className="video-container" 
                ref={videoContainerRef}
                style={{ 
                    position: 'relative', 
                    display: 'inline-block',
                    marginBottom: isMobile ? '0px' : '15px'
                }}
            >
                <div style={{ 
                    position: 'relative', 
                    display: 'inline-block', 
                    width: '100%', 
                    maxWidth: '100%'
                }}>
                    <video 
                        key={videoId}
                        ref={videoRef} 
                        controls
                        controlsList="nodownload"
                        poster={video.thumbnail || ''}
                        width="100%" 
                        height={isMobile ? "320" : "360"}
                        style={{
                            background: '#000', 
                            width: '100%',
                            height: isMobile ? '320px' : '360px',
                            outline: 'none'
                        }} 
                        src={video.video_url}
                        crossOrigin="anonymous"
                        playsInline
                        webkit-playsinline="true"
                        x-webkit-airplay="allow"
                        preload={isMobile ? "auto" : "metadata"}
                        disablePictureInPicture
                        onCanPlay={() => {
                            // console.log('Video can play');
                            setLoading(false);
                            setIsBuffering(false);
                        }}
                        onCanPlayThrough={() => {
                            // Video has buffered enough to play through without stopping
                            setIsBuffering(false);
                            setLoading(false);
                        }}
                        onLoadedData={() => {
                            // console.log('Video data loaded');
                            setLoading(false);
                            setVideoError(null); // Clear any previous errors
                        }}
                        onWaiting={() => {
                            // Video is waiting for more data (buffering)
                            setIsBuffering(true);
                        }}
                        onStalled={() => {
                            // Video download has stalled
                            setIsBuffering(true);
                        }}
                        onProgress={() => {
                            // Video is downloading - check if enough is buffered
                            if (videoRef.current) {
                                const video = videoRef.current;
                                if (video.buffered.length > 0) {
                                    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                                    const currentTime = video.currentTime;
                                    const remaining = bufferedEnd - currentTime;
                                    
                                    // If we have more than 3 seconds buffered, we're good
                                    if (remaining > 3) {
                                        setIsBuffering(false);
                                    }
                                }
                            }
                        }}
                        onPlaying={() => {
                            // Video started playing
                            setIsBuffering(false);
                        }}
                        onError={(e) => {
                            const videoElement = e.target;
                            const errorCode = videoElement.error;
                            let errorMessage = 'Video failed to load.';
                            
                            if (errorCode) {
                                // MediaError code constants:
                                // MEDIA_ERR_ABORTED = 1
                                // MEDIA_ERR_NETWORK = 2
                                // MEDIA_ERR_DECODE = 3
                                // MEDIA_ERR_SRC_NOT_SUPPORTED = 4
                                switch (errorCode.code) {
                                    case 1: // MEDIA_ERR_ABORTED
                                        errorMessage = 'Video loading was aborted.';
                                        break;
                                    case 2: // MEDIA_ERR_NETWORK
                                        errorMessage = 'Network error while loading video. Please check your connection.';
                                        break;
                                    case 3: // MEDIA_ERR_DECODE
                                        errorMessage = 'Video format not supported or file is corrupted.';
                                        break;
                                    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                                        errorMessage = 'Video format not supported or URL is invalid.';
                                        break;
                                    default:
                                        errorMessage = `Video error (code: ${errorCode.code}). The video file may be corrupted or the URL is invalid.`;
                                }
                            }
                            
                            console.error('Video playback error:', {
                                code: errorCode?.code,
                                message: errorMessage,
                                videoUrl: video?.video_url,
                                videoId: videoId
                            });
                            
                            setVideoError(errorMessage);
                            setLoading(false);
                        }}
                        onPlay={() => {
                            if (!videoHasPlayed) {
                                setVideoHasPlayed(true);
                                // Safely call onVideoPlayed if it exists
                                if (typeof onVideoPlayed === 'function') {
                                    onVideoPlayed();
                                }
                            }
                        }}
                    />
                    
                    {/* Play Video Overlay - Shows when video hasn't been played */}
                    {!videoHasPlayed && !videoError && video && (
                        <div 
                            onClick={async () => {
                                if (videoRef.current) {
                                    try {
                                        await videoRef.current.play();
                                        // Manually trigger the play event callback
                                        if (!videoHasPlayed) {
                                            setVideoHasPlayed(true);
                                            // Safely call onVideoPlayed if it exists
                                            if (typeof onVideoPlayed === 'function') {
                                                onVideoPlayed();
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error playing video:', error);
                                    }
                                }
                            }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 50,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'auto',
                                background: 'rgba(0, 0, 0, 0.4)',
                                borderRadius: '12px'
                            }}
                        >
                            <div 
                                className="play-icon-overlay"
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: '50%',
                                    width: isMobile ? '120px' : '150px',
                                    height: isMobile ? '120px' : '150px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 12px 40px rgba(102, 126, 234, 0.6), 0 0 0 0 rgba(102, 126, 234, 0.7)',
                                    animation: 'pulsePlayIcon 2s infinite',
                                    border: '6px solid rgba(255, 255, 255, 0.95)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <span style={{
                                    fontSize: isMobile ? '60px' : '80px',
                                    color: 'white',
                                    marginLeft: '8px', // Slight offset to center the play icon visually
                                    textShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                    lineHeight: '1'
                                }}>▶</span>
                            </div>
                            <p style={{
                                marginTop: '30px',
                                color: 'white',
                                fontSize: isMobile ? '20px' : '24px',
                                fontWeight: '700',
                                textShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
                                textAlign: 'center',
                                letterSpacing: '0.5px'
                            }}>▶️ Play Video</p>
                        </div>
                    )}
                    
                    {/* Video Error Display */}
                    {videoError && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(220, 53, 69, 0.95)',
                            color: 'white',
                            padding: '16px 24px',
                            borderRadius: '8px',
                            zIndex: 100,
                            maxWidth: '90%',
                            textAlign: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>⚠️ Video Playback Error</h4>
                            <p style={{ margin: '0', fontSize: '14px' }}>{videoError}</p>
                            {video?.video_url && (
                                <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                                    URL: {video.video_url.length > 50 ? video.video_url.substring(0, 50) + '...' : video.video_url}
                                </p>
                            )}
                        </div>
                    )}
                    
                                         {/* Crop Tool Icon - Top Left Corner */}
                     <button
                         onClick={handleToggleCropMode}
                         type="button"
                         style={{
                             position: 'absolute',
                             top: '10px',
                             left: '10px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            border: '2px solid #764ba2',
                            borderRadius: '6px',
                            width: isMobile ? '47px' : '53px',
                            height: isMobile ? '47px' : '53px',
                             cursor: 'pointer',
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                            zIndex: 1000,
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                            overflow: 'hidden',
                            outline: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            appearance: 'none',
                            borderStyle: 'solid',
                            padding: '4px'
                         }}
                         onFocus={(e) => {
                             e.target.style.outline = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.transform = 'none';
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onBlur={(e) => {
                             e.target.style.outline = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.transform = 'none';
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onMouseDown={(e) => {
                             e.preventDefault();
                             e.target.style.outline = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.transform = 'none';
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onMouseUp={(e) => {
                             e.target.style.outline = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.transform = 'none';
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onMouseEnter={(e) => {
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.transform = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onMouseLeave={(e) => {
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.transform = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onTouchStart={(e) => {
                             e.target.style.outline = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.transform = 'none';
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onTouchEnd={(e) => {
                             e.target.style.outline = 'none';
                             e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                             e.target.style.transform = 'none';
                             e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                             e.target.style.border = '2px solid #764ba2';
                         }}
                         onContextMenu={(e) => e.preventDefault()}
                         title={isCropMode ? "Exit Crop Mode" : "Crop Screenshot"}
                    >
                        {/* Crop icon */}
                        <svg 
                            width={isMobile ? "20" : "22"} 
                            height={isMobile ? "20" : "22"} 
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#764ba2"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ 
                                position: 'absolute',
                                top: '8px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 2
                            }}
                        >
                            <path d="M6 2v4h4M18 2v4h-4M6 22v-4h4M18 22v-4h-4M2 6h4v4M22 6h-4v4M2 18h4v-4M22 18h-4v-4"/>
                        </svg>
                        
                        {/* Crop Tool text */}
                        <span style={{ 
                            position: 'absolute',
                            bottom: '6px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: isMobile ? '8px' : '9px',
                            fontWeight: '700',
                            color: '#764ba2',
                            zIndex: 2,
                            whiteSpace: 'nowrap',
                            lineHeight: '1'
                        }}>Crop Tool</span>
                    </button>

                     {/* Inline Crop Overlay */}
                     {isCropMode && (
                         <div
                             style={{
                                 position: 'absolute',
                                 top: 0,
                                 left: 0,
                                 right: 0,
                                 bottom: 0,
                                 zIndex: 5,
                                 cursor: isDragging ? 'move' : 'default'
                             }}
                             onMouseDown={handleCropMouseDown}
                             onMouseMove={handleCropMouseMove}
                             onMouseUp={handleCropMouseUp}
                             onMouseLeave={handleCropMouseUp}
                             onTouchStart={handleCropTouchStart}
                             onTouchMove={handleCropTouchMove}
                             onTouchEnd={handleCropTouchEnd}
                         >
                             {/* Crop Area */}
                             <div
                                 className="crop-area"
                                 style={{
                                     position: 'absolute',
                                     left: cropArea.x,
                                     top: cropArea.y,
                                     width: cropArea.width,
                                     height: cropArea.height,
                                     border: '2px dashed #007bff',
                                     backgroundColor: 'rgba(0, 123, 255, 0.1)',
                                     cursor: isDragging ? 'move' : 'default'
                                 }}
                             >
                                 {/* Resize Handles */}
                                 <div
                                     className="resize-handle"
                                     style={{
                                         position: 'absolute',
                                         top: isMobile ? -10 : -5,
                                         left: isMobile ? -10 : -5,
                                         width: isMobile ? 20 : 10,
                                         height: isMobile ? 20 : 10,
                                         backgroundColor: '#007bff',
                                         borderRadius: '50%',
                                         cursor: 'nw-resize',
                                         border: isMobile ? '2px solid white' : 'none',
                                         boxShadow: isMobile ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                                         zIndex: 10
                                     }}
                                     onMouseDown={(e) => handleResizeStart('top-left', e)}
                                     onTouchStart={(e) => handleResizeTouchStart('top-left', e)}
                                     onTouchMove={handleResizeTouchMove}
                                     onTouchEnd={handleResizeTouchEnd}
                                 />
                                 <div
                                     className="resize-handle"
                                     style={{
                                         position: 'absolute',
                                         top: isMobile ? -10 : -5,
                                         right: isMobile ? -10 : -5,
                                         width: isMobile ? 20 : 10,
                                         height: isMobile ? 20 : 10,
                                         backgroundColor: '#007bff',
                                         borderRadius: '50%',
                                         cursor: 'ne-resize',
                                         border: isMobile ? '2px solid white' : 'none',
                                         boxShadow: isMobile ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                                         zIndex: 10
                                     }}
                                     onMouseDown={(e) => handleResizeStart('top-right', e)}
                                     onTouchStart={(e) => handleResizeTouchStart('top-right', e)}
                                     onTouchMove={handleResizeTouchMove}
                                     onTouchEnd={handleResizeTouchEnd}
                                 />
                                 <div
                                     className="resize-handle"
                                     style={{
                                         position: 'absolute',
                                         bottom: isMobile ? -10 : -5,
                                         left: isMobile ? -10 : -5,
                                         width: isMobile ? 20 : 10,
                                         height: isMobile ? 20 : 10,
                                         backgroundColor: '#007bff',
                                         borderRadius: '50%',
                                         cursor: 'sw-resize',
                                         border: isMobile ? '2px solid white' : 'none',
                                         boxShadow: isMobile ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                                         zIndex: 10
                                     }}
                                     onMouseDown={(e) => handleResizeStart('bottom-left', e)}
                                     onTouchStart={(e) => handleResizeTouchStart('bottom-left', e)}
                                     onTouchMove={handleResizeTouchMove}
                                     onTouchEnd={handleResizeTouchEnd}
                                 />
                                 <div
                                     className="resize-handle"
                                     style={{
                                         position: 'absolute',
                                         bottom: isMobile ? -10 : -5,
                                         right: isMobile ? -10 : -5,
                                         width: isMobile ? 20 : 10,
                                         height: isMobile ? 20 : 10,
                                         backgroundColor: '#007bff',
                                         borderRadius: '50%',
                                         cursor: 'se-resize',
                                         border: isMobile ? '2px solid white' : 'none',
                                         boxShadow: isMobile ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                                         zIndex: 10
                                     }}
                                     onMouseDown={(e) => handleResizeStart('bottom-right', e)}
                                     onTouchStart={(e) => handleResizeTouchStart('bottom-right', e)}
                                     onTouchMove={handleResizeTouchMove}
                                     onTouchEnd={handleResizeTouchEnd}
                                 />
                             </div>

                                                           {/* Crop Controls */}
                              <div
                                  style={{
                                      position: 'absolute',
                                      bottom: '20px',
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      display: 'flex',
                                      gap: '10px',
                                      zIndex: 6
                                  }}
                              >
                                  <button
                                      onClick={handleCancelCrop}
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onTouchEnd={(e) => e.stopPropagation()}
                                      style={{
                                          padding: isMobile ? '12px 20px' : '8px 16px',
                                          backgroundColor: '#6c757d',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: isMobile ? '16px' : '14px',
                                          minHeight: isMobile ? '44px' : 'auto',
                                          minWidth: isMobile ? '80px' : 'auto',
                                          touchAction: 'manipulation',
                                          zIndex: 20
                                      }}
                                  >
                                      Cancel
                                  </button>
                                  <button
                                      onClick={handleApplyCrop}
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onTouchEnd={(e) => e.stopPropagation()}
                                      style={{
                                          padding: isMobile ? '12px 20px' : '8px 16px',
                                          backgroundColor: '#007bff',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: isMobile ? '16px' : '14px',
                                          minHeight: isMobile ? '44px' : 'auto',
                                          minWidth: isMobile ? '80px' : 'auto',
                                          touchAction: 'manipulation',
                                          zIndex: 20
                                      }}
                                  >
                                      Apply Crop
                                  </button>
                              </div>
                         </div>
                     )}
                </div>
            </div>
            
                         {/* Action buttons for screenshots and merchandise - CACHE BUST 2025-01-27 */}
        <div className="screenmerch-actions" style={{
            display: 'flex',
            gap: '10px',
            marginBottom: isMobile ? '0px' : '0px',
            marginTop: isMobile ? '5px' : '0px',
            flexWrap: 'wrap'
        }}>
                <button 
                    className="screenmerch-btn screenshot-btn" 
                    onClick={handleGrabScreenshot}
                    disabled={isCapturingScreenshot || screenshots.length >= 6}
                    style={{
                        padding: '14px 24px',
                        backgroundColor: (isCapturingScreenshot || screenshots.length >= 6) ? '#6c757d' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: (isCapturingScreenshot || screenshots.length >= 6) ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        opacity: (isCapturingScreenshot || screenshots.length >= 6) ? 0.7 : 1,
                        textAlign: 'center',
                        lineHeight: '1.2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px'
                    }}
                >
                    {isCapturingScreenshot ? 'Capturing...' : screenshots.length >= 6 ? 'Max Screenshots' : 'Select Screenshot'}
                </button>
                
                                 <button 
                     className="screenmerch-btn make-merch-btn" 
                     onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         if (onMakeMerch) {
                             onMakeMerch();
                         } else {
                             handleMakeMerch();
                         }
                     }}
                     style={{
                         padding: '14px 24px',
                         backgroundColor: '#28a745',
                         color: 'white',
                         border: 'none',
                         borderRadius: '5px',
                         cursor: 'pointer',
                         fontWeight: 'bold',
                         touchAction: 'manipulation',
                         minHeight: '44px',
                         lineHeight: '1.2',
                         textAlign: 'center',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center'
                     }}
                 >
                     Make Merch
                 </button>
            </div>

            {/* Video title moved up */}
        <h3 style={{
            marginTop: '15px',
            marginBottom: isMobile ? '5px' : '15px',
            fontWeight: '600',
            fontSize: '22px',
            textAlign: 'center'
        }}>{video.title}</h3>

            <div className="publisher">
                <div>
                    {/* Publisher info area */}
                </div>
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
    // console.log('ScreenmerchImages: Received screenshots:', screenshots);
    // console.log('ScreenmerchImages: Received thumbnail:', thumbnail);
    
    return (
        <div className="screenmerch-images-grid">
            {[0,1,2,3,4,5].map(idx => (
                <div className="screenmerch-image-box" key={idx}>
                    {/* Removed "Screenshot X" labels - they're obvious from context */}
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
                                onLoad={() => {
                                    // console.log(`Screenshot ${idx + 1} loaded successfully:`, screenshots[idx]);
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
