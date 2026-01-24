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
  const { creatorSettings, currentCreator } = useCreator();

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
              ? `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)`
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
          onSave={(primary, secondary) => {
            // Colors are already applied by the modal
            // Just refresh the page or update state
            window.location.reload();
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
