import React, { useState, useEffect } from "react";
import Feed from "../../Components/Feed/Feed";
import './Home.css';
import { useNavigate } from 'react-router-dom';

const categories = [
  'All',
  'Comedy',
  'Education',
  'Gaming',
  'Health & Fitness',
  'Music',
  'News & Politics',
  'Sports',
  'Tech & Gadgets',
  'Travel',
  'Vlogs & Lifestyle',
  'More'
];

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
        const response = await fetch('https://backend-hidden-firefly-7865.fly.dev/api/videos');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setVideos(data || []);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch videos.');
        setVideos([]);
      }
      setLoading(false);
    };
    fetchVideos();
  }, []);

  return (
    <>
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        {/* Category Tabs */}
        <div className="category-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-tab${selectedCategory === cat ? ' active' : ''}`}
              onClick={() => {
                if (cat === 'All') setSelectedCategory('All');
                else navigate('/coming-soon');
              }}
            >
              {cat}
            </button>
          ))}
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
