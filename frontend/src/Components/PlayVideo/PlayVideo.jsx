import React, { useEffect, useState, useRef, useCallback } from 'react'
import './PlayVideo.css'
import { value_converter } from '../../data'
import moment from 'moment'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { API_CONFIG } from '../../config/apiConfig'
import { isOptimizedPlaybackUrl, needsVideoOptimize, requestVideoOptimize, screenshotSourceUrl } from '../../utils/videoOptimize'
import { useCreator } from '../../contexts/CreatorContext'
import { savePendingMerchData, markMerchIntentStarted } from '../../utils/merchSession'

// Before 28 Jul 2026, mobile captured the on-screen player box (~small JPEG).
// "screenshot/print fidelity" switched that to native videoWidth x videoHeight.
// Portrait uploads (Samurai Dog) then produced multi-MB JPEGs; iPhone Make Merch
// drops them and Tools looks empty. Copy the frame 1:1 (iOS-safe), then shrink
// the bitmap — never draw the <video> scaled (that path can be blank on Safari).
const SCREENSHOT_MAX_EDGE = 1080;
const SCREENSHOT_JPEG_QUALITY = 0.8;

function getUseCustomPlayer() {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(max-width: 768px)').matches) return true;
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    return /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '');
}

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2];

function formatPlaybackRate(rate) {
    const n = Number(rate) || 1;
    return `${n}x`;
}

function exportCanvasJpeg(canvas) {
    try {
        const url = canvas.toDataURL('image/jpeg', SCREENSHOT_JPEG_QUALITY);
        return url && url.length > 100 ? url : null;
    } catch {
        return null;
    }
}

function downsampleCanvasJpeg(sourceCanvas) {
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return null;
    const scale = Math.min(1, SCREENSHOT_MAX_EDGE / Math.max(sourceCanvas.width, sourceCanvas.height));
    if (scale >= 1) return exportCanvasJpeg(sourceCanvas);
    try {
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(sourceCanvas.width * scale));
        small.height = Math.max(1, Math.round(sourceCanvas.height * scale));
        const ctx = small.getContext('2d');
        if (!ctx) return exportCanvasJpeg(sourceCanvas);
        ctx.drawImage(sourceCanvas, 0, 0, small.width, small.height);
        return exportCanvasJpeg(small) || exportCanvasJpeg(sourceCanvas);
    } catch {
        return exportCanvasJpeg(sourceCanvas);
    }
}

function captureVideoFrameJpeg(videoElement) {
    if (!videoElement) return null;
    const srcW = videoElement.videoWidth;
    const srcH = videoElement.videoHeight;
    if (!srcW || !srcH) return null;

    try {
        const full = document.createElement('canvas');
        full.width = srcW;
        full.height = srcH;
        const ctx = full.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(videoElement, 0, 0);
        const jpeg = downsampleCanvasJpeg(full);
        if (jpeg) return jpeg;
    } catch {
        /* fall through to the pre-Jul-28 mobile path */
    }

    try {
        const rect = videoElement.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width || videoElement.clientWidth || srcW));
        const h = Math.max(1, Math.round(rect.height || videoElement.clientHeight || srcH));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(videoElement, 0, 0, w, h);
        return exportCanvasJpeg(canvas);
    } catch {
        return null;
    }
}

/** Visible video pixels inside the player box (object-fit: contain letterboxing). */
function getVideoContentBox(videoElement) {
    const rect = videoElement.getBoundingClientRect();
    const displayW = rect.width;
    const displayH = rect.height;
    const videoW = videoElement.videoWidth || 0;
    const videoH = videoElement.videoHeight || 0;
    if (!videoW || !videoH || !displayW || !displayH) {
        return { x: 0, y: 0, width: displayW, height: displayH, videoW, videoH, displayW, displayH };
    }
    const displayAspect = displayW / displayH;
    const videoAspect = videoW / videoH;
    let width;
    let height;
    let x;
    let y;
    if (displayAspect > videoAspect) {
        height = displayH;
        width = height * videoAspect;
        x = (displayW - width) / 2;
        y = 0;
    } else {
        width = displayW;
        height = width / videoAspect;
        x = 0;
        y = (displayH - height) / 2;
    }
    return { x, y, width, height, videoW, videoH, displayW, displayH };
}

function clampCropToContent(crop, content) {
    const minSize = 50;
    const maxW = Math.max(minSize, content.width);
    const maxH = Math.max(minSize, content.height);
    const width = Math.min(Math.max(minSize, crop.width), maxW);
    const height = Math.min(Math.max(minSize, crop.height), maxH);
    const x = Math.min(Math.max(content.x, crop.x), content.x + content.width - width);
    const y = Math.min(Math.max(content.y, crop.y), content.y + content.height - height);
    return { x, y, width, height };
}

