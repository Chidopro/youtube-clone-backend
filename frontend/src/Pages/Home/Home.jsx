import React, { useState, useEffect } from "react";
import Feed from "../../Components/Feed/Feed";
import { supabase } from '../../supabaseClient';
import './Home.css'
import { useNavigate } from 'react-router-dom';



const Home = ({sidebar, category, selectedCategory, setSelectedCategory}) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
        <div className="user-flow-section">
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
                <h3>Make Merchandise</h3>
                <p>Create custom products with your screenshot</p>
              </div>
            </div>
          </div>
        </div>


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
