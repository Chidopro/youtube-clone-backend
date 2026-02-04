import React from 'react';
import { Link } from 'react-router-dom';
import './CreatorThankYou.css';

const CreatorThankYou = () => {
  return (
    <div className="creator-thank-you">
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
        <Link to="/" className="creator-thank-you-link">
          Go to Homepage
        </Link>
      </div>
    </div>
  );
};

export default CreatorThankYou;