function cropAreaToSourceRect(cropArea, content, sourceWidth, sourceHeight) {
    if (!content.width || !content.height || !sourceWidth || !sourceHeight) {
        return { sx: 0, sy: 0, sw: sourceWidth || 1, sh: sourceHeight || 1 };
    }
    const relX = (cropArea.x - content.x) / content.width;
    const relY = (cropArea.y - content.y) / content.height;
    const relW = cropArea.width / content.width;
    const relH = cropArea.height / content.height;
    let sx = Math.round(relX * sourceWidth);
    let sy = Math.round(relY * sourceHeight);
    let sw = Math.round(relW * sourceWidth);
    let sh = Math.round(relH * sourceHeight);
    sx = Math.max(0, Math.min(sourceWidth - 1, sx));
    sy = Math.max(0, Math.min(sourceHeight - 1, sy));
    sw = Math.max(1, Math.min(sourceWidth - sx, sw));
    sh = Math.max(1, Math.min(sourceHeight - sy, sh));
    return { sx, sy, sw, sh };
}

function cropVideoFrameJpeg(videoElement, cropArea) {
    const content = getVideoContentBox(videoElement);
    if (!content.videoW || !content.videoH) return null;
    const { sx, sy, sw, sh } = cropAreaToSourceRect(cropArea, content, content.videoW, content.videoH);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, sw, sh);
        return downsampleCanvasJpeg(canvas);
    } catch {
        return null;
    }
}

function cropImageDataUrl(dataUrl, cropArea, videoElement) {
    return new Promise((resolve, reject) => {
        if (!dataUrl) {
            reject(new Error('No screenshot to crop'));
            return;
        }
        const img = new Image();
        img.onload = () => {
            try {
                const content = getVideoContentBox(videoElement);
                const sourceWidth = img.naturalWidth || img.width;
                const sourceHeight = img.naturalHeight || img.height;
                const { sx, sy, sw, sh } = cropAreaToSourceRect(cropArea, content, sourceWidth, sourceHeight);
                const canvas = document.createElement('canvas');
                canvas.width = sw;
                canvas.height = sh;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not crop screenshot'));
                    return;
                }
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                resolve(downsampleCanvasJpeg(canvas) || canvas.toDataURL('image/jpeg', SCREENSHOT_JPEG_QUALITY));
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('Failed to load screenshot for cropping'));
        img.src = dataUrl;
    });
}

