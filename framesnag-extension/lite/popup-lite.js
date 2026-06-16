document.addEventListener('DOMContentLoaded', () => {
  const thumbnailBtn = document.getElementById('captureBtn');
  const screenshotBtn = document.getElementById('screenshotBtn');
  const preview = document.getElementById('preview-image');
  const screenshotGrid = document.getElementById('screenshotGrid');
  const thumbnailContainer = document.getElementById('thumbnailContainer');
  const downloadThumbBtn = document.getElementById('downloadThumbBtn');
  const deleteThumbBtn = document.getElementById('deleteThumbBtn');
  const addThumbToFavoritesBtn = document.getElementById('addThumbToFavoritesBtn');

  let screenshotImages = [];
  let thumbnailImage = null;

  // ScreenMerch creator Favorites page (base URL synced from dashboard via screenmerch-sync.js)
  const SCREENMERCH_FAVORITES_URL_DEFAULT = 'https://screenmerch.com/dashboard?tab=favorites';

  async function getScreenmerchFavoritesUrl() {
    try {
      const stored = await chrome.storage.local.get([
        'screenmerch_favorites_base_url',
        'screenmerch_favorites_list_id',
      ]);
      let url = (stored.screenmerch_favorites_base_url || SCREENMERCH_FAVORITES_URL_DEFAULT).trim();
      if (!url.includes('tab=favorites')) {
        url += url.includes('?') ? '&tab=favorites' : '?tab=favorites';
      }
      const listId = (stored.screenmerch_favorites_list_id || '').trim();
      if (listId && !url.includes('list_id=')) {
        url += `&list_id=${encodeURIComponent(listId)}`;
      }
      return url;
    } catch (_) {
      return SCREENMERCH_FAVORITES_URL_DEFAULT;
    }
  }

  // Copy image (data URL) to clipboard and open ScreenMerch Favorites in new tab
  async function addToFavorites(imageDataUrl) {
    if (!imageDataUrl) return;
    const favoritesUrl = await getScreenmerchFavoritesUrl();
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      chrome.tabs.create({ url: favoritesUrl });
    } catch (err) {
      console.error('Clipboard or tab error:', err);
      chrome.tabs.create({ url: favoritesUrl });
    }
  }

  // Download function for images
  function downloadImage(imageUrl, filename) {
    if (imageUrl.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(err => {
          console.error('Download error:', err);
          alert('Failed to download image');
        });
    }
  }

  // Capture screenshot from video
  async function captureScreenshot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const response = await chrome.tabs.sendMessage(tab.id, { action: "captureScreenshot" });

      if (response?.success) {
        const imgData = response.data.dataUrl;
        screenshotImages.push(imgData);
        chrome.storage.local.set({ screenshots: screenshotImages });
        addScreenshotToGrid(imgData);
      } else {
        alert("Screenshot failed. Make sure you're on a YouTube video page.");
      }
    } catch (err) {
      console.error("Screenshot error:", err);
      alert("Screenshot failed: " + err.message);
    }
  }

  function addScreenshotToGrid(dataUrl, indexOverride) {
    const index = typeof indexOverride === 'number' ? indexOverride : screenshotImages.length - 1;
    const container = document.createElement("div");
    container.className = "screenshot-item";

    const img = document.createElement("img");
    img.src = dataUrl;

    const favoritesBtn = document.createElement("button");
    favoritesBtn.textContent = 'Add to Favorites';
    favoritesBtn.className = 'favorites-btn';
    favoritesBtn.addEventListener("click", () => addToFavorites(dataUrl));

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = 'Download';
    downloadBtn.className = 'download-btn';
    downloadBtn.addEventListener("click", () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadImage(dataUrl, `framesnag-screenshot-${timestamp}.png`);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener("click", () => {
      screenshotImages.splice(index, 1);
      chrome.storage.local.set({ screenshots: screenshotImages });
      renderScreenshotGrid();
    });

    container.appendChild(img);
    const btnRow = document.createElement("div");
    btnRow.className = "screenshot-action-row";
    btnRow.appendChild(favoritesBtn);
    btnRow.appendChild(downloadBtn);
    btnRow.appendChild(deleteBtn);
    container.appendChild(btnRow);
    screenshotGrid.appendChild(container);
  }

  function renderScreenshotGrid() {
    screenshotGrid.innerHTML = '';
    screenshotImages.forEach((img, idx) => addScreenshotToGrid(img, idx));
  }

  // Restore screenshots from storage on load
  chrome.storage.local.get(['screenshots'], (result) => {
    if (result.screenshots && Array.isArray(result.screenshots)) {
      screenshotImages = result.screenshots;
      renderScreenshotGrid();
    }
  });

  // Auto-crop function for thumbnails
  function autoCropImage(url, callback) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      let top = 0, bottom = height, left = 0, right = width;
      
      const isWhiteOrBlack = (r, g, b) =>
        (r > 230 && g > 230 && b > 230) || (r < 25 && g < 25 && b < 25);
      
      function scanTop() {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (!isWhiteOrBlack(data[i], data[i+1], data[i+2])) {
              top = y;
              return;
            }
          }
        }
      }
      function scanBottom() {
        for (let y = height - 1; y >= 0; y--) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (!isWhiteOrBlack(data[i], data[i+1], data[i+2])) {
              bottom = y;
              return;
            }
          }
        }
      }
      function scanLeft() {
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            const i = (y * width + x) * 4;
            if (!isWhiteOrBlack(data[i], data[i+1], data[i+2])) {
              left = x;
              return;
            }
          }
        }
      }
      function scanRight() {
        for (let x = width - 1; x >= 0; x--) {
          for (let y = 0; y < height; y++) {
            const i = (y * width + x) * 4;
            if (!isWhiteOrBlack(data[i], data[i+1], data[i+2])) {
              right = x;
              return;
            }
          }
        }
      }
      
      scanTop(); scanBottom(); scanLeft(); scanRight();
      const croppedW = right - left;
      const croppedH = bottom - top;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = croppedW;
      croppedCanvas.height = croppedH;
      const croppedCtx = croppedCanvas.getContext("2d");
      croppedCtx.drawImage(canvas, left, top, croppedW, croppedH, 0, 0, croppedW, croppedH);
      callback(croppedCanvas.toDataURL());
    };
    img.onerror = function() {
      callback(url);
    };
    img.src = url;
  }

  // Fetch thumbnail
  async function fetchThumbnail() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const videoId = url.searchParams.get("v");
      
      if (!videoId) {
        alert("No video ID found. Please make sure you're on a YouTube video page.");
        return;
      }

      const resolutionSelect = document.getElementById('resolutionSelect');
      const selectedResolution = resolutionSelect.value;
      let thumbUrl = `https://img.youtube.com/vi/${videoId}/${selectedResolution}.jpg`;
      
      // Try selected resolution, fallback to others
      try {
        const res = await fetch(thumbUrl, { method: 'HEAD' });
        if (!res.ok) {
          const fallbacks = ['maxresdefault', 'hqdefault', 'sddefault'];
          for (const fallback of fallbacks) {
            const fallbackUrl = `https://img.youtube.com/vi/${videoId}/${fallback}.jpg`;
            const fallbackRes = await fetch(fallbackUrl, { method: 'HEAD' });
            if (fallbackRes.ok) {
              thumbUrl = fallbackUrl;
              resolutionSelect.value = fallback;
              break;
            }
          }
        }
      } catch (err) {
        console.warn("Error checking resolutions:", err);
      }

      // Show the thumbnail
      preview.src = thumbUrl;
      thumbnailContainer.style.display = "block";

      // Auto-crop in background
      autoCropImage(thumbUrl, (croppedDataUrl) => {
        thumbnailImage = croppedDataUrl;
        preview.src = croppedDataUrl;
      });

    } catch (err) {
      console.error("Error fetching thumbnail:", err);
      alert("Error fetching thumbnail: " + err.message);
    }
  }

  // Thumbnail: Add to Favorites (opens ScreenMerch Favorites, copies image to clipboard)
  if (addThumbToFavoritesBtn) {
    addThumbToFavoritesBtn.addEventListener('click', async () => {
      const imgSrc = thumbnailImage || preview.src;
      if (!imgSrc) return;
      await addToFavorites(imgSrc);
    });
  }

  // Thumbnail download button
  if (downloadThumbBtn) {
    downloadThumbBtn.addEventListener('click', async () => {
      if (!thumbnailImage && !preview.src) return;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const videoId = url.searchParams.get("v") || "thumbnail";
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadImage(thumbnailImage || preview.src, `framesnag-thumbnail-${videoId}-${timestamp}.png`);
    });
  }

  // Thumbnail delete button
  if (deleteThumbBtn) {
    deleteThumbBtn.addEventListener('click', () => {
      preview.src = '';
      thumbnailContainer.style.display = 'none';
      thumbnailImage = null;
    });
  }

  // Button event listeners
  thumbnailBtn.addEventListener("click", fetchThumbnail);
  screenshotBtn.addEventListener("click", captureScreenshot);
});
