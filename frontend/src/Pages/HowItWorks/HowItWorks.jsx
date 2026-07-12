import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API_CONFIG from '../../config/apiConfig';
import './HowItWorks.css';

const INTRO_TITLE = 'ScreenMerch Introduction Video';

const isIntroVideo = (v) => {
  const title = (v?.title || '').trim().toLowerCase();
  return title === INTRO_TITLE.toLowerCase() || /screenmerch\s*introduction/i.test(v?.title || '');
};

const HowItWorks = () => {
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const base = (API_CONFIG?.BASE_URL || 'https://screenmerch.fly.dev').replace(/\/$/, '');
        const res = await fetch(`${base}/api/videos`);
        if (!res.ok) throw new Error('Could not load videos');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const match = list.find(isIntroVideo) || null;
        if (!cancelled) setVideo(match);
      } catch (_) {
        if (!cancelled) setVideo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="how-it-works-page">
      <div className="how-it-works-inner">
        <p className="how-it-works-eyebrow">ScreenMerch soft launch</p>
        <h1 className="how-it-works-title">How it works</h1>
        <p className="how-it-works-lede">
          Watch the introduction, then see how fans turn a video moment into merch — and how creators
          own the storefront.
        </p>

        <div className="how-it-works-player-wrap">
          {loading && <div className="how-it-works-player-placeholder">Loading video…</div>}
          {!loading && video?.video_url && (
            <video
              className="how-it-works-player"
              controls
              playsInline
              poster={video.thumbnail || undefined}
              src={video.video_url}
            >
              Your browser does not support the video tag.
            </video>
          )}
          {!loading && !video?.video_url && (
            <div className="how-it-works-player-placeholder">
              Introduction video is being prepared. Check back soon, or reserve your free storefront below.
            </div>
          )}
        </div>

        <section className="how-it-works-section">
          <h2>What you just saw</h2>
          <ol className="how-it-works-steps">
            <li>
              <strong>Choose a video</strong>
              <span>Fans browse content on a creator&apos;s branded ScreenMerch storefront.</span>
            </li>
            <li>
              <strong>Select a screenshot</strong>
              <span>They pause on the moment they love and capture it for print.</span>
            </li>
            <li>
              <strong>Make merch</strong>
              <span>That image goes on products and checks out — inventory and shipping handled for you.</span>
            </li>
          </ol>
        </section>

        <section className="how-it-works-section">
          <h2>Why this is different</h2>
          <p>
            ScreenMerch is not a marketplace bolted onto someone else&apos;s brand. Every approved creator
            gets a personalized subdomain, branding control, and a dashboard for videos, analytics, and
            payouts. Fans stay inside <em>your</em> world while they shop.
          </p>
          <p>
            Most products pay creators <strong>$6 per sale</strong>. Production and shipping run through
            trusted fulfillment partners. You focus on content.
          </p>
        </section>

        <section className="how-it-works-section">
          <h2>Grow with umbrella creators</h2>
          <p>
            Storefront owners can invite umbrella creators — trusted collaborators and creative partners —
            onto the same branded subdomain. Each collaborator gets an attributed page; sales are tracked
            per page. ScreenMerch pays the storefront owner for direct storefront earnings; the owner pays
            umbrella creators when owed balances reach the platform minimum (typically $50).
          </p>
          <p>
            Details on payouts, taxes, and responsibilities are in our{' '}
            <Link to="/terms-of-service">Terms of Service</Link> and{' '}
            <Link to="/faq">FAQ</Link>.
          </p>
        </section>

        <section className="how-it-works-section">
          <h2>Soft launch — limited free storefronts</h2>
          <p>
            ScreenMerch is offering a limited number of free storefronts for this soft launch. Reserve a
            spot, complete creator signup, and wait for admin approval. Subdomains may take up to 24 hours
            after approval.
          </p>
        </section>

        <div className="how-it-works-cta-row">
          <button
            type="button"
            className="how-it-works-cta-primary"
            onClick={() => navigate('/subscription-tiers', { state: { intent: 'creator' } })}
          >
            Unlock your free storefront
          </button>
          <Link to="/faq" className="how-it-works-cta-secondary">
            Read the FAQ
          </Link>
        </div>

        <Link to="/" className="how-it-works-back">
          ← Back to home
        </Link>
      </div>
    </div>
  );
};

export default HowItWorks;
