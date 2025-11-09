import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ToolsPage.css';

const ToolsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [featherEdge, setFeatherEdge] = useState(0);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [frameEnabled, setFrameEnabled] = useState(false);
  const [frameColor, setFrameColor] = useState('#FF0000');
  const [frameWidth, setFrameWidth] = useState(10);
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);

  // Load screenshot from localStorage or URL params
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        // Try to get edited screenshot first, then selected screenshot or thumbnail
        const screenshot = data.edited_screenshot || data.screenshots?.[0] || data.thumbnail || '';
        if (screenshot) {
          setImageUrl(screenshot);
          setSelectedImage(screenshot);
        }
      }
      
      // Also check if there's a selected screenshot from ProductPage
      const selectedScreenshot = searchParams.get('screenshot');
      if (selectedScreenshot) {
        setImageUrl(selectedScreenshot);
        setSelectedImage(selectedScreenshot);
      }
    } catch (e) {
      console.warn('Could not load screenshot from localStorage:', e);
    }
  }, [searchParams]);

  // Helper function to draw rounded rectangle
  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Apply edits to image
  useEffect(() => {
    if (!imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      // Create a temporary canvas for processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;

      // Draw original image to temp canvas
      tempCtx.drawImage(img, 0, 0);

      // Apply corner radius clipping
      if (cornerRadius > 0) {
        ctx.save();
        drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, cornerRadius);
        ctx.clip();
      }

      // Apply feather edge (soft edge effect) using alpha mask
      if (featherEdge > 0) {
        // Create a mask canvas for feather effect
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        
        // Create radial gradient for feather effect
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(canvas.width, canvas.height) / 2;
        const innerRadius = Math.max(0, maxRadius - featherEdge);
        
        const gradient = maskCtx.createRadialGradient(
          centerX, centerY, innerRadius,
          centerX, centerY, maxRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        maskCtx.fillStyle = gradient;
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        // Draw image first
        ctx.drawImage(tempCanvas, 0, 0);
        
        // Apply mask
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // No feather edge, just draw the image
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Restore clipping if corner radius was applied
      if (cornerRadius > 0) {
        ctx.restore();
      }

      // Apply frame border
      if (frameEnabled) {
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = frameWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        if (cornerRadius > 0) {
          drawRoundedRect(
            ctx, 
            frameWidth / 2, 
            frameWidth / 2, 
            canvas.width - frameWidth, 
            canvas.height - frameWidth, 
            Math.max(0, cornerRadius - frameWidth / 2)
          );
        } else {
          ctx.beginPath();
          ctx.rect(
            frameWidth / 2, 
            frameWidth / 2, 
            canvas.width - frameWidth, 
            canvas.height - frameWidth
          );
        }
        ctx.stroke();
      }

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      setEditedImageUrl(dataUrl);
    };
    img.onerror = () => {
      console.error('Failed to load image');
    };
    img.src = imageUrl;
  }, [imageUrl, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth]);

  const handleApplyEdits = () => {
    if (!editedImageUrl) {
      alert('Please wait for the image to process, or select a screenshot first.');
      return;
    }
    setShowAcknowledgment(true);
  };

  const handleAcknowledgmentConfirm = () => {
    // Save edited image to localStorage
    try {
      const raw = localStorage.getItem('pending_merch_data');
      const data = raw ? JSON.parse(raw) : {};
      data.edited_screenshot = editedImageUrl;
      data.tools_used = {
        featherEdge,
        cornerRadius,
        frameEnabled,
        frameColor,
        frameWidth
      };
      localStorage.setItem('pending_merch_data', JSON.stringify(data));
      
      // Also update cart items if they exist
      const cartItems = JSON.parse(localStorage.getItem('cart_items') || '[]');
      const updatedCart = cartItems.map(item => ({
        ...item,
        screenshot: editedImageUrl,
        edited: true,
        tools_acknowledged: true
      }));
      localStorage.setItem('cart_items', JSON.stringify(updatedCart));
    } catch (e) {
      console.error('Failed to save edited image:', e);
    }
    
    setShowAcknowledgment(false);
    // Navigate to cart
    navigate('/checkout');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target.result;
        setImageUrl(url);
        setSelectedImage(url);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="tools-page-container">
      <div className="tools-page-header">
        <h1>Screenshot Editing Tools</h1>
        <p className="tools-subtitle">Edit your screenshot with professional tools</p>
      </div>

      <div className="tools-content">
        <div className="tools-preview-section">
          <div className="preview-container">
            <h3>Preview</h3>
            {editedImageUrl ? (
              <div className="preview-image-wrapper">
                <img 
                  src={editedImageUrl} 
                  alt="Edited screenshot" 
                  className="preview-image"
                />
              </div>
            ) : imageUrl ? (
              <div className="preview-image-wrapper">
                <img 
                  src={imageUrl} 
                  alt="Original screenshot" 
                  className="preview-image"
                />
              </div>
            ) : (
              <div className="preview-placeholder">
                <p>No screenshot selected</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="file-input"
                  id="screenshot-upload"
                />
                <label htmlFor="screenshot-upload" className="upload-button">
                  Upload Screenshot
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="tools-controls-section">
          <div className="tool-control-group">
            <h3>Feather Edge</h3>
            <p className="tool-description">Softens the edges of your screenshot</p>
            <div className="slider-control">
              <input
                type="range"
                min="0"
                max="50"
                value={featherEdge}
                onChange={(e) => setFeatherEdge(parseInt(e.target.value))}
                className="slider"
              />
              <span className="slider-value">{featherEdge}px</span>
            </div>
          </div>

          <div className="tool-control-group">
            <h3>Corner Radius</h3>
            <p className="tool-description">Round the corners of your screenshot</p>
            <div className="slider-control">
              <input
                type="range"
                min="0"
                max="100"
                value={cornerRadius}
                onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                className="slider"
              />
              <span className="slider-value">{cornerRadius}px</span>
            </div>
          </div>

          <div className="tool-control-group">
            <h3>Framed Border</h3>
            <p className="tool-description">Add a colored frame around your screenshot</p>
            <div className="checkbox-control">
              <label>
                <input
                  type="checkbox"
                  checked={frameEnabled}
                  onChange={(e) => setFrameEnabled(e.target.checked)}
                />
                Enable Frame
              </label>
            </div>
            {frameEnabled && (
              <>
                <div className="color-control">
                  <label>Frame Color:</label>
                  <input
                    type="color"
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="color-picker"
                  />
                  <span className="color-value">{frameColor}</span>
                </div>
                <div className="slider-control">
                  <label>Frame Width:</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={frameWidth}
                    onChange={(e) => setFrameWidth(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="slider-value">{frameWidth}px</span>
                </div>
              </>
            )}
          </div>

          <div className="tools-actions">
            <button 
              className="apply-edits-btn"
              onClick={handleApplyEdits}
              disabled={!editedImageUrl && !imageUrl}
            >
              Apply Edits
            </button>
            <button 
              className="reset-btn"
              onClick={() => {
                setFeatherEdge(0);
                setCornerRadius(0);
                setFrameEnabled(false);
                setFrameWidth(10);
                setFrameColor('#FF0000');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Acknowledgment Modal */}
      {showAcknowledgment && (
        <div className="acknowledgment-modal" onClick={() => setShowAcknowledgment(false)}>
          <div className="acknowledgment-content" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Important Notice</h2>
            <div className="acknowledgment-text">
              <p><strong>Customized items are non-refundable.</strong></p>
              <p>By proceeding, you acknowledge that:</p>
              <ul>
                <li>You have reviewed and approved the edited screenshot</li>
                <li>Customized merchandise cannot be returned or refunded</li>
                <li>You are satisfied with the tool edits applied to your screenshot</li>
              </ul>
            </div>
            <div className="acknowledgment-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowAcknowledgment(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={handleAcknowledgmentConfirm}
              >
                I Understand - Proceed to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolsPage;

