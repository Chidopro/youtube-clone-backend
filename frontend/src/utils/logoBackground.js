/**
 * Knock out a solid white (or near-white) backdrop so a logo can sit on a
 * colored header. Only pixels connected to the image edge are cleared, so
 * white inside the mark is kept. Empty canvas around the mark is then trimmed
 * so wordmarks display at the header size instead of looking tiny.
 */
const WHITE_THRESHOLD = 240;
const croppedLogoUrls = new Map();

function isNearWhite(r, g, b, a, threshold) {
  if (a < 8) return true;
  return r >= threshold && g >= threshold && b >= threshold;
}

function pngFileName(name) {
  const base = String(name || 'logo').replace(/\.[^.]+$/, '');
  return `${base || 'logo'}.png`;
}

export function floodKnockoutWhite(imageData, threshold = WHITE_THRESHOLD) {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const stack = [];

  const idx = (x, y) => y * width + x;
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = idx(x, y);
    if (visited[i]) return;
    visited[i] = 1;
    const o = i * 4;
    if (isNearWhite(data[o], data[o + 1], data[o + 2], data[o + 3], threshold)) {
      stack.push(i);
    }
  };

  for (let x = 0; x < width; x++) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    consider(0, y);
    consider(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    data[o + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }

  return imageData;
}

export function trimTransparentImageData(imageData, { paddingRatio = 0.06 } = {}) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) return imageData;

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const padX = Math.max(2, Math.round(contentW * paddingRatio));
  const padY = Math.max(2, Math.round(contentH * paddingRatio));
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  if (cropW >= width * 0.97 && cropH >= height * 0.97) return imageData;

  const cropped = new ImageData(cropW, cropH);
  const src = data;
  const dst = cropped.data;
  for (let y = 0; y < cropH; y++) {
    const srcRow = ((minY + y) * width + minX) * 4;
    dst.set(src.subarray(srcRow, srcRow + cropW * 4), y * cropW * 4);
  }
  return cropped;
}

function processLogoImageData(imageData, threshold = WHITE_THRESHOLD) {
  floodKnockoutWhite(imageData, threshold);
  return trimTransparentImageData(imageData);
}

function canvasFromImageData(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return canvas;
}

function blobFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not process logo'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function knockoutLogoWhiteBackground(file, { threshold = WHITE_THRESHOLD } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      Promise.resolve()
        .then(async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          if (!canvas.width || !canvas.height) {
            URL.revokeObjectURL(url);
            resolve(file);
            return;
          }
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const processed = processLogoImageData(
            ctx.getImageData(0, 0, canvas.width, canvas.height),
            threshold
          );
          const out = canvasFromImageData(processed);
          const blob = await blobFromCanvas(out);
          URL.revokeObjectURL(url);
          resolve(new File([blob], pngFileName(file.name), { type: 'image/png' }));
        })
        .catch((err) => {
          URL.revokeObjectURL(url);
          reject(err);
        });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read logo image'));
    };
    img.src = url;
  });
}

/**
 * Crop empty canvas around a custom logo so it can use the normal header
 * wordmark size. Loads a CORS copy so the visible <img> does not need
 * crossOrigin. Returns a blob URL, or null if no crop is needed.
 */
export function cropCustomLogoFromUrl(src, { threshold = WHITE_THRESHOLD } = {}) {
  return new Promise((resolve) => {
    if (!src || src.startsWith('blob:')) {
      resolve(null);
      return;
    }
    if (croppedLogoUrls.has(src)) {
      resolve(croppedLogoUrls.get(src));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        if (!canvas.width || !canvas.height) {
          resolve(null);
          return;
        }
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const processed = processLogoImageData(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
          threshold
        );
        if (processed.width === canvas.width && processed.height === canvas.height) {
          croppedLogoUrls.set(src, null);
          resolve(null);
          return;
        }
        blobFromCanvas(canvasFromImageData(processed))
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            croppedLogoUrls.set(src, url);
            resolve(url);
          })
          .catch(() => resolve(null));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
