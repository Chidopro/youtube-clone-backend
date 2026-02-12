import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './CreatorSignupModal.css';

const CreatorSignupModal = ({ isOpen, onClose, onSignup, apiBase = '' }) => {
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [signupMethod, setSignupMethod] = useState('google'); // 'google' | 'email'
  const [signupSuccess, setSignupSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (signupMethod === 'google' && !location.trim()) {
      setError('Please enter your location.');
      return;
    }

    if (!agreedToTerms || !agreedToPrivacy) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (signupMethod === 'email') {
        const url = `${apiBase}/api/auth/signup/creator-email-only`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = data?.error || `Signup failed (${res.status})`;
          throw new Error(errMsg);
        }
        setSignupSuccess(true);
      } else {
        await onSignup(email.trim(), location.trim());
        onClose();
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="creator-signup-modal-overlay" onClick={handleOverlayClick}>
      <div className="creator-signup-modal">
        <button 
          className="creator-signup-modal-close" 
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="creator-signup-modal-content">
          <h2 className="creator-signup-modal-title">Creator Signup</h2>
          <p className="creator-signup-modal-subtitle">
            Join ScreenMerch as a creator and start selling merchandise from your content
          </p>

          {signupSuccess ? (
            <div className="creator-signup-success">
              <h3 className="creator-signup-success-title">Account created</h3>
              <p className="creator-signup-success-text">
                Your application is pending approval. You&apos;ll receive an acceptance email with a link to set your password once approved.
              </p>
              <Link to="/login" className="creator-signup-success-link">Go to Log in</Link>
              <button type="button" className="creator-signup-submit-btn" onClick={onClose} style={{ marginTop: 12 }}>
                Close
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="creator-signup-form">
            <div className="creator-signup-method-toggle">
              <button
                type="button"
                className={`creator-signup-method-btn ${signupMethod === 'google' ? 'active' : ''}`}
                onClick={() => setSignupMethod('google')}
              >
                Continue with Google
              </button>
              <button
                type="button"
                className={`creator-signup-method-btn ${signupMethod === 'email' ? 'active' : ''}`}
                onClick={() => setSignupMethod('email')}
              >
                Sign up with email
              </button>
            </div>

            <div className="creator-signup-field">
              <label htmlFor="creator-email" className="creator-signup-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                id="creator-email"
                type="email"
                className="creator-signup-input"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
                autoComplete="email"
              />
            </div>

            {signupMethod === 'google' && (
              <div className="creator-signup-field">
                <label htmlFor="creator-location" className="creator-signup-label">
                  Location <span className="required">*</span>
                </label>
                <input
                  id="creator-location"
                  type="text"
                  className="creator-signup-input"
                  placeholder="State, Country"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isSubmitting}
                  required
                  autoComplete="country-name"
                />
              </div>
            )}

            {error && (
              <div className="creator-signup-error">
                {error}
              </div>
            )}

            <div className="creator-signup-terms">
              <p className="creator-signup-agreement-intro">
                By creating an account you agree to our Terms of Service and Privacy Policy. Your application requires admin approval.
              </p>
              <p className="creator-signup-links">
                <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                {' · '}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              </p>
              <label className="terms-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={isSubmitting}
                  required
                />
                <span>
                  I have read and agree to the <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</a>. <span className="required">*</span>
                </span>
              </label>
              <label className="terms-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  disabled={isSubmitting}
                  required
                />
                <span>
                  I have read and agree to the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. <span className="required">*</span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="creator-signup-submit-btn"
              disabled={isSubmitting || !agreedToTerms || !agreedToPrivacy}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner-small"></span>
                  Processing...
                </>
              ) : signupMethod === 'email' ? (
                'Create account'
              ) : (
                'Continue with Google Sign In'
              )}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorSignupModal;

