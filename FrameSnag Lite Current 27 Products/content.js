console.log("--- ScreenMerch Content Script --- LOADED AND RUNNING. If you see this message, the connection should work.");

function formatTimestamp(seconds) {
  const date = new Date(null);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}

function getCurrentVideoTime() {
  const video = document.querySelector('video');
  return video ? video.currentTime : 0;
}

function isScreenMerchWebsite() {
  return window.location.hostname.includes('screenmerch.com') || 
         (window.location.hostname === 'localhost' && window.location.port === '5174');
}

async function grabVideoCanvas(sendResponse) {
  try {
    if (!isScreenMerchWebsite()) {
      sendResponse({ success: false, error: "This extension only works on ScreenMerch website." });
      return;
    }

    const video = document.querySelector('video');
    if (!video) {
      sendResponse({ success: false, error: "No video found. Please make sure you're on a video page in ScreenMerch." });
      return;
    }
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
      sendResponse({ success: false, error: "Video is not ready. Please wait for the video to load." });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentTime = getCurrentVideoTime();
    const timestamp = formatTimestamp(currentTime);
    const dataUrl = canvas.toDataURL('image/png');

    sendResponse({
      success: true,
      data: {
        dataUrl,
        timestamp,
        width: canvas.width,
        height: canvas.height
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request);
  sendResponse({ success: true, message: "Connection successful!" });
  return true;
}); 