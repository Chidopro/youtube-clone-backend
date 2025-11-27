import React, { useState } from 'react';
import './CreatorSignupModal.css';

const CreatorSignupModal = ({ isOpen, onClose, onSignup }) => {
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!location.trim()) {
      setError('Please enter your location.');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service to continue.');
      return;
    }

    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the parent's signup handler
      await onSignup(email.trim(), location.trim());
      // Close modal on success (parent will handle navigation)
      onClose();
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

          <div className="creator-limit-notice">
            <strong>⚠️ Limited Availability:</strong> We currently have a limit of 20 creators on our platform. 
            Your application will be reviewed and approved by our admin team.
          </div>

          <form onSubmit={handleSubmit} className="creator-signup-form">
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

            {error && (
              <div className="creator-signup-error">
                {error}
              </div>
            )}

            <div className="creator-signup-terms">
              <h3 className="terms-title">Terms of Service</h3>
              <div className="terms-content">
                <p>
                  By signing up as a creator on ScreenMerch, you agree to the following terms:
                </p>
                <ul>
                  <li>
                    <strong>Content Ownership:</strong> You confirm that any content you upload to ScreenMerch 
                    is either owned by you or you have the legal rights and permissions to use it for commercial purposes.
                  </li>
                  <li>
                    <strong>No Reverse Engineering:</strong> You agree not to reverse engineer, decompile, or 
                    disassemble any part of the ScreenMerch platform, software, or services.
                  </li>
                  <li>
                    <strong>Limitation of Liability:</strong> ScreenMerch is not responsible for any damages, 
                    losses, or liabilities arising from your use of the platform, including but not limited to 
                    product sales, customer disputes, or intellectual property claims.
                  </li>
                  <li>
                    <strong>User Responsibility:</strong> You assume all responsibility and liability for the 
                    content you upload, the products you create, and any interactions with customers through 
                    the ScreenMerch platform.
                  </li>
                  <li>
                    <strong>Creator Limit:</strong> ScreenMerch maintains a limit of 20 active creators. 
                    Your application is subject to admin approval, and we reserve the right to accept or 
                    reject applications at our discretion.
                  </li>
                </ul>
              </div>

              <label className="terms-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={isSubmitting}
                  required
                />
                <span>
                  I have read and agree to the Terms of Service and understand that my application 
                  requires admin approval. <span className="required">*</span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="creator-signup-submit-btn"
              disabled={isSubmitting || !agreedToTerms}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner-small"></span>
                  Processing...
                </>
              ) : (
                'Continue with Google Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatorSignupModal;

