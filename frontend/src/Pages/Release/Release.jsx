import React from 'react';
import { Link } from 'react-router-dom';
import './Release.css';

const Release = () => {
  return (
    <div className="release-page">
      <h1 className="release-title">The Creator Revolution Has a Storefront</h1>
      <p className="release-date">February 28, 2026</p>
      <p className="release-message">
        ScreenMerch is live. Creators can now turn their best moments into merch—choose a video, pick a frame, and make it yours.
      </p>
      <Link to="/" className="release-back">Back to Home</Link>
    </div>
  );
};

export default Release;
