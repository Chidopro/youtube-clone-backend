import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJoin } from '../../config/apiConfig';
import './Feed.css';
import './CreatorDirectory.css';
import { RESERVE_SLOT_THEMES, TOTAL_CREATOR_SPOTS } from './reserveSlotThemes';
import { DEMO_STOREFRONT_SUBDOMAIN, TEST_STOREFRONT_SUBDOMAIN } from '../../utils/demoStorefront';
import {
  fetchPublicFavoriteLists,
  publicStorageCardUrl,
  storefrontHubPreviews,
} from '../../utils/favoriteListsApi';
import { HubThumb, rotatingUrl, uniqueUrls, HUB_ROTATE_MS } from './Feed';
import {
  fetchIntroThumbnail,
  readCachedIntroThumbnail,
  writeCachedIntroThumbnail,
} from '../../utils/introThumbnail';
import reserveStorefrontPreview from '../../assets/reserve-storefront-preview.jpg';

function collectSlotShuffleUrls(lists) {
  const ownerId = (lists || []).find((L) => L?.is_primary || L?.slug === 'owner')
    ?.storefront_owner_id;
  const { ownerImages, friendImages, extraImages } = storefrontHubPreviews(lists, ownerId);
  return uniqueUrls(
    [...ownerImages, ...friendImages, ...extraImages].map((u) => publicStorageCardUrl(u, 720))
  ).slice(0, 16);
}

/** Maxfreedom always occupies seat 1; remaining live storefronts fill 2, 3, … in API order. */
function pinSoftLaunchSlots(rawSlots, total) {
  const demoKey = DEMO_STOREFRONT_SUBDOMAIN.toLowerCase();
  const testKey = TEST_STOREFRONT_SUBDOMAIN.toLowerCase();
  const slots = (Array.isArray(rawSlots) ? rawSlots : [])
    .map((s) => ({ ...s }))
    .filter((s) => {
      const sub = (s.subdomain || '').trim().toLowerCase();
      if (!sub) return false;
      if (sub === testKey) return false;
      return true;
    });
  const demoIdx = slots.findIndex(
    (s) => (s.subdomain || '').trim().toLowerCase() === demoKey
  );
  let demo;
  if (demoIdx >= 0) {
    [demo] = slots.splice(demoIdx, 1);
  } else {
    demo = {
      label: DEMO_STOREFRONT_SUBDOMAIN,
      name: DEMO_STOREFRONT_SUBDOMAIN,
      subdomain: DEMO_STOREFRONT_SUBDOMAIN,
      status: 'active',
    };
  }
  return [demo, ...slots].slice(0, total).map((slot, i) => {
    const subdomain = (slot.subdomain || '').trim();
    const name = (slot.name || '').trim();
    const generic = /^store\s+\d+$/i.test((slot.label || '').trim());
    return {
      ...slot,
      spot: i + 1,
      subdomain,
      name,
      label: subdomain || name || (!generic && (slot.label || '').trim()) || `Store ${i + 1}`,
    };
  });
}

/**
 * Apex homepage: How it works card + numbered reserve storefront slots.
 * Reserve → creator signup.
 */