function capDataUrlJpeg(dataUrl) {
    return new Promise((resolve) => {
        if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
            resolve(dataUrl);
            return;
        }
        const img = new Image();
        img.onload = () => {
            try {
                const full = document.createElement('canvas');
                full.width = img.naturalWidth || img.width;
                full.height = img.naturalHeight || img.height;
                const ctx = full.getContext('2d');
                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }
                ctx.drawImage(img, 0, 0);
                resolve(downsampleCanvasJpeg(full) || dataUrl);
            } catch {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// Mobile detection hook
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => getUseCustomPlayer());
    const [isMobilePortrait, setIsMobilePortrait] = useState(() => (
        getUseCustomPlayer() && typeof window !== 'undefined' && window.innerHeight > window.innerWidth
    ));
    
    useEffect(() => {
        const checkIsMobile = () => {
            const mobile = getUseCustomPlayer();
            const portrait = mobile && window.innerHeight > window.innerWidth;
            setIsMobile(mobile);
            setIsMobilePortrait(portrait);
        };
        
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        window.addEventListener('orientationchange', checkIsMobile);
        const narrow = window.matchMedia('(max-width: 768px)');
        const coarse = window.matchMedia('(pointer: coarse)');
        narrow.addEventListener?.('change', checkIsMobile);
        coarse.addEventListener?.('change', checkIsMobile);
        
        return () => {
            window.removeEventListener('resize', checkIsMobile);
            window.removeEventListener('orientationchange', checkIsMobile);
            narrow.removeEventListener?.('change', checkIsMobile);
            coarse.removeEventListener?.('change', checkIsMobile);
        };
    }, []);
    
    return { isMobile, isMobilePortrait };
};

const PlayVideo = ({
  videoId: propVideoId,
  thumbnail,
  setThumbnail,
  screenshots,
  setScreenshots,
  videoRef: propVideoRef,
  onVideoData,
  onScreenshotFunction,
  onVideoPlayed,
  onMakeMerch,
  screenshotTimestamps: screenshotTimestampsProp,
  setScreenshotTimestamps: setScreenshotTimestampsProp,
}) => {
    // Use prop if provided, otherwise fallback to URL param
    const params = useParams();
    const videoId = propVideoId || params.videoId;
    const { isMobile, isMobilePortrait } = useIsMobile();
    const { creatorSettings } = useCreator();
    const navigate = useNavigate();
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [error, setError] = useState('');
    const [videoError, setVideoError] = useState(null);
    const videoRef = propVideoRef || useRef(null);
    const pendingSeekRef = useRef(null);
    const playbackUrlRef = useRef('');
    const playStartedAtRef = useRef(0);
    const pausedCanvasRef = useRef(null);
    
    // Video container ref
    const [videoContainerRef] = useState(useRef(null));
    
    // Track if video has been played
    const [videoHasPlayed, setVideoHasPlayed] = useState(false);
    // Mobile native controls draw a full-frame pause / ±10s overlay for ~3s after play.
    const [mobilePlaying, setMobilePlaying] = useState(false);
    const [playerTime, setPlayerTime] = useState(0);
    const [playerDuration, setPlayerDuration] = useState(0);
    const [hideMediaChrome, setHideMediaChrome] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const hideChromeTimerRef = useRef(null);
    const videoHasPlayedRef = useRef(false);
    
    // Ref to track if screenshot function has been passed to prevent loops
    const screenshotFunctionPassedRef = useRef(false);
    
    // Screenshot protection state
    const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
    const [lastAlertTime, setLastAlertTime] = useState(0);
    
    // Inline crop tool state
    const [isCropMode, setIsCropMode] = useState(false);
    const [isApplyingCrop, setIsApplyingCrop] = useState(false);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState(null);
    const cropAreaRef = useRef(cropArea);
    const isDraggingRef = useRef(false);
    const isResizingRef = useRef(false);
    const resizeDirectionRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    
    // Screenshot timestamps (seconds in video). Parent can own state so "Make Merch" in Video.jsx saves real values.
    const [screenshotTimestampsInternal, setScreenshotTimestampsInternal] = useState([]);
    const screenshotTimestamps =
      screenshotTimestampsProp !== undefined ? screenshotTimestampsProp : screenshotTimestampsInternal;
    const setScreenshotTimestamps = setScreenshotTimestampsProp || setScreenshotTimestampsInternal;
    
    // Safe alert function to prevent rapid-fire alerts - DISABLED TO STOP LOOPS
    const safeAlert = useCallback((message) => {
        // DISABLED TO STOP ENDLESS LOOPS
        return;
    }, []);

    const stripNativeControls = useCallback((el) => {
        const video = el || videoRef.current;
        if (!video) return;
        video.controls = false;
        video.removeAttribute('controls');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
    }, [videoRef]);

    const drawPausedFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = pausedCanvasRef.current;
        if (!video || !canvas) return;
        const width = Math.max(1, video.clientWidth || 390);
        const height = Math.max(1, video.clientHeight || 320);
        const scale = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (video.readyState < 2) return;
        try {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (_) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [videoRef]);

    // Configure video for mobile inline playback
    useEffect(() => {
        if (videoRef.current && isMobile) {
            const video = videoRef.current;
            
            // Set attributes for mobile inline playback
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.setAttribute('x-webkit-airplay', 'allow');
            video.setAttribute('preload', 'auto');
            stripNativeControls(video);
            
            // Prevent fullscreen on mobile
            const preventBeginFullscreen = (e) => {
                e.preventDefault();
                video.webkitExitFullscreen?.();
            };
            
            const preventEndFullscreen = (e) => {
                e.preventDefault();
            };
            
            // Ensure video stays inline
            const preventFullscreen = () => {
                if (video.webkitPresentationMode === 'fullscreen') {
                    video.webkitSetPresentationMode('inline');
                }
            };
            
            video.addEventListener('webkitbeginfullscreen', preventBeginFullscreen);
            video.addEventListener('webkitendfullscreen', preventEndFullscreen);
            video.addEventListener('webkitpresentationmodechanged', preventFullscreen);

            const mo = new MutationObserver(() => stripNativeControls(video));
            mo.observe(video, { attributes: true, attributeFilter: ['controls'] });
            
            return () => {
                mo.disconnect();
                video.removeEventListener('webkitbeginfullscreen', preventBeginFullscreen);
                video.removeEventListener('webkitendfullscreen', preventEndFullscreen);
                video.removeEventListener('webkitpresentationmodechanged', preventFullscreen);
            };
        }
    }, [isMobile, stripNativeControls, videoRef]);
    


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

                setVideo(data);
                playbackUrlRef.current = String(data.video_url || '');
                if (needsVideoOptimize(data)) {
                    requestVideoOptimize({ videoId: data.id, videoUrl: data.video_url }).then((result) => {
                        if (result?.video_url && isOptimizedPlaybackUrl(result.video_url)) {
                            playbackUrlRef.current = result.video_url;
                            setVideo((prev) => prev ? { ...prev, video_url: result.video_url, source_video_url: result.source_video_url || prev.source_video_url } : prev);
                        }
                    });
                }
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

    useEffect(() => {
        if (!videoId || !video?.video_url || !needsVideoOptimize(video)) return undefined;
        let cancelled = false;
        let timeoutId = 0;
        const started = Date.now();
        const poll = async () => {
            if (cancelled || Date.now() - started > 180000) return;
            const { data } = await supabase
                .from('videos2')
                .select('video_url, source_video_url')
                .eq('id', videoId)
                .single();
            if (cancelled || !data?.video_url) return;
            if (data.video_url !== playbackUrlRef.current && isOptimizedPlaybackUrl(data.video_url)) {
                const el = videoRef.current;
                if (el) {
                    pendingSeekRef.current = { time: el.currentTime || 0, play: !el.paused };
                }
                playbackUrlRef.current = data.video_url;
                setVideo((prev) => prev ? { ...prev, video_url: data.video_url, source_video_url: data.source_video_url || prev.source_video_url } : prev);
                return;
            }
            timeoutId = window.setTimeout(poll, 4000);
        };
        timeoutId = window.setTimeout(poll, 4000);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [videoId, video?.video_url]);

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
        videoHasPlayedRef.current = false;
        setMobilePlaying(false);
        setHideMediaChrome(false);
        setPlaybackRate(1);
        if (hideChromeTimerRef.current) {
            window.clearTimeout(hideChromeTimerRef.current);
            hideChromeTimerRef.current = null;
        }
    }, [videoId, setScreenshots]);

    // Keep the bottom control bar; never let WebKit re-enable native controls.
    const revealMediaChrome = useCallback((el) => {
        if (hideChromeTimerRef.current) {
            window.clearTimeout(hideChromeTimerRef.current);
            hideChromeTimerRef.current = null;
        }
        setHideMediaChrome(false);
        const videoElement = el || videoRef.current;
        if (!videoElement) return;
        if (!isMobile && !isCropMode) {
            videoElement.controls = true;
        } else {
            videoElement.controls = false;
            videoElement.removeAttribute('controls');
        }
    }, [videoRef, isMobile, isCropMode]);

    const concealMediaChrome = useCallback((el) => {
        if (hideChromeTimerRef.current) {
            window.clearTimeout(hideChromeTimerRef.current);
            hideChromeTimerRef.current = null;
        }
        setHideMediaChrome(true);
        const videoElement = el || videoRef.current;
        if (videoElement) {
            videoElement.controls = false;
            videoElement.removeAttribute('controls');
        }
    }, [videoRef]);

    const scheduleHideMediaChrome = useCallback((el) => {
        if (hideChromeTimerRef.current) {
            window.clearTimeout(hideChromeTimerRef.current);
        }
        hideChromeTimerRef.current = window.setTimeout(() => {
            concealMediaChrome(el);
        }, 500);
    }, [concealMediaChrome]);

    const hideMobileNativeOverlay = useCallback((el) => {
        const videoElement = el || videoRef.current;
        if (!isMobile || !videoElement) return;
        playStartedAtRef.current = Date.now();
        stripNativeControls(videoElement);
    }, [isMobile, stripNativeControls]);

    // Listen for video play event using addEventListener for reliability
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        const stripOverlay = () => {
            hideMobileNativeOverlay(videoElement);
            if (isMobile) setMobilePlaying(true);
            scheduleHideMediaChrome(videoElement);
        };
        
        const handlePlay = () => {
            stripOverlay();
            videoHasPlayedRef.current = true;
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

        const handlePause = () => {
            if (videoElement.seeking) return;
            if (isMobile) {
                setMobilePlaying(false);
                requestAnimationFrame(() => drawPausedFrame());
            }
            if (videoHasPlayedRef.current || videoElement.currentTime > 0.05) {
                revealMediaChrome(videoElement);
            }
        };
        
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('playing', stripOverlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('ended', handlePause);
        
        return () => {
            videoElement.removeEventListener('play', handlePlay);
            videoElement.removeEventListener('playing', stripOverlay);
            videoElement.removeEventListener('pause', handlePause);
            videoElement.removeEventListener('ended', handlePause);
        };
    }, [videoRef, videoHasPlayed, onVideoPlayed, isMobile, hideMobileNativeOverlay, drawPausedFrame, scheduleHideMediaChrome, revealMediaChrome]);

    useEffect(() => () => {
        if (hideChromeTimerRef.current) {
            window.clearTimeout(hideChromeTimerRef.current);
        }
    }, []);

    useEffect(() => {
        if (!isMobile || mobilePlaying || isCropMode) return;
        const id = requestAnimationFrame(() => drawPausedFrame());
        return () => cancelAnimationFrame(id);
    }, [isMobile, mobilePlaying, isCropMode, playerTime, drawPausedFrame, videoId]);

    useEffect(() => {
        const el = videoRef.current;
        if (el) el.playbackRate = playbackRate;
    }, [playbackRate, videoId, videoRef]);







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
        const videoUrl = screenshotSourceUrl(video) || videoElement.src;

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
            // Print-quality upgrade happens only when the image is passed through the 300 DPI print image generator (e.g. Tools / print-quality page), not here.
            return; // Success with instant client-side capture
        }
        
        // Fallback: If client-side capture fails, use server-side
        if (!videoUrl) {
            safeAlert('No video URL available for screenshot capture.');
            return;
        }
        
        try {
            // Use regular screenshot endpoint only; print-quality upgrade happens in the 300 DPI print image generator flow
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_SCREENSHOT, {
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
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.screenshot) {
                    const screenshot = await capDataUrlJpeg(result.screenshot);
                    setScreenshots(prev => {
                        const newScreenshots = prev.length < 6 ? [...prev, screenshot] : prev;
                        showGreenFlagConfirmation(prev.length);
                        return newScreenshots;
                    });
                    setScreenshotTimestamps(prev => {
                        const newTimestamps = prev.length < 6 ? [...prev, currentTime] : prev;
                        return newTimestamps;
                    });
                    return;
                }
            }
        } catch (error) {
            console.error('❌ Server screenshot capture failed:', error);
            
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
            
            return captureVideoFrameJpeg(videoElement);
            
        } catch (error) {
            console.error('Error capturing video frame:', error);
            return null;
        }
    }, []);

    // Make Merch handler — guests can walk the product flow; login is asked at checkout.
    const handleMakeMerch = async () => {
        markMerchIntentStarted();
        const currentTime = videoRef.current ? videoRef.current.currentTime || 0 : (screenshotTimestamps[0] ?? 0);
        savePendingMerchData({
            thumbnail,
            videoUrl: video?.video_url || window.location.href,
            screenshots: screenshots.slice(0, 6),
            screenshot_timestamp: screenshotTimestamps[0] ?? currentTime,
            videoTitle: video?.title || 'Unknown Video',
            creatorName: video?.channelTitle || 'Unknown Creator'
        });
        const email = localStorage.getItem('user_email') || '';
        const qs = email ? `?authenticated=true&email=${encodeURIComponent(email)}` : '';
        navigate(`/merchandise${qs}`);
    };
    
    const updateCropArea = (next) => {
        cropAreaRef.current = next;
        setCropArea(next);
    };

    const endCropPointer = () => {
        isDraggingRef.current = false;
        isResizingRef.current = false;
        resizeDirectionRef.current = null;
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
    };

    const applyCropPointerMove = (clientX, clientY) => {
        if (!isDraggingRef.current && !isResizingRef.current) return;
        const videoElement = videoRef.current;
        if (!videoElement) return;
        const rect = videoElement.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const content = getVideoContentBox(videoElement);
        const prev = cropAreaRef.current;

        if (isDraggingRef.current) {
            updateCropArea(clampCropToContent({
                ...prev,
                x: x - dragStartRef.current.x,
                y: y - dragStartRef.current.y,
            }, content));
            return;
        }

        const dir = resizeDirectionRef.current || '';
        let { x: newX, y: newY, width: newWidth, height: newHeight } = prev;
        if (dir.includes('right')) newWidth = x - prev.x;
        if (dir.includes('left')) {
            newX = x;
            newWidth = prev.x + prev.width - newX;
        }
        if (dir.includes('bottom')) newHeight = y - prev.y;
        if (dir.includes('top')) {
            newY = y;
            newHeight = prev.y + prev.height - newY;
        }
        updateCropArea(clampCropToContent({ x: newX, y: newY, width: newWidth, height: newHeight }, content));
    };

    useEffect(() => {
        cropAreaRef.current = cropArea;
    }, [cropArea]);

    useEffect(() => {
        if (!isCropMode) return undefined;

        const onMouseMove = (e) => applyCropPointerMove(e.clientX, e.clientY);
        const onTouchMove = (e) => {
            if (!isDraggingRef.current && !isResizingRef.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) applyCropPointerMove(touch.clientX, touch.clientY);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', endCropPointer);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', endCropPointer);
        document.addEventListener('touchcancel', endCropPointer);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', endCropPointer);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', endCropPointer);
            document.removeEventListener('touchcancel', endCropPointer);
        };
    }, [isCropMode]);

    const handleToggleCropMode = () => {
        if (isCropMode) {
            endCropPointer();
            setIsCropMode(false);
            setIsApplyingCrop(false);
            return;
        }

        const videoElement = videoRef.current;
        if (videoElement && !videoElement.paused) {
            videoElement.pause();
        }
        if (videoElement) {
            const content = getVideoContentBox(videoElement);
            const width = Math.min(200, Math.max(50, content.width * 0.4));
            const height = Math.min(200, Math.max(50, content.height * 0.4));
            updateCropArea(clampCropToContent({
                x: content.x + (content.width - width) / 2,
                y: content.y + (content.height - height) / 2,
                width,
                height,
            }, content));
        }
        setIsCropMode(true);
    };

    const startCropDrag = (clientX, clientY) => {
        const videoElement = videoRef.current;
        if (!videoElement) return;
        const rect = videoElement.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const area = cropAreaRef.current;
        if (x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) {
            isDraggingRef.current = true;
            isResizingRef.current = false;
            dragStartRef.current = { x: x - area.x, y: y - area.y };
            setIsDragging(true);
            setIsResizing(false);
        }
    };

    const handleCropMouseDown = (e) => {
        if (!isCropMode || isApplyingCrop) return;
        if (e.target.closest && (e.target.closest('button') || e.target.closest('.resize-handle'))) return;
        startCropDrag(e.clientX, e.clientY);
    };

    const handleCropTouchStart = (e) => {
        if (!isCropMode || isApplyingCrop) return;
        if (e.target.closest && (e.target.closest('button') || e.target.closest('.resize-handle'))) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) startCropDrag(touch.clientX, touch.clientY);
    };

    const handleResizeStart = (direction, e) => {
        e.stopPropagation();
        e.preventDefault();
        if (isApplyingCrop) return;
        isResizingRef.current = true;
        isDraggingRef.current = false;
        resizeDirectionRef.current = direction;
        setIsResizing(true);
        setIsDragging(false);
        setResizeDirection(direction);
    };

    const handleApplyCrop = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!isCropMode || isApplyingCrop) return;

        const videoElement = videoRef.current;
        if (!videoElement) return;
        if (screenshots.length >= 6) {
            alert('Maximum 6 screenshots allowed. Please delete some screenshots first.');
            return;
        }

        const area = cropAreaRef.current || cropArea;
        const currentTime = videoElement.currentTime || 0;
        setIsApplyingCrop(true);

        try {
            let croppedImageUrl = cropVideoFrameJpeg(videoElement, area);

            if (!croppedImageUrl) {
                const videoUrl = screenshotSourceUrl(video) || video?.video_url;
                if (videoUrl) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);
                    try {
                        const response = await fetch(API_CONFIG.ENDPOINTS.CAPTURE_SCREENSHOT, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                video_url: videoUrl,
                                timestamp: currentTime,
                                quality: 95
                            }),
                            signal: controller.signal
                        });
                        if (response.ok) {
                            const result = await response.json();
                            if (result.success && result.screenshot) {
                                const fullScreenshot = await capDataUrlJpeg(result.screenshot);
                                croppedImageUrl = await cropImageDataUrl(fullScreenshot, area, videoElement);
                            }
                        }
                    } finally {
                        clearTimeout(timeoutId);
                    }
                }
            }

            if (!croppedImageUrl) {
                alert('Failed to crop image. Please try again.');
                return;
            }

            setScreenshots(prev => (prev.length < 6 ? [...prev, croppedImageUrl] : prev));
            setScreenshotTimestamps(prev => (prev.length < 6 ? [...prev, currentTime] : prev));
            endCropPointer();
            setIsCropMode(false);
        } catch (error) {
            console.error('Error applying crop:', error);
            alert(`Failed to crop image: ${error.message || 'Unknown error'}. Please try again.`);
        } finally {
            setIsApplyingCrop(false);
        }
    };

    const handleCancelCrop = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        endCropPointer();
        setIsApplyingCrop(false);
        setIsCropMode(false);
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
        <div className={`play-video ${isCropMode ? 'crop-mode-active' : ''} ${isMobile ? 'play-video--mobile' : ''}${hideMediaChrome ? ' play-video--chrome-hidden' : ''}`}>
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
                        className={isMobile ? 'mobile-inline-controls' : ''}
                        controls={!isMobile && !isCropMode && !hideMediaChrome}
                        controlsList="nodownload nofullscreen noremoteplayback"
                        poster={video.thumbnail || ''}
                        width="100%" 
                        height={isMobile ? "320" : "360"}
                        style={{
                            background: '#000', 
                            width: '100%',
                            height: isMobile ? '320px' : '360px',
                            objectFit: 'contain',
                            outline: 'none',
                            pointerEvents: (isCropMode || (isMobile && !mobilePlaying)) ? 'none' : 'auto'
                        }} 
                        src={video.video_url}
                        crossOrigin="anonymous"
                        playsInline
                        webkit-playsinline="true"
                        x-webkit-airplay="allow"
                        preload="auto"
                        disablePictureInPicture
                        disableRemotePlayback
                        onTimeUpdate={() => {
                            const el = videoRef.current;
                            if (!el) return;
                            setPlayerTime(el.currentTime || 0);
                            if (el.duration && Number.isFinite(el.duration)) {
                                setPlayerDuration(el.duration);
                            }
                        }}
                        onLoadedMetadata={() => {
                            const el = videoRef.current;
                            if (!el) return;
                            if (el.duration && Number.isFinite(el.duration)) {
                                setPlayerDuration(el.duration);
                            }
                            setPlayerTime(el.currentTime || 0);
                            if (isMobile && el.paused) requestAnimationFrame(() => drawPausedFrame());
                        }}
                        onClick={(e) => {
                            if (isCropMode) return;
                            const el = videoRef.current;
                            if (!el) return;
                            const rect = el.getBoundingClientRect();
                            if (!hideMediaChrome && e.clientY > rect.bottom - 44) return;
                            if (Date.now() - playStartedAtRef.current < 400) return;
                            if (el.paused) {
                                el.play().catch(() => {});
                            } else {
                                el.pause();
                            }
                        }}
                        onCanPlay={() => {
                            setLoading(false);
                            setIsBuffering(false);
                        }}
                        onCanPlayThrough={() => {
                            setIsBuffering(false);
                            setLoading(false);
                        }}
                        onLoadedData={() => {
                            setLoading(false);
                            setVideoError(null);
                            const pending = pendingSeekRef.current;
                            const el = videoRef.current;
                            if (pending && el) {
                                pendingSeekRef.current = null;
                                try {
                                    el.currentTime = pending.time || 0;
                                    if (pending.play) {
                                        el.play().catch(() => {});
                                    }
                                } catch (_) {
                                    /* ignore seek errors while swapping playback file */
                                }
                            }
                            if (isMobile && el?.paused) requestAnimationFrame(() => drawPausedFrame());
                        }}
                        onWaiting={() => {
                            setIsBuffering(true);
                        }}
                        onStalled={() => {
                            setIsBuffering(true);
                        }}
                        onProgress={() => {
                            if (videoRef.current) {
                                const playing = videoRef.current;
                                if (playing.buffered.length > 0) {
                                    const bufferedEnd = playing.buffered.end(playing.buffered.length - 1);
                                    const currentTime = playing.currentTime;
                                    const remaining = bufferedEnd - currentTime;
                                    if (remaining > 3) {
                                        setIsBuffering(false);
                                    }
                                }
                            }
                        }}
                        onPlaying={() => {
                            setIsBuffering(false);
                            if (isMobile) {
                                setMobilePlaying(true);
                                hideMobileNativeOverlay();
                            }
                            videoHasPlayedRef.current = true;
                            scheduleHideMediaChrome();
                        }}
                        onError={(e) => {
                            const videoElement = e.target;
                            const errorCode = videoElement.error;
                            let errorMessage = 'Video failed to load.';
                            
                            if (errorCode) {
                                switch (errorCode.code) {
                                    case 1:
                                        errorMessage = 'Video loading was aborted.';
                                        break;
                                    case 2:
                                        errorMessage = 'Network error while loading video. Please check your connection.';
                                        break;
                                    case 3:
                                        errorMessage = 'Video format not supported or file is corrupted.';
                                        break;
                                    case 4:
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
                            if (isMobile) {
                                setMobilePlaying(true);
                                hideMobileNativeOverlay();
                            }
                            videoHasPlayedRef.current = true;
                            scheduleHideMediaChrome();
                            if (!videoHasPlayed) {
                                setVideoHasPlayed(true);
                                if (typeof onVideoPlayed === 'function') {
                                    onVideoPlayed();
                                }
                            }
                        }}
                        onPause={() => {
                            if (isMobile) {
                                const el = videoRef.current;
                                if (el?.seeking) return;
                                setMobilePlaying(false);
                                requestAnimationFrame(() => drawPausedFrame());
                            }
                            if (videoHasPlayedRef.current) revealMediaChrome();
                        }}
                        onEnded={() => {
                            if (isMobile) {
                                setMobilePlaying(false);
                                requestAnimationFrame(() => drawPausedFrame());
                            }
                            revealMediaChrome();
                        }}
                    />

                    {isMobile && !isCropMode && (
                        <button
                            type="button"
                            className={`mobile-video-frame-cover${mobilePlaying ? ' is-playing' : ''}${hideMediaChrome ? '' : ' with-bar'}`}
                            aria-label="Play"
                            aria-hidden={mobilePlaying}
                            tabIndex={mobilePlaying ? -1 : 0}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (mobilePlaying) return;
                                videoRef.current?.play().catch(() => {});
                            }}
                        >
                            {video.thumbnail ? (
                                <img src={video.thumbnail} alt="" draggable="false" />
                            ) : null}
                            <canvas ref={pausedCanvasRef} />
                        </button>
                    )}

                    {isMobile && !isCropMode && (
                        <div
                            className={`mobile-video-bar${hideMediaChrome ? ' is-hidden' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                className="mobile-video-bar-play"
                                aria-label={mobilePlaying ? 'Pause' : 'Play'}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const el = videoRef.current;
                                    if (!el) return;
                                    if (el.paused) el.play().catch(() => {});
                                    else el.pause();
                                }}
                            >
                                {mobilePlaying ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                                        <rect x="6" y="5" width="4" height="14" fill="currentColor" />
                                        <rect x="14" y="5" width="4" height="14" fill="currentColor" />
                                    </svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M8 5.14v13.72L19 12 8 5.14z" fill="currentColor" />
                                    </svg>
                                )}
                            </button>
                            <input
                                type="range"
                                className="mobile-video-bar-seek"
                                min="0"
                                max={playerDuration > 0 ? playerDuration : 0}
                                step="0.1"
                                value={Math.min(playerTime, playerDuration || 0)}
                                aria-label="Seek"
                                onChange={(e) => {
                                    const el = videoRef.current;
                                    if (!el) return;
                                    const next = Number(e.target.value);
                                    el.currentTime = next;
                                    setPlayerTime(next);
                                }}
                            />
                            <button
                                type="button"
                                className="mobile-video-bar-speed"
                                aria-label={`Playback speed ${formatPlaybackRate(playbackRate)}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const el = videoRef.current;
                                    const idx = PLAYBACK_RATES.indexOf(playbackRate);
                                    const next = PLAYBACK_RATES[(idx < 0 ? 0 : idx + 1) % PLAYBACK_RATES.length];
                                    setPlaybackRate(next);
                                    if (el) el.playbackRate = next;
                                }}
                            >
                                {formatPlaybackRate(playbackRate)}
                            </button>
                        </div>
                    )}
                    
                    {/* Play overlay is desktop-only; mobile never uses the full-frame tint. */}
                    {!isMobile && !videoHasPlayed && !videoError && video && !isCropMode && (
                        <div 
                            className="play-start-overlay"
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
                                borderRadius: 0
                            }}
                        >
                            <div 
                                className="play-icon-overlay"
                                style={{
                                    background: 'rgba(45, 45, 45, 0.45)',
                                    borderRadius: '50%',
                                    width: isMobile ? '120px' : '150px',
                                    height: isMobile ? '120px' : '150px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35), 0 0 0 0 rgba(255, 255, 255, 0.2)',
                                    animation: 'pulsePlayIcon 2s infinite',
                                    border: '6px solid rgba(255, 255, 255, 0.85)',
                                    transition: 'all 0.3s ease'
                                }}
                                aria-label="Play Video"
                            >
                                <svg
                                    className="play-icon-glyph"
                                    width={isMobile ? 48 : 60}
                                    height={isMobile ? 48 : 60}
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <path
                                        d="M8 5.14v13.72L19 12 8 5.14z"
                                        fill="#fff"
                                    />
                                </svg>
                            </div>
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
                         className={`playvideo-crop-toggle${isCropMode ? ' is-active' : ''}`}
                         onClick={handleToggleCropMode}
                         type="button"
                         onContextMenu={(e) => e.preventDefault()}
                         title={isCropMode ? "Exit Crop Mode" : "Crop Screenshot"}
                    >
                        <svg
                            className="playvideo-crop-toggle-icon"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M6 2v4h4M18 2v4h-4M6 22v-4h4M18 22v-4h-4M2 6h4v4M22 6h-4v4M2 18h4v-4M22 18h-4v-4"/>
                        </svg>
                        <span className="playvideo-crop-toggle-label">Crop Tool</span>
                    </button>

                     {/* Inline Crop Overlay */}
                     {isCropMode && (
                         <div
                             className="inline-crop-overlay"
                             style={{
                                 position: 'absolute',
                                 top: 0,
                                 left: 0,
                                 right: 0,
                                 bottom: 0,
                                 zIndex: 60,
                                 cursor: isDragging ? 'move' : 'default',
                                 touchAction: 'none',
                                 userSelect: 'none'
                             }}
                             onMouseDown={handleCropMouseDown}
                             onTouchStart={handleCropTouchStart}
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
                                     onTouchStart={(e) => handleResizeStart('top-left', e)}
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
                                     onTouchStart={(e) => handleResizeStart('top-right', e)}
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
                                     onTouchStart={(e) => handleResizeStart('bottom-left', e)}
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
                                     onTouchStart={(e) => handleResizeStart('bottom-right', e)}
                                 />
                             </div>
                         </div>
                     )}
                </div>
            </div>

            {isCropMode && (
                <div className="inline-crop-controls">
                    <button
                        type="button"
                        className="inline-crop-btn inline-crop-btn--cancel"
                        onClick={handleCancelCrop}
                        disabled={isApplyingCrop}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="inline-crop-btn inline-crop-btn--apply"
                        onClick={handleApplyCrop}
                        disabled={isApplyingCrop}
                    >
                        {isApplyingCrop ? 'Applying...' : 'Apply Crop'}
                    </button>
                </div>
            )}
            
        {isMobile && (
        <div className="screenmerch-actions" style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '0px',
            marginTop: '8px',
            flexWrap: 'nowrap'
        }}>
                <button 
                    className={`screenmerch-btn screenshot-btn${videoHasPlayed && screenshots.length < 6 && !isCapturingScreenshot ? ' screenshot-btn-pulse' : ''}`} 
                    onClick={handleGrabScreenshot}
                    disabled={isCapturingScreenshot || screenshots.length >= 6}
                    style={{
                        backgroundColor: (isCapturingScreenshot || screenshots.length >= 6) ? '#6c757d' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: 0,
                        cursor: (isCapturingScreenshot || screenshots.length >= 6) ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        opacity: (isCapturingScreenshot || screenshots.length >= 6) ? 0.7 : 1
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
                         backgroundColor: '#28a745',
                         color: 'white',
                         border: 'none',
                         borderRadius: 0,
                         cursor: 'pointer',
                         fontWeight: 'bold',
                         touchAction: 'manipulation'
                     }}
                 >
                     Make Merch
                 </button>
            </div>
        )}

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
                                onError={(e) => console.error(`Failed to load screenshot ${idx + 1}:`, e.target.src)}
                            />
                            <div className="screenmerch-buttons">
                                <button type="button" className="screenmerch-delete-btn" onClick={() => onDeleteScreenshot(idx)} title="Delete screenshot" aria-label="Delete screenshot">
                                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </button>
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
