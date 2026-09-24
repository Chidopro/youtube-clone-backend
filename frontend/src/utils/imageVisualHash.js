const HASH_SIZE = 8;
export const VISUAL_HASH_MAX_DISTANCE = 16;

export function averageHashFromImage(img) {
  const canvas = document.createElement('canvas');
  canvas.width = HASH_SIZE;
  canvas.height = HASH_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE);
  const { data } = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);
  const grays = [];
  for (let i = 0; i < HASH_SIZE * HASH_SIZE; i += 1) {
    const j = i * 4;
    grays.push((data[j] + data[j + 1] + data[j + 2]) / 3);
  }
  const avg = grays.reduce((sum, v) => sum + v, 0) / grays.length;
  return grays.map((g) => (g >= avg ? '1' : '0')).join('');
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let n = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) n += 1;
  }
  return n;
}

export function hashesTooClose(a, b, maxDist = VISUAL_HASH_MAX_DISTANCE) {
  return hammingDistance(a, b) <= maxDist;
}

export function hashIsNearSet(hash, hashSet, maxDist = VISUAL_HASH_MAX_DISTANCE) {
  if (!hash || !hashSet || !hashSet.size) return false;
  for (const other of hashSet) {
    if (hashesTooClose(hash, other, maxDist)) return true;
  }
  return false;
}

export async function loadAverageHash(url) {
  const src = String(url || '').trim();
  if (!src) return '';

  const hashFromImage = (img) => {
    try {
      return averageHashFromImage(img) || '';
    } catch {
      return '';
    }
  };

  const hashFromElement = (imageSrc, crossOrigin) =>
    new Promise((resolve) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(hashFromImage(img));
      img.onerror = () => resolve('');
      img.src = imageSrc;
    });

  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const hashed = await hashFromElement(objectUrl, false);
        if (hashed) return hashed;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  } catch {
    /* fall through to image element */
  }

  return hashFromElement(src, true);
}