const CreatorDirectory = () => {
  const navigate = useNavigate();
  const cachedThumb = typeof window !== 'undefined' ? readCachedIntroThumbnail() : null;
  const [introThumb, setIntroThumb] = useState(cachedThumb);
  const [claimedCount, setClaimedCount] = useState(1);
  const [takenBySpot, setTakenBySpot] = useState(() => ({
    1: {
      spot: 1,
      label: DEMO_STOREFRONT_SUBDOMAIN,
      name: DEMO_STOREFRONT_SUBDOMAIN,
      subdomain: DEMO_STOREFRONT_SUBDOMAIN,
      status: 'active',
    },
  }));
  const [imagesBySpot, setImagesBySpot] = useState({});
  const [tick, setTick] = useState(() => Math.floor(Date.now() / HUB_ROTATE_MS));

  const availableCount = Math.max(0, TOTAL_CREATOR_SPOTS - claimedCount);
  const firstOpenSpot = RESERVE_SLOT_THEMES.find((slot) => !takenBySpot[slot.spot])?.spot;
  const visibleSlotThemes = RESERVE_SLOT_THEMES.filter(
    (slot) => takenBySpot[slot.spot] || slot.spot === firstOpenSpot
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const thumb = await fetchIntroThumbnail();
        if (cancelled) return;
        setIntroThumb(thumb);
        writeCachedIntroThumbnail(thumb);
      } catch (_) {
        if (!cancelled && !cachedThumb) setIntroThumb(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; cache seeds first paint
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Same-origin /api on screenmerch.com (Netlify → Fly). Direct fly.dev can fail CORS and leave counter at 0.
        const res = await fetch(apiJoin('/api/creators/soft-launch-spots'), {
          credentials: 'omit',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data?.success) return;
        const pinned = pinSoftLaunchSlots(data.taken_slots, TOTAL_CREATOR_SPOTS);
        setClaimedCount(Math.min(TOTAL_CREATOR_SPOTS, pinned.length));
        const map = {};
        pinned.forEach((slot) => {
          if (slot?.spot) map[slot.spot] = slot;
        });
        setTakenBySpot(map);
      } catch (_) {
        /* keep default 0 until next load */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const claimed = Object.values(takenBySpot).filter((slot) => (slot?.subdomain || '').trim());
    if (!claimed.length) {
      setImagesBySpot({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const bySub = {};
      await Promise.all(
        claimed.map(async (slot) => {
          const sub = (slot.subdomain || '').trim().toLowerCase();
          if (!sub || bySub[sub]) return;
          try {
            const { ok, data } = await fetchPublicFavoriteLists(sub, { lite: true });
            if (!ok || !data?.success) return;
            let lists = data.lists || [];
            let urls = collectSlotShuffleUrls(lists);
            if (!urls.length) {
              const full = await fetchPublicFavoriteLists(sub);
              if (full.ok && full.data?.success) {
                lists = full.data.lists || [];
                urls = collectSlotShuffleUrls(lists);
              }
            }
            if (urls.length) bySub[sub] = urls;
          } catch (_) {
            /* leave this window on the gradient fallback */
          }
        })
      );
      if (cancelled) return;
      const map = {};
      claimed.forEach((slot) => {
        const urls = bySub[(slot.subdomain || '').trim().toLowerCase()];
        if (urls?.length) map[slot.spot] = urls;
      });
      setImagesBySpot(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [takenBySpot]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick(Math.floor(Date.now() / HUB_ROTATE_MS));
    }, Math.min(HUB_ROTATE_MS, 4000));
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    Object.entries(imagesBySpot).forEach(([spot, urls]) => {
      const next = rotatingUrl(urls, `spot-${spot}`, tick + 1);
      if (!next) return;
      const img = new Image();
      img.src = next;
    });
  }, [imagesBySpot, tick]);

  const openHowItWorks = () => {
    navigate('/how-it-works');
  };

  /** Open the creator signup window (skip the earnings calculator). */
  const openReserveCta = () => {
    window.dispatchEvent(new CustomEvent('screenmerch:open-creator-signup'));
  };

  return (
    <div className="creator-directory">
      <div className="creator-directory-header">
        <p className="creator-directory-subtitle creator-directory-subtitle-desktop">
          Unlock your Free ScreenMerch storefront, limited access soft launch.
        </p>
        <p className="creator-directory-subtitle creator-directory-subtitle-mobile">
          Free ScreenMerch storefront limited access soft launch
        </p>
      </div>

      <div className="feed creator-directory-grid">
        <div
          className="card intro-directory-card"
          style={{ cursor: 'pointer' }}
          onClick={openHowItWorks}
          onKeyDown={(e) => e.key === 'Enter' && openHowItWorks()}
          role="button"
          tabIndex={0}
          aria-label="How ScreenMerch Works"
        >
          <div className={`intro-directory-preview${introThumb ? ' intro-directory-preview--thumb' : ''}`}>
            {introThumb ? (
              <img
                className="intro-directory-thumb"
                src={introThumb}
                alt=""
              />
            ) : (
              <>
                <span className="intro-directory-preview-kicker">Guide</span>
                <p className="intro-directory-preview-title">How ScreenMerch Works</p>
              </>
            )}
          </div>
          <h2>How ScreenMerch Works</h2>
          <h3>See how moments become merchandise.</h3>
        </div>

        {/* Claimed storefronts plus one open reserve seat — hide empty Spot #n placeholders */}
        {visibleSlotThemes.map((slot) => {
          const taken = takenBySpot[slot.spot];
          const isTaken = Boolean(taken);
          const subdomain = (taken?.subdomain || '').trim().toLowerCase();
          const storeLabel = (taken?.label || subdomain || taken?.name || `Store ${slot.spot}`).trim();
          const storeHref = subdomain ? `https://${subdomain}.screenmerch.com/` : '';
          const canVisit = Boolean(storeHref);
          const shuffleSrc = isTaken
            ? rotatingUrl(imagesBySpot[slot.spot], `spot-${slot.spot}`, tick)
            : null;
          const openPreviewSrc = isTaken ? null : reserveStorefrontPreview;
          const previewSrc = shuffleSrc || openPreviewSrc;
          const isDemo = subdomain === DEMO_STOREFRONT_SUBDOMAIN;
          const captionTitle = !isTaken
            ? 'Limited Free Soft Launch'
            : isDemo
              ? 'Take a Tour'
              : storeLabel;
          const captionBody = !isTaken
            ? 'Claim one of 20 free creator storefronts.'
            : isDemo
              ? 'Explore the storefront, creator tools, and customization features.'
              : (canVisit ? `${subdomain}.screenmerch.com` : 'Soft launch seat claimed');
          const openSlot = () => {
            if (canVisit) {
              window.location.href = isDemo ? `${storeHref}?from=hub` : storeHref;
              return;
            }
            if (!isTaken) openReserveCta();
          };
          return (
            <div
              key={slot.spot}
              className={`card reserve-slot-card${isTaken ? ' reserve-slot-card--taken' : ''}${canVisit ? ' reserve-slot-card--live' : ''}`}
              onClick={isTaken && !canVisit ? undefined : openSlot}
              onKeyDown={
                isTaken && !canVisit
                  ? undefined
                  : (e) => e.key === 'Enter' && openSlot()
              }
              role={isTaken && !canVisit ? 'group' : 'button'}
              tabIndex={isTaken && !canVisit ? -1 : 0}
              aria-label={
                canVisit
                  ? (isDemo ? 'Take a Tour' : `Visit ${storeLabel} storefront`)
                  : isTaken
                    ? `${storeLabel} taken — soft launch seat`
                    : 'Limited Free Soft Launch — claim a free creator storefront'
              }
              aria-disabled={isTaken && !canVisit}
            >
              <div
                className={`reserve-slot-preview pattern-${slot.pattern}${previewSrc ? ' reserve-slot-preview--shuffle' : ''}${openPreviewSrc ? ' reserve-slot-preview--photo' : ''}`}
                style={{ background: slot.gradient }}
              >
                {shuffleSrc ? (
                  <div className="reserve-slot-shuffle" aria-hidden="true">
                    <HubThumb key={shuffleSrc} src={shuffleSrc} emptyLabel="" />
                  </div>
                ) : openPreviewSrc ? (
                  <div className="reserve-slot-shuffle" aria-hidden="true">
                    <img src={openPreviewSrc} alt="" />
                  </div>
                ) : null}
                {isTaken ? (
                  <>
                    {shuffleSrc ? null : (
                      <p className="reserve-slot-store-label">{storeLabel}</p>
                    )}
                    {canVisit ? null : (
                      <span className="reserve-slot-cta-pill reserve-slot-cta-pill--taken">
                        Claimed
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {openPreviewSrc ? null : (
                      <span className="reserve-slot-icon" aria-hidden="true">
                        {slot.icon}
                      </span>
                    )}
                    <span className="reserve-slot-cta-pill">Reserve My Spot</span>
                  </>
                )}
              </div>
              <h2>{captionTitle}</h2>
              <h3>{captionBody}</h3>
            </div>
          );
        })}
      </div>

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
  );
};

export default CreatorDirectory;
