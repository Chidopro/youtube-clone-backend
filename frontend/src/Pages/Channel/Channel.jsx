import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import Feed from '../../Components/Feed/Feed';
import './Channel.css';

const Channel = () => {
  const { channelName } = useParams();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channelInfo, setChannelInfo] = useState(null);

  useEffect(() => {
    const fetchChannelVideos = async () => {
      setLoading(true);
      setError(null);

      try {
        // Decode the channel name from URL
        const decodedChannelName = decodeURIComponent(channelName);

        // Fetch videos for this channel (all verification statuses)
        const { data: channelVideos, error: videoError } = await supabase
          .from('videos2')
          .select('*')
          .eq('channelTitle', decodedChannelName)
          .order('created_at', { ascending: false });

        if (videoError) {
          console.error('Error fetching channel videos:', videoError);
          setError('Failed to load channel videos');
          setLoading(false);
          return;
        }

        if (!channelVideos || channelVideos.length === 0) {
          setError('No videos found for this channel');
          setLoading(false);
          return;
        }

        setVideos(channelVideos);
        
        // Fetch user profile info for cover and avatar images
        const userId = channelVideos[0].user_id;
        let userProfile = null;
        
        if (userId) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('display_name, username, profile_image_url, cover_image_url, bio')
            .eq('id', userId)
            .single();
          
          if (!profileError && profileData) {
            userProfile = profileData;
          }
        }
        
        // Set channel info from first video and user profile
        const channelData = {
          channelTitle: channelVideos[0].channelTitle,
          videoCount: channelVideos.length,
          username: userProfile?.username || decodedChannelName,
          profileImageUrl: userProfile?.profile_image_url || null,
          coverImageUrl: userProfile?.cover_image_url || null,
          bio: userProfile?.bio || null
        };
        
        setChannelInfo(channelData);

      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load channel');
      } finally {
        setLoading(false);
      }
    };

    if (channelName) {
      fetchChannelVideos();
    }
  }, [channelName]);

  if (loading) {
    return (
      <div className="channel-page">
        <div className="channel-loading">Loading channel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="channel-page">
        <div className="channel-error">
          <h2>{error}</h2>
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="channel-page">
      {channelInfo && (
        <div className="channel-header-container">
          {/* Cover Image */}
          <div className="channel-cover-container">
            <img 
              className="channel-cover-photo" 
              src={channelInfo.coverImageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'} 
              alt="Channel Cover" 
            />
          </div>
          
          {/* Channel Info Overlay */}
          <div className="channel-info-overlay">
            {/* Avatar */}
            <div className="channel-avatar-container">
              {channelInfo.profileImageUrl ? (
                <img 
                  className="channel-avatar" 
                  src={channelInfo.profileImageUrl} 
                  alt={channelInfo.channelTitle} 
                />
              ) : (
                <div className="channel-avatar-placeholder">
                  {channelInfo.channelTitle?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            
            {/* Channel Details */}
            <div className="channel-details">
              <h1 className="channel-name">{channelInfo.channelTitle}</h1>
              <p className="channel-username">@{channelInfo.username}</p>
              {channelInfo.bio && (
                <p className="channel-bio">{channelInfo.bio}</p>
              )}
              <p className="channel-stats">
                {channelInfo.videoCount} video{channelInfo.videoCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="channel-content">
        {videos.length > 0 ? (
          <Feed videos={videos} />
        ) : (
          <div className="no-videos">
            <p>No videos available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Channel;

