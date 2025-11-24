import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import './Profile.css';
import '../../Components/ChannelHeader/ChannelHeaderShared.css';
import { API_CONFIG } from '../../config/apiConfig';

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('videos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchProfileAndVideos = async () => {
      setLoading(true);
      setError(null);
      // Fetch user profile by username
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      if (userError || !userProfile) {
        setError('User not found');
        setLoading(false);
        return;
      }
      setProfile(userProfile);
      // Fetch videos for this user - use same logic for favorites
      const channelName = userProfile.display_name || userProfile.username;
      console.log('Fetching content for channel:', channelName, { display_name: userProfile.display_name, username: userProfile.username });
      
      const { data: userVideos } = await supabase
        .from('videos2')
        .select('*')
        .eq('channelTitle', channelName)
        .order('created_at', { ascending: false });
      setVideos(userVideos || []);
      console.log('Fetched videos:', userVideos?.length || 0, 'items');
      
      // Fetch favorites for this user - use EXACT same query logic as videos
      const { data: userFavorites, error: favoritesError } = await supabase
        .from('creator_favorites')
        .select('*')
        .eq('channelTitle', channelName)
        .order('created_at', { ascending: false });
      
      if (favoritesError) {
        console.error('Error fetching favorites:', favoritesError);
        // Try fallback with lowercase in case column was created differently
        const { data: fallbackFavorites } = await supabase
          .from('creator_favorites')
          .select('*')
          .eq('channeltitle', channelName)
          .order('created_at', { ascending: false });
        console.log('Fallback query result:', fallbackFavorites?.length || 0, 'items');
        setFavorites(fallbackFavorites || []);
      } else {
        console.log('Fetched favorites:', userFavorites?.length || 0, 'items');
        setFavorites(userFavorites || []);
      }
      
      setLoading(false);
    };
    if (username) fetchProfileAndVideos();
  }, [username]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        setCurrentUser({ ...user, ...profile });
      } else {
        setCurrentUser(null);
      }
    };
    fetchCurrentUser();
  }, []);

  const handleMakeMerchFromFavorite = async (favorite) => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('user_authenticated');
    const googleAuthenticated = localStorage.getItem('isAuthenticated');
    const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');
    
    if (!isLoggedIn) {
      // Store favorite data for after login
      const merchData = {
        thumbnail: favorite.image_url || favorite.thumbnail_url,
        screenshots: [favorite.image_url || favorite.thumbnail_url],
        videoUrl: window.location.href,
        videoTitle: favorite.title || 'Favorite Image',
        creatorName: favorite.channeltitle || favorite.channelTitle || profile?.display_name || profile?.username || 'Unknown Creator'
      };
      localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
      
      // Redirect to login or show auth modal
      alert('Please log in to create merchandise');
      return;
    }
    
    // User is authenticated, proceed with merch creation
    const merchData = {
      thumbnail: favorite.image_url || favorite.thumbnail_url,
      screenshots: [favorite.image_url || favorite.thumbnail_url],
      videoUrl: window.location.href,
      videoTitle: favorite.title || 'Favorite Image',
      creatorName: favorite.channelTitle || profile?.display_name || profile?.username || 'Unknown Creator'
    };
    localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
    
    try {
      const requestData = {
        thumbnail: favorite.image_url || favorite.thumbnail_url,
        videoUrl: window.location.href,
        screenshots: [favorite.image_url || favorite.thumbnail_url],
        screenshot_timestamp: 0,
        videoTitle: favorite.title || 'Favorite Image',
        creatorName: favorite.channeltitle || favorite.channelTitle || profile?.display_name || profile?.username || 'Unknown Creator'
      };
      
      const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_PRODUCT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        window.location.href = '/merchandise';
      } else {
        console.error('Failed to create product:', data);
        alert(`Failed to create merch product page: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Make Merch error:', err);
      alert(`Error connecting to merch server: ${err.message}. Please check the console for more details.`);
    }
  };



  if (currentUser && currentUser.role !== 'creator') {
    return <Navigate to="/" replace />;
  }

  if (loading) return <div className="profile-page"><div>Loading profile...</div></div>;
  if (error) return <div className="profile-page"><div>{error}</div></div>;

  return (
    <>
      {/* Channel Header - Cheedo V Style (copied from dashboard, no edit icons) */}
      <div className="channel-header">
        <div className="channel-cover-container">
          <div className="cover-image-container">
            <img
              className="channel-cover-photo"
              src={profile.cover_image_url || 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'}
              alt="Channel Cover"
            />
          </div>
          <div className="channel-info-overlay">
            <div className="channel-avatar-container">
              <img
                className="channel-avatar"
                src={profile.profile_image_url || '/default-avatar.jpg'}
                alt="Channel Avatar"
              />
            </div>
            <div className="channel-details">
              <h1 className="channel-name">{profile.display_name || profile.username}</h1>
              <p className="channel-username">@{profile.username}</p>
              {profile.bio && (
                <p className="channel-bio">{profile.bio}</p>
              )}

            </div>
          </div>
        </div>
      </div>
      <div className="profile-page">
        <div className="profile-tabs">
          <span 
            className={activeTab === 'videos' ? 'active' : ''}
            onClick={() => setActiveTab('videos')}
            style={{ cursor: 'pointer' }}
          >
            Videos
          </span>
          <span 
            className={activeTab === 'favorites' ? 'active' : ''}
            onClick={() => setActiveTab('favorites')}
            style={{ cursor: 'pointer' }}
          >
            Favorites
          </span>
        </div>
        
        {activeTab === 'videos' && (
          <div className="profile-videos">
            {videos.length === 0 ? (
              <div>No videos yet.</div>
            ) : (
              <div className="profile-video-grid">
                {videos.map(video => (
                  <div 
                    className="profile-video-card" 
                    key={video.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      console.log('Clicked video:', video);
                      navigate(`/video/${video.categoryId || 0}/${video.id}`);
                    }}
                  >
                    <img src={video.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'} alt={video.title} />
                    <h3>{video.title}</h3>
                    <p>{video.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'favorites' && (
          <div className="profile-favorites">
            {favorites.length === 0 ? (
              <div>No favorites yet.</div>
            ) : (
              <div className="profile-video-grid">
                {favorites.map(favorite => (
                  <div 
                    className="profile-video-card" 
                    key={favorite.id}
                  >
                    <img 
                      src={favorite.image_url || favorite.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Image'} 
                      alt={favorite.title}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        // Navigate to video page if needed, or just show image
                        console.log('Clicked favorite:', favorite);
                      }}
                    />
                    <h3>{favorite.title}</h3>
                    {favorite.description && <p>{favorite.description}</p>}
                    <button
                      className="make-merch-btn-favorite"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMakeMerchFromFavorite(favorite);
                      }}
                    >
                      Make Merch
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Profile; 