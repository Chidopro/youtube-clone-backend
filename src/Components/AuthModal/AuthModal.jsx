import React, { useState } from 'react';
import { API_CONFIG } from '../../config/apiConfig';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
      const url = `${API_CONFIG.BASE_URL}${endpoint}`;
      
      // Debug logging and UI display
      const debug = {
        baseUrl: API_CONFIG.BASE_URL,
        fullUrl: url,
        endpoint: endpoint,
        email: email.trim(),
        mode: isLoginMode ? 'login' : 'signup'
      };
      console.log('🔍 AuthModal - API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
      console.log('🔍 AuthModal - Full URL:', url);
      console.log('🔍 AuthModal - Email:', email.trim());
      console.log('🔍 AuthModal - Mode:', isLoginMode ? 'login' : 'signup');
      setDebugInfo(debug);
      
      // Add timeout to prevent hanging requests on mobile
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',  // <- REQUIRED for cookies
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });
      
      clearTimeout(timeoutId);

      // Update debug info with response
      setDebugInfo(prev => ({
        ...prev,
        responseStatus: response.status,
        responseOk: response.ok
      }));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        
        // Update debug info with error
        setDebugInfo(prev => ({
          ...prev,
          errorText: errorText
        }));
        
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
        
        console.log('🔐 Auth success - storing auth state');
        
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
      console.error('Auth error caught:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
      
      // Get the actual error message
      let errorMsg = error.message || error.toString() || 'Unknown error';
      let userFriendlyMsg = 'Authentication error';
      
      // Handle specific error types
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        userFriendlyMsg = 'Request timed out. Please check your connection and try again.';
        errorMsg = 'Request timeout - network may be slow or unstable';
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('Load failed') || error.message?.includes('NetworkError')) {
        userFriendlyMsg = 'Network error. Please check your internet connection and try again.';
        errorMsg = 'Network connection failed - unable to reach server';
      } else if (error.message?.includes('CORS')) {
        userFriendlyMsg = 'CORS error. Please try refreshing the page.';
        errorMsg = 'CORS policy blocked the request';
      }
      
      // Build debug info for display
      const baseUrl = debugInfo?.baseUrl || API_CONFIG.BASE_URL;
      const fullUrl = debugInfo?.fullUrl || `${baseUrl}${isLoginMode ? '/api/auth/login' : '/api/auth/signup'}`;
      
      // Set message with error
      setMessage({ 
        type: 'error', 
        text: `${userFriendlyMsg}: ${errorMsg}` 
      });
      
      // Always show debug info in error cases
      setDebugInfo(prev => ({
        ...prev,
        errorMessage: errorMsg,
        errorName: error.name,
        baseUrl: baseUrl,
        fullUrl: fullUrl,
        networkError: true
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMessage('');
    setDebugInfo(null);
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
            {debugInfo && message.type === 'error' && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '12px', wordBreak: 'break-all', color: '#333' }}>
                <strong>Debug Info:</strong><br />
                Base URL: {debugInfo.baseUrl || 'N/A'}<br />
                Full URL: {debugInfo.fullUrl || 'N/A'}<br />
                {debugInfo.responseStatus && `Response Status: ${debugInfo.responseStatus}`}
                {debugInfo.responseStatus && <br />}
                {debugInfo.errorText && (
                  <div style={{ marginTop: '5px' }}>
                    <strong>Error Response:</strong><br />
                    {debugInfo.errorText.substring(0, 300)}
                  </div>
                )}
                {debugInfo.errorMessage && !debugInfo.errorText && (
                  <div style={{ marginTop: '5px' }}>
                    <strong>Error:</strong> {debugInfo.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal; 