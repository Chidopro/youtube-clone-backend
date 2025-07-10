let screenshotImages = [];
let thumbnailImage = null; // Store the thumbnail image
let thumbnailAdded = false; // Track if thumbnail is in the grid

// Declare button and grid variables at a higher scope
let screenshotGrid, makeMerchBtn, screenshotBtn, thumbnailBtn, preview;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    screenshotGrid = document.getElementById('screenshotGrid');
    makeMerchBtn = document.getElementById('makeMerchBtn');
    thumbnailBtn = document.getElementById('thumbnailBtn');
    screenshotBtn = document.getElementById('screenshotBtn');
    preview = document.getElementById('preview');

    if (thumbnailBtn) {
        thumbnailBtn.addEventListener('click', captureThumbnail);
    }

    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', captureScreenshot);
    }
    
    if (makeMerchBtn) {
        makeMerchBtn.addEventListener('click', sendToBackend);
    }

    // Load saved data on popup open
    loadFromStorage();
});

async function captureThumbnail() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Make sure content script is injected
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
        });
    } catch (e) {
        console.error("Failed to inject content script:", e);
        // Fallback or error message if injection fails
        alert("Could not connect to the page. Please reload the page and try again.");
        return;
    }


  const response = await chrome.tabs.sendMessage(tab.id, { action: "captureThumbnail" });
  if (response?.success) {
    const imgData = response.data.dataUrl;
    thumbnailImage = imgData;
        chrome.storage.local.set({ thumbnail: thumbnailImage });
    addThumbnailToGrid(imgData);
    preview.src = imgData;
    preview.style.display = "block";
        if(makeMerchBtn) makeMerchBtn.disabled = false;
    } else {
        alert(response?.error || "Thumbnail capture failed. Is the video playing?");
    }
}

async function captureScreenshot() {
    if (screenshotImages.length >= 4) {
        alert("You can only add up to 4 screenshots.");
        return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

     // Make sure content script is injected
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
        });
    } catch (e) {
        console.error("Failed to inject content script:", e);
        alert("Could not connect to the page. Please reload the page and try again.");
        return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: "captureScreenshot" });
    if (response && response.success) {
        screenshotImages.push(response.data.dataUrl);
        chrome.storage.local.set({ screenshots: screenshotImages });
        addScreenshotToGrid(response.data.dataUrl);
        if (screenshotImages.length >= 4) {
            screenshotBtn.disabled = true;
        }
        if(makeMerchBtn) makeMerchBtn.disabled = false;
    } else {
        alert(response?.error || "Screenshot capture failed.");
    }
}

async function sendToBackend() {
    if (!thumbnailImage) {
        alert('Please grab a thumbnail first.');
        return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const videoUrl = tab.url;

    // This now correctly references the flask backend
    try {
        const response = await fetch('http://localhost:5000/api/create-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thumbnail: thumbnailImage,
                screenshots: screenshotImages, // Also send screenshots
          videoUrl: videoUrl,
        }),
      });

        const result = await response.json();

        if (response.ok && result.success) {
            alert('Success! Your merch is being created.');
            // Clear storage after successful creation
            screenshotImages = [];
            thumbnailImage = null;
            chrome.storage.local.remove(['screenshots', 'thumbnail']);
            renderScreenshotGrid();
            preview.style.display = 'none';
            if(makeMerchBtn) makeMerchBtn.disabled = true;
            if(screenshotBtn) screenshotBtn.disabled = false;


      } else {
            alert(`Error: ${result.error || 'An unknown error occurred.'}`);
      }
    } catch (error) {
      console.error('Failed to send data to backend:', error);
      alert('Failed to connect to the backend. Is it running?');
  }
}

function addThumbnailToGrid(dataUrl) {
    if (document.getElementById('thumbnail-item')) return; // Already exists
  const container = document.createElement("div");
  container.className = "screenshot-item";
  container.id = "thumbnail-item";

  const img = document.createElement("img");
  img.src = dataUrl;

  const label = document.createElement("div");
  label.textContent = "Thumbnail";
  label.className = "thumbnail-label";
  container.appendChild(label);
  container.appendChild(img);
  screenshotGrid.insertBefore(container, screenshotGrid.firstChild);
  thumbnailAdded = true;
}

function addScreenshotToGrid(dataUrl, indexOverride) {
  const index = typeof indexOverride === 'number' ? indexOverride : screenshotImages.length - 1;
  const container = document.createElement("div");
  container.className = "screenshot-item";
    container.dataset.index = index; // Keep track of index

  const img = document.createElement("img");
  img.src = dataUrl;

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = 'Delete';
  deleteBtn.title = 'Delete';
  deleteBtn.className = 'delete-btn';
    
    // Styling for the delete button
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = '5px';
    deleteBtn.style.right = '5px';
    deleteBtn.style.background = '#ff4d4d';
    deleteBtn.style.color = 'white';
    deleteBtn.style.border = 'none';
    deleteBtn.style.padding = '2px 5px';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '10px';


    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemToRemove = e.target.closest('.screenshot-item');
        const indexToRemove = parseInt(itemToRemove.dataset.index, 10);
        
        // Remove from array
        screenshotImages.splice(indexToRemove, 1);
        
        // Update storage
    chrome.storage.local.set({ screenshots: screenshotImages });

        // Re-render grid
    renderScreenshotGrid();
  });

  container.appendChild(img);
    container.appendChild(deleteBtn);
    container.style.position = 'relative'; // Needed for absolute positioning of button
  screenshotGrid.appendChild(container);
}

function renderScreenshotGrid() {
  screenshotGrid.innerHTML = '';
    
  if (thumbnailImage) {
    addThumbnailToGrid(thumbnailImage);
  }
    
  screenshotImages.forEach((img, idx) => addScreenshotToGrid(img, idx));

    if (screenshotImages.length < 4 && screenshotBtn) {
        screenshotBtn.disabled = false;
    }
    if (screenshotImages.length === 0 && !thumbnailImage && makeMerchBtn) {
        makeMerchBtn.disabled = true;
      }
}

function loadFromStorage() {
    chrome.storage.local.get(['screenshots', 'thumbnail'], (result) => {
        if (result.thumbnail) {
            thumbnailImage = result.thumbnail;
            preview.src = thumbnailImage;
            preview.style.display = "block";
        }
        if (result.screenshots) {
            screenshotImages = result.screenshots;
        }
        renderScreenshotGrid();
    });
} 