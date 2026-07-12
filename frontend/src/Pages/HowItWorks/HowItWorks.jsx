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

        <section className="how-it-works-section how-it-works-narrative">
          <h1 className="how-it-works-title">How ScreenMerch Works</h1>

          <p>
            ScreenMerch transforms the best moments from online videos into high-quality, personalized
            merchandise—giving creators a simple new way to monetize the content their audiences already
            love.
          </p>

          <p>
            Every approved creator receives a fully branded online storefront with a personalized
            subdomain, custom logo, colors, favicon, and branding. Instead of directing fans to a generic
            marketplace, each creator has their own destination where their community can browse and
            purchase merchandise inspired by their videos.
          </p>

          <p>
            To make capturing those memorable moments effortless, ScreenMerch provides creators with{' '}
            <strong>FrameSnag</strong>, a free Google Chrome extension developed exclusively for the
            ScreenMerch platform. FrameSnag allows creators to browse YouTube videos and channel
            thumbnails, capture high-quality frames with a single click, and instantly save them to their
            ScreenMerch Favorites page. Those saved images become the artwork available for merchandise,
            eliminating the need to download, edit, or upload images manually.
          </p>

          <p>
            Once images have been added through FrameSnag, fans simply visit the creator&apos;s
            storefront, browse the creator&apos;s collection of favorite images, select the one they love
            most, and place it on a wide variety of premium print-on-demand products. Every product is
            professionally printed at 300 DPI for exceptional image quality, then produced and shipped
            through trusted global fulfillment partners.
          </p>

          <p>
            Creators never have to purchase inventory, package orders, or manage shipping logistics.
            ScreenMerch handles secure payment processing, manufacturing, fulfillment, and customer
            delivery, allowing creators to focus entirely on creating content while earning revenue from
            every qualifying sale.
          </p>

          <p>
            ScreenMerch also supports collaborative growth through its unique Umbrella Creator system.
            Storefront owners can invite trusted collaborators, co-hosts, or team members to create their
            own branded pages within the same storefront. Each umbrella creator manages their own
            collection of favorite images while maintaining separate analytics and earnings, giving
            audiences a seamless shopping experience across an entire creator network.
          </p>

          <p>
            By bringing together video content, image capture, merchandise creation, storefront
            management, fulfillment, and creator collaboration into one integrated platform, ScreenMerch
            provides a complete merchandising ecosystem designed specifically for today&apos;s creator
            economy.
          </p>
        </section>

        <div className="how-it-works-cta-block">
          <div className="how-it-works-cta-primary-col">
            <p className="how-it-works-tagline">
              <strong>Your brand. Your content. Your earnings.</strong>
            </p>
            <button
              type="button"
              className="how-it-works-cta-primary"
              onClick={() => navigate('/subscription-tiers', { state: { intent: 'creator' } })}
            >
              Unlock your free storefront
            </button>
          </div>
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
