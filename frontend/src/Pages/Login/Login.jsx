import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const location = useLocation();
  
  // Auto-switch to signup mode if accessed via /signup route
  useEffect(() => {
    if (location.pathname === '/signup') {
      setIsLoginMode(false);
    }
  }, [location.pathname]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
      const url = `${API_CONFIG.BASE_URL}${endpoint}`;
      
      console.log('Attempting auth request to:', url);
      console.log('Mode:', isLoginMode ? 'login' : 'signup');
      console.log('Email:', email.trim());
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
        
        // Parse the error response to get better error messages
        try {
          const errorData = JSON.parse(errorText);
          if (response.status === 409 && errorData.error?.includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead.');
          } else if (errorData.error) {
            throw new Error(errorData.error);
          } else {
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        // Store authentication state
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_email', email.trim());
        // Set customer authentication keys
        localStorage.setItem('customer_authenticated', 'true');
        localStorage.setItem('customer_user', JSON.stringify({
          display_name: email.trim(),
          email: email.trim(),
          user_type: 'customer'
        }));
        
        // Set flag to indicate user just logged in (for subscription success page)
        if (returnTo.includes('/subscription-success')) {
          localStorage.setItem('justLoggedIn', 'true');
          console.log('🏷️ Set justLoggedIn flag for subscription success page');
        }
        
        console.log('🔐 Auth success - storing auth state');
        
        setMessage({ type: 'success', text: data.message || 'Login successful! Redirecting...' });
        
        // For new signups, check if they have pending PayPal info
        if (!isLoginMode) {
          const pendingPaypalEmail = localStorage.getItem('pending_paypal_email');
          const pendingTaxId = localStorage.getItem('pending_tax_id');
          
          if (pendingPaypalEmail || pendingTaxId) {
            // User has PayPal info, redirect to instruction page with channel link
            setTimeout(() => {
              navigate('/subscription-success');
            }, 1500);
          } else {
            // No PayPal info, redirect to PayPal setup
            setTimeout(() => {
              navigate('/payment-setup?flow=new_user');
            }, 1500);
          }
        } else {
          // For logins, check if it's merch creation flow
          if (returnTo === 'merch') {
            // Redirect to category selection page for merch creation
            setTimeout(() => {
              navigate('/category-selection');
            }, 1500);
          } else {
            // For other logins, redirect to specified page
            setTimeout(() => {
              navigate(returnTo);
            }, 1500);
          }
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Authentication failed' });
      }
    } catch (error) {
      console.error('Auth error:', error);
      setMessage({ 
        type: 'error', 
        text: `Authentication error: ${error.message}` 
      });
    } finally {
      setIsLoading(false);
    }
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
              : 'Create your free account to start selling merchandise with our 30% transaction fee model.'
            }
          </div>

          <form onSubmit={handleSubmit} className="login-form">
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
            <button 
              onClick={() => navigate('/')} 
              className="back-home-btn"
            >
              ← Back to Home
            </button>
          </div>

          {/* Google OAuth Button */}
          <div className="google-oauth-section" style={{ marginTop: '20px', textAlign: 'center' }}>
            <div style={{ margin: '10px 0', color: '#666' }}>Or</div>
            <button 
              onClick={() => {
                // Direct redirect - no more CORS issues
                alert('Login page Google button clicked!');
                const authUrl = `https://screenmerch.fly.dev/api/auth/google/login?return_url=${encodeURIComponent(window.location.href)}`;
                console.log('Login page redirecting to:', authUrl);
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
