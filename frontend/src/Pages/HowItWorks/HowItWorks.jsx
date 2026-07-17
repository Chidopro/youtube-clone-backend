import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiJoin } from '../../config/apiConfig';
import './HowItWorks.css';

const INTRO_TITLE = 'ScreenMerch Introduction Video';
const INTRO_CACHE_KEY = 'sm_how_it_works_intro_video';

const isIntroVideo = (v) => {
  const title = (v?.title || '').trim().toLowerCase();
  return title === INTRO_TITLE.toLowerCase() || /screenmerch\s*introduction/i.test(v?.title || '');
};

const normalizeIntro = (raw) => {
  if (!raw) return null;
  const video_url = (raw.video_url || '').trim() || null;
  const thumbnail = (raw.thumbnail || raw.thumbnail_url || '').trim() || null;
  if (!video_url && !thumbnail) return null;
  return {
    id: raw.id || null,
    title: raw.title || INTRO_TITLE,
    video_url,
    thumbnail,
    channelTitle: raw.channelTitle || 'ScreenMerch',
  };
};

const readCachedIntro = () => {
  try {
    const raw = localStorage.getItem(INTRO_CACHE_KEY);
    if (!raw) return null;
    return normalizeIntro(JSON.parse(raw));
  } catch (_) {
    return null;
  }
};

const writeCachedIntro = (video) => {
  try {
    if (!video) {
      localStorage.removeItem(INTRO_CACHE_KEY);
      return;
    }
    localStorage.setItem(INTRO_CACHE_KEY, JSON.stringify(video));
  } catch (_) {
    /* ignore */
  }
};

const HowItWorks = () => {
  const navigate = useNavigate();
  const cached = typeof window !== 'undefined' ? readCachedIntro() : null;
  const [video, setVideo] = useState(cached);
  const [loading, setLoading] = useState(!cached?.video_url);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cached?.video_url) setLoading(true);
      try {
        // Fast path: dedicated intro endpoint
        let match = null;
        try {
          const res = await fetch(apiJoin('/api/public/intro-video'));
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data?.success && data.video) match = normalizeIntro(data.video);
          }
        } catch (_) {
          /* fall through */
        }

        // Fallback: scan videos list (older backends / deploy lag)
        if (!match) {
          const res = await fetch(apiJoin('/api/videos?limit=200'));
          if (!res.ok) throw new Error('Could not load videos');
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          match = normalizeIntro(list.find(isIntroVideo) || null);
        }

        if (!cancelled) {
          setVideo(match);
          writeCachedIntro(match);
        }
      } catch (_) {
        if (!cancelled && !cached?.video_url) setVideo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; cache seeds first paint
  }, []);

  const poster = video?.thumbnail || undefined;
  const showPlayer = Boolean(video?.video_url);
  const showEmpty = !loading && !showPlayer && !poster;

  return (
    <div className="how-it-works-page">
      <div className="how-it-works-inner">
        <p className="how-it-works-eyebrow">ScreenMerch Limited Access</p>

        <div className="how-it-works-player-wrap">
          {poster && !showPlayer ? (
            <img className="how-it-works-poster" src={poster} alt="" />
          ) : null}
          {loading && !poster && !showPlayer ? (
            <div className="how-it-works-player-placeholder">Loading video…</div>
          ) : null}
          {showPlayer ? (
            <video
              className="how-it-works-player"
              controls
              playsInline
              preload="metadata"
              poster={poster}
              src={video.video_url}
            >
              Your browser does not support the video tag.
            </video>
          ) : null}
          {showEmpty ? (
            <div className="how-it-works-player-placeholder">
              Introduction video is being prepared. Check back soon, or reserve your free storefront below.
            </div>
          ) : null}
        </div>

        <section className="how-it-works-section how-it-works-narrative">
          <h1 className="how-it-works-title">How ScreenMerch Works</h1>

          <p>
            ScreenMerch transforms the best moments from videos into high-quality, personalized
            merchandise, giving creators a simple new way to monetize the content their audiences already
            love.
          </p>

          <p>
            Every approved creator receives a fully branded online storefront with a personalized
            subdomain, page color editor, favicon, and a header area for their own logo. Instead of
            directing fans to a generic marketplace, each creator has their own destination where their
            community can browse and purchase merchandise inspired by their videos.
          </p>

          <p>
            To make capturing those memorable moments effortless, ScreenMerch provides creators with{' '}
            <strong>FrameSnag</strong>, a free Google Chrome extension developed exclusively for the
            ScreenMerch platform. FrameSnag allows creators to browse their YouTube videos, capture
            high-quality frames and thumbnail images with a single click, and instantly save them to their
            ScreenMerch Favorites page. Those saved images become the artwork available for merchandise,
            eliminating the need to download, edit, or upload images manually.
          </p>

          <p>
            Once favorites and video shorts are on the storefront, fans simply visit the creator&apos;s
            storefront, browse the creator&apos;s collection, select the one they love most, and place it
            on a wide variety of premium print-on-demand products. Every product image is professionally
            printed at 300 DPI for exceptional quality, then produced and shipped through trusted global
            fulfillment partners.
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
            own branded pages within the same storefront, giving audiences a seamless shopping experience
            across an entire creator network. Each umbrella creator manages their own video shorts and
            favorite images, with separate analytics and earnings, so tracking sales, popular images, and
            payouts stays simple.
          </p>

          <p>
            By bringing together video content, image capture, merchandise creation, storefront
            management, fulfillment, and creator collaboration into one integrated platform, ScreenMerch
            provides a complete merchandising ecosystem designed specifically for today&apos;s creator
            economy.
          </p>
        </section>

        <p className="how-it-works-tagline">
          <strong>Your brand. Your content. Your earnings.</strong>
        </p>

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
