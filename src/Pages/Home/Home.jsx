import React, { useState, useEffect } from "react";
import Feed from "../../Components/Feed/Feed";
import { API_CONFIG } from "../../config/apiConfig";
import { mockVideos } from "../../mockVideos";
import './Home.css';
import { useNavigate } from 'react-router-dom';

// Normalize mock items so Feed has created_at (uses publishedAt as fallback)
const mockVideosForFeed = mockVideos.map((v) => ({
  ...v,
  created_at: v.created_at || v.publishedAt,
}));

const Home = ({ sidebar, category, selectedCategory, setSelectedCategory }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError('');
      try {
        const url = `${API_CONFIG.BASE_URL}/api/videos`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        setVideos(list.length > 0 ? list : mockVideosForFeed);
      } catch (err) {
        console.error('Home: videos API failed, using fallback:', err);
        setError('');
        setVideos(mockVideosForFeed);
      }
      setLoading(false);
    };
    fetchVideos();
  }, []);

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
        {loading && <div style={{ padding: 24 }}>Loading videos...</div>}
        {error && <div style={{ padding: 24, color: 'red' }}>{error}</div>}
        {!loading && !error && videos.length > 0 && (
          <Feed videos={videos} />
        )}
      </div>
    </>
  );
};

export default Home;
