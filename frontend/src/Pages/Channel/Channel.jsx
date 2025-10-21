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
        console.log('Looking for channel:', decodedChannelName);

        // First, let's see what channels exist in the database
        const { data: allVideos, error: allVideosError } = await supabase
          .from('videos2')
          .select('channelTitle')
          .limit(10);
        
        if (allVideos) {
          console.log('Available channels in database:', allVideos.map(v => v.channelTitle));
        }

        // Fetch videos for this channel - try multiple search fields
        let channelVideos = null;
        let videoError = null;
        
        // First try searching by channelTitle
        let { data, error } = await supabase
          .from('videos2')
          .select('*')
          .eq('channelTitle', decodedChannelName)
          .order('created_at', { ascending: false });
        
        if (data && data.length > 0) {
          channelVideos = data;
        } else {
          // Try searching by username or display name
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, username, display_name')
            .or(`username.ilike.%${decodedChannelName}%,display_name.ilike.%${decodedChannelName}%`)
            .limit(1);
          
          if (userData && userData.length > 0) {
            const user = userData[0];
            console.log('Found user:', user);
            
            // Search videos by user_id
            const { data: userVideos, error: userVideoError } = await supabase
              .from('videos2')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
            
            if (userVideos) {
              channelVideos = userVideos;
            }
            videoError = userVideoError;
          } else {
            videoError = userError;
          }
        }

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
        
        console.log('Channel videos user_id:', userId);
        
        if (userId) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('display_name, username, profile_image_url, cover_image_url')
            .eq('id', userId)
            .single();
          
          console.log('User profile data:', profileData);
          console.log('Profile error:', profileError);
          
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
          coverImageUrl: userProfile?.cover_image_url || null
        };
        
        console.log('Channel data being set:', channelData);
        console.log('Profile image URL:', channelData.profileImageUrl);
        console.log('Cover image URL:', channelData.coverImageUrl);
        
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

