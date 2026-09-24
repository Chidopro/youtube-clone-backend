import { apiJoin } from '../config/apiConfig';

export function isOptimizedPlaybackUrl(url) {
  return /_w720t\d*\.|_w720\./i.test(String(url || ''));
}

export function needsVideoOptimize(video) {
  const url = String(video?.video_url || '');
  if (!url || /youtube\.com|youtu\.be/i.test(url)) return false;
  return !isOptimizedPlaybackUrl(url);
}

const VIDEOS2_MARKER = '/storage/v1/object/public/videos2/';

/** Same naming Caroline / DJ Panda use: original.mp4 → original_w720.mp4. Prefer the transcoded file. */
export function candidateWebPlaybackUrls(url) {
  const raw = String(url || '').split('?')[0];
  if (!raw || isOptimizedPlaybackUrl(raw) || /youtube\.com|youtu\.be/i.test(raw)) return [];
  const idx = raw.indexOf(VIDEOS2_MARKER);
  if (idx < 0) return [];
  const root = raw.slice(0, idx + VIDEOS2_MARKER.length);
  let rel = raw.slice(idx + VIDEOS2_MARKER.length);
  try {
    rel = decodeURIComponent(rel);
  } catch (_) {
    /* keep raw path */
  }
  const dot = rel.lastIndexOf('.');
  let base = dot >= 0 ? rel.slice(0, dot) : rel;
  base = base.replace(/(_w720t\d*|_w720|_web)$/i, '');
  return [...new Set([
    `${root}${base}_w720t2.mp4`,
    `${root}${base}_w720t.mp4`,
    `${root}${base}_w720.mp4`,
  ])];
}

/**
 * Play the Jenny / Samurai Dog file: original_w720t.mp4, or original_w720t2.mp4
 * after a recode. Unix-timestamp names are not on that path.
 */
export function playbackUrlForVideo(video) {
  const raw = String(video?.video_url || '').trim();
  if (!raw || /youtube\.com|youtu\.be/i.test(raw)) return raw;
  const path = raw.split('?')[0];
  const qs = raw.includes('?') ? `?${raw.split('?').slice(1).join('?')}` : '';
  const stable = path.replace(/_w720t\d{5,}\.mp4$/i, '_w720t2.mp4');
  if (stable !== path) return `${stable}${qs || '?v=2'}`;
  if (isOptimizedPlaybackUrl(path)) return `${stable}${qs}`;
  return raw;
}

/**
 * Desktop / large screens play the original upload (source_video_url).
 * Phones keep the small _w720t file so Watch can start on cellular.
 */
export function playerSrcForVideo(video, { preferOriginal = false } = {}) {
  const playback = playbackUrlForVideo(video) || String(video?.video_url || '').trim();
  if (!preferOriginal) return playback;
  const source = String(video?.source_video_url || '').trim();
  if (source && !isOptimizedPlaybackUrl(source)) return source;
  return playback;
}

/** Warm the small playback file as soon as Watch is tapped (Samurai Dog path). */
export function prefetchVideoPlayback(video) {
  const href = playbackUrlForVideo(video) || String(video?.video_url || '').trim();
  if (!href || !/^https?:/i.test(href)) return;
  try {
    const already = Array.from(document.head.querySelectorAll('link[data-sm-video-preload]')).some(
      (el) => el.getAttribute('data-sm-video-preload') === href
    );
    if (already) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = href;
    link.setAttribute('data-sm-video-preload', href);
    document.head.appendChild(link);
  } catch (_) {
    /* ignore */
  }
}

/** Ask the backend to make a smoother H.264 playback file. Non-blocking. */
export function requestVideoOptimize({ videoId, videoUrl } = {}) {
  const id = videoId ? String(videoId).trim() : '';
  const url = videoUrl ? String(videoUrl).trim() : '';
  if (!id && !url) return Promise.resolve(null);
  if (url && /youtube\.com|youtu\.be/i.test(url)) return Promise.resolve(null);
  return fetch(apiJoin('/api/videos/optimize'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      ...(id ? { video_id: id } : {}),
      ...(url ? { video_url: url } : {}),
    }),
  })
    .then((res) => res.json().catch(() => null))
    .catch((err) => {
      console.warn('Video optimize request failed:', err);
      return null;
    });
}

/** Poll until video_url is a _w720 file, or give up so upload can finish. */
export async function waitForOptimizedPlayback({ videoId, videoUrl, timeoutMs = 45000 } = {}) {
  const started = Date.now();
  let result = await requestVideoOptimize({ videoId, videoUrl });
  if (result?.video_url && isOptimizedPlaybackUrl(result.video_url)) return result;
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    result = await requestVideoOptimize({ videoId, videoUrl });
    if (result?.video_url && isOptimizedPlaybackUrl(result.video_url)) return result;
  }
  return result;
}

export function screenshotSourceUrl(video) {
  if (!video) return '';
  return video.source_video_url || video.video_url || '';
}
