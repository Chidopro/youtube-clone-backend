import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null); // {type: 'error'|'success', text: string}

  // Auto-switch to signup mode if accessed via /signup route
  useEffect(() => {
    if (location.pathname === '/signup') {
      setIsLoginMode(false);
    }
  }, [location.pathname]);

  // Optional: show a message if redirected here after a protected route
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'session_expired') {
      setMessage({ type: 'error', text: 'Your session expired. Please sign in again.' });
    }
  }, [searchParams]);

  // Decide API URL:
  // - On localhost/dev → use API_CONFIG.BASE_URL (your Fly/localhost backend)
  // - Everywhere else (Netlify prod or preview) → use RELATIVE path so Netlify proxy handles it (no CORS).
  const getApiUrl = (endpoint) => {
    const host =
      (typeof window !== 'undefined' && window.location && window.location.hostname) || '';

    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      // common LAN dev IPs:
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.20.') ||
      host.startsWith('172.21.') ||
      host.startsWith('172.22.') ||
      host.startsWith('172.23.') ||
      host.startsWith('172.24.') ||
      host.startsWith('172.25.') ||
      host.startsWith('172.26.') ||
      host.startsWith('172.27.') ||
      host.startsWith('172.28.') ||
      host.startsWith('172.29.') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.');

    // If we are on localhost/dev, use absolute BASE_URL.
    if (isLocalHost) {
      return `${API_CONFIG.BASE_URL}${endpoint}`;
    }

    // Otherwise (Netlify prod or preview), ALWAYS use relative to trigger Netlify proxy.
    return endpoint; // e.g. "/api/auth/login"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    // Very basic validation
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email.' });
      return;
    }
    if (!password) {
      setMessage({ type: 'error', text: 'Please enter your password.' });
      return;
    }

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
    const url = getApiUrl(endpoint);

    try {
      setIsLoading(true);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // If you later switch to cookie sessions, add:
        // credentials: 'include'
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          if (response.status === 409 && errorData.error?.includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead.');
          } else if (errorData.error) {
            throw new Error(errorData.error);
          } else {
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
        } catch {
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('Auth success payload:', data);

      if (data?.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      const returnTo = searchParams.get('returnTo');
      if (returnTo === 'subscription-success') {
        localStorage.setItem('justLoggedIn', 'true');
        console.log('🏷️ Set justLoggedIn flag for subscription success page');
      }

      setMessage({ type: 'success', text: data.message || 'Login successful! Redirecting...' });

      if (!isLoginMode) {
        const pendingPaypalEmail = localStorage.getItem('pending_paypal_email');
        const pendingTaxId = localStorage.getItem('pending_tax_id');

        if (pendingPaypalEmail || pendingTaxId) {
          setTimeout(() => navigate('/subscription-success'), 1200);
        } else {
          setTimeout(() => navigate('/payment-setup?ref=new_user'), 1200);
        }
      } else {
        if (returnTo === 'merch') {
          setTimeout(() => navigate('/category-selection'), 1000);
        } else if (returnTo === 'subscription-success') {
          setTimeout(() => navigate('/subscription-success'), 1000);
        } else {
          setTimeout(() => navigate('/dashboard'), 800);
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setMessage({ type: 'error', text: err?.message || 'Authentication error: Load failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsLoginMode((prev) => !prev);
    setMessage(null);
  };

  const handleGoogleSignIn = () => {
    // Always use relative path here too, so Netlify proxies it.
    const endpoint = '/api/auth/google/login';
    const url = getApiUrl(endpoint);
    window.location.href = url;
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2 className="login-title">{isLoginMode ? 'Welcome back' : 'Create your account'}</h2>
        <p className="login-subtitle">
          {isLoginMode
            ? 'Sign in to continue to ScreenMerch'
            : 'Join ScreenMerch and start creating merch from your content'}
        </p>

        {message && (
          <div
            className={`login-alert ${message.type === 'error' ? 'login-alert-error' : 'login-alert-success'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              className="login-input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              placeholder="••••••••"
              autoComplete={isLoginMode ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="loading-spinner" />
                Processing...
              </>
            ) : (
              isLoginMode ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="login-toggle">
          <span>{isLoginMode ? "Don't have an account?" : "Already have an account?"}</span>
          <button className="login-toggle-btn" onClick={handleToggleMode} disabled={isLoading}>
            {isLoginMode ? 'Create one' : 'Sign in'}
          </button>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="login-social">
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span role="img" aria-label="google">🔍</span>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;