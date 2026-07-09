import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { AdminService } from '../../utils/adminService';
import './Feed.css';
import './CreatorDirectory.css';
import { RESERVE_SLOT_THEMES, TOTAL_CREATOR_SPOTS } from './reserveSlotThemes';

export const SCREENMERCH_INTRO_TITLE = 'ScreenMerch Introduction Video';

const DEFAULT_INTRO = {
  id: null,
  title: SCREENMERCH_INTRO_TITLE,
  channelTitle: 'ScreenMerch',
  thumbnail: 'https://via.placeholder.com/640x360/667eea/ffffff?text=ScreenMerch+Intro',
};

const INTRO_LOCAL_KEY = 'sm_homepage_intro_video';

/**
 * Apex homepage: ScreenMerch intro card + 20 numbered reserve storefront slots (7×3 grid).
 * Reserve → creator signup. Intro editable by master admin (video + thumbnail).
 */
const CreatorDirectory = ({ introVideo = null, onIntroUpdated = null }) => {
  const navigate = useNavigate();
  const [intro, setIntro] = useState(introVideo || DEFAULT_INTRO);
  const [canEditIntro, setCanEditIntro] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [title, setTitle] = useState(SCREENMERCH_INTRO_TITLE);
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const videoInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  const claimedCount = 0; // wire to approved creators later
  const availableCount = TOTAL_CREATOR_SPOTS - claimedCount;

  useEffect(() => {
    if (introVideo) {
      setIntro(introVideo);
      setTitle(introVideo.title || SCREENMERCH_INTRO_TITLE);
      return;
    }
    try {
      const raw = localStorage.getItem(INTRO_LOCAL_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.thumbnail || saved?.video_url) {
          setIntro({ ...DEFAULT_INTRO, ...saved, title: SCREENMERCH_INTRO_TITLE });
        }
      }
    } catch (_) {
      /* ignore */
    }
  }, [introVideo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const isMaster = await AdminService.isMasterAdmin();
        if (!cancelled) setCanEditIntro(!!isMaster);
      } catch (_) {
        if (!cancelled) setCanEditIntro(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openIntro = () => {
    if (intro?.id) {
      navigate(`/video/${intro.categoryId || 0}/${intro.id}`);
    }
  };

  /** Same path as Navbar "Become a creator" → earnings/signup flow. */
  const openReserveCta = () => {
    navigate('/subscription-tiers', { state: { intent: 'creator' } });
  };

  const openEdit = (e) => {
    e.stopPropagation();
    setEditMsg('');
    setVideoFile(null);
    setThumbFile(null);
    setTitle(SCREENMERCH_INTRO_TITLE);
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
  };

  const saveIntro = async (e) => {
    e.preventDefault();
    if (!videoFile && !thumbFile && !intro?.id) {
      setEditMsg('Choose a video and/or thumbnail to update the intro card.');
      return;
    }
    if (!videoFile && !intro?.video_url && !intro?.id) {
      setEditMsg('Please select a video file for the ScreenMerch introduction.');
      return;
    }
    if (!thumbFile && !intro?.thumbnail) {
      setEditMsg('Please select a thumbnail image (16:9 recommended).');
      return;
    }

    setSaving(true);
    setEditMsg('');
    try {
      const user = await AdminService.getCurrentUser();
      if (!user?.id) {
        setEditMsg('Sign in as master admin to edit the intro card.');
        return;
      }

      let videoUrl = intro.video_url || null;
      let thumbUrl = intro.thumbnail || null;
      const stamp = Date.now();

      if (videoFile) {
        if (videoFile.size > 100 * 1024 * 1024) {
          setEditMsg('Video must be under 100MB (about 2 minutes or less).');
          return;
        }
        const ext = videoFile.name.split('.').pop() || 'mp4';
        const path = `screenmerch-intro/${stamp}.${ext}`;
        const { error: upErr } = await supabase.storage.from('videos2').upload(path, videoFile, {
          cacheControl: '3600',
          upsert: true,
        });
        if (upErr) throw new Error(upErr.message);
        videoUrl = supabase.storage.from('videos2').getPublicUrl(path).data.publicUrl;
      }

      if (thumbFile) {
        if (thumbFile.size > 10 * 1024 * 1024) {
          setEditMsg('Thumbnail must be under 10MB.');
          return;
        }
        const ext = thumbFile.name.split('.').pop() || 'jpg';
        const path = `screenmerch-intro/${stamp}_thumb.${ext}`;
        const { error: thErr } = await supabase.storage.from('thumbnails').upload(path, thumbFile, {
          cacheControl: '3600',
          upsert: true,
        });
        if (thErr) throw new Error(thErr.message);
        thumbUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        title: SCREENMERCH_INTRO_TITLE,
        description:
          'ScreenMerch introduction — watch how it works, then reserve your free storefront.',
        channelTitle: 'ScreenMerch',
        video_url: videoUrl,
        thumbnail: thumbUrl,
        user_id: user.id,
        verification_status: 'screenmerch_homepage_intro',
        updated_at: new Date().toISOString(),
      };

      let savedRow = null;
      if (intro?.id && String(intro.id) !== 'screenmerch-intro') {
        const { data, error } = await supabase
          .from('videos2')
          .update(payload)
          .eq('id', intro.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        savedRow = data;
      } else {
        const { data: existing } = await supabase
          .from('videos2')
          .select('id')
          .ilike('title', SCREENMERCH_INTRO_TITLE)
          .limit(1);
        if (existing?.[0]?.id) {
          const { data, error } = await supabase
            .from('videos2')
            .update(payload)
            .eq('id', existing[0].id)
            .select()
            .single();
          if (error) throw new Error(error.message);
          savedRow = data;
        } else {
          const { data, error } = await supabase
            .from('videos2')
            .insert([{ ...payload, created_at: new Date().toISOString() }])
            .select()
            .single();
          if (error) throw new Error(error.message);
          savedRow = data;
        }
      }

      const next = {
        id: savedRow?.id || intro.id,
        title: SCREENMERCH_INTRO_TITLE,
        channelTitle: 'ScreenMerch',
        thumbnail: thumbUrl || savedRow?.thumbnail,
        video_url: videoUrl || savedRow?.video_url,
        categoryId: savedRow?.categoryId || 0,
      };
      setIntro(next);
      try {
        localStorage.setItem(INTRO_LOCAL_KEY, JSON.stringify(next));
      } catch (_) {
        /* ignore */
      }
      if (typeof onIntroUpdated === 'function') onIntroUpdated(next);
      setEditMsg('Intro card updated.');
      setTimeout(() => {
        setEditOpen(false);
        setEditMsg('');
      }, 800);
    } catch (err) {
      setEditMsg(err.message || 'Could not save intro video.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="creator-directory">
      <div className="creator-directory-header">
        <p className="creator-directory-subtitle">
          Watch How It Works, then unlock your Free storefront for ScreenMerch&apos;s limited access soft launch.
        </p>
        <div className="creator-directory-counter" aria-live="polite">
          <span>
            <strong>{claimedCount}</strong> of <strong>{TOTAL_CREATOR_SPOTS}</strong> spots claimed
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong>{availableCount}</strong> available
          </span>
        </div>
      </div>

      <div className="feed creator-directory-grid">
        {/* First card — ScreenMerch introduction only */}
        <div
          className="card intro-directory-card"
          style={{ cursor: intro?.id ? 'pointer' : 'default' }}
          onClick={openIntro}
          onKeyDown={(e) => e.key === 'Enter' && openIntro()}
          role={intro?.id ? 'button' : undefined}
          tabIndex={intro?.id ? 0 : undefined}
        >
          <div style={{ position: 'relative' }}>
            <span className="intro-directory-badge">How it works</span>
            {canEditIntro && (
              <button
                type="button"
                className="intro-directory-edit-btn"
                onClick={openEdit}
                title="Edit ScreenMerch introduction video & thumbnail"
              >
                Edit intro
              </button>
            )}
            <img
              src={intro.thumbnail || DEFAULT_INTRO.thumbnail}
              alt={intro.title || SCREENMERCH_INTRO_TITLE}
            />
          </div>
          <h2>{SCREENMERCH_INTRO_TITLE}</h2>
          <h3>ScreenMerch</h3>
        </div>

        {/* 20 numbered reserve storefront slots */}
        {RESERVE_SLOT_THEMES.map((slot) => (
          <div
            key={slot.spot}
            className="card reserve-slot-card"
            onClick={openReserveCta}
            onKeyDown={(e) => e.key === 'Enter' && openReserveCta()}
            role="button"
            tabIndex={0}
            aria-label={`Reserve storefront spot number ${slot.spot}`}
          >
            <div
              className={`reserve-slot-preview pattern-${slot.pattern}`}
              style={{ background: slot.gradient }}
            >
              <span className="reserve-slot-number">Spot #{slot.spot}</span>
              <span className="reserve-slot-icon" aria-hidden="true">
                {slot.icon}
              </span>
              <p className="reserve-slot-tagline">{slot.tagline}</p>
              <span className="reserve-slot-cta-pill">Reserve — free</span>
            </div>
            <h2>Reserve your storefront</h2>
            <h3>
              Limited to {TOTAL_CREATOR_SPOTS} creators · Spot #{slot.spot}
            </h3>
          </div>
        ))}
      </div>

      {editOpen && (
        <div className="intro-edit-overlay" onClick={closeEdit} role="presentation">
          <div
            className="intro-edit-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-edit-title"
          >
            <button type="button" className="intro-edit-close" onClick={closeEdit} aria-label="Close">
              ×
            </button>
            <h2 id="intro-edit-title">Edit ScreenMerch introduction</h2>
            <p className="intro-edit-hint">
              This first homepage card is reserved for ScreenMerch only. Upload a short highlight clip
              (max 100MB — about 2 minutes or less) and a 16:9 thumbnail.
            </p>
            <form onSubmit={saveIntro}>
              <label className="intro-edit-label">
                Title (fixed)
                <input type="text" value={title} readOnly disabled />
              </label>
              <label className="intro-edit-label">
                Video file
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                />
              </label>
              {videoFile && (
                <p className="intro-edit-file">
                  {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <label className="intro-edit-label">
                Thumbnail image (16:9)
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                />
              </label>
              {thumbFile && (
                <p className="intro-edit-file">
                  {thumbFile.name} ({(thumbFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {editMsg && <p className="intro-edit-msg">{editMsg}</p>}
              <div className="intro-edit-actions">
                <button type="button" onClick={closeEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="intro-edit-save" disabled={saving}>
                  {saving ? 'Saving…' : 'Save intro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorDirectory;
