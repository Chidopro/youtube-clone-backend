import React, { useState } from 'react';
import { API_CONFIG } from '../../config/apiConfig';
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

    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
      const url = `${API_CONFIG.BASE_URL}${endpoint}`;
      
      const requestBody = {
        email: email.trim(),
        password: password
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': navigator.userAgent
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        
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

      if (data.success) {
        // Store authentication state
        localStorage.setItem('user_authenticated', 'true');
        localStorage.setItem('user_email', email.trim());
        localStorage.setItem('customer_authenticated', 'true');
        localStorage.setItem('customer_user', JSON.stringify({
          display_name: email.trim(),
          email: email.trim(),
          user_type: 'customer'
        }));
        
        setMessage({ type: 'success', text: data.message || 'Login successful! Redirecting...' });
        
        // Close modal and trigger success callback
        setTimeout(() => {
          onSuccess && onSuccess();
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Authentication failed' });
      }
    } catch (error) {
      // Check for specific error types
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setMessage({ 
          type: 'error', 
          text: 'Network error. Please check your internet connection and try again.' 
        });
      } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
        setMessage({ 
          type: 'error', 
          text: 'CORS error. Please try refreshing the page and logging in again.' 
        });
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        setMessage({ 
          type: 'error', 
          text: 'Request timeout. Please check your connection and try again.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `Authentication error: ${error.message}` 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-logo">🎯</div>
          <h2>ScreenMerch Login</h2>
          <button className="auth-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="auth-message">
          <strong>Login Required</strong><br />
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

          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              isLoginMode ? 'Login' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="auth-toggle">
          <span>{isLoginMode ? "Don't have an account?" : "Already have an account?"}</span>
          <button type="button" onClick={toggleMode} className="auth-toggle-btn">
            {isLoginMode ? 'Sign Up' : 'Login'}
          </button>
        </div>

        {message && (
          <div className={`auth-message-display ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal; 