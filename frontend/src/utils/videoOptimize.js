import { apiJoin } from '../config/apiConfig';

export function isOptimizedPlaybackUrl(url) {
  return /_w720t\.|_w720\./i.test(String(url || ''));
}

export function needsVideoOptimize(video) {
  const url = String(video?.video_url || '');
  if (!url || /youtube\.com|youtu\.be/i.test(url)) return false;
  return !isOptimizedPlaybackUrl(url);
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

export function screenshotSourceUrl(video) {
  if (!video) return '';
  return video.source_video_url || video.video_url || '';
}
