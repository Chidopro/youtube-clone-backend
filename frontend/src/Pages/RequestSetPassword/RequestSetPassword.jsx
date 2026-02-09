import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getBackendUrl } from '../../config/apiConfig';
import './RequestSetPassword.css';

const RequestSetPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${getBackendUrl()}/api/auth/request-set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: trimmed })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        return;
      }
      setSent(true);
      setMessage({ type: 'success', text: data.message || 'If an account exists with that email, we sent a link to set your password. Check your inbox.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Could not reach the server. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="request-set-password-page">
      <div className="request-set-password-card">
        <div className="request-set-password-header">
          <div className="request-set-password-logo">🎯</div>
          <h2 className="request-set-password-title">Set your password</h2>
          <p className="request-set-password-subtitle">
            Enter the email for your ScreenMerch account. We’ll send you a link to set or reset your password (valid for 24 hours).
          </p>
        </div>

        {message && (
          <div
            className={`request-set-password-alert ${message.type === 'error' ? 'request-set-password-alert-error' : 'request-set-password-alert-success'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        {!sent ? (
          <form className="request-set-password-form" onSubmit={handleSubmit} noValidate>
            <div className="request-set-password-field">
              <label htmlFor="request-set-password-email" className="request-set-password-label">
                Email address
              </label>
              <input
                id="request-set-password-email"
                type="email"
                className="request-set-password-input"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <button type="submit" className="request-set-password-submit" disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send set-password link'}
            </button>
          </form>
        ) : null}

        <div className="request-set-password-footer">
          <Link to="/login" className="request-set-password-link">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default RequestSetPassword;
