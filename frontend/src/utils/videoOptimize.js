import { apiJoin } from '../config/apiConfig';

export function isOptimizedPlaybackUrl(url) {
  return /_w720t\.|_w720\./i.test(String(url || ''));
}

export function needsVideoOptimize(video) {
  const url = String(video?.video_url || '');
  if (!url || /youtube\.com|youtu\.be/i.test(url)) return false;
  return !isOptimizedPlaybackUrl(url);
}

const VIDEOS2_MARKER = '/storage/v1/object/public/videos2/';

/** Same naming Caroline / DJ Panda use: original.mp4 → original_w720.mp4. */
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
  base = base.replace(/(_w720t|_w720|_web)$/i, '');
  return [...new Set([`${root}${base}_w720.mp4`, `${root}${base}_w720t.mp4`])];
}

/**
 * Play the stored file immediately.
 * Do not guess a _w720 URL that may 404 for ~10s before the original starts.
 */
export function playbackUrlForVideo(video) {
  const url = String(video?.video_url || '').split('?')[0];
  if (!url || /youtube\.com|youtu\.be/i.test(url)) return url;
  if (isOptimizedPlaybackUrl(url)) return url;
  return url;
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
