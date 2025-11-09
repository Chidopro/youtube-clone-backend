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
  const [doubleFrame, setDoubleFrame] = useState(false);
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

      // Calculate max corner radius for circle (half of smallest dimension)
      const maxCornerRadius = Math.min(canvas.width, canvas.height) / 2;
      const isCircle = cornerRadius >= 100; // When maxed out, create perfect circle
      const effectiveCornerRadius = isCircle ? maxCornerRadius : cornerRadius;

      // Apply corner radius clipping (or circle if maxed out)
      if (effectiveCornerRadius > 0) {
        ctx.save();
        if (isCircle) {
          // Create perfect circle
          ctx.beginPath();
          ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            maxCornerRadius,
            0,
            Math.PI * 2
          );
          ctx.clip();
        } else {
          // Use rounded rectangle
          drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, effectiveCornerRadius);
          ctx.clip();
        }
      }

      // Apply feather edge (soft edge effect) - only softens edges, doesn't create circle
      if (featherEdge > 0 && !isCircle) {
        // Calculate feather size
        const featherSize = Math.min(featherEdge, Math.min(canvas.width, canvas.height) / 4);
        
        // Create a mask canvas for feather effect
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        
        // Start with a fully opaque white rectangle
        maskCtx.fillStyle = 'white';
        maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create soft edges by erasing with gradients on each edge
        // Top edge - fade from transparent to opaque
        const topGradient = maskCtx.createLinearGradient(0, 0, 0, featherSize);
        topGradient.addColorStop(0, 'rgba(0, 0, 0, 1)'); // Fully erase at edge
        topGradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // No erase in center
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.fillStyle = topGradient;
        maskCtx.fillRect(0, 0, canvas.width, featherSize);
        
        // Bottom edge
        const bottomGradient = maskCtx.createLinearGradient(0, canvas.height - featherSize, 0, canvas.height);
        bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        maskCtx.fillStyle = bottomGradient;
        maskCtx.fillRect(0, canvas.height - featherSize, canvas.width, featherSize);
        
        // Left edge
        const leftGradient = maskCtx.createLinearGradient(0, 0, featherSize, 0);
        leftGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        leftGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        maskCtx.fillStyle = leftGradient;
        maskCtx.fillRect(0, featherSize, featherSize, canvas.height - (featherSize * 2));
        
        // Right edge
        const rightGradient = maskCtx.createLinearGradient(canvas.width - featherSize, 0, canvas.width, 0);
        rightGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        rightGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        maskCtx.fillStyle = rightGradient;
        maskCtx.fillRect(canvas.width - featherSize, featherSize, featherSize, canvas.height - (featherSize * 2));
        
        maskCtx.globalCompositeOperation = 'source-over';
        
        // Draw image first
        ctx.drawImage(tempCanvas, 0, 0);
        
        // Apply mask to soften edges
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // No feather edge, just draw the image
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Restore clipping if corner radius was applied
      if (effectiveCornerRadius > 0) {
        ctx.restore();
      }

      // Apply frame border
      if (frameEnabled) {
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = frameWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        const maxCornerRadius = Math.min(canvas.width, canvas.height) / 2;
        const isCircle = cornerRadius >= 100;
        const effectiveCornerRadius = isCircle ? maxCornerRadius : cornerRadius;
        
        // Draw outer frame
        if (isCircle) {
          ctx.beginPath();
          ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            maxCornerRadius - frameWidth / 2,
            0,
            Math.PI * 2
          );
        } else if (effectiveCornerRadius > 0) {
          drawRoundedRect(
            ctx, 
            frameWidth / 2, 
            frameWidth / 2, 
            canvas.width - frameWidth, 
            canvas.height - frameWidth, 
            Math.max(0, effectiveCornerRadius - frameWidth / 2)
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
        
        // Draw inner frame for double frame effect
        if (doubleFrame) {
          const innerFrameOffset = frameWidth * 1.5; // Space between frames
          const innerFrameWidth = frameWidth * 0.7; // Slightly thinner inner frame
          
          ctx.lineWidth = innerFrameWidth;
          
          if (isCircle) {
            ctx.beginPath();
            ctx.arc(
              canvas.width / 2,
              canvas.height / 2,
              maxCornerRadius - frameWidth - innerFrameOffset,
              0,
              Math.PI * 2
            );
          } else if (effectiveCornerRadius > 0) {
            drawRoundedRect(
              ctx, 
              frameWidth + innerFrameOffset, 
              frameWidth + innerFrameOffset, 
              canvas.width - (frameWidth + innerFrameOffset) * 2, 
              canvas.height - (frameWidth + innerFrameOffset) * 2, 
              Math.max(0, effectiveCornerRadius - frameWidth - innerFrameOffset)
            );
          } else {
            ctx.beginPath();
            ctx.rect(
              frameWidth + innerFrameOffset, 
              frameWidth + innerFrameOffset, 
              canvas.width - (frameWidth + innerFrameOffset) * 2, 
              canvas.height - (frameWidth + innerFrameOffset) * 2
            );
          }
          ctx.stroke();
        }
      }

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      setEditedImageUrl(dataUrl);
    };
    img.onerror = () => {
      console.error('Failed to load image');
    };
    img.src = imageUrl;
  }, [imageUrl, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth, doubleFrame]);

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
        frameWidth,
        doubleFrame
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
            <p className="tool-description">Round the corners of your screenshot (max = perfect circle)</p>
            <div className="slider-control">
              <input
                type="range"
                min="0"
                max="100"
                value={cornerRadius}
                onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                className="slider"
              />
              <span className="slider-value">{cornerRadius === 100 ? 'Circle' : `${cornerRadius}px`}</span>
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
                <div className="checkbox-control" style={{ marginTop: '0.5rem' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={doubleFrame}
                      onChange={(e) => setDoubleFrame(e.target.checked)}
                    />
                    Double Frame (3D Look)
                  </label>
                </div>
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
                setDoubleFrame(false);
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

