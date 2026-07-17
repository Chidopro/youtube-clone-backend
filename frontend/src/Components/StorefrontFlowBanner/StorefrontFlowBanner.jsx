import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import '../../Pages/Home/Home.css';

/**
 * Same launch line + 1-2-3 storefront bar as Home (read-only).
 * Keeps Favorites / Friends List visually congruent with the storefront homepage.
 */
const StorefrontFlowBanner = () => {
  const { creatorSettings } = useCreator();

  useEffect(() => {
    if (!creatorSettings?.primary_color || !creatorSettings?.secondary_color) return;
    const bars = document.querySelectorAll('.user-flow-section');
    bars.forEach((bar) => {
      bar.style.setProperty(
        'background',
        `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)`,
        'important'
      );
    });
  }, [creatorSettings?.primary_color, creatorSettings?.secondary_color]);

  const gradientStyle =
    creatorSettings?.primary_color && creatorSettings?.secondary_color
      ? {
          background: `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%) !important`,
        }
      : undefined;

  return (
    <>
      <Link
        to="/release"
        className="home-launch-banner"
        aria-label="Launch announcement: The Content Creator Revolution Now Has a Storefront"
      >
        The Content Creator Revolution Now Has a Storefront.
      </Link>
      <div className="user-flow-section" style={{ position: 'relative', ...gradientStyle }}>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Choose Video</h3>
              <p>Browse and select your favorite video content</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Select Screenshot</h3>
              <p>Select the perfect moment to capture</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Make Merch</h3>
              <p>Create custom products with your screenshot</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StorefrontFlowBanner;
