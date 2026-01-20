import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { API_CONFIG } from '../../config/apiConfig';
import { supabase } from '../../supabaseClient';
import './Login.css';

// Helper function to check if we're on a subdomain
const isSubdomain = () => {
  const hostname = window.location.hostname;
  return hostname !== 'screenmerch.com' && hostname !== 'www.screenmerch.com';
};

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
  const [showPassword, setShowPassword] = useState(false);
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

  // Check if user is already authenticated and redirect them
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userData = localStorage.getItem('user');
    
    if (isAuthenticated === 'true' && userData) {
      try {
        const user = JSON.parse(userData);
        console.log('✅ User already authenticated, redirecting...', user);
        
        // Redirect based on user role and location
        const userRole = user.role || 'customer';
        const returnTo = searchParams.get('returnTo');
        
        if (returnTo === 'merch') {
          navigate('/merchandise', { replace: true });
        } else if (returnTo === 'subscription-success') {
          navigate('/subscription-success', { replace: true });
        } else if (userRole === 'customer') {
          // On subdomains, go to home page; on main domain, go to product browse
          if (isSubdomain()) {
            console.log('🔄 Already logged in on subdomain, redirecting to home');
            navigate('/', { replace: true });
          } else {
            navigate('/product/browse', { replace: true });
          }
        } else {
          // Creators and admins go to dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        // If error parsing, clear invalid data and let them log in again
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
      }
    }
  }, [navigate, searchParams]);

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
        console.error('❌ Login failed:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          endpoint: endpoint,
          isLoginMode: isLoginMode,
          raw: raw.substring(0, 500) // First 500 chars
        });
        
        if (isJson) {
          let data;
          try {
            data = JSON.parse(raw);
            console.error('❌ Error data:', data);
            
            // Handle specific error cases
            if (response.status === 409 || (data?.error && data.error.includes('already exists'))) {
              throw new Error('This email is already registered. Please sign in instead, or use "Sign in with Google" if you created your account with Google.');
            }
            
            // Handle database constraint errors
            if (data?.error && (data.error.includes('23505') || data.error.includes('Key') && data.error.includes('already exists'))) {
              throw new Error('This email is already registered. Please sign in instead, or use "Sign in with Google" if you created your account with Google.');
            }
            
            throw new Error(data?.error || `Server error: ${response.status}`);
          } catch (parseError) {
            if (parseError.message.includes('already registered') || parseError.message.includes('already exists')) {
              throw parseError;
            }
            throw new Error(`Server error ${response.status}: ${parseError.message}`);
          }
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
      if (data?.user) {
        // For email/password login, fetch full user profile from database
        if (data.user.id && !data.user.user_metadata) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data.user.id)
              .single();
            
            if (profile) {
              // Merge profile data with user data - prioritize profile_image_url from database
              const fullUser = {
                ...data.user,
                profile_image_url: profile.profile_image_url || data.user.profile_image_url,
                cover_image_url: profile.cover_image_url || data.user.cover_image_url,
                display_name: profile.display_name || data.user.display_name,
                bio: profile.bio || data.user.bio,
                subdomain: profile.subdomain || data.user.subdomain,
                user_metadata: {
                  name: profile.display_name || data.user.display_name,
                  picture: profile.profile_image_url || data.user.profile_image_url
                }
              };
              localStorage.setItem('user', JSON.stringify(fullUser));
              console.log('💾 Stored full user with profile_image_url:', fullUser.profile_image_url);
            } else {
              localStorage.setItem('user', JSON.stringify(data.user));
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        } else {
          // For Google OAuth users, ensure profile_image_url is included
          const userWithImage = {
            ...data.user,
            profile_image_url: data.user.profile_image_url || data.user.picture || data.user.user_metadata?.picture
          };
          localStorage.setItem('user', JSON.stringify(userWithImage));
          console.log('💾 Stored OAuth user with profile_image_url:', userWithImage.profile_image_url);
        }
      }
      localStorage.setItem('isAuthenticated', 'true');
      
      // Store subdomain info for email login (similar to OAuth) to prevent redirect to main domain
      const currentHostname = window.location.hostname;
      if (currentHostname !== 'screenmerch.com' && currentHostname !== 'www.screenmerch.com') {
        // Store that we're on a subdomain so App.jsx doesn't redirect us away
        localStorage.setItem('email_login_subdomain', currentHostname);
        console.log('🔐 Email login: Storing subdomain info:', currentHostname);
      }

      const returnTo = searchParams.get('returnTo');
      if (returnTo === 'subscription-success') {
        localStorage.setItem('justLoggedIn', 'true');
      }

      // Dispatch custom event to notify Navbar and other components of login
      window.dispatchEvent(new CustomEvent('userLoggedIn', { 
        detail: { user: data.user } 
      }));

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
        console.log('✅ Login successful, preparing redirect...', {
          userRole: data?.user?.role,
          isSubdomain: isSubdomain(),
          returnTo: returnTo
        });
        
        setTimeout(() => {
          const userRole = data?.user?.role || 'customer';
          if (returnTo === 'merch') {
            console.log('🔄 Redirecting to merchandise');
            navigate('/merchandise', { replace: true });
          } else if (returnTo === 'subscription-success') {
            console.log('🔄 Redirecting to subscription success');
            navigate('/subscription-success', { replace: true });
          } else if (userRole === 'customer') {
            // On subdomains, go to home page; on main domain, go to product browse
            if (isSubdomain()) {
              console.log('🔄 Subdomain detected, redirecting to home page');
              navigate('/', { replace: true }); // Use replace to avoid back button issues
            } else {
              console.log('🔄 Main domain, redirecting to product browse');
              navigate('/product/browse', { replace: true });
            }
          } else {
            // Creators and admins go to dashboard
            console.log('🔄 Creator/Admin, redirecting to dashboard');
            // On subdomains, stay on subdomain; on main domain, go to dashboard
            if (isSubdomain()) {
              console.log('🔄 Subdomain detected, staying on subdomain for dashboard');
              navigate('/dashboard', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }
        }, 700);
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setMessage({ type: 'error', text: err?.message || 'Authentication error: Load failed' });
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
    // Store current subdomain info before OAuth redirect (for App.jsx fallback)
    const currentHostname = window.location.hostname;
    const currentPath = window.location.pathname;
    if (currentHostname !== 'screenmerch.com' && currentHostname !== 'www.screenmerch.com') {
      localStorage.setItem('oauth_original_subdomain', currentHostname);
      localStorage.setItem('oauth_original_path', currentPath);
      console.log('🔐 Storing subdomain info for OAuth redirect:', currentHostname, currentPath);
    }
    
    // Open provider auth on API server (absolute URL) with return_url
    const returnUrl = window.location.href;
    window.location.href = `${BACKEND_URL}/api/auth/google/login?return_url=${encodeURIComponent(returnUrl)}`;
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
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="••••••••"
                    autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
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

        {/* Only show Google OAuth on main domain (for new creator signups) */}
        {!isSubdomain() && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
