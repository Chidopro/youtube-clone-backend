import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJoin } from '../../config/apiConfig';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const isCustomerSignup = !isLoginMode;

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email.' });
      setIsLoading(false);
      return;
    }

    if (isLoginMode && !password) {
      setMessage({ type: 'error', text: 'Please enter your password.' });
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup/email-only';
      // Same-origin /api on *.screenmerch.com (Netlify → Fly). Avoids dead api.screenmerch.com.
      const url = apiJoin(endpoint);

      const requestBody = isCustomerSignup
        ? { email: email.trim() }
        : { email: email.trim(), password };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          if (response.status === 409 && errorData.error?.includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw new Error(errorData.error || `Server error: ${response.status}`);
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message && !parseError.message.startsWith('Server error')) {
            throw parseError;
          }
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const data = await response.json();

      if (isCustomerSignup && data.success) {
        setMessage({
          type: 'success',
          text: 'Please check your email to verify your account and set your password.',
        });
        setEmail('');
        setPassword('');
        return;
      }

      if (data.success) {
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_email', email.trim());
        localStorage.setItem('customer_authenticated', 'true');
        localStorage.setItem(
          'customer_user',
          JSON.stringify({
            display_name: email.trim(),
            email: email.trim(),
            user_type: 'customer',
          })
        );

        setMessage({ type: 'success', text: data.message || 'Login successful! Redirecting...' });

        setTimeout(() => {
          onSuccess && onSuccess();
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Authentication failed' });
      }
    } catch (error) {
      let userFriendlyMsg = error.message || 'Authentication error';

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        userFriendlyMsg = 'Request timed out. Please check your connection and try again.';
      } else if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Load failed') ||
        error.message?.includes('NetworkError')
      ) {
        userFriendlyMsg = 'Network error. Please check your connection and try again.';
      }

      setMessage({ type: 'error', text: userFriendlyMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMessage('');
    if (!isLoginMode) {
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-logo">🎯</div>
          <h2>ScreenMerch Login</h2>
          <button type="button" className="auth-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="auth-modal-body">
          <div className="auth-message">
            <strong>Login Required</strong>
            <br />
            To create merchandise, please log in or create an account with your email address.
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>

            {isLoginMode && (
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="loading-spinner" />
                  Processing...
                </>
              ) : isLoginMode ? (
                'Login'
              ) : (
                'Sign Up'
              )}
            </button>
            {isLoginMode && (
              <div className="auth-forgot-wrap">
                <Link to="/set-password" className="auth-forgot-link" onClick={onClose}>
                  Forgot password? Set password
                </Link>
              </div>
            )}
          </form>

          <div className="auth-toggle">
            <span>{isLoginMode ? "Don't have an account?" : 'Already have an account?'}</span>
            <button type="button" onClick={toggleMode} className="auth-toggle-btn">
              {isLoginMode ? 'Sign Up' : 'Login'}
            </button>
          </div>

          {message && (
            <div className={`auth-message-display ${message.type}`}>{message.text}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
