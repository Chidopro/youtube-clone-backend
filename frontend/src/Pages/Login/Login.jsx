import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import './Login.css';

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  "https://screenmerch.fly.dev"; // final fallback

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null); // {type: 'error'|'success', text: string}
  const [isCreatorSignup, setIsCreatorSignup] = useState(false);

  // Force signup view if routed to /signup
  // Check if coming from "Start Free" flow (payment-setup with flow=new_user)
  useEffect(() => {
    if (location.pathname === '/signup') {
      setIsLoginMode(false);
      // Check if user came from payment-setup (Start Free flow) or has pending payment info
      const pendingPaypalEmail = localStorage.getItem('pending_paypal_email');
      const pendingPaymentMethod = localStorage.getItem('pending_payment_method');
      const fromPaymentSetup = location.state?.from?.includes('/payment-setup') || 
                               document.referrer.includes('/payment-setup');
      
      // If coming from payment setup or has pending payment info, it's a creator signup
      if (pendingPaypalEmail || pendingPaymentMethod || fromPaymentSetup) {
        setIsCreatorSignup(true);
      } else {
        // Ensure creator signup is false for regular customer signups
        setIsCreatorSignup(false);
      }
    } else {
      // If not on /signup route, ensure creator signup is false
      setIsCreatorSignup(false);
    }
  }, [location.pathname, location.state]);

  // Optional notice if a protected route bounced the user here
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'session_expired') {
      setMessage({ type: 'error', text: 'Your session expired. Please sign in again.' });
    }
  }, [searchParams]);

  // Always return absolute API URL (no more relative proxy assumption)
  const apiUrl = (endpoint) => `${BACKEND_URL}${endpoint}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email.' });
      return;
    }
    
    // For customer signups (not creators), only require email
    const isCustomerSignup = !isLoginMode && !isCreatorSignup;
    
    if (!isCustomerSignup && !password) {
      setMessage({ type: 'error', text: 'Please enter your password.' });
      return;
    }

    // For customer signups, use email-only endpoint
    const endpoint = isLoginMode 
      ? '/api/auth/login' 
      : (isCustomerSignup ? '/api/auth/signup/email-only' : '/api/auth/signup');
    const url = apiUrl(endpoint);

    try {
      setIsLoading(true);

      const requestBody = isCustomerSignup
        ? { email: email.trim() }
        : {
            email: email.trim(),
            password: password,
            is_creator: !isLoginMode && isCreatorSignup  // Pass is_creator flag for creator signups
          };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        // If you move to cookie sessions, also add: credentials: 'include'
        body: JSON.stringify(requestBody)
      });

      // If backend ever sends HTML (like a 404 page), catch it early
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        const raw = await response.text();
        if (isJson) {
          let data;
          try {
            data = JSON.parse(raw);
          } catch (_) {
            throw new Error(`Server error ${response.status}`);
          }
          const msg =
            (response.status === 409 && data?.error?.includes('already exists'))
              ? 'This email is already registered. Please sign in instead.'
              : (data?.error || `Server error: ${response.status}`);
          throw new Error(msg);
        } else {
          // Most likely the 404 HTML page from the frontend host
          throw new Error(`Could not reach auth API (HTTP ${response.status}). Check BACKEND_URL.`);
        }
      }

      // OK path
      if (!isJson) {
        // Succeeds but not JSON? Still treat as an error to avoid dumping HTML.
        throw new Error('Unexpected response from server (not JSON).');
      }

      const data = await response.json();

      // For customer email-only signup, show message and don't log in yet
      if (isCustomerSignup) {
        setMessage({ 
          type: 'success', 
          text: 'Please check your email to verify your account and set your password.' 
        });
        // Clear the form
        setEmail('');
        return;
      }

      if (data?.token) localStorage.setItem('auth_token', data.token);
      if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isAuthenticated', 'true');

      const returnTo = searchParams.get('returnTo');
      if (returnTo === 'subscription-success') {
        localStorage.setItem('justLoggedIn', 'true');
      }

      setMessage({ type: 'success', text: data.message || 'Login successful! Redirecting…' });

      if (!isLoginMode) {
        const pendingPaypalEmail = localStorage.getItem('pending_paypal_email');
        const pendingTaxId = localStorage.getItem('pending_tax_id');
        
        // If creator signup with pending approval, show message and redirect appropriately
        if (isCreatorSignup && data?.user?.status === 'pending') {
          // Creator signup is pending approval - redirect to a waiting page or dashboard
          setTimeout(() => {
            navigate('/dashboard', { 
              state: { 
                message: 'Your account is pending approval. You will receive an email once approved.' 
              } 
            });
          }, 2000);
        } else {
          setTimeout(() => {
            if (pendingPaypalEmail || pendingTaxId) {
              navigate('/subscription-success');
            } else {
              navigate('/payment-setup?ref=new_user');
            }
          }, 1000);
        }
      } else {
        // Login mode - check user role to redirect appropriately
        setTimeout(() => {
          const userRole = data?.user?.role || 'customer';
          if (returnTo === 'merch') navigate('/merchandise');
          else if (returnTo === 'subscription-success') navigate('/subscription-success');
          else if (userRole === 'customer') {
            // Customers go to product category page to continue shopping
            navigate('/product/browse');
          } else {
            // Creators and admins go to dashboard
            navigate('/dashboard');
          }
        }, 700);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Authentication error: Load failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsLoginMode((prev) => !prev);
    setMessage(null);
    // Reset creator signup flag when toggling (unless coming from payment setup)
    if (location.pathname !== '/signup') {
      setIsCreatorSignup(false);
    }
  };

  const handleGoogleSignIn = () => {
    // Open provider auth on API server (absolute URL)
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
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

          {/* Only show password field for login or creator signup */}
          {(() => {
            const shouldShowPassword = isLoginMode || isCreatorSignup;
            return shouldShowPassword ? (
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
            ) : null;
          })()}

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
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
