import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
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
            
            // Ensure user exists in database before upload
            const ensureUserResponse = await fetch('https://screenmerch.fly.dev/api/users/ensure-exists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    email: user.email,
                    display_name: userProfile?.display_name || user.user_metadata?.name
                })
            });
            
            if (!ensureUserResponse.ok) {
                throw new Error('Failed to ensure user exists in database');
            }
            
            const ensureUserResult = await ensureUserResponse.json();
            console.log('User ensured:', ensureUserResult);
            
            // 1. Upload video
            setUploadProgress(10);
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            console.log('Uploading video to:', fileName);
            
            const { error: storageError, data: videoData } = await supabase.storage
                .from('videos2')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (storageError) {
                console.error('Video upload error:', storageError);
                throw new Error(`Video upload failed: ${storageError.message}`);
            }
            
            setUploadProgress(50);
            const { data: videoUrlData } = supabase.storage.from('videos2').getPublicUrl(fileName);
            console.log('Video uploaded successfully:', videoUrlData.publicUrl);

            // 2. Upload thumbnail
            setUploadProgress(60);
            const thumbExt = thumbnail.name.split('.').pop();
            const thumbName = `${user.id}/${Date.now()}_thumb.${thumbExt}`;
            console.log('Uploading thumbnail to:', thumbName);
            
            const { error: thumbError, data: thumbData } = await supabase.storage
                .from('thumbnails')
                .upload(thumbName, thumbnail, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (thumbError) {
                console.error('Thumbnail upload error:', thumbError);
                throw new Error(`Thumbnail upload failed: ${thumbError.message}`);
            }
            
            setUploadProgress(80);
            const { data: thumbUrlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbName);
            console.log('Thumbnail uploaded successfully:', thumbUrlData.publicUrl);

            // 3. Insert metadata into database
            setUploadProgress(90);
            console.log('Inserting video metadata into database...');
            
            const videoMetadata = {
                title: title.trim(),
                description: description.trim(),
                video_url: videoUrlData.publicUrl,
                thumbnail: thumbUrlData.publicUrl,
                channelTitle: userProfile?.display_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown Creator',
                user_id: user.id,
                verification_status: 'verified_via_supabase_auth',
                created_at: new Date().toISOString(),
            };
            
            console.log('Video metadata:', videoMetadata);
            
            const { error: dbError, data: dbData } = await supabase
                .from('videos2')
                .insert([videoMetadata])
                .select();
                
            if (dbError) {
                console.error('Database insert error:', dbError);
                throw new Error(`Database error: ${dbError.message}`);
            }
            
            setUploadProgress(100);
            console.log('Video uploaded and saved successfully:', dbData);

            setMessage('✅ Video uploaded successfully! Redirecting you to the homepage...');
            setTitle('');
            setDescription('');
            setFile(null);
            setThumbnail(null);

            // Redirect to home page after 2 seconds
            setTimeout(() => {
                navigate('/');
            }, 2000);

        } catch (err) {
            console.error('Upload error:', err);
            setMessage(`❌ Upload failed: ${err.message}`);
            
            // If video was uploaded but database insert failed, try to clean up
            if (err.message.includes('Database error') && file) {
                try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
                    await supabase.storage.from('videos2').remove([fileName]);
                    console.log('Cleaned up uploaded video file');
                } catch (cleanupError) {
                    console.error('Failed to cleanup video file:', cleanupError);
                }
            }
        } finally {
            setLoading(false);
            setUploadProgress(0);
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
                <div className="upload-modal-overlay" role="dialog" aria-modal="true" aria-label="Upload Video">
                    <div className="upload-modal-card">
                        <h2>Upload Video</h2>
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
                    <h2 id="upload-video-heading">Upload Video</h2>
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
                                {loading ? 'Uploading...' : 'Upload Video'}
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
