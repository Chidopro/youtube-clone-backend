import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPrintAreaConfig, getPrintAreaDimensions, getPrintAreaAspectRatio, getAspectRatio, getPixelDimensions, PRINT_AREA_CONFIG } from '../../config/printAreaConfig';
import API_CONFIG from '../../config/apiConfig';
import './ToolsPage.css';

// Component for product preview with draggable screenshot
const ProductPreviewWithDrag = ({ 
  productImage, 
  screenshot, 
  productName, 
  productSize,
  offsetX, 
  offsetY, 
  onOffsetChange,
  featherEdge,
  cornerRadius,
  printAreaFit,
  selectedProductName,
  screenshotScale = 100
}) => {
  const containerRef = useRef(null);
  const productImageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastDragPositionRef = useRef({ x: 0, y: 0 });
  const currentDragPositionRef = useRef({ x: 0, y: 0 }); // Track current position for snapping
  const [processedImage, setProcessedImage] = useState(screenshot);
  const [screenshotDisplaySize, setScreenshotDisplaySize] = useState({ width: 150, height: 150 });
  const [productImageSize, setProductImageSize] = useState({ width: 0, height: 0 });

  // Calculate screenshot display size based on product print area
  useEffect(() => {
    // Use selectedProductName if available and printAreaFit is 'product', otherwise use productName
    const effectiveProductName = (printAreaFit === 'product' && selectedProductName) ? selectedProductName : productName;
    
    if (!effectiveProductName) return;

    const calculateSize = () => {
      // For products without preview images, use a default size for calculation
      // Reset productImageSize when product changes to force recalculation
      const hasProductImage = productImageRef.current && productImageSize.width > 0;
      const defaultProductSize = { width: 400, height: 400 }; // Default size for calculation when no product image
      const effectiveProductSize = hasProductImage ? productImageSize : defaultProductSize;
      
      if (!hasProductImage && !productImageRef.current) {
        // If no product image ref exists, we'll still calculate but use defaults
        // This allows size calculation for products without previews
      }

      try {
        // Get print area dimensions for this product
        const printDimensions = getPrintAreaDimensions(effectiveProductName, productSize || null, 'front');
        
        console.log(`🔍 [SIZE_CALC] Product: "${effectiveProductName}" (from ${printAreaFit === 'product' && selectedProductName ? 'dropdown' : 'cart'}), Size: "${productSize || 'default'}", Print Area:`, printDimensions);
        
        if (printDimensions && effectiveProductSize.width > 0) {
          const displayedProductWidth = effectiveProductSize.width;
          const displayedProductHeight = effectiveProductSize.height;
          
          // Calculate size based on print area dimensions and product image size
          // Direct mapping: print area inches → percentage of product image
          // This ensures consistent sizing across all product types
          
          // Calculate print area aspect ratio (must maintain this)
          const printAspectRatio = printDimensions.width / printDimensions.height;
          
          // Estimate typical product width in inches for scaling reference
          // This helps convert print area inches to a percentage of product image
          const productNameLower = effectiveProductName.toLowerCase();
          const isCroppedHoodie = productNameLower.includes('cropped') && productNameLower.includes('hoodie');
          
          // Check if this is a square product (aspect ratio very close to 1.0)
          // Cropped Hoodie has 10x10 print area, so it's square
          const isSquare = Math.abs(printAspectRatio - 1.0) < 0.01 || isCroppedHoodie;
          
          // Check for hats first (they have much smaller print areas)
          const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
          
          // Check if this is a shirt (women's, men's, or kids) for optimized sizing
          const isShirt = productNameLower.includes('shirt') || productNameLower.includes('tee');
          const isWomensShirt = productNameLower.includes("women") && isShirt;
          const isMensShirt = productNameLower.includes("men") && isShirt;
          const isKidsShirt = productNameLower.includes("kids") && isShirt;
          
          // Direct mapping: print area width in inches → percentage of product image width
          // Print areas typically range from 5" (hats) to 15" (large shirts) wide
          // For hats, use a different calculation since they're much smaller
          let minPercent, maxPercent;
          
          if (isHat) {
            // For hats: 5" print area on ~6.5" hat = ~77% of hat width
            // But we want it to look proportional, so use 60-75% range
            minPercent = 0.60;  // 60% of hat width for 5" print area
            maxPercent = 0.75;  // 75% of hat width for 5.5" print area (trucker hat)
            
            // Calculate percentage directly based on print area width
            // 5" = 60%, 5.5" = 75% (linear interpolation)
            const hatPrintWidth = printDimensions.width; // 5 or 5.5
            const widthPercent = hatPrintWidth <= 5 ? 0.60 : 0.60 + ((hatPrintWidth - 5) / 0.5) * (0.75 - 0.60);
            
            // Calculate base width from product image
            let finalWidth = displayedProductWidth * widthPercent;
            
            // Calculate height to maintain print area aspect ratio
            let finalHeight = finalWidth / printAspectRatio;
            
            // Set bounds for hats (can be larger percentage since print area is on front panel)
            const maxWidth = displayedProductWidth * 0.80;
            const maxHeight = displayedProductHeight * 0.50; // Hats are taller, print area is on front panel
            
            if (finalWidth > maxWidth) {
              finalWidth = maxWidth;
              finalHeight = finalWidth / printAspectRatio;
            }
            if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              finalWidth = finalHeight * printAspectRatio;
            }
            
            // Ensure minimum size for visibility
            const minWidth = displayedProductWidth * 0.40;
            const minHeight = displayedProductHeight * 0.20;
            
            if (finalWidth < minWidth) {
              finalWidth = minWidth;
              finalHeight = finalWidth / printAspectRatio;
            }
            if (finalHeight < minHeight) {
              finalHeight = minHeight;
              finalWidth = finalHeight * printAspectRatio;
            }
            
            setScreenshotDisplaySize({
              width: finalWidth,
              height: finalHeight
            });
            
            console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
            return; // Exit early for hats
          }
          
          // For non-hat products, calculate size to ensure full print area coverage
          // Calculate based on print area dimensions to ensure even coverage
          const printWidthInches = printDimensions.width;
          const printHeightInches = printDimensions.height;
          
          // Estimate product dimensions in inches for scaling
          // Typical product widths: kids ~14", womens/mens ~18-20", hoodies ~20"
          let typicalProductWidthInches = 18;
          let typicalProductHeightInches = 24; // Typical shirt/hoodie height
          
          // Override based on product type (remove duplicate declaration)
          
          if (productNameLower.includes('kids') || productNameLower.includes('youth')) {
            typicalProductWidthInches = 14;
            typicalProductHeightInches = 18;
          } else if (productNameLower.includes('hoodie')) {
            typicalProductWidthInches = 20;
            typicalProductHeightInches = 26;
          } else if (productNameLower.includes('tank')) {
            typicalProductWidthInches = 17;
            typicalProductHeightInches = 22;
          }
          
          // Calculate what percentage of product the print area represents (with 5% buffer for safety)
          const printWidthPercent = (printWidthInches / typicalProductWidthInches) * 1.05;
          const printHeightPercent = (printHeightInches / typicalProductHeightInches) * 1.05;
          
          // Calculate base dimensions to cover print area
          let baseWidth = displayedProductWidth * printWidthPercent;
          let baseHeight = displayedProductHeight * printHeightPercent;
          
          // Calculate dimensions maintaining print area aspect ratio
          // Try width-based first
          let finalWidth = baseWidth;
          let finalHeight = finalWidth / printAspectRatio;
          
          // Check if height-based gives better coverage
          const heightBasedWidth = baseHeight * printAspectRatio;
          const heightBasedHeight = baseHeight;
          
          // Use whichever ensures both dimensions cover their print areas
          // If width-based height doesn't cover print height, use height-based
          if (finalHeight < displayedProductHeight * printHeightPercent) {
            finalWidth = heightBasedWidth;
            finalHeight = heightBasedHeight;
          }
          
          // Ensure we cover both dimensions
          if (finalWidth < displayedProductWidth * printWidthPercent) {
            finalWidth = displayedProductWidth * printWidthPercent;
            finalHeight = finalWidth / printAspectRatio;
          }
          if (finalHeight < displayedProductHeight * printHeightPercent) {
            finalHeight = displayedProductHeight * printHeightPercent;
            finalWidth = finalHeight * printAspectRatio;
          }
          
          // For square products, ensure width and height are always equal
          if (isSquare) {
            // Use the larger of width or height to ensure full coverage, then make square
            const baseSize = Math.min(displayedProductWidth, displayedProductHeight);
            const squareSize = Math.max(finalWidth, finalHeight);
            // Use the larger dimension to ensure coverage, but don't exceed product bounds
            finalWidth = Math.min(squareSize, baseSize * 0.75);
            finalHeight = finalWidth; // Force square
            
            // Apply square-specific bounds (use same percentage for both dimensions)
            const maxPercent = isShirt ? 0.75 : 0.70;
            const minPercent = 0.35;
            const maxSize = baseSize * maxPercent;
            const minSize = baseSize * minPercent;
            
            if (finalWidth > maxSize) {
              finalWidth = maxSize;
              finalHeight = maxSize; // Keep square
            }
            if (finalWidth < minSize) {
              finalWidth = minSize;
              finalHeight = minSize; // Keep square
            }
          } else {
            // For non-square products, apply reasonable maximum bounds
            // But prioritize coverage - if print area requires larger size, allow it
            const maxWidth = displayedProductWidth * 0.80; // Allow up to 80% of product width
            const maxHeight = displayedProductHeight * 0.80; // Allow up to 80% of product height
            
            // Only clamp if we exceed maximum, but maintain aspect ratio
            if (finalWidth > maxWidth) {
              finalWidth = maxWidth;
              finalHeight = finalWidth / printAspectRatio;
              // If height still exceeds, recalculate from height
              if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight * printAspectRatio;
              }
            } else if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              finalWidth = finalHeight * printAspectRatio;
              // If width still exceeds, recalculate from width
              if (finalWidth > maxWidth) {
                finalWidth = maxWidth;
                finalHeight = finalWidth / printAspectRatio;
              }
            }
            
            // Ensure minimum size for visibility (at least 30% width, 25% height)
            // But don't override if we need larger for print area coverage
            const minWidth = displayedProductWidth * 0.30;
            const minHeight = displayedProductHeight * 0.25;
            
            if (finalWidth < minWidth && finalWidth < displayedProductWidth * printWidthPercent) {
              finalWidth = Math.max(minWidth, displayedProductWidth * printWidthPercent);
              finalHeight = finalWidth / printAspectRatio;
            }
            if (finalHeight < minHeight && finalHeight < displayedProductHeight * printHeightPercent) {
              finalHeight = Math.max(minHeight, displayedProductHeight * printHeightPercent);
              finalWidth = finalHeight * printAspectRatio;
            }
          }
          
          setScreenshotDisplaySize({
            width: finalWidth,
            height: finalHeight
          });
          
          console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
        } else {
          // Fallback: use a percentage of product image size based on product type
          const fallbackPercent = effectiveProductName.toLowerCase().includes('cropped') ? 0.25 : 0.30;
          const fallbackSize = Math.min(productImageSize.width, productImageSize.height) * fallbackPercent;
          setScreenshotDisplaySize({ width: fallbackSize, height: fallbackSize });
        }
      } catch (e) {
        console.warn('Could not calculate print area size:', e);
        // Fallback: use a percentage of product image size
        const fallbackSize = Math.min(productImageSize.width, productImageSize.height) * 0.25;
        setScreenshotDisplaySize({ width: fallbackSize, height: fallbackSize });
      }
    };

    calculateSize();
  }, [productName, productSize, productImageSize, selectedProductName, printAreaFit, productImage]);

  // Measure product image when it loads
  const handleProductImageLoad = (e) => {
    const img = e.target;
    const newSize = {
      width: img.offsetWidth || img.naturalWidth,
      height: img.offsetHeight || img.naturalHeight
    };
    setProductImageSize(newSize);
    // Force recalculation when image loads, especially after product selection
    // This ensures size updates correctly when switching products
  };

  // Process image with effects in real-time
  useEffect(() => {
    const processImage = async () => {
      if (!screenshot) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Apply corner radius
        if (cornerRadius > 0) {
          const maxRadius = Math.min(canvas.width, canvas.height) / 2;
          // Convert percentage (0-100) to pixels
          const radius = cornerRadius >= 100 ? maxRadius : Math.round((cornerRadius / 100) * maxRadius);
          
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          
          tempCtx.fillStyle = 'white';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          
          if (cornerRadius >= 100) {
            tempCtx.beginPath();
            tempCtx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
            tempCtx.fill();
          } else {
            tempCtx.beginPath();
            tempCtx.moveTo(radius, 0);
            tempCtx.lineTo(canvas.width - radius, 0);
            tempCtx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
            tempCtx.lineTo(canvas.width, canvas.height - radius);
            tempCtx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
            tempCtx.lineTo(radius, canvas.height);
            tempCtx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
            tempCtx.lineTo(0, radius);
            tempCtx.quadraticCurveTo(0, 0, radius, 0);
            tempCtx.closePath();
            tempCtx.fill();
          }
          
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
        }

        // Apply feather edge
        if (featherEdge > 0) {
          const maskCanvas = document.createElement('canvas');
          const maskCtx = maskCanvas.getContext('2d');
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          
          maskCtx.fillStyle = 'white';
          maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
          
          const gradient = maskCtx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - featherEdge,
            canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2
          );
          gradient.addColorStop(0, 'white');
          gradient.addColorStop(1, 'transparent');
          
          maskCtx.fillStyle = gradient;
          maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
          
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCanvas, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
        }

        setProcessedImage(canvas.toDataURL('image/png'));
      };
      img.src = screenshot;
    };

    processImage();
  }, [screenshot, featherEdge, cornerRadius]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    // Store the initial mouse position
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    // Store the initial touch position
    const startPos = { x: touch.clientX, y: touch.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
  };

  useEffect(() => {
    if (isDragging) {
      const handleMove = (e) => {
        // Prevent default behavior (scrolling, selection, etc.) on mobile
        if (e.touches) {
          e.preventDefault();
        }
        
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
        
        if (clientX === undefined || clientY === undefined) return;
        
        // Increase sensitivity for easier movement (0.75 = 75% sensitivity = more responsive)
        const sensitivityMultiplier = 0.75;
        // Calculate delta from last position (not from start) for smoother movement
        const deltaX = (clientX - lastDragPositionRef.current.x) * sensitivityMultiplier;
        const deltaY = (clientY - lastDragPositionRef.current.y) * sensitivityMultiplier;
        
        // Update last position for next calculation
        lastDragPositionRef.current = { x: clientX, y: clientY };
        
        // Calculate new position relative to current offset
        const newX = offsetX + deltaX;
        const newY = offsetY + deltaY;
        
        // Calculate drag bounds based on product image size to allow full range of movement
        // Account for screenshot scale when calculating bounds
        const scaledWidth = screenshotDisplaySize.width * (screenshotScale / 100);
        const scaledHeight = screenshotDisplaySize.height * (screenshotScale / 100);
        
        // Screenshot starts centered (50% of product image), so we need to allow movement
        // up to at least half the product image height to reach the top
        if (productImageSize.width > 0 && productImageSize.height > 0) {
          // Allow horizontal movement up to 40% of product image width
          const maxOffsetX = productImageSize.width * 0.4;
          // Allow upward movement up to 60% of product image height (to reach top of print area)
          const maxOffsetYUp = productImageSize.height * 0.6;
          // Allow downward movement up to 40% of product image height
          const maxOffsetYDown = productImageSize.height * 0.4;
          
          // Clamp to bounds
          let clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newX));
          let clampedY = Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, newY));
          
          // Store current position for snapping on release
          currentDragPositionRef.current = { x: clampedX, y: clampedY };
          
          // Don't snap during dragging - allow free movement
          // Snapping will happen on release (in handleUp)
          onOffsetChange(clampedX, clampedY);
        } else {
          // Fallback to screenshot-based bounds if product image size not available
          const maxOffsetX = Math.max(scaledWidth, scaledHeight) * 0.5;
          const maxOffsetYUp = Math.max(scaledWidth, scaledHeight) * 1.2; // Increased significantly
          const maxOffsetYDown = Math.max(scaledWidth, scaledHeight) * 0.5;
          const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newX));
          const clampedY = Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, newY));
          onOffsetChange(clampedX, clampedY);
        }
      };
      
      const handleUp = () => {
        // Snap to center/print area when released if close enough
        if (productImageSize.width > 0 && productImageSize.height > 0) {
          const maxOffsetX = productImageSize.width * 0.4;
          const maxOffsetYUp = productImageSize.height * 0.6;
          const maxOffsetYDown = productImageSize.height * 0.4;
          
          // Use the current drag position for snapping
          const currentX = currentDragPositionRef.current.x;
          const currentY = currentDragPositionRef.current.y;
          
          // Calculate snap threshold based on product size (larger threshold for easier snapping)
          const snapThresholdX = productImageSize.width * 0.03; // 3% of product width
          const snapThresholdY = productImageSize.height * 0.03; // 3% of product height
          
          let finalX = currentX;
          let finalY = currentY;
          
          // Snap to center if within threshold
          if (Math.abs(currentX) < snapThresholdX) {
            finalX = 0;
          }
          if (Math.abs(currentY) < snapThresholdY) {
            finalY = 0;
          }
          
          // Clamp to bounds
          finalX = Math.max(-maxOffsetX, Math.min(maxOffsetX, finalX));
          finalY = Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, finalY));
          
          // Update position (will snap if within threshold)
          onOffsetChange(finalX, finalY);
        }
        
        setIsDragging(false);
      };
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleUp);
      document.addEventListener('touchcancel', handleUp);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleUp);
        document.removeEventListener('touchcancel', handleUp);
      };
    }
  }, [isDragging, dragStart, onOffsetChange, screenshotDisplaySize, productImageSize, screenshotScale, offsetX, offsetY]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '200px',
        margin: '0 auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none'
      }}
    >
      {/* Product Image */}
      <img 
        ref={productImageRef}
        src={productImage} 
        alt={productName}
        onLoad={handleProductImageLoad}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '4px'
        }}
      />
      
      {/* Print Area Indicator (for hats) - Shows where the print area is located */}
      {(() => {
        const productNameLower = (productName || '').toLowerCase();
        const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
        
        if (isHat && productImageSize.width > 0 && screenshotDisplaySize.width > 0) {
          // Calculate print area position (centered horizontally, moved up slightly for hats)
          const printAreaWidth = screenshotDisplaySize.width;
          const printAreaHeight = screenshotDisplaySize.height;
          const left = (productImageSize.width - printAreaWidth) / 2;
          // Move print area up by 8% of hat height (positioned above the bill but not too high)
          const top = (productImageSize.height - printAreaHeight) / 2 - (productImageSize.height * 0.08);
          
          return (
            <div
              style={{
                position: 'absolute',
                left: `${(left / productImageSize.width) * 100}%`,
                top: `${(top / productImageSize.height) * 100}%`,
                width: `${(printAreaWidth / productImageSize.width) * 100}%`,
                height: `${(printAreaHeight / productImageSize.height) * 100}%`,
                border: '2px dashed #007bff',
                borderRadius: '4px',
                pointerEvents: 'none',
                boxSizing: 'border-box',
                opacity: 0.7,
                zIndex: 1
              }}
            >
              {/* Optional: Add corner markers */}
              <div style={{
                position: 'absolute',
                top: '-2px',
                left: '-2px',
                width: '8px',
                height: '8px',
                border: '2px solid #007bff',
                borderRadius: '2px',
                backgroundColor: 'rgba(0, 123, 255, 0.2)'
              }} />
              <div style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                border: '2px solid #007bff',
                borderRadius: '2px',
                backgroundColor: 'rgba(0, 123, 255, 0.2)'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                left: '-2px',
                width: '8px',
                height: '8px',
                border: '2px solid #007bff',
                borderRadius: '2px',
                backgroundColor: 'rgba(0, 123, 255, 0.2)'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                border: '2px solid #007bff',
                borderRadius: '2px',
                backgroundColor: 'rgba(0, 123, 255, 0.2)'
              }} />
            </div>
          );
        }
        return null;
      })()}
      
      {/* Screenshot Overlay (Draggable) */}
      {processedImage && (
        <div
          style={{
            position: 'absolute',
            top: (() => {
              // For hats, position higher to match print area indicator (moved up 8%)
              const productNameLower = (productName || '').toLowerCase();
              const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
              if (isHat && productImageSize.height > 0) {
                return `${50 - 8}%`; // Move up 8% from center
              }
              return '50%';
            })(),
            left: '50%',
            transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: 'none',
            pointerEvents: 'auto'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {(() => {
            const productNameLower = (productName || '').toLowerCase();
            const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
            const scaleFactor = screenshotScale / 100;
            const aspectRatio = screenshotDisplaySize.width / screenshotDisplaySize.height;
            const isSquare = Math.abs(aspectRatio - 1.0) < 0.01; // Check if display size is square
            let scaledWidth, scaledHeight;
            
            if (isSquare) {
              // For square products: Scale both dimensions equally to maintain square shape
              scaledWidth = screenshotDisplaySize.width * scaleFactor;
              scaledHeight = scaledWidth; // Force square
            } else if (isHat) {
              // For hats: Scale primarily based on width to fill horizontal print area
              // This ensures the width grows more than height when enlarging
              scaledWidth = screenshotDisplaySize.width * scaleFactor;
              scaledHeight = scaledWidth / aspectRatio; // Maintain aspect ratio
            } else {
              // For shirts and other products: Use balanced scaling (original logic)
              if (screenshotDisplaySize.width <= screenshotDisplaySize.height) {
                // Width is smaller or equal - scale based on width, then calculate height
                scaledWidth = screenshotDisplaySize.width * scaleFactor;
                scaledHeight = scaledWidth / aspectRatio;
              } else {
                // Height is smaller - scale based on height, then calculate width
                scaledHeight = screenshotDisplaySize.height * scaleFactor;
                scaledWidth = scaledHeight * aspectRatio;
              }
            }
            
            return (
              <img 
                src={processedImage}
                alt="Screenshot overlay"
                style={{
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  objectFit: 'contain',
                  display: 'block',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                  touchAction: 'none'
                }}
                draggable={false}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Helper functions to determine product handling
const isMugProduct = (productName) => {
  if (!productName) return false;
  const mugs = ["White Glossy Mug", "Travel Mug", "Enamel Mug", "Colored Mug"];
  return mugs.some(mug => productName.includes(mug) || mug.includes(productName));
};

const isHatProduct = (productName) => {
  if (!productName) return false;
  const productNameLower = productName.toLowerCase().trim();
  const hats = [
    "distressed dad hat",
    "closed back cap",
    "five panel trucker hat",
    "five panel baseball cap",
    "5 panel baseball cap",
    "snapback hat" // Legacy support
  ];
  // More robust matching - check if product name contains any hat name or vice versa
  const isHat = hats.some(hat => {
    const hatLower = hat.toLowerCase().trim();
    return productNameLower.includes(hatLower) || hatLower.includes(productNameLower) ||
           productNameLower === hatLower;
  });
  if (isHat) {
    console.log('🎩 [HAT CHECK] Matched:', productName, 'as hat product');
  }
  return isHat;
};

const isAllOverPrintProduct = (productName) => {
  if (!productName) return false;
  // Bags - all over print
  const allOverPrintBags = [
    "All-Over Print Drawstring",
    "All Over Print Tote Pocket",
    "All-Over Print Crossbody Bag",
    "All-Over Print Utility Bag"
  ];
  // Pets - all over print
  const allOverPrintPets = [
    "Pet Bowl All-Over Print",
    "All Over Print Leash",
    "All Over Print Collar"
  ];
  // Misc - all over print
  const allOverPrintMisc = ["Apron"]; // Only apron is all over print in misc
  
  const allOverPrintProducts = [...allOverPrintBags, ...allOverPrintPets, ...allOverPrintMisc];
  return allOverPrintProducts.some(product => 
    productName.includes(product) || product.includes(productName) ||
    productName.toLowerCase().includes('all over print') ||
    productName.toLowerCase().includes('all-over print')
  );
};

const isMiscProductNoPreview = (productName) => {
  if (!productName) return false;
  const miscNoPreview = [
    "Greeting Card",
    "Hardcover Bound Notebook",
    "Coasters",
    "Kiss-Cut Stickers",
    "Kiss Cut Stickers",
    "Bandana"
  ];
  return miscNoPreview.some(product => productName.includes(product) || product.includes(productName));
};

const getGenericHatImage = () => {
  // Use a generic hat image for all hats in tools page
  // This flat front-facing hat template works well for accurate screenshot positioning
  // All hats use this same preview image in tools (except 5 Panel Trucker Hat which has slightly bigger print area)
  return "https://screenmerch.fly.dev/static/images/hatflatfront.png";
};

// Placeholder when product image is missing (e.g. products loaded from order_id) so screenshot still shows
let _placeholderProductImage = null;
const getPlaceholderProductImage = () => {
  if (_placeholderProductImage) return _placeholderProductImage;
  const w = 400;
  const h = 480;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(20, 20, w - 40, h - 40);
  _placeholderProductImage = canvas.toDataURL('image/png');
  return _placeholderProductImage;
};

const ToolsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const leftColumnRef = useRef(null);
  const containerRef = useRef(null);
  
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
  const [selectedProductName, setSelectedProductName] = useState('');
  const [currentImageDimensions, setCurrentImageDimensions] = useState({ width: 0, height: 0 });
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);
  const upgradeTriggeredRef = useRef(false); // Track if we've already triggered an upgrade for this image
  const [cartProducts, setCartProducts] = useState([]); // Store all cart products
  const [selectedCartProductIndex, setSelectedCartProductIndex] = useState(null); // Selected product index from cart
  const [productImageOffsets, setProductImageOffsets] = useState({}); // Store image offsets for each cart product {cartIndex: {x: 0, y: 0}}
  const [screenshotScale, setScreenshotScale] = useState(100); // Screenshot size scale (percentage: 50-150%)
  const [screenshotSizeInteracted, setScreenshotSizeInteracted] = useState(false); // Track if screenshot size has been adjusted
  const [productSelectClicked, setProductSelectClicked] = useState(false); // Track if product select has been clicked
  const [orderScreenshotsLoading, setOrderScreenshotsLoading] = useState(false);
  const [orderScreenshotsError, setOrderScreenshotsError] = useState(null);
  const orderIdLoadedRef = useRef(null); // Avoid re-fetching same order when effect re-runs

  // Calculate and set fixed position for left column
  useEffect(() => {
    const updateLeftColumnPosition = () => {
      if (leftColumnRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const leftPosition = containerRect.left + 100; // Add 100px for the grey spacer column
        leftColumnRef.current.style.left = `${leftPosition}px`;
      }
    };

    // Update on mount and resize
    updateLeftColumnPosition();
    window.addEventListener('resize', updateLeftColumnPosition);
    window.addEventListener('scroll', updateLeftColumnPosition);

    return () => {
      window.removeEventListener('resize', updateLeftColumnPosition);
      window.removeEventListener('scroll', updateLeftColumnPosition);
    };
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Reset pulse state on mount to ensure it shows
    setProductSelectClicked(false);
  }, []);

  // Load tool page state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('tools_page_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.screenshotScale !== undefined) setScreenshotScale(state.screenshotScale);
        if (state.productImageOffsets) setProductImageOffsets(state.productImageOffsets);
        if (state.selectedCartProductIndex !== undefined) setSelectedCartProductIndex(state.selectedCartProductIndex);
        console.log('📦 Restored tool page state from localStorage');
      }
    } catch (e) {
      console.warn('Could not load tool page state:', e);
    }
  }, []);

  // Save tool page state to localStorage whenever it changes
  useEffect(() => {
    try {
      const stateToSave = {
        screenshotScale,
        productImageOffsets,
        selectedCartProductIndex
      };
      localStorage.setItem('tools_page_state', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Could not save tool page state:', e);
    }
  }, [screenshotScale, productImageOffsets, selectedCartProductIndex]);

  // When order_id is in URL (e.g. from email "Edit Tools" link), load screenshots from order (same API as Print Quality page)
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId || String(orderId).trim() === '') {
      orderIdLoadedRef.current = null;
      return;
    }
    const trimmedOrderId = String(orderId).trim();
    if (orderIdLoadedRef.current === trimmedOrderId) return;

    let cancelled = false;
    orderIdLoadedRef.current = trimmedOrderId;
    setOrderScreenshotsLoading(true);
    setOrderScreenshotsError(null);

    fetch(`${API_CONFIG.BASE_URL}/api/get-order-screenshot/${encodeURIComponent(trimmedOrderId)}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          let errMsg = 'Failed to load order screenshots';
          try {
            const errData = await response.json();
            if (errData && errData.error) errMsg = errData.error;
          } catch (_) {}
          setOrderScreenshotsError(errMsg);
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          orderIdLoadedRef.current = null;
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        if (data.success && (data.products?.length > 0 || data.screenshot)) {
          const products = data.products?.length > 0
            ? data.products
            : [{ product: 'Order Screenshot', screenshot: data.screenshot, color: 'N/A', size: 'N/A', index: 0 }];
          let mapped = products
            .map((p, i) => ({
              originalCartIndex: p.index ?? i,
              name: p.product || 'Product',
              color: p.color || 'N/A',
              size: p.size || 'N/A',
              screenshot: p.screenshot || '',
              productImage: (p.preview_image_url && p.preview_image_url.trim()) || '', // Product mockup (same as cart tools)
              toolSettings: null,
              filteredIndex: i
            }))
            .filter((item) => item.screenshot && item.screenshot.trim() !== '');
          setCartProducts(mapped);
          setSelectedCartProductIndex(mapped.length > 0 ? 0 : null);
          setOrderScreenshotsError(null);
          // If any product is missing product image, fetch by name so we show product mockup (measure screenshot over print area)
          const missing = mapped.filter((item) => item.name && !item.productImage);
          if (missing.length > 0) {
            Promise.all(
              missing.map((item) =>
                fetch(`${API_CONFIG.BASE_URL}/api/product-preview-url?name=${encodeURIComponent(item.name)}`)
                  .then((r) => r.ok ? r.json() : null)
                  .then((data) => (data && data.url ? { ...item, productImage: data.url } : item))
                  .catch(() => item)
              )
            ).then((filled) => {
              if (filled.some((f) => f.productImage)) {
                const updated = mapped.map((m) => {
                  const i = missing.findIndex((x) => x.name === m.name && x.originalCartIndex === m.originalCartIndex);
                  if (i >= 0 && filled[i].productImage) return { ...m, productImage: filled[i].productImage };
                  return m;
                });
                setCartProducts(updated);
                console.log('📦 Fetched product preview URLs for Tools (screenshot over print area)');
              }
            });
          }
          // Auto-select Fit to Print Area to order's product so screenshot auto-resizes to print area (like cart tools)
          if (mapped.length > 0) {
            const firstProductName = mapped[0].name;
            if (firstProductName && Object.prototype.hasOwnProperty.call(PRINT_AREA_CONFIG, firstProductName)) {
              setSelectedProductName(firstProductName);
              setPrintAreaFit('product');
            }
          }
          console.log(`📦 Loaded ${mapped.length} screenshot(s) from order ${trimmedOrderId} (same as Print Quality / email)`);
        } else {
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          setOrderScreenshotsError('No screenshots found for this order.');
        }
        setOrderScreenshotsLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setOrderScreenshotsError(error.message || 'Error loading order screenshots');
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          orderIdLoadedRef.current = null;
          setOrderScreenshotsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [searchParams]);

  // Auto-adjust screenshot scale to 100% when product is selected (mobile only)
  // This ensures the screenshot is proportionately sized to fit the print area
  useEffect(() => {
    if (selectedProductName && printAreaFit === 'product') {
      // Reset scale to 100% for proper proportional sizing
      setScreenshotScale(100);
    }
  }, [selectedProductName, printAreaFit]);

  // Load cart products on mount and when component becomes visible (skip when order_id in URL — those come from order API)
  useEffect(() => {
    if (searchParams.get('order_id')) return;

    const loadCartProducts = () => {
      try {
        const cartItems = JSON.parse(localStorage.getItem('cart_items') || '[]');
        if (cartItems && cartItems.length > 0) {
          // Filter items that have screenshots, preserving original cart index
          const productsWithScreenshots = cartItems
            .map((item, originalIndex) => ({
              originalCartIndex: originalIndex, // Store original cart index for matching
              name: item.name || 'Product',
              color: item.color || 'N/A',
              size: item.size || 'N/A',
              screenshot: item.screenshot || '',
              productImage: item.image || '', // Store product image from cart
              toolSettings: item.toolSettings || null // Store tool settings if they exist
            }))
            .filter(item => item.screenshot && item.screenshot.trim() !== '')
            .map((item, filteredIndex) => ({
              ...item,
              filteredIndex // Also store filtered index for dropdown
            }));
          
          // Restore tool settings from cart items if available
          if (productsWithScreenshots.length > 0) {
            const firstProduct = productsWithScreenshots[0];
            if (firstProduct.toolSettings) {
              const settings = firstProduct.toolSettings;
              if (settings.screenshotScale !== undefined) setScreenshotScale(settings.screenshotScale);
              if (settings.offsetX !== undefined && settings.offsetY !== undefined) {
                setProductImageOffsets(prev => ({
                  ...prev,
                  [firstProduct.originalCartIndex]: { x: settings.offsetX, y: settings.offsetY }
                }));
              }
            }
          }
          
          setCartProducts(productsWithScreenshots);
          
          // Auto-select first product if products exist and none is currently selected
          if (productsWithScreenshots.length > 0) {
            if (selectedCartProductIndex === null || selectedCartProductIndex >= productsWithScreenshots.length) {
              setSelectedCartProductIndex(0);
            }
            if (productsWithScreenshots.length > 1) {
              console.log(`🛍️ Found ${productsWithScreenshots.length} products in cart`);
            }
          }
        } else {
          setCartProducts([]);
          setSelectedCartProductIndex(null);
        }
      } catch (e) {
        console.warn('Could not load cart items:', e);
        setCartProducts([]);
        setSelectedCartProductIndex(null);
      }
    };
    
    // Load immediately
    loadCartProducts();
    
    // Also listen for storage changes (when cart is updated in other tabs/pages)
    const handleStorageChange = (e) => {
      if (e.key === 'cart_items') {
        loadCartProducts();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case localStorage is updated in same tab
    const checkInterval = setInterval(loadCartProducts, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [selectedCartProductIndex, searchParams]); // Re-run if selected index becomes invalid or order_id is removed

  // Load screenshot and product name from localStorage or URL params
  useEffect(() => {
    const loadScreenshot = () => {
      try {
        // Priority 1: Use selected cart product screenshot if available
        if (selectedCartProductIndex !== null && cartProducts.length > 0 && cartProducts[selectedCartProductIndex]) {
          const selectedProduct = cartProducts[selectedCartProductIndex];
          if (selectedProduct.screenshot && selectedProduct.screenshot.trim() !== '') {
            const screenshot = selectedProduct.screenshot;
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            setIsUpgrading(false);
            console.log(`📸 Loaded screenshot from cart product ${selectedCartProductIndex + 1}: ${selectedProduct.name}`);
            return; // Exit early, don't check other sources
          }
        }
        
        // Priority 2: Fallback to pending_merch_data
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          // Priority: edited screenshot > selected screenshot > first screenshot > thumbnail
          const screenshot = data.edited_screenshot || data.selected_screenshot || data.screenshots?.[0] || data.thumbnail || '';
          if (screenshot) {
            // Reset upgrade trigger if image changed
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            // Reset upgrading state when new image loads (will be set again when image actually loads)
            setIsUpgrading(false);
          }
          // Check if upgrade failed - but verify the current image isn't already upgraded
          // If we have a print quality screenshot that matches the current image, clear failure
          if (data.print_quality_upgrade_failed) {
            console.log('🔍 [UPGRADE] Found failure flag in localStorage, checking if image is actually upgraded...');
            // Check if the current screenshot is actually the upgraded one
            const currentScreenshot = data.edited_screenshot || data.selected_screenshot || data.screenshots?.[0] || data.thumbnail || '';
            if (data.print_quality_screenshot && currentScreenshot === data.print_quality_screenshot) {
              // Image is already upgraded, clear failure flag
              console.log('✅ [UPGRADE] Current image matches print_quality_screenshot - clearing failure flag');
              setUpgradeFailed(false);
              // Also clear the flag in localStorage
              try {
                delete data.print_quality_upgrade_failed;
                localStorage.setItem('pending_merch_data', JSON.stringify(data));
              } catch (e) {
                console.warn('Could not clear failure flag:', e);
              }
            } else if (currentImageDimensions.width && currentImageDimensions.height && currentImageDimensions.width >= 2000 && currentImageDimensions.height >= 2000) {
              // Image dimensions indicate it's already at print quality, clear failure flag
              console.log('✅ [UPGRADE] Image dimensions indicate print quality - clearing failure flag', {
                width: currentImageDimensions.width,
                height: currentImageDimensions.height
              });
              setUpgradeFailed(false);
              // Also clear the flag in localStorage
              try {
                delete data.print_quality_upgrade_failed;
                localStorage.setItem('pending_merch_data', JSON.stringify(data));
              } catch (e) {
                console.warn('Could not clear failure flag:', e);
              }
            } else {
              // Upgrade actually failed - but don't set the state yet, wait for image to load
              // The image load handler will check dimensions and clear if needed
              console.log('⚠️ [UPGRADE] Failure flag found and image appears to be small - will check again when image loads');
              setUpgradeFailed(true);
              setIsUpgrading(false);
            }
          } else {
            // No failure flag, clear failure state
            setUpgradeFailed(false);
          }
          // Load selected product name
          if (data.selected_product_name) {
            setSelectedProductName(data.selected_product_name);
          }
        }
        
        // Also check if there's a selected screenshot from URL params
        const selectedScreenshot = searchParams.get('screenshot');
        if (selectedScreenshot) {
          if (selectedScreenshot !== imageUrl) {
            upgradeTriggeredRef.current = false;
          }
          setImageUrl(selectedScreenshot);
          setSelectedImage(selectedScreenshot);
        }
      } catch (e) {
        console.warn('Could not load screenshot from localStorage:', e);
      }
    };
    
    // Load immediately
    loadScreenshot();
  }, [selectedCartProductIndex, cartProducts]); // Re-run when cart product selection changes

  // Listen for storage events and set up upgrade checking
  useEffect(() => {
    // Listen for storage events (when print quality upgrade completes from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'pending_merch_data' && e.newValue) {
        // Reload screenshot when storage changes
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          try {
            const data = JSON.parse(raw);
            const screenshot = data.edited_screenshot || data.selected_screenshot || data.screenshots?.[0] || data.thumbnail || '';
            if (screenshot && screenshot !== imageUrl) {
              setImageUrl(screenshot);
              setSelectedImage(screenshot);
            }
          } catch (e) {
            console.warn('Could not parse storage data:', e);
          }
        }
      }
    };
    
    // Listen for custom event (when print quality upgrade completes in same tab)
    const handleLocalStorageUpdate = () => {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        try {
          const data = JSON.parse(raw);
          const screenshot = data.edited_screenshot || data.selected_screenshot || data.screenshots?.[0] || data.thumbnail || '';
          if (screenshot && screenshot !== imageUrl) {
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
          }
        } catch (e) {
          console.warn('Could not parse storage data:', e);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleLocalStorageUpdate);
    
    // Also check periodically for upgrades (backup in case events don't fire)
    // Check more frequently for first 10 seconds, then every 5 seconds for up to 70 seconds total
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      // Check if upgrade has been running too long (more than 60 seconds)
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          if (data.print_quality_upgrade_timestamp) {
            const timeSinceUpgrade = Date.now() - data.print_quality_upgrade_timestamp;
            if (timeSinceUpgrade > 60000 && !data.print_quality_upgrade_failed) {
              // Upgrade has been running for more than 60 seconds, mark as failed
              data.print_quality_upgrade_failed = true;
              localStorage.setItem('pending_merch_data', JSON.stringify(data));
            }
          }
        }
      } catch (e) {
        console.warn('Could not check upgrade status:', e);
      }
    }, 2000); // Check every 2 seconds
    
    // Stop checking after 70 seconds (enough time for 60 second timeout + buffer)
    setTimeout(() => clearInterval(checkInterval), 70000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleLocalStorageUpdate);
      clearInterval(checkInterval);
    };
  }, [searchParams, imageUrl]);

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

  // Manual 300 DPI upgrade function (no longer automatic)
  const triggerPrintQualityUpgrade = () => {
    if (!imageUrl || !currentImageDimensions.width || !currentImageDimensions.height) {
      console.log('🔍 [UPGRADE] Cannot upgrade: missing imageUrl or dimensions');
      return;
    }
    
    // Check if image is small (likely client-side capture) - needs upgrade
    // Small images are typically < 2000 pixels in either dimension
    const isSmallImage = currentImageDimensions.width < 2000 || currentImageDimensions.height < 2000;
    
    // Don't trigger if image is already large enough
    if (!isSmallImage) {
      console.log('✅ [UPGRADE] Image is already at print quality, no upgrade needed');
      alert('Image is already at print quality!');
      return;
    }
    
    // Don't trigger if upgrade is already in progress
    if (isUpgrading) {
      console.log('⏸️ [UPGRADE] Upgrade already in progress');
      return;
    }
    
    // Check current upgrade state from localStorage
    let currentUpgradeInProgress = false;
    let currentUpgradeFailed = false;
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.print_quality_upgrade_timestamp) {
          const timeSinceUpgrade = Date.now() - data.print_quality_upgrade_timestamp;
          currentUpgradeInProgress = timeSinceUpgrade < 60000;
          console.log('🔍 [UPGRADE] Upgrade timestamp check', {
            timestamp: data.print_quality_upgrade_timestamp,
            timeSinceUpgrade: Math.round(timeSinceUpgrade / 1000) + 's',
            inProgress: currentUpgradeInProgress
          });
        }
        currentUpgradeFailed = !!data.print_quality_upgrade_failed;
        console.log('🔍 [UPGRADE] Failure flag check', { failed: currentUpgradeFailed });
      }
    } catch (e) {
      console.warn('❌ [UPGRADE] Could not check upgrade status:', e);
    }
    
    // Don't trigger if upgrade is currently in progress (within last 60 seconds)
    // BUT allow retry if it previously failed (failure flag might be stale)
    if (currentUpgradeInProgress) {
      console.log('⏸️ [UPGRADE] Skipping: upgrade currently in progress', {
        inProgress: currentUpgradeInProgress
      });
      return;
    }
    
    // If it previously failed, log it but still allow retry
    if (currentUpgradeFailed) {
      console.log('⚠️ [UPGRADE] Previous upgrade failed, but allowing retry...', {
        failed: currentUpgradeFailed
      });
      // Clear the failure flag so we can try again
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          delete data.print_quality_upgrade_failed;
          localStorage.setItem('pending_merch_data', JSON.stringify(data));
          console.log('✅ [UPGRADE] Cleared previous failure flag to allow retry');
        }
      } catch (e) {
        console.warn('⚠️ [UPGRADE] Could not clear failure flag, but continuing anyway:', e);
      }
    }
    
    // Check if image has already been upgraded (check if there's a print quality version)
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        // If the current image URL matches a print quality screenshot, don't upgrade again
        if (data.print_quality_screenshot && imageUrl === data.print_quality_screenshot) {
          upgradeTriggeredRef.current = true;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not check if image already upgraded:', e);
    }
    
    // Mark that we're triggering an upgrade
    console.log('🚀 [UPGRADE] Starting manual 300 DPI upgrade');
    upgradeTriggeredRef.current = true;
    setIsUpgrading(true);
    setUpgradeFailed(false); // Clear any previous failure state
    
    // Mark upgrade as starting in localStorage
    try {
      const raw = localStorage.getItem('pending_merch_data');
      if (raw) {
        const data = JSON.parse(raw);
        data.print_quality_upgrade_timestamp = Date.now();
        delete data.print_quality_upgrade_failed; // Clear any previous failure
        localStorage.setItem('pending_merch_data', JSON.stringify(data));
        window.dispatchEvent(new Event('localStorageUpdated'));
        console.log('✅ [UPGRADE] Marked upgrade as starting in localStorage');
      }
    } catch (e) {
      console.warn('❌ [UPGRADE] Failed to mark upgrade as starting:', e);
    }
    
    // Trigger manual 300 DPI upgrade
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('⚠️ Print quality upgrade timed out after 120 seconds');
      // Mark upgrade as failed
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          data.print_quality_upgrade_failed = true;
          localStorage.setItem('pending_merch_data', JSON.stringify(data));
          window.dispatchEvent(new Event('localStorageUpdated'));
        }
      } catch (e) {
        console.warn('Failed to mark upgrade as failed:', e);
      }
      setIsUpgrading(false);
      setUpgradeFailed(true);
    }, 120000); // 120 second timeout (increased from 60s)
    
    // Convert image to base64 if it's not already
    const getImageAsBase64 = async (url) => {
      // If it's already a data URL, return it
      if (url.startsWith('data:image')) {
        return url;
      }
      
      // If it's a blob URL, convert it
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Failed to convert image to base64:', error);
        throw error;
      }
    };
    
    // Use process-thumbnail-print-quality endpoint to upgrade the image
    const upgradeUrl = API_CONFIG.BASE_URL === 'http://127.0.0.1:5000' 
      ? 'http://127.0.0.1:5000/api/process-thumbnail-print-quality'
      : 'https://screenmerch.fly.dev/api/process-thumbnail-print-quality';
    
    console.log('🌐 [UPGRADE] API URL:', upgradeUrl);
    console.log('🖼️ [UPGRADE] Converting image to base64...');
    
    // Convert image to base64 first
    getImageAsBase64(imageUrl)
      .then(base64Image => {
        console.log('✅ [UPGRADE] Image converted to base64, size:', Math.round(base64Image.length / 1024) + ' KB');
        console.log('📤 [UPGRADE] Sending request to:', upgradeUrl);
        return fetch(upgradeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            thumbnail_data: base64Image,
            print_dpi: 300,
            soft_corners: false,
            edge_feather: false
          }),
          signal: controller.signal
        });
      })
        .then(response => {
          clearTimeout(timeoutId);
          console.log('📥 [UPGRADE] Response received:', response.status, response.statusText);
          if (!response.ok) {
            return response.text().then(text => {
              let errorMsg = `Server responded with status: ${response.status}`;
              try {
                const errorData = JSON.parse(text);
                errorMsg = errorData.error || errorMsg;
              } catch (e) {
                errorMsg = text || errorMsg;
              }
              console.error('❌ [UPGRADE] Server error:', errorMsg);
              throw new Error(errorMsg);
            });
          }
          return response.json();
        })
      .then(result => {
      console.log('📦 [UPGRADE] Response data received:', { success: result.success, hasScreenshot: !!result.screenshot, dimensions: result.dimensions });
      if (result.success && result.screenshot) {
        // Check if upgrade actually increased dimensions
        const upgradedWidth = result.dimensions?.width || 0;
        const upgradedHeight = result.dimensions?.height || 0;
        const wasUpgraded = upgradedWidth >= 2000 || upgradedHeight >= 2000;
        
        console.log('✅ [UPGRADE] Upgrade successful! Updating UI...');
        console.log('📊 [UPGRADE] New image size:', result.screenshot ? Math.round(result.screenshot.length / 1024) + ' KB' : 'N/A');
        console.log('📐 [UPGRADE] Upgraded dimensions:', { width: upgradedWidth, height: upgradedHeight, wasUpgraded });
        
        if (!wasUpgraded) {
          console.warn('⚠️ [UPGRADE] Upgrade completed but dimensions are still small - upgrade may have failed silently');
        }
        // IMPORTANT: Update UI state FIRST - the upgrade succeeded regardless of localStorage
        // Clear failure flag IMMEDIATELY since upgrade succeeded
        setUpgradeFailed(false);
        setIsUpgrading(false);
        // Force image reload by clearing first, then setting
        // This ensures React detects the change and reloads the image
        const oldUrl = imageUrl;
        setImageUrl('');
        setSelectedImage('');
        
        // Use setTimeout to ensure state updates properly and force re-render
        setTimeout(() => {
          // Add a cache-busting parameter to force reload if it's the same URL
          const newImageUrl = result.screenshot;
          setImageUrl(newImageUrl);
          setSelectedImage(newImageUrl);
          console.log('🔄 [UPGRADE] Image URL updated, waiting for dimensions to load...');
          console.log('📏 [UPGRADE] Expected dimensions from server:', { width: upgradedWidth, height: upgradedHeight });
          
          // Force a check after image should have loaded (2 seconds)
          setTimeout(() => {
            const img = new Image();
            img.onload = () => {
              console.log('🔍 [UPGRADE] Verification - Image actually loaded with dimensions:', { width: img.width, height: img.height });
              if (img.width >= 2000 || img.height >= 2000) {
                console.log('✅ [UPGRADE] Verified: Image is at print quality!');
                setCurrentImageDimensions({ width: img.width, height: img.height });
              } else {
                console.warn('⚠️ [UPGRADE] Warning: Image loaded but dimensions are still small:', { width: img.width, height: img.height });
              }
            };
            img.onerror = () => {
              console.error('❌ [UPGRADE] Failed to load upgraded image');
            };
            img.src = newImageUrl;
          }, 2000);
        }, 100);
        
        // Clear failure flag in localStorage immediately (before trying to save the large image)
        try {
          const raw = localStorage.getItem('pending_merch_data');
          if (raw) {
            const data = JSON.parse(raw);
            delete data.print_quality_upgrade_failed;
            // Try to save just the flag clearing (small operation)
            try {
              localStorage.setItem('pending_merch_data', JSON.stringify(data));
              console.log('✅ [UPGRADE] Cleared failure flag in localStorage');
            } catch (e) {
              console.warn('⚠️ [UPGRADE] Could not clear failure flag in localStorage, but upgrade succeeded');
            }
          }
        } catch (e) {
          console.warn('⚠️ [UPGRADE] Error clearing failure flag:', e);
        }
        
        // Then try to save to localStorage (but don't let failures affect UI state)
        try {
          const raw = localStorage.getItem('pending_merch_data');
          if (raw) {
            const data = JSON.parse(raw);
            
            // Update the appropriate screenshot field
            if (data.selected_screenshot === imageUrl) {
              data.selected_screenshot = result.screenshot;
            } else if (data.screenshots && Array.isArray(data.screenshots)) {
              const index = data.screenshots.findIndex(s => s === imageUrl);
              if (index >= 0) {
                data.screenshots[index] = result.screenshot;
              }
            } else if (data.thumbnail === imageUrl) {
              data.thumbnail = result.screenshot;
            }
            
            // Store print quality version
            data.print_quality_screenshot = result.screenshot;
            
            // Clear upgrade flags FIRST before trying to save
            delete data.print_quality_upgrade_failed;
            delete data.print_quality_upgrade_timestamp;
            
            // Try to save - if it fails due to quota, clear more data
            try {
              localStorage.setItem('pending_merch_data', JSON.stringify(data));
            } catch (quotaError) {
              if (quotaError.name === 'QuotaExceededError') {
                console.warn('⚠️ localStorage quota exceeded, clearing old screenshots to make room');
                // Clear old screenshots array and thumbnail to free space
                delete data.screenshots;
                delete data.thumbnail;
                // Keep only the essential upgraded screenshot
                if (!data.selected_screenshot || data.selected_screenshot === imageUrl) {
                  data.selected_screenshot = result.screenshot;
                }
                // Make sure failure flag is still cleared
                delete data.print_quality_upgrade_failed;
                delete data.print_quality_upgrade_timestamp;
                // Try again with minimal data
                try {
                  localStorage.setItem('pending_merch_data', JSON.stringify(data));
                  console.log('✅ Saved upgraded screenshot after clearing old data');
                } catch (secondError) {
                  console.warn('⚠️ Still unable to save to localStorage, but upgrade succeeded. Image is available in memory.');
                  // Even if we can't save, try one more time with just the essential data and cleared flags
                  try {
                    const minimalData = {
                      selected_screenshot: result.screenshot,
                      print_quality_screenshot: result.screenshot,
                      selected_product_name: data.selected_product_name
                    };
                    localStorage.setItem('pending_merch_data', JSON.stringify(minimalData));
                    console.log('✅ Saved minimal data with upgraded screenshot');
                  } catch (finalError) {
                    console.warn('⚠️ Could not save even minimal data, but upgrade succeeded. Image is in memory.');
                  }
                }
              } else {
                throw quotaError;
              }
            }
            
            // Trigger custom event for same-tab updates
            window.dispatchEvent(new Event('localStorageUpdated'));
          }
        } catch (e) {
          console.warn('Failed to update localStorage with print quality screenshot:', e);
          // localStorage save failed, but upgrade succeeded - UI already updated above
        }
        
        console.log('✅ Screenshot upgraded to 300 DPI print quality');
        // IMPORTANT: Even if localStorage save failed, the upgrade succeeded and image is in memory
        // Don't show error - the image is available and will work for this session
        console.log('💡 [UPGRADE] Note: Image is in memory. If localStorage save failed, it will be lost on page reload, but works for current session.');
      } else {
        throw new Error(result.error || 'Server failed to upgrade screenshot');
      }
    })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn('⚠️ [UPGRADE] Print quality upgrade aborted (timeout after 120s)');
          alert('Upgrade timed out. The image may be too large or the server is slow. Try again or use a smaller image.');
        } else {
          console.error('❌ [UPGRADE] Failed to upgrade screenshot to print quality:', error);
          alert(`Upgrade failed: ${error.message || 'Unknown error'}. Please try again.`);
        }
        setIsUpgrading(false);
        setUpgradeFailed(true);
      // Mark upgrade as failed in localStorage (only if it actually failed, not if localStorage quota was exceeded)
      try {
        const raw = localStorage.getItem('pending_merch_data');
        if (raw) {
          const data = JSON.parse(raw);
          // Only mark as failed if the API call actually failed, not if localStorage quota was exceeded
          // The upgrade might have succeeded but localStorage save failed
          if (error.name !== 'QuotaExceededError') {
            data.print_quality_upgrade_failed = true;
            localStorage.setItem('pending_merch_data', JSON.stringify(data));
            window.dispatchEvent(new Event('localStorageUpdated'));
          }
        }
      } catch (e) {
        console.warn('Failed to mark upgrade as failed:', e);
      }
    });
  };

  // Apply edits to image
  useEffect(() => {
    if (!imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Store current image dimensions
      const newDimensions = { width: img.width, height: img.height };
      setCurrentImageDimensions(newDimensions);
      console.log('🖼️ [IMAGE] Image loaded with dimensions:', newDimensions);
      
      // Check if image is already at print quality (large dimensions)
      // If image is large, it's already upgraded - clear any failure flags
      const isPrintQuality = img.width >= 2000 && img.height >= 2000;
      if (isPrintQuality) {
        console.log('✅ [UPGRADE] Image loaded with print quality dimensions:', { width: img.width, height: img.height });
        // Image is already at print quality, clear failure state
        setUpgradeFailed(false);
        // Also clear failure flag in localStorage if it exists
        try {
          const raw = localStorage.getItem('pending_merch_data');
          if (raw) {
            const data = JSON.parse(raw);
            if (data.print_quality_upgrade_failed) {
              console.log('✅ [UPGRADE] Clearing failure flag because image is at print quality');
              delete data.print_quality_upgrade_failed;
              try {
                localStorage.setItem('pending_merch_data', JSON.stringify(data));
                console.log('✅ [UPGRADE] Failure flag cleared in localStorage');
              } catch (e) {
                console.warn('⚠️ [UPGRADE] Could not save cleared flag to localStorage, but image is upgraded');
              }
            }
          }
        } catch (e) {
          console.warn('Could not clear failure flag:', e);
        }
      } else {
        console.log('🔍 [UPGRADE] Image dimensions are small:', { width: img.width, height: img.height });
      }
      
      // Check if image is small (likely client-side capture) - upgrade might be in progress
      // Small images are typically < 2000 pixels in either dimension
      const isSmallImage = img.width < 2000 || img.height < 2000;
      // Only set upgrading state if we haven't already triggered an upgrade
      if (isSmallImage && !upgradeTriggeredRef.current) {
        setIsUpgrading(isSmallImage);
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: true }); // Ensure alpha channel for transparency
      canvas.width = img.width;
      canvas.height = img.height;

      // Create a temporary canvas for processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { alpha: true }); // Ensure alpha channel
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
          // Use new helper function that supports size-specific dimensions
          // For now, size is null (will use default), but can be added later
          const dimensions = getPrintAreaDimensions(selectedProductName, null, 'front');
          if (dimensions) {
            targetAspect = getAspectRatio(dimensions.width, dimensions.height);
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
      
      // Clear canvas to ensure transparent background (important for rounded corners)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw cropped image to temp canvas
      tempCtx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

      // Calculate max corner radius for circle (half of smallest dimension)
      const maxCornerRadius = Math.min(canvas.width, canvas.height) / 2;
      const isCircle = cornerRadius >= 100; // When maxed out, create perfect circle
      // Convert percentage (0-100) to pixels
      const effectiveCornerRadius = isCircle ? maxCornerRadius : Math.round((cornerRadius / 100) * maxCornerRadius);

      // Apply corner radius clipping (or circle if maxed out)
      // Create a new transparent canvas for the final result to ensure no black background
      if (effectiveCornerRadius > 0) {
        // Create a mask canvas for the rounded corners
        const roundedMaskCanvas = document.createElement('canvas');
        const roundedMaskCtx = roundedMaskCanvas.getContext('2d', { alpha: true });
        roundedMaskCanvas.width = canvas.width;
        roundedMaskCanvas.height = canvas.height;
        
        // Clear mask canvas to transparent
        roundedMaskCtx.clearRect(0, 0, roundedMaskCanvas.width, roundedMaskCanvas.height);
        
        // Draw white shape (will be used as mask)
        roundedMaskCtx.fillStyle = 'white';
        if (isCircle) {
          roundedMaskCtx.beginPath();
          roundedMaskCtx.arc(
            roundedMaskCanvas.width / 2,
            roundedMaskCanvas.height / 2,
            maxCornerRadius,
            0,
            Math.PI * 2
          );
          roundedMaskCtx.fill();
        } else {
          drawRoundedRect(roundedMaskCtx, 0, 0, roundedMaskCanvas.width, roundedMaskCanvas.height, effectiveCornerRadius);
          roundedMaskCtx.fill();
        }
        
        // Create a new transparent canvas for the final result
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d', { alpha: true });
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height;
        
        // Draw image to final canvas first
        finalCtx.drawImage(tempCanvas, 0, 0);
        
        // Use destination-in to clip the image to the rounded shape (removes black background)
        // This operation keeps only the pixels where the mask is opaque, making everything else transparent
        finalCtx.globalCompositeOperation = 'destination-in';
        finalCtx.drawImage(roundedMaskCanvas, 0, 0);
        finalCtx.globalCompositeOperation = 'source-over';
        
        // Replace the original canvas with the final transparent canvas
        canvas.width = finalCanvas.width;
        canvas.height = finalCanvas.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(finalCanvas, 0, 0);
      } else {
        // No rounded corners, just draw the image
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Apply feather edge (soft edge effect) - works with both rectangles and circles
      if (featherEdge > 0) {
        // Calculate feather size as percentage of smallest dimension (0-100% slider)
        // At 100%, use 50% of smallest dimension for strong feather effect
        const minDimension = Math.min(canvas.width, canvas.height);
        const featherSize = (featherEdge / 100) * (minDimension * 0.5); // 0-100% slider maps to 0-50% of image
        
        // Create a mask canvas for feather effect
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d', { alpha: true });
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        
        // Clear mask canvas to transparent
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        // Start with a fully opaque white shape (circle or rectangle with same corner radius as image)
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
        } else if (effectiveCornerRadius > 0) {
          // For rectangle with rounded corners, create a white rounded rectangle matching the image shape
          drawRoundedRect(maskCtx, 0, 0, canvas.width, canvas.height, effectiveCornerRadius);
          maskCtx.fill();
        } else {
          // For rectangle without rounded corners, create a white rectangle
          maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Create soft edges using distance-based approach for smooth corners
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
          // For rectangular images (with or without rounded corners), use distance-based mask
          // This approach calculates distance from each pixel to the nearest edge/corner
          // and creates a smooth gradient that works perfectly on corners
          
          // Get image data to manipulate pixels directly
          const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          const data = imageData.data;
          
          // Calculate distance from each pixel to the nearest edge
          // For rounded rectangles, we need to account for corner radius
          for (let y = 0; y < maskCanvas.height; y++) {
            for (let x = 0; x < maskCanvas.width; x++) {
              let minDist;
              
              if (effectiveCornerRadius > 0) {
                // For rounded rectangles, calculate distance to the rounded shape
                // Check if we're in a corner region
                const distToLeft = x;
                const distToRight = maskCanvas.width - x;
                const distToTop = y;
                const distToBottom = maskCanvas.height - y;
                
                // Check if we're in the corner region (within corner radius of both edges)
                const inTopLeftCorner = distToLeft < effectiveCornerRadius && distToTop < effectiveCornerRadius;
                const inTopRightCorner = distToRight < effectiveCornerRadius && distToTop < effectiveCornerRadius;
                const inBottomLeftCorner = distToLeft < effectiveCornerRadius && distToBottom < effectiveCornerRadius;
                const inBottomRightCorner = distToRight < effectiveCornerRadius && distToBottom < effectiveCornerRadius;
                
                if (inTopLeftCorner || inTopRightCorner || inBottomLeftCorner || inBottomRightCorner) {
                  // In a corner - calculate distance to the arc
                  let cornerCenterX, cornerCenterY;
                  if (inTopLeftCorner) {
                    cornerCenterX = effectiveCornerRadius;
                    cornerCenterY = effectiveCornerRadius;
                  } else if (inTopRightCorner) {
                    cornerCenterX = maskCanvas.width - effectiveCornerRadius;
                    cornerCenterY = effectiveCornerRadius;
                  } else if (inBottomLeftCorner) {
                    cornerCenterX = effectiveCornerRadius;
                    cornerCenterY = maskCanvas.height - effectiveCornerRadius;
                  } else {
                    cornerCenterX = maskCanvas.width - effectiveCornerRadius;
                    cornerCenterY = maskCanvas.height - effectiveCornerRadius;
                  }
                  
                  const distToCornerCenter = Math.sqrt(
                    Math.pow(x - cornerCenterX, 2) + Math.pow(y - cornerCenterY, 2)
                  );
                  minDist = Math.max(0, effectiveCornerRadius - distToCornerCenter);
                } else {
                  // Not in a corner - use standard edge distance
                  minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
                }
              } else {
                // No rounded corners - simple edge distance
                minDist = Math.min(y, maskCanvas.height - y, x, maskCanvas.width - x);
              }
              
              // Calculate alpha based on distance from edge
              // Pixels at the edge (minDist = 0) should be fully transparent (alpha = 0)
              // Pixels at featherSize or more from edge should be fully opaque (alpha = 255)
              let alpha = 255;
              if (minDist < featherSize) {
                // Linear fade from edge to featherSize
                alpha = Math.floor((minDist / featherSize) * 255);
              }
              
              // Apply the alpha to the mask (index 3 is alpha channel)
              const index = (y * maskCanvas.width + x) * 4;
              data[index + 3] = alpha;
            }
          }
          
          // Put the modified image data back
          maskCtx.putImageData(imageData, 0, 0);
        }
        
        maskCtx.globalCompositeOperation = 'source-over';
        
        // Apply mask to soften edges (image already drawn, just apply feather mask)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
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

  const handleDownload = () => {
    const imageToDownload = editedImageUrl || imageUrl;
    if (!imageToDownload || !imageToDownload.trim()) {
      alert('No image to download. Please load a screenshot first.');
      return;
    }
    const orderId = searchParams.get('order_id') || '';
    const baseName = orderId ? `screenmerch-${orderId}` : 'screenmerch-print-ready`;
    const filename = `${baseName}.png`;

    const doDownload = (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    if (imageToDownload.startsWith('data:image')) {
      try {
        const comma = imageToDownload.indexOf(',');
        const base64 = comma >= 0 ? imageToDownload.slice(comma + 1) : '';
        const mime = imageToDownload.match(/data:([^;]+);/);
        const type = (mime && mime[1]) || 'image/png';
        if (base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          doDownload(new Blob([bytes], { type }));
        } else {
          alert('Download failed. No image data.');
        }
      } catch (e) {
        console.error(e);
        alert('Download failed. Try again.');
      }
    } else if (imageToDownload.startsWith('http')) {
      fetch(imageToDownload, { mode: 'cors' })
        .then((r) => r.blob())
        .then(doDownload)
        .catch(() => alert('Download failed. Image may be from another origin.'));
    } else {
      alert('Download failed. No valid image.');
    }
  };

  const handleApplyEdits = () => {
    if (!editedImageUrl) {
      alert('Please wait for the image to process, or select a screenshot first.');
      return;
    }
    
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
      let updatedCart;
      
      // If a specific cart product is selected, only update that one
      if (selectedCartProductIndex !== null && cartProducts.length > 0 && cartProducts[selectedCartProductIndex]) {
        const selectedProduct = cartProducts[selectedCartProductIndex];
        const cartIndex = selectedProduct.originalCartIndex;
        const offsets = productImageOffsets[cartIndex] || { x: 0, y: 0 };
        
        // Use the original cart index to update the correct item
        updatedCart = cartItems.map((item, index) => {
          // Check if this is the selected product using original cart index
          if (index === cartIndex) {
            return {
              ...item,
              screenshot: editedImageUrl,
              edited: true,
              tools_acknowledged: true,
              // Save tool settings for this product
              toolSettings: {
                screenshotScale,
                offsetX: offsets.x,
                offsetY: offsets.y,
                featherEdge,
                cornerRadius,
                frameEnabled,
                frameColor,
                frameWidth,
                doubleFrame,
                printAreaFit
              }
            };
          }
          return item;
        });
        console.log(`💾 Updated screenshot for selected cart product: ${selectedProduct.name} (cart index: ${selectedProduct.originalCartIndex})`);
      } else {
        // No specific product selected, update all items (backward compatibility)
        updatedCart = cartItems.map(item => ({
          ...item,
          screenshot: editedImageUrl,
          edited: true,
          tools_acknowledged: true
        }));
        console.log('💾 Updated screenshot for all cart items');
      }
      
      localStorage.setItem('cart_items', JSON.stringify(updatedCart));
    } catch (e) {
      console.error('Failed to save edited image:', e);
    }
    
    // Navigate directly to cart
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
    <div className="tools-page-container" ref={containerRef}>
      <div className="tools-page-header">
        <h1>Edit Tools</h1>
        <p className="tools-subtitle">Edit your screenshot with professional tools</p>
      </div>

      {searchParams.get('order_id') && (orderScreenshotsLoading || orderScreenshotsError) && (
        <div style={{
          margin: '0 20px 16px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: orderScreenshotsError ? '#f8d7da' : '#cce5ff',
          color: orderScreenshotsError ? '#721c24' : '#004085',
          border: `1px solid ${orderScreenshotsError ? '#f5c6cb' : '#b8daff'}`
        }}>
          {orderScreenshotsLoading && '⏳ Loading screenshots from order (same as in your email)...'}
          {orderScreenshotsError && !orderScreenshotsLoading && `❌ ${orderScreenshotsError}`}
        </div>
      )}

      {(() => {
        // Check if screenshot and product are selected
        const hasScreenshot = imageUrl || editedImageUrl;
        const hasProduct = cartProducts.length > 0 && selectedCartProductIndex !== null;
        const isEnabled = hasScreenshot && hasProduct;
        
        return (
          <>
            <div 
              className={`tools-content-reorganized ${!isEnabled ? 'tools-disabled' : ''}`}
              style={!isEnabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}
            >
        {/* Left Column: Product Preview and Screenshot Size - Fixed Position */}
        <div className="tools-left-column" ref={leftColumnRef}>
          {/* Fixed section at top - Product Preview and Screenshot Preview */}
          <div className="cart-products-preview-fixed">
            {/* Cart Products Preview Section - Show only selected product */}
            {cartProducts.length > 0 && selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex] && (
              <div className="cart-products-preview-section-compact">
                <h3 style={{ marginTop: '10px', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>
                  Product Preview ({selectedCartProductIndex + 1} of {cartProducts.length})
                </h3>
              {(() => {
                const product = cartProducts[selectedCartProductIndex];
                const cartIndex = product.originalCartIndex;
                const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
                const currentImage = editedImageUrl || imageUrl;
                
                return (
                  <div style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '2px solid #dee2e6',
                    position: 'relative'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '10px',
                      gap: '8px',
                      justifyContent: 'center'
                    }}>
                      <span style={{
                        background: '#007bff',
                        color: 'white',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        flexShrink: 0
                      }}>
                        {selectedCartProductIndex + 1}
                      </span>
                      <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-word' }}>{product.name}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {product.color} • {product.size}
                        </div>
                      </div>
                    </div>
                    
                    {/* Product Preview - Handle different product types */}
                    {(() => {
                      const productName = product.name || '';
                      const isMug = isMugProduct(productName);
                      const isHat = isHatProduct(productName);
                      const isAllOverPrint = isAllOverPrintProduct(productName);
                      const isMiscNoPreview = isMiscProductNoPreview(productName);
                      
                      // Debug logging for hat products
                      if (isHat) {
                        console.log('🎩 [HAT DETECTED] Product:', productName, 'Will use generic hat image');
                      }
                      
                      // All-over-print products: Show notice, no preview, tools disabled
                      if (isAllOverPrint) {
                        return (
                          <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            background: '#fff3cd',
                            border: '2px solid #ffc107',
                            borderRadius: '8px',
                            color: '#856404'
                          }}>
                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
                            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>No Tools for All-Over Print</div>
                            <div style={{ fontSize: '14px' }}>
                              Editing tools (feather, corner radius, frame) are not available for all-over print products.
                            </div>
                          </div>
                        );
                      }
                      
                      // Mugs: Show "Preview Not Available" message, but allow tools
                      if (isMug) {
                        return (
                          <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            background: '#e7f3ff',
                            border: '2px solid #b3d9ff',
                            borderRadius: '8px',
                            color: '#004085',
                            minHeight: '150px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}>
                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>☕</div>
                            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Preview Not Available</div>
                            <div style={{ fontSize: '14px' }}>
                              Mug preview is not available due to the curved surface, but you can still use the editing tools to customize your screenshot.
                            </div>
                          </div>
                        );
                      }
                      
                      // Misc products (no preview needed): Allow tools but no preview
                      // Still render ProductPreviewWithDrag for size calculation, but use placeholder image
                      if (isMiscNoPreview) {
                        if (currentImage) {
                          // Use a placeholder transparent/white image for size calculation
                          // Create a data URL for a white rectangle
                          const placeholderSize = 400;
                          const canvas = document.createElement('canvas');
                          canvas.width = placeholderSize;
                          canvas.height = placeholderSize;
                          const ctx = canvas.getContext('2d');
                          ctx.fillStyle = '#f8f9fa';
                          ctx.fillRect(0, 0, placeholderSize, placeholderSize);
                          const placeholderImage = canvas.toDataURL();
                          
                          return (
                            <div style={{ position: 'relative' }}>
                              <ProductPreviewWithDrag
                                productImage={placeholderImage}
                                screenshot={currentImage}
                                productName={productName}
                                productSize={product.size}
                                offsetX={offset.x}
                                offsetY={offset.y}
                                onOffsetChange={(x, y) => {
                                  setProductImageOffsets(prev => ({
                                    ...prev,
                                    [cartIndex]: { x, y }
                                  }));
                                }}
                                featherEdge={featherEdge}
                                cornerRadius={cornerRadius}
                                printAreaFit={printAreaFit}
                                selectedProductName={selectedProductName}
                                screenshotScale={screenshotScale}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                right: '10px',
                                background: 'rgba(255, 255, 255, 0.9)',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                textAlign: 'center',
                                border: '1px solid #dee2e6'
                              }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Product Preview Not Available</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>
                                  Screenshot size reflects selected product print area
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div style={{
                              padding: '20px',
                              textAlign: 'center',
                              background: '#f8f9fa',
                              border: '2px solid #dee2e6',
                              borderRadius: '8px',
                              color: '#495057',
                              minHeight: '150px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}>
                              <div style={{ fontSize: '24px', marginBottom: '10px' }}>✏️</div>
                              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Product Preview Not Available</div>
                              <div style={{ fontSize: '14px' }}>
                                You can use the editing tools to customize your screenshot for this product.
                              </div>
                            </div>
                          );
                        }
                      }
                      
                      // Hats: Use generic hat image for all hats (always, even without screenshot)
                      if (isHat) {
                        const hatImage = getGenericHatImage();
                        console.log('🎩 [HAT DETECTED] Product:', productName);
                        console.log('🎩 [HAT IMAGE] Using generic hat image:', hatImage);
                        console.log('🎩 [HAT IMAGE] Original product image from cart:', product.productImage);
                        console.log('🎩 [HAT IMAGE] Will override with:', hatImage);
                        // Only show preview if there's a screenshot
                        if (currentImage) {
                          return (
                            <ProductPreviewWithDrag
                              productImage={hatImage}
                              screenshot={currentImage}
                              productName={productName}
                              productSize={product.size}
                              offsetX={offset.x}
                              offsetY={offset.y}
                              onOffsetChange={(x, y) => {
                                setProductImageOffsets(prev => ({
                                  ...prev,
                                  [cartIndex]: { x, y }
                                }));
                              }}
                              featherEdge={featherEdge}
                              cornerRadius={cornerRadius}
                              printAreaFit={printAreaFit}
                              selectedProductName={selectedProductName}
                              screenshotScale={screenshotScale}
                            />
                          );
                        } else {
                          // Show placeholder for hat when no screenshot
                          return (
                            <div style={{
                              padding: '20px',
                              textAlign: 'center',
                              background: '#f8f9fa',
                              border: '2px solid #dee2e6',
                              borderRadius: '8px',
                              color: '#495057',
                              minHeight: '150px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}>
                              <img 
                                src={hatImage} 
                                alt={productName}
                                style={{ maxWidth: '200px', maxHeight: '150px', marginBottom: '10px' }}
                              />
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                Add a screenshot to see preview
                              </div>
                            </div>
                          );
                        }
                      }
                      
                      // Regular products (shirts, etc.): Show normal preview (use placeholder when productImage missing, e.g. loaded from order_id)
                      if (currentImage) {
                        const productImg = product.productImage || getPlaceholderProductImage();
                        return (
                          <ProductPreviewWithDrag
                            productImage={productImg}
                            screenshot={currentImage}
                            productName={productName}
                            productSize={product.size}
                            offsetX={offset.x}
                            offsetY={offset.y}
                            onOffsetChange={(x, y) => {
                              setProductImageOffsets(prev => ({
                                ...prev,
                                [cartIndex]: { x, y }
                              }));
                            }}
                            featherEdge={featherEdge}
                            cornerRadius={cornerRadius}
                            printAreaFit={printAreaFit}
                            selectedProductName={selectedProductName}
                            screenshotScale={screenshotScale}
                          />
                        );
                      }
                      
                      return null;
                    })()}
                  </div>
                );
              })()}
              </div>
            )}

          </div>

          {/* Scrollable section below fixed previews */}
          <div className="tools-left-column-scrollable">
            {/* Screenshot Size Tool - Directly under product */}
            <div className="tool-control-group" style={{ marginTop: '20px' }}>
              <h3 style={{ textAlign: 'center' }}>Screenshot Size</h3>
              <p className="tool-description" style={{ textAlign: 'center' }}>Adjust the size of your screenshot to fit the print area perfectly</p>
              <div className="slider-control">
                <div className={`${selectedProductName && !screenshotSizeInteracted ? 'screenshot-size-pulse' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '4px' }}>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={screenshotScale}
                    onMouseDown={() => setScreenshotSizeInteracted(true)}
                    onTouchStart={() => setScreenshotSizeInteracted(true)}
                    onChange={(e) => {
                      setScreenshotScale(parseInt(e.target.value));
                      setScreenshotSizeInteracted(true);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onSelectStart={(e) => e.preventDefault()}
                    className="slider"
                    style={{ 
                      flex: 1,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                      touchAction: 'manipulation'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotScale(Math.min(150, screenshotScale + 1));
                        setScreenshotSizeInteracted(true);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onSelectStart={(e) => e.preventDefault()}
                      style={{
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        width: '28px',
                        height: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        padding: 0,
                        lineHeight: 1,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'manipulation'
                      }}
                      title="Increase size"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotScale(Math.max(50, screenshotScale - 1));
                        setScreenshotSizeInteracted(true);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onSelectStart={(e) => e.preventDefault()}
                      style={{
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        width: '28px',
                        height: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        padding: 0,
                        lineHeight: 1,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'manipulation'
                      }}
                      title="Decrease size"
                    >
                      ▼
                    </button>
                  </div>
                  <span 
                    className="slider-value" 
                    style={{ 
                      minWidth: '50px', 
                      textAlign: 'right',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onSelectStart={(e) => e.preventDefault()}
                  >
                    {screenshotScale}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Spacer to maintain grid layout since left column is fixed */}
        <div style={{ width: '100px', flexShrink: 0 }} className="tools-left-column-spacer"></div>
        <div style={{ width: '350px', flexShrink: 0 }} className="tools-left-column-spacer"></div>

        {/* Right Column: Tools */}
        <div className="tools-controls-section">
          {/* Product Selector - Small dropdown at top of tools */}
          {cartProducts.length > 1 && (
            <div 
              className="tool-control-group"
              style={{ 
                marginBottom: '1rem',
                position: 'relative'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Select Product From Cart:
              </h3>
              <select
                value={selectedCartProductIndex !== null ? selectedCartProductIndex : ''}
                onChange={(e) => {
                  const index = parseInt(e.target.value);
                  if (!isNaN(index)) {
                    setSelectedCartProductIndex(index);
                    console.log(`🔄 Product changed to index ${index}`);
                  }
                }}
                className="print-area-select"
                style={{ width: '100%' }}
              >
                <option value="">-- Select Product --</option>
                {cartProducts.map((product, index) => (
                  <option key={index} value={index}>
                    {product.name}{product.color && product.color !== 'N/A' ? ` - ${product.color}` : ''}{product.size && product.size !== 'N/A' ? ` (${product.size})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Fit to Print Area - At the top */}
          <div className="tool-control-group">
            <h3>Fit to Print Area</h3>
            <p className="tool-description">Crop image to fit product print areas</p>
            
            {/* Product Selector */}
            <div 
              className="select-control product-select-pulse-wrapper"
              style={{ marginBottom: '1rem', position: 'relative' }}
            >
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Select Product:
              </label>
              <select
                value={selectedProductName}
                onClick={() => {
                  if (!productSelectClicked) {
                    setProductSelectClicked(true);
                  }
                }}
                onChange={(e) => {
                  setSelectedProductName(e.target.value);
                  setProductSelectClicked(true);
                  // Reset screenshot size interaction when product changes
                  setScreenshotSizeInteracted(false);
                  // Auto-select product fit if product is selected
                  if (e.target.value) {
                    setPrintAreaFit('product');
                  }
                }}
                className={`print-area-select ${!productSelectClicked ? 'product-select-pulse' : ''}`}
              >
                <option value="">-- Select Product --</option>
                {Object.keys(PRINT_AREA_CONFIG).sort().map(productName => (
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

          {(() => {
            // Check if current product is all-over-print (tools should be disabled)
            const currentProduct = cartProducts.length > 0 && selectedCartProductIndex !== null 
              ? cartProducts[selectedCartProductIndex] 
              : null;
            const currentProductName = currentProduct?.name || '';
            const toolsDisabled = isAllOverPrintProduct(currentProductName);
            
            if (toolsDisabled) {
              return (
                <div className="tool-control-group">
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: '#fff3cd',
                    border: '2px solid #ffc107',
                    borderRadius: '8px',
                    color: '#856404'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Tools Not Available</div>
                    <div style={{ fontSize: '14px' }}>
                      Editing tools (feather, corner radius, frame) are not available for all-over print products.
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <>
                <div className="tool-control-group">
                  <h3>Feather Edge</h3>
                  <p className="tool-description">Softens the edges of your screenshot</p>
                  <div className="slider-control">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={featherEdge}
                      onChange={(e) => setFeatherEdge(parseInt(e.target.value))}
                      className="slider"
                    />
                    <span className="slider-value">{featherEdge}%</span>
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
                    <span className="slider-value">{cornerRadius === 100 ? 'Circle' : `${cornerRadius}%`}</span>
                  </div>
                </div>

                <div className="tool-control-group">
                  <div className="framed-border-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '100%' }}>
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
                          <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <label style={{ minWidth: '100px' }}>Frame Color:</label>
                            <input
                              type="color"
                              value={frameColor}
                              onChange={(e) => setFrameColor(e.target.value)}
                              className="color-picker"
                            />
                            <span className="color-value" style={{ wordBreak: 'break-all' }}>{frameColor}</span>
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
                    
                    {/* Screenshot Preview - Small window to the right */}
                    <div style={{ 
                      flexShrink: 0, 
                      width: '200px', 
                      background: 'white', 
                      borderRadius: '8px', 
                      padding: '12px',
                      border: '2px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      <h4 className="screenshot-preview-title" style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        Screenshot Preview
                      </h4>
                      <div style={{ 
                        width: '100%', 
                        minHeight: '120px', 
                        maxHeight: '150px',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: '#f8f9fa', 
                        borderRadius: '6px', 
                        overflow: 'hidden',
                        border: '1px solid #dee2e6'
                      }}>
                        {editedImageUrl ? (
                          <img 
                            src={editedImageUrl} 
                            alt="Screenshot Preview" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '150px', 
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt="Screenshot Preview" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '150px', 
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                        ) : (
                          <p style={{ color: '#999', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '10px' }}>
                            No screenshot loaded
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
          
          {(() => {
            // Check if current product is all-over-print (tools should be disabled)
            const currentProduct = cartProducts.length > 0 && selectedCartProductIndex !== null 
              ? cartProducts[selectedCartProductIndex] 
              : null;
            const currentProductName = currentProduct?.name || '';
            const toolsDisabled = isAllOverPrintProduct(currentProductName);
            
            if (toolsDisabled) {
              return null; // Don't show Framed Border if tools are disabled
            }
            
            return null; // Framed Border is already shown above
          })()}

          <div className="tools-actions">
            {searchParams.get('order_id') ? (
              <button 
                className="apply-edits-btn download-btn"
                onClick={handleDownload}
                disabled={!editedImageUrl && !imageUrl}
              >
                Download
              </button>
            ) : (
              <button 
                className="apply-edits-btn"
                onClick={handleApplyEdits}
                disabled={!editedImageUrl}
              >
                Apply Edits
              </button>
            )}
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
          </>
        );
      })()}

    </div>
  );
};

export default ToolsPage;

