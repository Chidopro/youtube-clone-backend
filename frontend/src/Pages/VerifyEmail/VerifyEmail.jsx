import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './VerifyEmail.css';

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  "https://screenmerch.fly.dev";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const tokenParam = (searchParams.get('token') || '').trim();
    const emailParam = (searchParams.get('email') || '').trim().toLowerCase();
    if (!tokenParam || !emailParam) {
      setMessage({ type: 'error', text: 'Invalid verification link. Please check your email and try again.' });
    } else {
      setToken(tokenParam);
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!password) {
      setMessage({ type: 'error', text: 'Please enter a password.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (!token || !email) {
      setMessage({ type: 'error', text: 'Invalid verification link.' });
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${BACKEND_URL}/api/auth/verify-email`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          token: (token || '').trim(),
          email: (email || '').trim().toLowerCase(),
          password: password
        })
      });

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
          throw new Error(data?.error || `Server error: ${response.status}`);
        } else {
          throw new Error(`Could not reach verification API (HTTP ${response.status}).`);
        }
      }

      if (!isJson) {
        throw new Error('Unexpected response from server (not JSON).');
      }

      const data = await response.json();

      if (data?.token) localStorage.setItem('auth_token', data.token);
      if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isAuthenticated', 'true');

      // So App.jsx keeps user on home and does not redirect to creator-thank-you or elsewhere
      try {
        sessionStorage.setItem('from_password_set', '1');
      } catch (_) {}

      setMessage({ type: 'success', text: 'Email verified and password set successfully! Redirecting to home...' });

      // Always send user to homepage after password set (full-page redirect)
      const homeUrl = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin + '/' : '/';
      setTimeout(() => {
        window.location.replace(homeUrl);
      }, 800);
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Verification failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || resendLoading) return;
    setResendLoading(true);
    setMessage(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/signup/email-only`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = r.ok ? await r.json().catch(() => ({})) : {};
      if (r.ok && data.success) {
        setMessage({ type: 'success', text: 'A new verification link was sent to your email. Use the link in the latest email, then set your password.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not send a new link. Try again or sign up again from the home page.' });
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Could not send a new link. Try again or sign up again from the home page.' });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <h2 className="verify-email-title">Set Your Password</h2>
        <p className="verify-email-subtitle">
          Please create a password to complete your account setup
        </p>

        {message && (
          <div
            className={`verify-email-alert ${message.type === 'error' ? 'verify-email-alert-error' : 'verify-email-alert-success'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        {token && email ? (
          <form className="verify-email-form" onSubmit={handleSubmit} noValidate>
            <div className="verify-email-field">
              <label htmlFor="email" className="verify-email-label">Email</label>
              <input
                id="email"
                type="email"
                className="verify-email-input"
                value={email}
                disabled
              />
            </div>

            <div className="verify-email-field">
              <label htmlFor="password" className="verify-email-label">Password</label>
              <input
                id="password"
                type="password"
                className="verify-email-input"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
              />
              <p className="verify-email-hint">Must be at least 6 characters</p>
            </div>

            <div className="verify-email-field">
              <label htmlFor="confirmPassword" className="verify-email-label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                className="verify-email-input"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="verify-email-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="loading-spinner" />
                  Verifying...
                </>
              ) : (
                'Verify & Set Password'
              )}
            </button>
            <p className="verify-email-resend">
              Link invalid or expired?{' '}
              <button type="button" className="verify-email-resend-btn" onClick={handleResendVerification} disabled={resendLoading}>
                {resendLoading ? 'Sending...' : 'Send a new verification link'}
              </button>
            </p>
          </form>
        ) : (
          <div className="verify-email-error">
            <p>Invalid verification link. Please check your email and try again.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

