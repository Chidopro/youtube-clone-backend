import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './CreatorThankYou.css';

const CreatorThankYou = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAwaitingApprovalModal, setShowAwaitingApprovalModal] = useState(false);

  useEffect(() => {
    const existingPending = searchParams.get('existing_pending');
    if (existingPending === '1') {
      setShowAwaitingApprovalModal(true);
      searchParams.delete('existing_pending');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="creator-thank-you">
      {showAwaitingApprovalModal && (
        <div className="creator-thank-you-modal-overlay" onClick={() => setShowAwaitingApprovalModal(false)}>
          <div className="creator-thank-you-modal" onClick={e => e.stopPropagation()}>
            <div className="creator-thank-you-modal-icon">ℹ️</div>
            <h2>This email is already registered</h2>
            <p>
              This email address is already registered and is <strong>awaiting approval</strong>.
              You do not need to sign up again. We will notify you once your account is approved.
            </p>
            <button
              type="button"
              className="creator-thank-you-modal-btn"
              onClick={() => setShowAwaitingApprovalModal(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
      <div className="creator-thank-you-card">
        <div className="creator-thank-you-icon">✓</div>
        <h1>Thank you for signing up!</h1>
        <p className="creator-thank-you-message">
          Your creator account has been submitted successfully. Our team will review your
          application and approve your account shortly. You’ll receive an email at the
          address you signed up with once your account is approved.
        </p>
        <p className="creator-thank-you-note">
          In the meantime, feel free to explore ScreenMerch and see how creators like you
          are earning from their content.
        </p>
        <Link to="/subscription-tiers" className="creator-thank-you-btn">
          Back to Creator Calculator
        </Link>
        <Link
          to="/"
          className="creator-thank-you-link"
          onClick={() => {
            try {
              sessionStorage.setItem('creator_thank_you_go_home', '1');
            } catch (_) {}
            setShowAwaitingApprovalModal(false);
          }}
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
};

export default CreatorThankYou;
