import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  // Auto-switch for /signup route
  useEffect(() => {
    if (location.pathname === '/signup') setIsLoginMode(false);
  }, [location.pathname]);

  // 👉 Redirect-based email auth to avoid third-party cookie blocks on mobile
  const submitViaRedirect = () => {
    setIsLoading(true);
    setMessage('');
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
    const action = `${endpoint}?return_url=${encodeURIComponent(window.location.origin + returnTo)}`;

    // Build a hidden form and POST
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';

    const add = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    add('email', email.trim());
    add('password', password);

    document.body.appendChild(form);
    form.submit(); // full-page navigation (first-party cookie on fly.io)
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMessage('');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">🎯</div>
            <h2>ScreenMerch {isLoginMode ? 'Login' : 'Sign Up'}</h2>
          </div>

          <div className="login-message">
            <strong>{isLoginMode ? 'Welcome Back!' : 'Join ScreenMerch'}</strong><br />
            {isLoginMode
              ? 'Sign in to access your account and continue creating amazing merchandise.'
              : 'Create your free account to start selling merchandise with our 30% transaction fee model.'}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); submitViaRedirect(); }}
            className="login-form"
          >
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Processing...
                </>
              ) : (
                isLoginMode ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="login-toggle">
            <span>{isLoginMode ? "Don't have an account?" : "Already have an account?"}</span>
            <button type="button" onClick={toggleMode} className="login-toggle-btn">
              {isLoginMode ? 'Sign Up' : 'Sign In'}
            </button>
          </div>

          {message && (
            <div className={`login-message-display ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="login-footer">
            <button onClick={() => navigate('/')} className="back-home-btn">← Back to Home</button>
          </div>

          {/* Google OAuth Button (already using redirect — keep as-is) */}
          <div className="google-oauth-section" style={{ marginTop: '20px', textAlign: 'center' }}>
            <div style={{ margin: '10px 0', color: '#666' }}>Or</div>
            <button
              onClick={() => {
                const authUrl = `/api/auth/google/login?return_url=${encodeURIComponent(window.location.href)}`;
                window.location.href = authUrl;
              }}
              className="google-signin-btn"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🔍</span>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
