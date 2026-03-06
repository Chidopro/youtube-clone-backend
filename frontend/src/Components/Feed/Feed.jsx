import React from 'react'
import './Feed.css'
import { value_converter } from '../../data'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'

const Feed = ({ videos, favoritesCount = 0, favoritesPreview = null, creatorName = '' }) => {
    const navigate = useNavigate();
    
    const showFavoritesCard = favoritesCount > 0;
    
    return (
        <div className='feed'>
            {/* Favorites Card - Always First */}
            {showFavoritesCard && (
                <div
                    className="card favorites-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/favorites')}
                >
                    <div className="favorites-card-preview">
                        {favoritesPreview && favoritesPreview.length > 0 ? (
                            <div className="favorites-preview-grid">
                                {favoritesPreview.slice(0, 4).map((img, idx) => (
                                    <div key={idx} className="favorites-preview-item">
                                        <img src={img} alt={`Favorite ${idx + 1}`} />
                                    </div>
                                ))}
                                {favoritesPreview.length < 4 && 
                                    Array(4 - favoritesPreview.length).fill(null).map((_, idx) => (
                                        <div key={`empty-${idx}`} className="favorites-preview-item favorites-preview-empty">
                                            <span>⭐</span>
                                        </div>
                                    ))
                                }
                            </div>
                        ) : (
                            <div className="favorites-preview-placeholder">
                                <span className="favorites-star">⭐</span>
                            </div>
                        )}
                        <div className="favorites-card-overlay">
                            <span className="favorites-count">{favoritesCount}</span>
                        </div>
                    </div>
                    <h2>⭐ Favorites</h2>
                    <h3>{creatorName ? `${creatorName}'s Picks` : 'Creator Picks'}</h3>
                </div>
            )}
            
            {/* Video Cards */}
            {videos.map((item) => {
                return (
                    <div
                        key={item.id}
                        className="card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            console.log('Clicked item:', item);
                            navigate(`/video/${item.categoryId || 0}/${item.id}`);
                        }}
                    >
                        <img src={item.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'} alt="" />
                        <h2>{item.title}</h2>
                        <h3>{item.channelTitle || 'Creator'}</h3>
                    </div>
                );
            })}
        </div>
    )
}

export default Feed;
