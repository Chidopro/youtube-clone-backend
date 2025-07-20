import React from 'react';
import { useNavigate } from 'react-router-dom';

const ComingSoon = () => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: 16 }}>🚧 Coming Soon!</h1>
      <p style={{ fontSize: '1.2rem', color: '#555', marginBottom: 32 }}>
        This category or feature is not available yet. Check back soon for updates!
      </p>
      <button onClick={() => navigate('/')} style={{ padding: '12px 32px', fontSize: '1rem', borderRadius: 8, background: '#222', color: '#fff', border: 'none', cursor: 'pointer' }}>
        Back to Home
      </button>
    </div>
  );
};

export default ComingSoon; 