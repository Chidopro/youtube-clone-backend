import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useCreator } from '../../contexts/CreatorContext';
import { getBackendUrl } from '../../config/apiConfig';
import './Favorites.css';

const Favorites = ({ sidebar }) => {
  const navigate = useNavigate();
  const { currentCreator } = useCreator();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!currentCreator?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: userFavorites, error } = await supabase
          .from('creator_favorites')
          .select('*')
          .eq('user_id', currentCreator.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching favorites:', error);
          setFavorites([]);
        } else {
          setFavorites(userFavorites || []);
        }
      } catch (err) {
        console.error('Error fetching favorites:', err);
        setFavorites([]);
      }
      setLoading(false);
    };

    fetchFavorites();
  }, [currentCreator?.id]);

  const handleMakeMerch = async (favorite) => {
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuth) {
      alert('Please sign in to create merchandise.');
      return;
    }

    const imageUrl = favorite.image_url || favorite.thumbnail_url;
    if (!imageUrl) {
      alert('No image available for this favorite.');
      return;
    }

    localStorage.setItem('screenshotImageUrl', imageUrl);
    localStorage.setItem('screenshotVideoTitle', favorite.title || 'Favorite');
    localStorage.setItem('screenshotTimestamp', '0:00');
    localStorage.setItem('creator_favorites_mode', 'false');

    navigate('/product/browse?category=mens');
  };

  if (loading) {
    return (
      <div className={`favorites-page ${sidebar ? '' : 'large-container'}`}>
        <div className="favorites-loading">Loading favorites...</div>
      </div>
    );
  }

  return (
    <div className={`favorites-page ${sidebar ? '' : 'large-container'}`}>
      <div className="favorites-header">
        <button className="favorites-back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>⭐ {currentCreator?.display_name || 'Creator'}'s Favorites</h1>
        <p className="favorites-subtitle">
          {favorites.length} favorite{favorites.length !== 1 ? 's' : ''} curated by the creator
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="favorites-empty">
          <div className="favorites-empty-icon">⭐</div>
          <h2>No favorites yet</h2>
          <p>The creator hasn't added any favorites yet. Check back later!</p>
        </div>
      ) : (
        <div className="favorites-grid">
          {favorites.map((favorite) => (
            <div className="favorites-card" key={favorite.id}>
              <div className="favorites-card-image">
                <img
                  src={favorite.image_url || favorite.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Image'}
                  alt={favorite.title || 'Favorite'}
                />
              </div>
              <div className="favorites-card-content">
                <h3>{favorite.title || 'Untitled'}</h3>
                {favorite.description && <p>{favorite.description}</p>}
                <button
                  className="favorites-make-merch-btn"
                  onClick={() => handleMakeMerch(favorite)}
                >
                  Make Merch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
