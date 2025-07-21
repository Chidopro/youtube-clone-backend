import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import './Profile.css';
import '../../Components/ChannelHeader/ChannelHeaderShared.css';

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
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
      // Fetch videos for this user
      const { data: userVideos } = await supabase
        .from('videos2')
        .select('*')
        .eq('channelTitle', userProfile.display_name || userProfile.username)
        .order('created_at', { ascending: false });
      setVideos(userVideos || []);
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
          <span className="active">Videos</span>
        </div>
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
      </div>
    </>
  );
};

export default Profile; 