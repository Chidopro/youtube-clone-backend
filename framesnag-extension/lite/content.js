// FrameSnag Content Script - Captures video frames from YouTube

function formatTimestamp(seconds) {
  const date = new Date(null);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}

function getCurrentVideoTime() {
  const video = document.querySelector('video');
  return video ? video.currentTime : 0;
}

async function grabVideoCanvas(sendResponse) {
  try {
    const video = document.querySelector('video');
    if (!video) {
      sendResponse({ success: false, error: 'No video found on page' });
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
  if (request.action === "captureScreenshot" || request.action === "captureThumbnail") {
    grabVideoCanvas(sendResponse);
    return true;
  }
});
