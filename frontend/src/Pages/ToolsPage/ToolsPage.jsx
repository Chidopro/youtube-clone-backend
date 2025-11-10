import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPrintAreaConfig, getAspectRatio, getPixelDimensions, PRINT_AREA_CONFIG } from '../../config/printAreaConfig';
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
  const [printAreaFit, setPrintAreaFit] = useState('none'); // 'none', 'horizontal', 'square', 'vertical', 'product'
  const [imageOffsetX, setImageOffsetX] = useState(0); // -100 to 100 (percentage)
  const [imageOffsetY, setImageOffsetY] = useState(0); // -100 to 100 (percentage)
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [currentImageDimensions, setCurrentImageDimensions] = useState({ width: 0, height: 0 });

  // Load screenshot and product name from localStorage or URL params
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        // Priority: edited screenshot > selected screenshot > first screenshot > thumbnail
        const screenshot = data.edited_screenshot || data.selected_screenshot || data.screenshots?.[0] || data.thumbnail || '';
        if (screenshot) {
          setImageUrl(screenshot);
          setSelectedImage(screenshot);
        }
        // Load selected product name
        if (data.selected_product_name) {
          setSelectedProductName(data.selected_product_name);
        }
      }
      
      // Also check if there's a selected screenshot from URL params
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
      // Store current image dimensions
      setCurrentImageDimensions({ width: img.width, height: img.height });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      // Create a temporary canvas for processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;

      // Apply print area fit first (crop/resize to fit print area)
      let sourceWidth = img.width;
      let sourceHeight = img.height;
      let sourceX = 0;
      let sourceY = 0;
      
      if (printAreaFit !== 'none') {
        const imgAspect = img.width / img.height;
        let targetAspect;
        
        // Check if using product-specific dimensions
        if (printAreaFit === 'product' && selectedProductName) {
          const printConfig = getPrintAreaConfig(selectedProductName);
          if (printConfig) {
            targetAspect = getAspectRatio(printConfig.width, printConfig.height);
          } else {
            // Fallback to generic vertical if product not found
            targetAspect = 0.67;
          }
        } else {
          // Define aspect ratios for different print areas
          switch (printAreaFit) {
            case 'horizontal':
              targetAspect = 1.5; // Wider (e.g., 3:2 or 4:3)
              break;
            case 'square':
              targetAspect = 1.0; // Square (1:1)
              break;
            case 'vertical':
              targetAspect = 0.67; // Taller (e.g., 2:3 or 3:4) - for tank tops, vertical shirts
              break;
            default:
              targetAspect = imgAspect;
          }
        }
        
        // Calculate crop area to fit target aspect ratio
        if (imgAspect > targetAspect) {
          // Image is wider than target - crop width
          sourceWidth = img.height * targetAspect;
          const maxOffsetX = img.width - sourceWidth;
          // Apply X offset: 0 = center, -100 = left (show left side), +100 = right (show right side)
          sourceX = (img.width - sourceWidth) / 2 + (imageOffsetX / 100) * (maxOffsetX / 2);
          sourceX = Math.max(0, Math.min(sourceX, maxOffsetX)); // Clamp to bounds
        } else if (imgAspect < targetAspect) {
          // Image is taller than target - crop height
          sourceHeight = img.width / targetAspect;
          const maxOffsetY = img.height - sourceHeight;
          // Apply Y offset: 0 = center, -100 = up (show top), +100 = down (show bottom)
          // Negative offset moves crop window up (towards top of image)
          sourceY = (img.height - sourceHeight) / 2 - (imageOffsetY / 100) * (maxOffsetY / 2);
          sourceY = Math.max(0, Math.min(sourceY, maxOffsetY)); // Clamp to bounds
        }
      }
      
      // Update canvas size to match cropped area
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      tempCanvas.width = sourceWidth;
      tempCanvas.height = sourceHeight;
      
      // Draw cropped image to temp canvas
      tempCtx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

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

      // Apply feather edge (soft edge effect) - works with both rectangles and circles
      if (featherEdge > 0) {
        // Calculate feather size
        const featherSize = Math.min(featherEdge, Math.min(canvas.width, canvas.height) / 4);
        
        // Create a mask canvas for feather effect
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        
        // Start with a fully opaque white shape (circle or rectangle)
        maskCtx.fillStyle = 'white';
        if (isCircle) {
          // For circle, create a white circle
          maskCtx.beginPath();
          maskCtx.arc(
            canvas.width / 2,
            canvas.height / 2,
            maxCornerRadius,
            0,
            Math.PI * 2
          );
          maskCtx.fill();
        } else {
          // For rectangle, create a white rectangle
          maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Create soft edges using radial gradient for circles, linear for rectangles
        if (isCircle) {
          // For circular images, use radial gradient to create soft edge
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const innerRadius = Math.max(0, maxCornerRadius - featherSize);
          const outerRadius = maxCornerRadius;
          
          const radialGradient = maskCtx.createRadialGradient(
            centerX, centerY, innerRadius,
            centerX, centerY, outerRadius
          );
          radialGradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // No erase in center
          radialGradient.addColorStop(1, 'rgba(0, 0, 0, 1)'); // Fully erase at edge
          
          maskCtx.globalCompositeOperation = 'destination-out';
          maskCtx.fillStyle = radialGradient;
          maskCtx.beginPath();
          maskCtx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
          maskCtx.fill();
        } else {
          // For rectangular images, use linear gradients on each edge
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
        }
        
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
  }, [imageUrl, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth, doubleFrame, printAreaFit, imageOffsetX, imageOffsetY, selectedProductName]);

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
        doubleFrame,
        printAreaFit,
        imageOffsetX,
        imageOffsetY
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
            <h3>Fit to Print Area</h3>
            <p className="tool-description">Crop image to fit product print areas</p>
            
            {/* Product Selector */}
            <div className="select-control" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select Product:</label>
              <select
                value={selectedProductName}
                onChange={(e) => {
                  setSelectedProductName(e.target.value);
                  // Auto-select product fit if product is selected
                  if (e.target.value) {
                    setPrintAreaFit('product');
                  }
                }}
                className="print-area-select"
              >
                <option value="">-- Select Product --</option>
                {Object.keys(PRINT_AREA_CONFIG).map(productName => (
                  <option key={productName} value={productName}>
                    {productName}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="select-control">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Fit Type:</label>
              <select
                value={printAreaFit}
                onChange={(e) => {
                  setPrintAreaFit(e.target.value);
                  // Reset offsets when changing print area
                  setImageOffsetX(0);
                  setImageOffsetY(0);
                }}
                className="print-area-select"
              >
                <option value="none">Original (No Fit)</option>
                {selectedProductName && (
                  <option value="product">Product Specific ({selectedProductName})</option>
                )}
                <option value="horizontal">Horizontal (Wide - for standard shirts)</option>
                <option value="square">Square (1:1 - for mugs, square items)</option>
                <option value="vertical">Vertical (Tall - for tank tops, vertical shirts)</option>
              </select>
            </div>
            
            {/* Dimension Information */}
            {printAreaFit === 'product' && selectedProductName && (() => {
              const printConfig = getPrintAreaConfig(selectedProductName);
              if (printConfig) {
                const targetPixels = getPixelDimensions(printConfig.width, printConfig.height, printConfig.dpi);
                const currentPixels = currentImageDimensions;
                const widthMatch = Math.abs(currentPixels.width - targetPixels.width) < 50;
                const heightMatch = Math.abs(currentPixels.height - targetPixels.height) < 50;
                const isMatch = widthMatch && heightMatch;
                
                return (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    backgroundColor: isMatch ? '#e8f5e9' : '#fff3e0',
                    border: `1px solid ${isMatch ? '#4caf50' : '#ff9800'}`,
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {printConfig.description} - {printConfig.width}" × {printConfig.height}" @ {printConfig.dpi} DPI
                    </div>
                    <div style={{ marginBottom: '0.25rem' }}>
                      Target: {targetPixels.width} × {targetPixels.height} pixels
                    </div>
                    <div style={{ marginBottom: '0.25rem' }}>
                      Current: {currentPixels.width} × {currentPixels.height} pixels
                    </div>
                    <div style={{ fontWeight: 'bold', color: isMatch ? '#2e7d32' : '#e65100' }}>
                      {isMatch ? '✓ Dimensions match!' : '⚠ Dimensions do not match - image will be cropped'}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
            {printAreaFit !== 'none' && (
              <>
                <div className="slider-control" style={{ marginTop: '1rem' }}>
                  <label>Move Horizontal:</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={imageOffsetX}
                    onChange={(e) => setImageOffsetX(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="slider-value">{imageOffsetX > 0 ? `Right ${imageOffsetX}%` : imageOffsetX < 0 ? `Left ${Math.abs(imageOffsetX)}%` : 'Center'}</span>
                </div>
                <div className="slider-control">
                  <label>Move Vertical:</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={imageOffsetY}
                    onChange={(e) => setImageOffsetY(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="slider-value">{imageOffsetY > 0 ? `Down ${imageOffsetY}%` : imageOffsetY < 0 ? `Up ${Math.abs(imageOffsetY)}%` : 'Center'}</span>
                </div>
              </>
            )}
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
                setPrintAreaFit('none');
                setImageOffsetX(0);
                setImageOffsetY(0);
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

