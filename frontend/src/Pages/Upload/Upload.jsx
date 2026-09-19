import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { waitForOptimizedPlayback, isOptimizedPlaybackUrl } from '../../utils/videoOptimize';
import { supabase } from '../../supabaseClient';
import { getBackendUrl } from '../../config/apiConfig';
import { claimSessionTokenIfNeeded } from '../../utils/userService';
import { uploadFileWithProgress, mapRangeProgress } from '../../utils/uploadWithProgress';
import '../Home/Home.css'; // For layout
import './Upload.css'; // Import new styles

const Upload = () => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                // Check for Google OAuth user first
                const isAuthenticated = localStorage.getItem('isAuthenticated');
                const userData = localStorage.getItem('user');
                
                let user = null;
                
                if (isAuthenticated === 'true' && userData) {
                    // Google OAuth user
                    user = JSON.parse(userData);
                    console.log('🔐 Upload: Found Google OAuth user:', user);
                } else {
                    // Fallback to Supabase auth
                    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
                    if (supabaseUser) {
                        user = supabaseUser;
                        console.log('🔐 Upload: Found Supabase user:', user);
                    }
                }
                
                if (!user) {
                    console.log('🔐 Upload: No authenticated user found');
                    setMessage('❌ Please log in to upload videos');
                    setLoadingUser(false);
                    return;
                }
                setUser(user);
                
                // Fetch user profile from database
                const { data: profile, error: profileError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                if (profile) {
                    setUserProfile(profile);
                } else if (profileError && profileError.code === 'PGRST116') {
                    // User doesn't exist in users table, create them
                    const { data: newProfile, error: createError } = await supabase
                        .from('users')
                        .upsert({
                            id: user.id,
                            email: user.email,
                            username: user.email?.split('@')[0] || 'user',
                            display_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                            role: 'creator',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'id',
                            ignoreDuplicates: false
                        })
                        .select()
                        .single();
                    
                    if (createError && createError.message.includes('duplicate key')) {
                        // If duplicate key error, try to get existing user
                        console.log('Duplicate key detected, fetching existing user');
                        const { data: existingProfile, error: fetchError } = await supabase
                            .from('users')
                            .select('*')
                            .eq('id', user.id)
                            .single();
                        
                        if (existingProfile) {
                            setUserProfile(existingProfile);
                        }
                    } else if (newProfile) {
                        setUserProfile(newProfile);
                    }
                }
            } catch (error) {
                console.error('Error fetching user:', error);
                setMessage('❌ Authentication error. Please log in again.');
            } finally {
                setLoadingUser(false);
            }
        };
        fetchUser();
    }, []);

    const validateFile = (file, type) => {
        if (!file) return 'No file selected';
        
        if (type === 'video') {
            if (!file.type.startsWith('video/')) {
                return 'Please select a valid video file';
            }
            if (file.size > 100 * 1024 * 1024) { // 100MB limit
                return 'Video file size must be less than 100MB';
            }
        } else if (type === 'image') {
            if (!file.type.startsWith('image/')) {
                return 'Please select a valid image file';
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                return 'Image file size must be less than 10MB';
            }
        }
        
        return null;
    };

    // Thumbnail must be 16:9 so it matches the screenshot window and other thumbnails (no size mismatch)
    const THUMBNAIL_ASPECT_RATIO = 16 / 9;  // 1.778
    const THUMBNAIL_ASPECT_TOLERANCE = 0.08; // e.g. 1.70–1.86

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (!file) {
            setThumbnail(null);
            setMessage('');
            return;
        }
        const error = validateFile(file, 'image');
        if (error) {
            setMessage(`❌ ${error}`);
            setThumbnail(null);
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = img.width / img.height;
            const minRatio = THUMBNAIL_ASPECT_RATIO - THUMBNAIL_ASPECT_TOLERANCE;
            const maxRatio = THUMBNAIL_ASPECT_RATIO + THUMBNAIL_ASPECT_TOLERANCE;
            if (ratio >= minRatio && ratio <= maxRatio) {
                setThumbnail(file);
                setMessage('');
            } else {
                setThumbnail(null);
                setMessage('❌ Thumbnail must be 16:9 aspect ratio so it matches the screenshot window. Use e.g. 1280×720 or 1920×1080.');
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            setMessage('❌ Could not read image. Please select a valid image file.');
            setThumbnail(null);
        };
        img.src = url;
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        const error = validateFile(file, 'video');
        if (error) {
            setMessage(`❌ ${error}`);
            setFile(null);
        } else {
            setFile(file);
            setMessage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setUploadProgress(0);

        // Validation
        if (!title.trim()) {
            setMessage('❌ Please enter a video title');
            return;
        }

        if (!description.trim()) {
            setMessage('❌ Please enter a video description');
            return;
        }

        if (!file) {
            setMessage('❌ Please select a video file');
            return;
        }

        if (!thumbnail) {
            setMessage('❌ Please select a thumbnail image');
            return;
        }

        if (!user || !user.id) {
            setMessage('❌ Please log in to upload videos');
            return;
        }

        setLoading(true);
        try {
            console.log('Starting upload process...');
            console.log('User ID:', user.id);

            const sessionToken = await claimSessionTokenIfNeeded(user.id);
            const authHeaders = {
                'Content-Type': 'application/json',
                'X-User-Id': user.id,
                ...(user.email ? { 'X-User-Email': String(user.email).trim().toLowerCase() } : {}),
                ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
            };

            setUploadProgress(4);
            const prepareRes = await fetch(`${getBackendUrl()}/api/videos/prepare-upload`, {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders,
                body: JSON.stringify({
                    video_name: file.name,
                    thumb_name: thumbnail.name,
                    video_size: file.size,
                }),
            });
            const prepared = await prepareRes.json().catch(() => ({}));
            if (!prepareRes.ok || !prepared?.video?.signedUrl || !prepared?.thumbnail?.signedUrl) {
                throw new Error(prepared?.error || 'Could not start upload. Please sign in again and retry.');
            }

            setUploadProgress(8);
            await uploadFileWithProgress(prepared.video.signedUrl, file, {
                contentType: file.type || 'video/mp4',
                onProgress: (loaded, total) => {
                    setUploadProgress(mapRangeProgress(loaded, total, 8, 82));
                },
            });

            setUploadProgress(84);
            await uploadFileWithProgress(prepared.thumbnail.signedUrl, thumbnail, {
                contentType: thumbnail.type || 'image/png',
                onProgress: (loaded, total) => {
                    setUploadProgress(mapRangeProgress(loaded, total, 84, 92));
                },
            });

            setUploadProgress(94);
            const completeRes = await fetch(`${getBackendUrl()}/api/videos/complete-upload`, {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders,
                body: JSON.stringify({
                    video_path: prepared.video.path,
                    thumb_path: prepared.thumbnail.path,
                    title: title.trim(),
                    description: description.trim(),
                    channel_title: userProfile?.display_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Creator',
                }),
            });
            const completed = await completeRes.json().catch(() => ({}));
            if (!completeRes.ok || !completed?.success) {
                throw new Error(completed?.error || 'Video uploaded but could not be saved. Please try again.');
            }

            const saved = completed.video;
            setUploadProgress(98);
            setMessage('Optimizing playback to a small _w720 file…');
            const videoUrl = saved?.video_url || saved?.source_video_url || '';
            const optimized = await waitForOptimizedPlayback({
                videoId: saved?.id,
                videoUrl,
                timeoutMs: 45000,
            });
            setUploadProgress(100);
            if (optimized?.video_url && isOptimizedPlaybackUrl(optimized.video_url)) {
                setMessage('✅ Video uploaded. Playback is ready.');
            } else {
                setMessage('✅ Video uploaded. Playback will finish optimizing in the background.');
            }

            setTitle('');
            setDescription('');
            setFile(null);
            setThumbnail(null);

            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);

        } catch (err) {
            console.error('Upload error:', err);
            setMessage(`❌ Upload failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/dashboard');
        }
    };

    const modal = (() => {
        if (loadingUser) {
            return (
                <div className="upload-modal-overlay" role="dialog" aria-modal="true" aria-label="Upload Clip">
                    <div className="upload-modal-card">
                        <h2>Upload Clip</h2>
                        <div className="upload-form-body">Loading...</div>
                    </div>
                </div>
            );
        }

        if (!user) {
            return (
                <div
                    className="upload-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Sign in to upload"
                    onClick={goBack}
                >
                    <div className="upload-auth-card" onClick={(e) => e.stopPropagation()}>
                        <h2>Please Log In to Upload</h2>
                        <p>You must sign in to upload videos.</p>
                        <button
                            type="button"
                            className="sign-in-btn"
                            onClick={async () => {
                                const apiBase =
                                    window.location.origin === 'https://screenmerch.com' ||
                                    window.location.origin === 'https://www.screenmerch.com'
                                        ? ''
                                        : 'https://screenmerch.fly.dev';
                                const url = `${apiBase}/api/auth/google/login?return_url=${encodeURIComponent(window.location.href)}&format=json`;
                                try {
                                    const res = await fetch(url, {
                                        credentials: 'include',
                                        headers: { Accept: 'application/json' },
                                    });
                                    const data = await res.json().catch(() => ({}));
                                    if (data.auth_url) {
                                        window.location.href = data.auth_url;
                                        return;
                                    }
                                } catch (_) {}
                                window.location.href = url.replace('&format=json', '');
                            }}
                        >
                            Sign In with Google
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div
                className="upload-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-video-heading"
                onClick={goBack}
            >
                <div className="upload-modal-card" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        className="upload-modal-close"
                        onClick={goBack}
                        aria-label="Close"
                    >
                        &times;
                    </button>
                    <h2 id="upload-video-heading">Upload Clip</h2>
                    <form className="upload-form-body" onSubmit={handleSubmit}>
                        <div className="upload-form-group">
                            <label htmlFor="upload-video-title">Title *</label>
                            <input
                                id="upload-video-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                placeholder="Enter video title"
                            />
                        </div>

                        <div className="upload-form-group">
                            <label htmlFor="upload-video-description">Description *</label>
                            <textarea
                                id="upload-video-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                                rows={3}
                                placeholder="Enter video description"
                            />
                        </div>

                        <div className="upload-file-row">
                            <div className="upload-form-group">
                                <label htmlFor="upload-video-file">
                                    Video File *{' '}
                                    <span className="field-hint">(Max 100MB)</span>
                                </label>
                                <input
                                    id="upload-video-file"
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    required
                                />
                                {file && (
                                    <small className="upload-file-meta">
                                        {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                                    </small>
                                )}
                            </div>

                            <div className="upload-form-group">
                                <label htmlFor="upload-video-thumb">
                                    Thumbnail *{' '}
                                    <span className="field-hint">(16:9)</span>
                                </label>
                                <input
                                    id="upload-video-thumb"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleThumbnailChange}
                                    required
                                />
                                {thumbnail && (
                                    <small className="upload-file-meta">
                                        {thumbnail.name} ({(thumbnail.size / 1024 / 1024).toFixed(1)} MB)
                                    </small>
                                )}
                            </div>
                        </div>

                        {uploadProgress > 0 && (
                            <div className="upload-progress">
                                <div className="upload-progress-track">
                                    <div
                                        className="upload-progress-fill"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <small className="upload-progress-label">
                                    Upload progress: {uploadProgress}%
                                </small>
                            </div>
                        )}

                        {message && (
                            <div
                                className={`upload-message ${
                                    message.includes('✅') ? 'success' : 'error'
                                }`}
                            >
                                {message}
                            </div>
                        )}

                        <div className="upload-form-actions">
                            <button type="submit" className="save-btn" disabled={loading}>
                                {loading ? 'Uploading...' : 'Upload Clip'}
                            </button>
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={goBack}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    })();

    return createPortal(modal, document.body);
};

export default Upload;
