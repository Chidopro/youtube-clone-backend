import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
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
      if (isLoginMode) {
        // Login with Supabase
        const { error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password: password 
        });
        
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
          setTimeout(() => {
            navigate(returnTo);
          }, 1500);
        }
      } else {
        // Signup with Supabase
        const { error } = await supabase.auth.signUp({ 
          email: email.trim(), 
          password: password 
        });
        
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({ type: 'success', text: 'Signup successful! Please check your email for confirmation.' });
        }
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
              : 'Create your account to start building your creator business with ScreenMerch.'
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
        </div>
      </div>
    </div>
  );
};

export default Login;
