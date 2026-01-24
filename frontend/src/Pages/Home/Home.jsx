import React, { useState, useEffect } from "react";
import Feed from "../../Components/Feed/Feed";
import { supabase } from '../../supabaseClient';
import './Home.css'
import { useNavigate } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain, getCreatorFromSubdomain } from '../../utils/subdomainService';
import ColorPickerModal from '../../Components/ColorPickerModal/ColorPickerModal';



const Home = ({sidebar, category, selectedCategory, setSelectedCategory}) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const navigate = useNavigate();
  const { creatorSettings, currentCreator, refreshCreator } = useCreator();

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError('');
      let query = supabase
        .from('videos2')
        .select('*')
        .order('created_at', { ascending: false });
      if (category && category !== 'All') {
        query = query.eq('category', category);
      }
      let { data, error } = await query;
      if (error) {
        setError('Failed to fetch videos.');
        setVideos([]);
      } else {
        setVideos(data || []);
      }
      setLoading(false);
    };
    fetchVideos();
  }, [category]);

  // Check if user can edit colors (must be authenticated and own the subdomain)
  useEffect(() => {
    const checkEditPermission = async () => {
      const currentSubdomain = getSubdomain();
      if (!currentSubdomain || !currentCreator) {
        console.log('🔒 [HOME] No subdomain or creator:', { currentSubdomain, currentCreator });
        setCanEdit(false);
        return;
      }

      // Get logged-in user
      let loggedInUserId = null;
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');

      if (isAuthenticated === 'true' && userData) {
        try {
          const authenticatedUser = JSON.parse(userData);
          loggedInUserId = authenticatedUser.id;
          if (!loggedInUserId && authenticatedUser.email) {
            const { data: profileData } = await supabase
              .from('users')
              .select('id')
              .eq('email', authenticatedUser.email)
              .single();
            if (profileData) loggedInUserId = profileData.id;
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }

      if (!loggedInUserId) {
        try {
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser) loggedInUserId = supabaseUser.id;
        } catch (e) {
          console.error('Error getting Supabase user:', e);
        }
      }

      // Check if logged-in user owns this subdomain
      const canEditColors = loggedInUserId && currentCreator && loggedInUserId === currentCreator.id;
      console.log('🔒 [HOME] Edit permission check:', {
        loggedInUserId,
        creatorId: currentCreator?.id,
        canEdit: canEditColors,
        subdomain: currentSubdomain
      });
      setCanEdit(canEditColors);
    };

    checkEditPermission();
  }, [currentCreator]);

  // Apply colors from creatorSettings when they change
  useEffect(() => {
    if (creatorSettings?.primary_color && creatorSettings?.secondary_color) {
      const progressBar = document.querySelector('.user-flow-section');
      if (progressBar) {
        // Use setProperty with important flag to override CSS !important rules
        progressBar.style.setProperty(
          'background', 
          `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)`, 
          'important'
        );
        console.log('🎨 [HOME] Applied colors from creatorSettings:', {
          primary: creatorSettings.primary_color,
          secondary: creatorSettings.secondary_color
        });
      }
    }
  }, [creatorSettings?.primary_color, creatorSettings?.secondary_color]);

  return (
    <>
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        {/* User Flow Section */}
        <div 
          className="user-flow-section"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            position: 'relative',
            background: creatorSettings?.primary_color && creatorSettings?.secondary_color
              ? `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%) !important`
              : undefined
          }}
        >
          {canEdit && (
            <button
              className="progress-bar-edit-btn"
              onClick={() => setShowColorPicker(true)}
              style={{
                opacity: isHovering ? 1 : 0.7,
                transition: 'opacity 0.2s ease'
              }}
              title="Edit colors"
            >
              ✏️
            </button>
          )}
          <div className="flow-steps">
            <div className="flow-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Choose Video</h3>
                <p>Browse and select your favorite video content</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Select Screenshot</h3>
                <p>Select the perfect moment to capture</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Make Merch</h3>
                <p>Create custom products with your screenshot</p>
              </div>
            </div>
          </div>
        </div>

        <ColorPickerModal
          isOpen={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          currentPrimaryColor={creatorSettings?.primary_color}
          currentSecondaryColor={creatorSettings?.secondary_color}
          onSave={async (primary, secondary) => {
            // Wait for CreatorContext to refresh
            setTimeout(() => {
              // Force refresh of creator settings
              const { refreshCreator } = useCreator();
              if (refreshCreator) {
                refreshCreator();
              }
              // Also update local state to force re-render
              window.dispatchEvent(new CustomEvent('creatorSettingsUpdated'));
            }, 500);
          }}
        />


        {/* Videos Feed */}
        {loading && <div style={{padding: 24}}>Loading videos...</div>}
        {error && <div style={{padding: 24, color: 'red'}}>{error}</div>}
        {!loading && !error && videos.length > 0 && (
          <Feed videos={videos} />
        )}
      </div>
    </>
  );
};

export default Home;
