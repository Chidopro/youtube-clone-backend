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
      
      // Only log detailed debugging for mobile devices
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.log('🔍 MOBILE AUTH - Starting mobile authentication');
        console.log('🔍 MOBILE AUTH - URL:', url);
        console.log('🔍 MOBILE AUTH - Email:', email.trim());
        console.log('🔍 MOBILE AUTH - Mode:', isLoginMode ? 'login' : 'signup');
        console.log('🔍 MOBILE AUTH - User Agent:', navigator.userAgent);
        console.log('🔍 MOBILE AUTH - Screen size:', `${window.screen.width}x${window.screen.height}`);
        console.log('🔍 MOBILE AUTH - Viewport size:', `${window.innerWidth}x${window.innerHeight}`);
        console.log('🔍 MOBILE AUTH - Connection type:', navigator.connection?.effectiveType || 'unknown');
        console.log('🔍 MOBILE AUTH - Online status:', navigator.onLine);
        console.log('🔍 MOBILE AUTH - Timestamp:', new Date().toISOString());
      }
      
      const requestBody = {
        email: email.trim(),
        password: password
      };
      
      if (isMobile) {
        console.log('🔍 MOBILE AUTH - Request body:', JSON.stringify(requestBody, null, 2));
        console.log('🔍 MOBILE AUTH - Request headers:', {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': navigator.userAgent
        });
      }
      
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
      
      if (isMobile) {
        console.log('🔍 MOBILE AUTH - Response status:', response.status);
        console.log('🔍 MOBILE AUTH - Response ok:', response.ok);
        console.log('🔍 MOBILE AUTH - Response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (!response.ok) {
        const errorText = await response.text();
        
        if (isMobile) {
          console.log('🔍 MOBILE AUTH - Error response:', errorText);
          console.log('🔍 MOBILE AUTH - Error status:', response.status);
        }
        
        try {
          const errorData = JSON.parse(errorText);
          if (isMobile) {
            console.log('🔍 MOBILE AUTH - Parsed error data:', errorData);
          }
          
          if (response.status === 409 && errorData.error?.includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead.');
          } else if (errorData.error) {
            throw new Error(errorData.error);
          } else {
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
        } catch (parseError) {
          if (isMobile) {
            console.log('🔍 MOBILE AUTH - Parse error:', parseError);
          }
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
      // Only log detailed debugging for mobile devices
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.error('🔍 MOBILE AUTH - Auth error:', error);
        console.error('🔍 MOBILE AUTH - Error name:', error.name);
        console.error('🔍 MOBILE AUTH - Error message:', error.message);
        console.error('🔍 MOBILE AUTH - Error stack:', error.stack);
        console.error('🔍 MOBILE AUTH - Error cause:', error.cause);
        console.error('🔍 MOBILE AUTH - Is TypeError:', error instanceof TypeError);
        console.error('🔍 MOBILE AUTH - Is NetworkError:', error.name === 'NetworkError');
        console.error('🔍 MOBILE AUTH - Error toString:', error.toString());
      }
      
      // Check for specific mobile-related errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        if (isMobile) {
          console.log('🔍 MOBILE AUTH - Network error detected');
          console.log('🔍 MOBILE AUTH - Checking network status...');
          console.log('🔍 MOBILE AUTH - Navigator online:', navigator.onLine);
          console.log('🔍 MOBILE AUTH - Connection type:', navigator.connection?.effectiveType);
          console.log('🔍 MOBILE AUTH - Connection downlink:', navigator.connection?.downlink);
        }
        
        setMessage({ 
          type: 'error', 
          text: 'Network error. Please check your internet connection and try again.' 
        });
      } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
        if (isMobile) {
          console.log('🔍 MOBILE AUTH - CORS error detected');
        }
        setMessage({ 
          type: 'error', 
          text: 'CORS error. Please try refreshing the page and logging in again.' 
        });
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        if (isMobile) {
          console.log('🔍 MOBILE AUTH - Timeout error detected');
        }
        setMessage({ 
          type: 'error', 
          text: 'Request timeout. Please check your connection and try again.' 
        });
      } else {
        if (isMobile) {
          console.log('🔍 MOBILE AUTH - Other error detected:', error.message);
        }
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

  // Mobile-specific debugging function
  const testMobileConnection = async () => {
    console.log('🔍 AuthModal - Testing mobile connection...');
    try {
      // Test basic connectivity
      const testResponse = await fetch(`${API_CONFIG.BASE_URL}/api/test-connection`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': navigator.userAgent
        },
        credentials: 'include',
        mode: 'cors'
      });
      console.log('🔍 AuthModal - Test connection response:', testResponse.status);
      return testResponse.ok;
    } catch (error) {
      console.error('🔍 AuthModal - Test connection failed:', error);
      return false;
    }
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