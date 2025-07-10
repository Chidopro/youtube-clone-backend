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
        if (!video) return;
        if (screenshots.length >= 8) return; // max 8
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setScreenshots(prev => prev.length < 8 ? [...prev, dataUrl] : prev);
    };

    // Make Merch handler
    const handleMakeMerch = async () => {
        try {
            const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thumbnail,
                    videoUrl: window.location.href,
                    screenshots: screenshots.slice(0, 5),
                })
            });
            const data = await response.json();
            if (data.success && data.product_url) {
                window.open(data.product_url, '_blank');
            } else {
                alert('Failed to create merch product page.');
            }
        } catch (err) {
            alert('Error connecting to merch server. Make sure Flask is running.');
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
            <video ref={videoRef} controls width="100%" style={{background: '#000'}} poster={video.thumbnail || ''} src={"/WIN_20231111_15_05_23_Pro.mp4"}>
                Your browser does not support the video tag.
            </video>
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
        {[0,1,2,3,4].map(idx => (
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
