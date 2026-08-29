import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { getPrintAreaConfig, getPrintAreaDimensions, getPrintAreaAspectRatio, getAspectRatio, getPixelDimensions, PRINT_AREA_CONFIG, matchPrintAreaProductName } from '../../config/printAreaConfig';
import API_CONFIG, { apiJoin } from '../../config/apiConfig';
import { consumeToolsFocusCartIndex, peekToolsFocusCartIndex, writeCartItems, readPendingMerchData, savePendingMerchData, readCartItems, resyncMerchSessionFromStorage, CART_UPDATED_EVENT, PENDING_MERCH_UPDATED_EVENT } from '../../utils/merchSession';
import './ToolsPage.css';

// Google Fonts used by the Text tool (fringe/style). Must be loaded before canvas can use them.
const TEXT_TOOL_GOOGLE_FONTS = [
  'Permanent Marker',
  'Orbitron',
  'Bebas Neue',
  'Creepster',
  'Dela Gothic One',
  'Long Cang',
  'Pacifico'
];
const GOOGLE_FONTS_STYLESHEET_URL = 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Orbitron:wght@400;700&family=Bebas+Neue&family=Creepster&family=Dela+Gothic+One&family=Long+Cang&family=Pacifico&display=swap';

// Women's / men's / kids garments that use a chest print on a framed mockup photo.
// All-over, swim, and leggings stay on their existing paths.
function isApparelChestPrintProduct(productName) {
  if (!productName) return false;
  const n = productName.toLowerCase();
  if (n.includes('all-over') || n.includes('all over')) return false;
  if (n.includes('swimsuit') || n.includes('leggings')) return false;
  if (n.includes('hat') || n.includes('cap')) return false;
  // Tanks keep the 17" typical-width mapping below. Baby-jersey chest
  // fraction (7/18) is too small for racerback/tank print boxes even at 150%.
  if (n.includes('tank')) return false;
  return (
    n.includes('shirt') ||
    n.includes('tee') ||
    n.includes('hoodie') ||
    n.includes('sweatshirt') ||
    n.includes('jersey') ||
    n.includes('body suit') ||
    n.includes('bodysuit') ||
    n.includes('crop top') ||
    n.includes('long sleeve')
  );
}

// Sync Product Specific fit before first paint when a cart item is already known
// (order_id path sets this after fetch; cart Tools used to wait on effects).
function shotFingerprint(url) {
  const s = String(url || '');
  if (!s) return '';
  return `${s.length}:${s.slice(0, 40)}:${s.slice(-40)}`;
}

function cartIdentity(products) {
  return (products || [])
    .map((p) => `${p.originalCartIndex}|${p.name}|${shotFingerprint(p.productImage)}|${shotFingerprint(p.screenshot)}`)
    .join(';');
}

function defaultSessionProductName() {
  try {
    const cat = String(localStorage.getItem('last_selected_category') || 'mens').toLowerCase();
    if (cat === 'womens') return "Women's Shirt";
    if (cat === 'kids') return 'Kids Shirt';
    return 'T-Shirt';
  } catch {
    return 'T-Shirt';
  }
}

function pendingScreenshotUrl(data) {
  if (!data || typeof data !== 'object') return '';
  return (
    data.selected_screenshot ||
    data.edited_screenshot ||
    data.thumbnail ||
    (Array.isArray(data.screenshots) && data.screenshots[0]) ||
    ''
  );
}

/** Tools can run from the selected merch image without a shopping-cart item. */
function sessionToolsProductFromPending() {
  try {
    const data = readPendingMerchData() || {};
    const screenshot = pendingScreenshotUrl(data);
    if (!screenshot) return null;
    const rawName = data.selected_product_name || defaultSessionProductName();
    const name = matchPrintAreaProductName(rawName) || rawName;
    return {
      originalCartIndex: 0,
      name,
      color: 'N/A',
      size: 'N/A',
      screenshot,
      productImage: '',
      toolSettings: null,
      filteredIndex: 0,
      sessionOnly: true,
    };
  } catch {
    return null;
  }
}

function getInitialCartPrintFit() {
  if (typeof window === 'undefined') return { name: '', fit: 'none' };
  try {
    const q = window.location.search;
    if (q && new URLSearchParams(q).get('order_id')) {
      return { name: '', fit: 'none' };
    }
    const items = readCartItems();
    if (!Array.isArray(items) || items.length === 0) {
      const sessionProduct = sessionToolsProductFromPending();
      if (!sessionProduct) return { name: '', fit: 'none' };
      const name = matchPrintAreaProductName(sessionProduct.name) || sessionProduct.name || '';
      return { name, fit: name ? 'product' : 'none' };
    }

    const withShots = items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => item && item.screenshot && String(item.screenshot).trim() !== '');
    if (!withShots.length) return { name: '', fit: 'none' };

    const focusOriginal = peekToolsFocusCartIndex();
    let chosen = withShots[withShots.length - 1];
    if (focusOriginal != null) {
      const matched = withShots.find((p) => p.originalIndex === focusOriginal);
      if (matched) chosen = matched;
    }
    const name = matchPrintAreaProductName(chosen.item.name) || '';
    return { name, fit: name ? 'product' : 'none' };
  } catch {
    return { name: '', fit: 'none' };
  }
}

// Component for product preview with draggable screenshot
const ProductPreviewWithDrag = ({ 
  productImage, 
  screenshot, 
  productName, 
  productSize,
  offsetX, 
  offsetY, 
  onOffsetChange,
  textEnabled,
  textOffsetX = 50,
  textOffsetY = 50,
  onTextPositionChange,
  featherEdge,
  cornerRadius,
  printAreaFit,
  selectedProductName,
  screenshotScale = 100,
  imageOffsetX = 0,
  imageOffsetY = 0
}) => {
  const containerRef = useRef(null);
  const productImageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastDragPositionRef = useRef({ x: 0, y: 0 });
  const currentDragPositionRef = useRef({ x: 0, y: 0 }); // Track current position for snapping
  const dragStartTextPositionRef = useRef({ x: 50, y: 50 }); // When text drag starts, store text %
  const totalDragDeltaRef = useRef({ x: 0, y: 0 }); // Accumulated pixel delta during text drag
  const [processedImage, setProcessedImage] = useState(screenshot);
  const textDragMode = false;
  const [screenshotDisplaySize, setScreenshotDisplaySize] = useState({ width: 150, height: 150 });
  const [productImageSize, setProductImageSize] = useState({ width: 0, height: 0 });

  // Calculate screenshot display size based on product print area
  useLayoutEffect(() => {
    // Use selectedProductName if available and printAreaFit is 'product', otherwise use productName
    const effectiveProductName = (printAreaFit === 'product' && selectedProductName) ? selectedProductName : productName;
    
    if (!effectiveProductName) return;

    const calculateSize = () => {
      const hasProductImage = productImageSize.width > 0 && productImageSize.height > 0;
      let displayedProductWidth = productImageSize.width;
      let displayedProductHeight = productImageSize.height;

      // Before the mockup reports a painted rect, size from the stage width
      // (img is width:100%). Same print-area math — not a 400×400 guess.
      if (!hasProductImage && containerRef.current) {
        const stageW = containerRef.current.getBoundingClientRect().width;
        if (stageW >= 2) {
          displayedProductWidth = stageW;
          const img = productImageRef.current;
          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            displayedProductHeight = stageW * (img.naturalHeight / img.naturalWidth);
          }
        }
      }

      try {
        // Get print area dimensions for this product
        const printDimensions = getPrintAreaDimensions(effectiveProductName, productSize || null, 'front');
        
        console.log(`🔍 [SIZE_CALC] Product: "${effectiveProductName}" (from ${printAreaFit === 'product' && selectedProductName ? 'dropdown' : 'cart'}), Size: "${productSize || 'default'}", Print Area:`, printDimensions);
        
        // Wait for the painted mockup. A 400×400 fallback sizes the overlay
        // as if the photo were huge, which sticks on phones when layout is late.
        if (printDimensions && displayedProductWidth > 0) {
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
            const maxHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.50 : Number.POSITIVE_INFINITY; // Hats are taller, print area is on front panel
            
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
            const minHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.20 : 0;
            
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

          // Apparel (women/men/kids shirts, tees, hoodies, tanks, sweatshirts,
          // baby/toddler): size to a shared mockup-relative chest print region,
          // same pattern as hats (explicit % of the displayed mockup).
          //
          // Why Baby Jersey already looks perfect: it is 7×8 and does not match
          // kids/youth/hoodie/tank, so it uses the default typical garment width
          // of 18" → overlay width = 7/18 of the *full* mockup photo. Shirt
          // mockups frame the chest similarly, so that fraction matches the
          // visual print box. Mapping 12"/18" onto the full photo (~67%) is
          // far larger than the actual chest on the same style of photo.
          if (isApparelChestPrintProduct(effectiveProductName)) {
            const babyJerseyPrint = getPrintAreaDimensions('Baby Jersey T-Shirt', null, 'front');
            const defaultTypicalGarmentWidthInches = 18;
            const isHoodieOrSweat =
              productNameLower.includes('hoodie') || productNameLower.includes('sweatshirt');
            // Hoodies show more of the garment than baby jersey. Size from the
            // real print width so the chest box fills evenly on both axes.
            const typicalGarmentWidthInches = isHoodieOrSweat
              ? ((productNameLower.includes('youth') || productNameLower.includes('kids')) ? 16 : 18)
              : defaultTypicalGarmentWidthInches;
            const printWidthForFraction = isHoodieOrSweat
              ? printDimensions.width
              : (babyJerseyPrint?.width || 7);
            const chestWidthFraction = printWidthForFraction / typicalGarmentWidthInches;

            let finalWidth = displayedProductWidth * chestWidthFraction;
            if (isHoodieOrSweat) {
              const maxW = displayedProductWidth * 0.50;
              const minW = displayedProductWidth * 0.34;
              if (finalWidth > maxW) finalWidth = maxW;
              if (finalWidth < minW) finalWidth = minW;
            }
            let finalHeight = finalWidth / printAspectRatio;
            if (isSquare && !isHoodieOrSweat) {
              finalHeight = finalWidth;
            }
            // kidhoodiepreview.png has one painted print box for every size.
            // XS is 10×7 (Printful crop), but that box on the photo is closer
            // to 10×9 — 10×7 leaves the bottom of the print region uncovered.
            const isYouthHoodie =
              isHoodieOrSweat &&
              (productNameLower.includes('youth') || productNameLower.includes('kids'));
            if (isYouthHoodie && printDimensions.width > 0) {
              // Keep the width-matched box. Stretch height by 1/8 so the
              // painted print region is covered without changing left/right.
              finalHeight = (finalWidth / printAspectRatio) * (8 / 7);
            }

            // Keep tall prints on the garment, not the full photo. Baby Jersey
            // (7×8 at 7/18 width) is ~44% of mockup width in height and must
            // not be clamped.
            const maxHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.65 : Number.POSITIVE_INFINITY;
            if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              if (!isYouthHoodie) {
                finalWidth = isSquare ? finalHeight : finalHeight * printAspectRatio;
              }
            }

            setScreenshotDisplaySize({
              width: finalWidth,
              height: finalHeight
            });

            console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product) [apparel chest]`);
            return;
          }
          
          // For non-hat products, calculate size to ensure full print area coverage
          // Calculate based on print area dimensions to ensure even coverage
          const printWidthInches = printDimensions.width;
          const printHeightInches = printDimensions.height;
          
          // Estimate product dimensions in inches for scaling
          // Typical product widths: kids ~14", womens/mens ~18-20", hoodies ~20"
          let typicalProductWidthInches = 18;
          
          if (productNameLower.includes('kids') || productNameLower.includes('youth')) {
            typicalProductWidthInches = 14;
          } else if (productNameLower.includes('hoodie')) {
            typicalProductWidthInches = 20;
          } else if (productNameLower.includes('tank')) {
            typicalProductWidthInches = 17;
          }
          
          // Map configured print inches onto the mockup. Height comes only from
          // the print-area aspect (width x height in printAreaConfig) — do not
          // also scale from mockup photo height or the overlay becomes too tall.
          const printWidthPercent = printWidthInches / typicalProductWidthInches;
          let finalWidth = displayedProductWidth * printWidthPercent;
          let finalHeight = finalWidth / printAspectRatio;
          
          // For square products, ensure width and height are always equal
          if (isSquare) {
            // Use the larger of width or height to ensure full coverage, then make square
            const baseSize = displayedProductHeight > 0
              ? Math.min(displayedProductWidth, displayedProductHeight)
              : displayedProductWidth;
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
            const maxHeight = displayedProductHeight > 0 ? displayedProductHeight * 0.80 : Number.POSITIVE_INFINITY;
            
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
            
            if (finalWidth < minWidth) {
              finalWidth = minWidth;
              finalHeight = finalWidth / printAspectRatio;
            }
          }
          
          setScreenshotDisplaySize({
            width: finalWidth,
            height: finalHeight
          });
          
          console.log(`📐 [PRINT_AREA] ${effectiveProductName} (${productSize || 'default'}): Print ${printDimensions.width}"x${printDimensions.height}" (AR: ${printAspectRatio.toFixed(2)}) → ${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}px (${(finalWidth/displayedProductWidth*100).toFixed(1)}% x ${(finalHeight/displayedProductHeight*100).toFixed(1)}% of product)`);
        } else if (displayedProductWidth > 0) {
          // Fallback: use a percentage of the painted mockup, not a 400px guess
          const fallbackPercent = effectiveProductName.toLowerCase().includes('cropped') ? 0.25 : 0.30;
          const fallbackBase = displayedProductHeight > 0
            ? Math.min(displayedProductWidth, displayedProductHeight)
            : displayedProductWidth;
          const fallbackSize = fallbackBase * fallbackPercent;
          setScreenshotDisplaySize({ width: fallbackSize, height: fallbackSize });
        }
      } catch (e) {
        console.warn('Could not calculate print area size:', e);
        if (productImageSize.width > 0 && productImageSize.height > 0) {
          const fallbackSize = Math.min(productImageSize.width, productImageSize.height) * 0.25;
          setScreenshotDisplaySize({ width: fallbackSize, height: fallbackSize });
        }
      }
    };

    calculateSize();
    const raf = requestAnimationFrame(calculateSize);
    return () => cancelAnimationFrame(raf);
  }, [productName, productSize, productImageSize, selectedProductName, printAreaFit, productImage]);

  // Measure the painted mockup only. naturalWidth is the file size and
  // makes the overlay huge on phones (then too tall once width is matched).
  const measureProductImage = () => {
    const img = productImageRef.current;
    const stage = containerRef.current;
    if (!img && !stage) return;
    const rect = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
    let width = rect.width || img?.clientWidth || img?.offsetWidth || 0;
    let height = rect.height || img?.clientHeight || img?.offsetHeight || 0;
    // iOS can report width before height:auto has resolved. Infer painted
    // height from file aspect — never use naturalWidth as the overlay size.
    if (width >= 2 && height < 2 && img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      height = width * (img.naturalHeight / img.naturalWidth);
    }
    // Cached/mobile: img rect can be 0 on first layout. Stage width is the
    // mockup's CSS width (img is 100%).
    if (width < 2 && stage) {
      const stageW = stage.getBoundingClientRect().width;
      if (stageW >= 2) {
        width = stageW;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          height = width * (img.naturalHeight / img.naturalWidth);
        }
      }
    }
    if (width < 2 || height < 2) return;
    setProductImageSize((prev) => {
      if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
        return prev;
      }
      return { width, height };
    });
  };

  const handleProductImageLoad = () => {
    measureProductImage();
    requestAnimationFrame(() => {
      measureProductImage();
      requestAnimationFrame(measureProductImage);
    });
  };

  useLayoutEffect(() => {
    measureProductImage();
    const img = productImageRef.current;
    const stage = containerRef.current;
    // Cached images (especially iOS) may not fire onLoad again.
    if (img?.complete) {
      handleProductImageLoad();
    }
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measureProductImage())
      : null;
    if (observer) {
      if (img) observer.observe(img);
      if (stage) observer.observe(stage);
    }
    window.addEventListener('resize', measureProductImage);
    window.addEventListener('orientationchange', measureProductImage);
    let measureCancelled = false;
    const tickMeasure = (attempt) => {
      if (measureCancelled) return;
      measureProductImage();
      if (attempt < 8) {
        requestAnimationFrame(() => tickMeasure(attempt + 1));
      }
    };
    requestAnimationFrame(() => tickMeasure(0));
    return () => {
      measureCancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', measureProductImage);
      window.removeEventListener('orientationchange', measureProductImage);
    };
  }, [productImage, productName]);

  useEffect(() => {
    setProcessedImage(screenshot);
  }, [screenshot]);

  // Process image with effects in real-time
  useEffect(() => {
    let cancelled = false;
    const processImage = async () => {
      if (!screenshot) return;

      // Default Tools path: do not rasterize into a PNG. Portrait frames from
      // uploads like Samurai Dog become multi-MB PNGs on iPhone and the overlay
      // never appears. If Angle Radius / feather are already baked into the
      // screenshot (editedImageUrl), skip a second clip — it cut a square
      // frame off at the rounded corners and JPEG-filled the gaps.
      if (!featherEdge && !cornerRadius) {
        if (!cancelled) setProcessedImage(screenshot);
        return;
      }

      const img = new Image();
      if (typeof screenshot === 'string' && !screenshot.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (cancelled) return;
        try {
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

        if (!cancelled) setProcessedImage(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          if (!cancelled) setProcessedImage(screenshot);
        }
      };
      img.onerror = () => {
        if (!cancelled) setProcessedImage(screenshot);
      };
      img.src = screenshot;
    };

    processImage();
    return () => { cancelled = true; };
  }, [screenshot, featherEdge, cornerRadius]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
    currentDragPositionRef.current = { x: offsetX, y: offsetY };
    if (textDragMode) {
      dragStartTextPositionRef.current = { x: textOffsetX, y: textOffsetY };
      totalDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    const startPos = { x: touch.clientX, y: touch.clientY };
    setDragStart(startPos);
    lastDragPositionRef.current = startPos;
    currentDragPositionRef.current = { x: offsetX, y: offsetY };
    if (textDragMode) {
      dragStartTextPositionRef.current = { x: textOffsetX, y: textOffsetY };
      totalDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const clampOffsets = (x, y) => {
      if (productImageSize.width > 0 && productImageSize.height > 0) {
        const maxOffsetX = productImageSize.width * 0.4;
        const maxOffsetYUp = productImageSize.height * 0.6;
        const maxOffsetYDown = productImageSize.height * 0.4;
        return {
          x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
          y: Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, y)),
        };
      }
      const scaledWidth = screenshotDisplaySize.width * (screenshotScale / 100);
      const scaledHeight = screenshotDisplaySize.height * (screenshotScale / 100);
      const maxOffsetX = Math.max(scaledWidth, scaledHeight) * 0.5;
      const maxOffsetYUp = Math.max(scaledWidth, scaledHeight) * 1.2;
      const maxOffsetYDown = Math.max(scaledWidth, scaledHeight) * 0.5;
      return {
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
        y: Math.max(-maxOffsetYUp, Math.min(maxOffsetYDown, y)),
      };
    };

    const handleMove = (e) => {
      if (e.touches) e.preventDefault();
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      // 1:1 with cursor so placement matches where you release
      const deltaX = clientX - lastDragPositionRef.current.x;
      const deltaY = clientY - lastDragPositionRef.current.y;
      lastDragPositionRef.current = { x: clientX, y: clientY };

      if (textDragMode && onTextPositionChange) {
        totalDragDeltaRef.current.x += deltaX;
        totalDragDeltaRef.current.y += deltaY;
        const refW = productImageSize.width || screenshotDisplaySize.width || 300;
        const refH = productImageSize.height || screenshotDisplaySize.height || 300;
        const start = dragStartTextPositionRef.current;
        const percentX = Math.max(0, Math.min(100, start.x + (totalDragDeltaRef.current.x / refW) * 100));
        const percentY = Math.max(0, Math.min(100, start.y + (totalDragDeltaRef.current.y / refH) * 100));
        onTextPositionChange(percentX, percentY);
        return;
      }

      const next = clampOffsets(
        currentDragPositionRef.current.x + deltaX,
        currentDragPositionRef.current.y + deltaY
      );
      currentDragPositionRef.current = next;
      onOffsetChange(next.x, next.y);
    };

    const handleUp = () => {
      // Keep exact release position — do not snap back to center
      if (!textDragMode && onOffsetChange) {
        const { x, y } = currentDragPositionRef.current;
        onOffsetChange(x, y);
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
  }, [isDragging, onOffsetChange, onTextPositionChange, textDragMode, screenshotDisplaySize, productImageSize, screenshotScale]);

  return (
    <div 
      ref={containerRef}
      className="product-preview-stage"
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
        className="product-preview-mockup"
        key={productImage || 'mockup'}
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
      
      {/* Screenshot Overlay (Draggable) */}
      {processedImage && (
        <div
          style={{
            position: 'absolute',
            top: (() => {
              const productNameLower = (productName || '').toLowerCase();
              const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
              const isHoodie = productNameLower.includes('hoodie') || productNameLower.includes('sweatshirt');
              if (isHat && productImageSize.height > 0) {
                return `${50 - 8}%`;
              }
              if (isHoodie) return '52%';
              return '50%';
            })(),
            left: '50%',
            transform: (() => {
              const productNameLower = (productName || '').toLowerCase();
              const isYouthHoodie =
                (productNameLower.includes('hoodie') || productNameLower.includes('sweatshirt')) &&
                (productNameLower.includes('youth') || productNameLower.includes('kids'));
              // Extra 1/8 of height hangs down so left/right and the top stay put.
              const downShift = isYouthHoodie
                ? screenshotDisplaySize.height * (screenshotScale / 100) * (1 / 16)
                : 0;
              return `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY + downShift}px))`;
            })(),
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: 'none',
            pointerEvents: 'auto',
            zIndex: 2,
            overflow: 'hidden'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {(() => {
            const productNameLower = (productName || '').toLowerCase();
            const isHat = productNameLower.includes('hat') || productNameLower.includes('cap');
            const isHoodie = productNameLower.includes('hoodie') || productNameLower.includes('sweatshirt');
            const isYouthHoodie =
              isHoodie &&
              (productNameLower.includes('youth') || productNameLower.includes('kids'));
            const scaleFactor = screenshotScale / 100;
            const aspectRatio = screenshotDisplaySize.width / screenshotDisplaySize.height;
            const isSquare = Math.abs(aspectRatio - 1.0) < 0.01; // Check if display size is square
            let scaledWidth, scaledHeight;
            
            if (isHoodie || isHat) {
              // Scale from width so left/right stay the control axis.
              scaledWidth = screenshotDisplaySize.width * scaleFactor;
              scaledHeight = screenshotDisplaySize.height * scaleFactor;
            } else if (isSquare) {
              // For square products: Scale both dimensions equally to maintain square shape
              scaledWidth = screenshotDisplaySize.width * scaleFactor;
              scaledHeight = scaledWidth; // Force square
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
                className={`product-preview-overlay${printAreaFit && printAreaFit !== 'none' ? ' product-preview-overlay-fit' : ''}${isYouthHoodie ? ' product-preview-overlay-youth-hoodie' : ''}`}
                key={processedImage || 'overlay'}
                src={processedImage}
                alt="Screenshot overlay"
                style={{
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  // Stretch only: cover was cropping the sides when height grew.
                  objectFit: isYouthHoodie ? 'fill' : (printAreaFit && printAreaFit !== 'none' ? 'cover' : 'contain'),
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
    "Pet Bowl All-Over Print"
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
    "Hardcover Bound Notebook"
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const leftColumnRef = useRef(null);
  const containerRef = useRef(null);
  const backBtnRef = useRef(null);
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [featherEdge, setFeatherEdge] = useState(0);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [frameEnabled, setFrameEnabled] = useState(false);
  const [frameColor, setFrameColor] = useState('#FF0000');
  const [frameWidth, setFrameWidth] = useState(10);
  const [doubleFrame, setDoubleFrame] = useState(false);
  const [textEnabled, setTextEnabled] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textFont, setTextFont] = useState('Arial');
  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(24);
  const [textOffsetX, setTextOffsetX] = useState(50); // 0-100, 50 = center
  const [textOffsetY, setTextOffsetY] = useState(50); // 0-100, 50 = center
  const [printAreaFit, setPrintAreaFit] = useState(() => getInitialCartPrintFit().fit); // 'none', 'horizontal', 'square', 'vertical', 'product'
  const [imageOrientation, setImageOrientation] = useState('portrait'); // 'portrait' | 'landscape' - landscape forces No Fit for uncropped view
  const [imageOffsetX, setImageOffsetX] = useState(0); // -100 to 100 (percentage)
  const [imageOffsetY, setImageOffsetY] = useState(0); // -100 to 100 (percentage)
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [selectedProductName, setSelectedProductName] = useState(() => getInitialCartPrintFit().name);
  const [currentImageDimensions, setCurrentImageDimensions] = useState({ width: 0, height: 0 });
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);
  const upgradeTriggeredRef = useRef(false); // Track if we've already triggered an upgrade for this image
  const [cartProducts, setCartProducts] = useState([]); // Store all cart products
  const [selectedCartProductIndex, setSelectedCartProductIndex] = useState(null); // Selected product index from cart
  const [productImageOffsets, setProductImageOffsets] = useState({}); // Store image offsets for each cart product {cartIndex: {x: 0, y: 0}}
  const [screenshotScale, setScreenshotScale] = useState(100); // Screenshot size scale (percentage: 50-150%)
  const [screenshotSizeInteracted, setScreenshotSizeInteracted] = useState(false); // Track if screenshot size has been adjusted
  const [productSelectClicked, setProductSelectClicked] = useState(() => Boolean(getInitialCartPrintFit().name)); // Track if product select has been clicked
  const [fitPreviewImageUrl, setFitPreviewImageUrl] = useState('');
  const [orderScreenshotsLoading, setOrderScreenshotsLoading] = useState(false);
  const [orderScreenshotsError, setOrderScreenshotsError] = useState(null);
  // True when opened from admin email (Edit Tools link). Init from URL so first paint is correct.
  const [isFromOrderEmail, setIsFromOrderEmail] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const q = window.location.search;
      if (q && new URLSearchParams(q).get('order_id')) return true;
      if (window.location.href && window.location.href.includes('order_id=')) return true;
    } catch (_) {}
    return false;
  });
  const orderIdLoadedRef = useRef(null); // Avoid re-fetching same order when effect re-runs
  // Per-slot edit state (keyed by cart product index) so each of up-to-5 products has its own edits; no carry-over when switching
  const slotStateRef = useRef({});
  const cartCountRef = useRef(0);
  const cartIdentityRef = useRef('');
  const entrySelectRef = useRef(true);
  const sessionPreviewUrlRef = useRef('');
  const [sessionEpoch, setSessionEpoch] = useState(0);
  // True when the user picked Fit Type / landscape (do not treat initial 'none' as a choice)
  const fitUserSetRef = useRef({});
  // When true, apply-edits effect must skip so it doesn't overwrite with previous product's image (same effect batch race)
  const switchingSlotRef = useRef(false);
  const [slotSwitchTick, setSlotSwitchTick] = useState(0);
  const [printQualityImageUrl, setPrintQualityImageUrl] = useState(''); // 300 DPI image from API (parked for download)
  const [printQualityMeta, setPrintQualityMeta] = useState(null); // { dimensions: { width, height, dpi }, file_size, format, quality }
  const [generating300Dpi, setGenerating300Dpi] = useState(false);
  const customFontsReadyRef = useRef(false);

  // Lock horizontal page pan on mobile so it doesn't fight mockup drag / sliders
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('tools-page-active');
    document.body.classList.add('tools-page-active');
    return () => {
      html.classList.remove('tools-page-active');
      document.body.classList.remove('tools-page-active');
    };
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e) => {
      if (!e.touches?.[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (!e.touches?.[0]) return;
      const el = e.target;
      if (el?.closest?.('input[type="range"], select, .preview-image-wrapper, .preview-image-wrapper-compact')) {
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > dy && dx > 6) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Ensure Google Fonts stylesheet is loaded and preload fringe fonts so canvas can use them
  useEffect(() => {
    let cancelled = false;
    const ensureFonts = async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      const existing = document.querySelector(`link[href*="fonts.googleapis.com"][rel="stylesheet"]`);
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = GOOGLE_FONTS_STYLESHEET_URL;
        document.head.appendChild(link);
        await new Promise((resolve, reject) => {
          link.onload = resolve;
          link.onerror = reject;
        });
      }
      if (cancelled) return;
      await document.fonts.ready;
      if (cancelled) return;
      await Promise.all(
        TEXT_TOOL_GOOGLE_FONTS.map((family) =>
          document.fonts.load(`16px "${family}"`)
        )
      ).catch(() => {});
      if (!cancelled) customFontsReadyRef.current = true;
    };
    ensureFonts();
    return () => { cancelled = true; };
  }, []);

  // Calculate and set fixed position for left column
  useEffect(() => {
    const updateLeftColumnPosition = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const leftPosition = containerRect.left + 100; // Add 100px for the grey spacer column
      if (leftColumnRef.current) {
        leftColumnRef.current.style.left = `${leftPosition}px`;
      }
      if (backBtnRef.current && !window.matchMedia('(max-width: 968px)').matches) {
        // Left gutter beside Product Preview, just under the header bar.
        backBtnRef.current.style.left = `${Math.round(containerRect.left)}px`;
        const nav = document.querySelector('nav');
        const belowHeader = Math.max(nav?.getBoundingClientRect().bottom || 0, 64);
        backBtnRef.current.style.top = `${Math.round(belowHeader + 4)}px`;
      }
    };

    updateLeftColumnPosition();
    const later = window.setTimeout(updateLeftColumnPosition, 250);
    const later2 = window.setTimeout(updateLeftColumnPosition, 700);
    window.addEventListener('resize', updateLeftColumnPosition);
    window.addEventListener('scroll', updateLeftColumnPosition);
    const logoImg = document.querySelector('.navbar-logo-wrap img.logo');
    logoImg?.addEventListener('load', updateLeftColumnPosition);

    return () => {
      window.clearTimeout(later);
      window.clearTimeout(later2);
      window.removeEventListener('resize', updateLeftColumnPosition);
      window.removeEventListener('scroll', updateLeftColumnPosition);
      logoImg?.removeEventListener('load', updateLeftColumnPosition);
    };
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Phone: module memory kept the previous cart/screenshot after adding a
  // new product. A manual refresh dropped that cache. Re-read storage on
  // every Tools visit and when iOS restores the page from bfcache.
  useEffect(() => {
    resyncMerchSessionFromStorage();
    entrySelectRef.current = true;
    slotStateRef.current = {};
    cartIdentityRef.current = '';
    cartCountRef.current = 0;
  }, [location.key]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      resyncMerchSessionFromStorage();
      entrySelectRef.current = true;
      slotStateRef.current = {};
      cartIdentityRef.current = '';
      cartCountRef.current = 0;
      setImageUrl('');
      setSelectedImage('');
      setEditedImageUrl('');
      setSessionEpoch((n) => n + 1);
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      resyncMerchSessionFromStorage();
      setSessionEpoch((n) => n + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Load tool page state from localStorage on mount (skip when opened from email/order link so we always start clean)
  useEffect(() => {
    const fromOrder = searchParams.get('order_id') || (typeof window !== 'undefined' && window.location.href && window.location.href.includes('order_id='));
    if (fromOrder) return;
    try {
      const savedState = localStorage.getItem('tools_page_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        // Do not restore screenshotScale or productImageOffsets — those belong
        // to the previous cart item and shove a newly added product off-center.
        // Do NOT restore selectedCartProductIndex — it often points at a leftover
        // item from a previous video. Selection is set from focus index / latest cart item.
        console.log('📦 Restored tool page state from localStorage');
      }
    } catch (e) {
      console.warn('Could not load tool page state:', e);
    }
  }, [searchParams]);

  // Save tool page state to localStorage whenever it changes (skip when opened from order link)
  useEffect(() => {
    const fromOrder = searchParams.get('order_id') || (typeof window !== 'undefined' && window.location.href && window.location.href.includes('order_id='));
    if (fromOrder) return;
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
  }, [screenshotScale, productImageOffsets, selectedCartProductIndex, searchParams]);

  // Persist current slot's Fit to Print (and related) state so it survives cart poll / loadScreenshot re-run
  useEffect(() => {
    if (selectedCartProductIndex === null || !cartProducts.length || !cartProducts[selectedCartProductIndex]) return;
    const idx = selectedCartProductIndex;
    const cartIndex = cartProducts[idx].originalCartIndex;
    const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
    slotStateRef.current[idx] = {
      ...(slotStateRef.current[idx] || {}),
      editedImageUrl,
      screenshotScale,
      selectedProductName,
      printAreaFit,
      imageOrientation,
      imageOffsetX,
      imageOffsetY,
      printQualityImageUrl,
      printQualityMeta,
      offsetX: offset.x,
      offsetY: offset.y,
      fitUserSet: Boolean(fitUserSetRef.current[idx]),
      sourceScreenshot: imageUrl || cartProducts[idx].screenshot || ''
    };
  }, [selectedCartProductIndex, cartProducts, editedImageUrl, imageUrl, screenshotScale, selectedProductName, printAreaFit, imageOrientation, imageOffsetX, imageOffsetY, printQualityImageUrl, printQualityMeta, productImageOffsets]);

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

    fetch(apiJoin(`/api/get-order-screenshot/${encodeURIComponent(trimmedOrderId)}`))
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
          setIsFromOrderEmail(false);
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
          setIsFromOrderEmail(true); // Opened from admin email (Edit Tools link) → show 300 DPI actions, not Apply Edits
          // If any product is missing product image, fetch by name so we show product mockup (measure screenshot over print area)
          const missing = mapped.filter((item) => item.name && !item.productImage);
          if (missing.length > 0) {
            Promise.all(
              missing.map((item) =>
                fetch(apiJoin(`/api/product-preview-url?name=${encodeURIComponent(item.name)}`))
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
            const firstProductName = matchPrintAreaProductName(mapped[0].name);
            if (firstProductName) {
              setSelectedProductName(firstProductName);
              setPrintAreaFit('product');
              setProductSelectClicked(true);
            }
          }
          console.log(`📦 Loaded ${mapped.length} screenshot(s) from order ${trimmedOrderId} (same as Print Quality / email)`);
        } else {
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          setOrderScreenshotsError('No screenshots found for this order.');
          setIsFromOrderEmail(false);
        }
        setOrderScreenshotsLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setOrderScreenshotsError(error.message || 'Error loading order screenshots');
          setCartProducts([]);
          setSelectedCartProductIndex(null);
          orderIdLoadedRef.current = null;
          setIsFromOrderEmail(false);
          setOrderScreenshotsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [searchParams]);

  // Load cart products on mount and when component becomes visible (skip when order_id in URL — those come from order API)
  useEffect(() => {
    if (searchParams.get('order_id')) return;

    const loadCartProducts = () => {
      try {
        if (entrySelectRef.current) {
          resyncMerchSessionFromStorage();
        }
        const cartItems = readCartItems();
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
          
          setCartProducts(productsWithScreenshots);
          
          // Newest cart item wins. Do not match pending_merch screenshot — that
          // is the previous video and findIndex returns the oldest duplicate.
          if (productsWithScreenshots.length > 0) {
            const lastIndex = productsWithScreenshots.length - 1;
            const focusOriginal = peekToolsFocusCartIndex();
            const identity = cartIdentity(productsWithScreenshots);
            const identityChanged = identity !== cartIdentityRef.current;
            cartIdentityRef.current = identity;
            const cartGrew = productsWithScreenshots.length > cartCountRef.current;
            cartCountRef.current = productsWithScreenshots.length;
            const forceEntry = entrySelectRef.current;
            if (forceEntry) entrySelectRef.current = false;
            let nextIndex = lastIndex;
            if (focusOriginal != null) {
              consumeToolsFocusCartIndex();
              const matched = productsWithScreenshots.findIndex(
                (p) => p.originalCartIndex === focusOriginal
              );
              nextIndex = matched >= 0 ? matched : lastIndex;
            } else if (forceEntry || cartGrew) {
              nextIndex = lastIndex;
            } else if (
              selectedCartProductIndex !== null &&
              selectedCartProductIndex < productsWithScreenshots.length
            ) {
              nextIndex = selectedCartProductIndex;
            }
            const chosen = productsWithScreenshots[nextIndex];
            if (identityChanged && chosen) {
              const slot = slotStateRef.current[nextIndex];
              if (slot && slot.sourceScreenshot && slot.sourceScreenshot !== chosen.screenshot) {
                delete slotStateRef.current[nextIndex];
                setEditedImageUrl('');
              }
            }
            if (nextIndex !== selectedCartProductIndex || forceEntry) {
              setSelectedCartProductIndex(nextIndex);
              const matchedName = matchPrintAreaProductName(chosen?.name) || '';
              if (matchedName) {
                setSelectedProductName(matchedName);
                setPrintAreaFit('product');
              }
              const settings = chosen?.toolSettings;
              if (settings?.screenshotScale !== undefined) {
                setScreenshotScale(settings.screenshotScale);
              } else {
                setScreenshotScale(100);
              }
              if (chosen && settings && settings.offsetX !== undefined && settings.offsetY !== undefined) {
                setProductImageOffsets(prev => ({
                  ...prev,
                  [chosen.originalCartIndex]: { x: settings.offsetX, y: settings.offsetY }
                }));
              } else if (chosen) {
                setProductImageOffsets(prev => ({
                  ...prev,
                  [chosen.originalCartIndex]: { x: 0, y: 0 }
                }));
              }
            }
            if (productsWithScreenshots.length > 1) {
              console.log(`🛍️ Found ${productsWithScreenshots.length} products in cart`);
            }
          }
        } else {
          const sessionProduct = sessionToolsProductFromPending();
          if (sessionProduct) {
            if (sessionPreviewUrlRef.current) {
              sessionProduct.productImage = sessionPreviewUrlRef.current;
            }
            cartCountRef.current = 1;
            cartIdentityRef.current = cartIdentity([sessionProduct]);
            setCartProducts((prev) => {
              const existing = prev[0];
              if (
                existing?.sessionOnly &&
                existing.screenshot === sessionProduct.screenshot &&
                existing.name === sessionProduct.name &&
                existing.productImage === sessionProduct.productImage
              ) {
                return prev;
              }
              if (existing?.sessionOnly && existing.screenshot === sessionProduct.screenshot && existing.productImage) {
                return [{ ...sessionProduct, productImage: existing.productImage }];
              }
              return [sessionProduct];
            });
            setSelectedCartProductIndex((prev) => (prev === 0 ? prev : 0));
            const matchedName = matchPrintAreaProductName(sessionProduct.name) || sessionProduct.name;
            if (matchedName) {
              setSelectedProductName((prev) => prev || matchedName);
              setPrintAreaFit((prev) => (prev && prev !== 'none' ? prev : 'product'));
            }
            if (!sessionProduct.productImage && sessionProduct.name) {
              fetch(apiJoin(`/api/product-preview-url?name=${encodeURIComponent(sessionProduct.name)}`))
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                  if (!data?.url) return;
                  sessionPreviewUrlRef.current = data.url;
                  setCartProducts((prev) => {
                    if (!prev[0]?.sessionOnly) return prev;
                    if (prev[0].productImage === data.url) return prev;
                    return [{ ...prev[0], productImage: data.url }];
                  });
                })
                .catch(() => {});
            }
          } else {
            cartCountRef.current = 0;
            cartIdentityRef.current = '';
            setCartProducts([]);
            setSelectedCartProductIndex(null);
          }
        }
      } catch (e) {
        console.warn('Could not load cart items:', e);
        cartCountRef.current = 0;
        cartIdentityRef.current = '';
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
    window.addEventListener(CART_UPDATED_EVENT, loadCartProducts);
    
    // Also check periodically in case localStorage is updated in same tab
    const checkInterval = setInterval(loadCartProducts, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(CART_UPDATED_EVENT, loadCartProducts);
      clearInterval(checkInterval);
    };
  }, [selectedCartProductIndex, searchParams, sessionEpoch, location.key]); // Re-run on Tools visit, bfcache, or cart selection

  // Load screenshot and product name from localStorage or URL params
  useEffect(() => {
    const loadScreenshot = () => {
      try {
        // Priority 1: Use selected cart product screenshot if available
        if (selectedCartProductIndex !== null && cartProducts.length > 0 && cartProducts[selectedCartProductIndex]) {
          const selectedProduct = cartProducts[selectedCartProductIndex];
          if (selectedProduct.screenshot && selectedProduct.screenshot.trim() !== '') {
            const screenshotFromCart = selectedProduct.screenshot;
            const pending = readPendingMerchData() || {};
            const preferred = pending.selected_screenshot || '';
            const pendingEdited = pending.edited_screenshot || '';
            let screenshot = screenshotFromCart;
            // Never replace a cart item that already has art with leftover
            // pending_merch from a previous product.
            if (!screenshotFromCart && preferred && !pendingEdited) {
              screenshot = preferred;
              try {
                const cartItems = readCartItems();
                const origIdx = selectedProduct.originalCartIndex;
                if (Array.isArray(cartItems) && cartItems[origIdx]) {
                  cartItems[origIdx] = {
                    ...cartItems[origIdx],
                    screenshot: preferred,
                    selected_screenshot: preferred
                  };
                  writeCartItems(cartItems);
                }
              } catch (_) { /* ignore */ }
              if (slotStateRef.current[selectedCartProductIndex]) {
                slotStateRef.current[selectedCartProductIndex] = {
                  ...slotStateRef.current[selectedCartProductIndex],
                  editedImageUrl: ''
                };
              }
            }
            // Avoid clobbering an in-progress edit when cart poll reloads the same image
            const saved = slotStateRef.current[selectedCartProductIndex];
            const matchedName = matchPrintAreaProductName(selectedProduct.name);
            const resolvedName = (saved && saved.selectedProductName) || matchedName || '';
            const savedFit = saved && saved.printAreaFit;
            const userChoseNoFit = Boolean(saved && saved.fitUserSet && savedFit === 'none');
            const resolvedFit = userChoseNoFit
              ? 'none'
              : (savedFit && savedFit !== 'none'
                ? savedFit
                : (resolvedName ? 'product' : 'none'));
            if (screenshot === imageUrl && !switchingSlotRef.current) {
              // Same image, but first load used to skip Product Specific forever.
              if (!userChoseNoFit && resolvedName) {
                setSelectedProductName((prev) => prev || resolvedName);
                setPrintAreaFit((prev) => (prev && prev !== 'none' ? prev : 'product'));
              }
              return;
            }
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
              fitUserSetRef.current[selectedCartProductIndex] = false;
              setEditedImageUrl('');
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            setIsUpgrading(false);
            const savedMatchesSource = Boolean(
              saved &&
              screenshot === screenshotFromCart &&
              (!saved.sourceScreenshot || saved.sourceScreenshot === screenshot)
            );
            if (savedMatchesSource) {
              fitUserSetRef.current[selectedCartProductIndex] = Boolean(saved.fitUserSet);
              setEditedImageUrl(saved.editedImageUrl || '');
              setScreenshotScale(saved.screenshotScale ?? 100);
              setSelectedProductName(resolvedName);
              setPrintAreaFit(resolvedFit);
              setImageOrientation(saved.imageOrientation || 'portrait');
              setImageOffsetX(saved.imageOffsetX ?? 0);
              setImageOffsetY(saved.imageOffsetY ?? 0);
              setPrintQualityImageUrl(saved.printQualityImageUrl || '');
              setPrintQualityMeta(saved.printQualityMeta || null);
              const cartIndex = selectedProduct.originalCartIndex;
              setProductImageOffsets(prev => ({ ...prev, [cartIndex]: { x: saved.offsetX ?? 0, y: saved.offsetY ?? 0 } }));
            } else {
              fitUserSetRef.current[selectedCartProductIndex] = false;
              setEditedImageUrl('');
              setScreenshotScale(100);
              setSelectedProductName(resolvedName);
              setPrintAreaFit(resolvedFit);
              setImageOrientation('portrait');
              setImageOffsetX(0);
              setImageOffsetY(0);
              setPrintQualityImageUrl('');
              setPrintQualityMeta(null);
              const cartIndex = selectedProduct.originalCartIndex;
              setProductImageOffsets(prev => ({ ...prev, [cartIndex]: { x: 0, y: 0 } }));
            }
            if (resolvedName) setProductSelectClicked(true);
            setTimeout(function clearSwitchFlag() {
              switchingSlotRef.current = false;
              setSlotSwitchTick(t => t + 1);
            }, 0);
            console.log(`📸 Loaded screenshot from cart product ${selectedCartProductIndex + 1}: ${selectedProduct.name}`);
            return; // Exit early, don't check other sources
          }
        }
        
        // Priority 2: Only an explicitly chosen working shot. Do not fall back to
        // screenshots[0]/thumbnail — that keeps the previous image after cart-empty
        // or when the user goes back to pick another video/image.
        const data = readPendingMerchData();
        const cartEmpty = !cartProducts.length;
        const screenshot = cartEmpty
          ? (data?.selected_screenshot || '')
          : (data?.edited_screenshot || data?.selected_screenshot || '');
        if (!screenshot) {
          slotStateRef.current = {};
          if (imageUrl || editedImageUrl) {
            setImageUrl('');
            setSelectedImage('');
            setEditedImageUrl('');
            setPrintQualityImageUrl('');
            setPrintQualityMeta(null);
          }
        } else if (data && (data.screenshots?.length || data.selected_screenshot || data.thumbnail || data.edited_screenshot)) {
          // Priority: edited screenshot > selected screenshot (never gallery leftovers)
          if (screenshot) {
            // Reset upgrade trigger if image changed
            if (screenshot !== imageUrl) {
              upgradeTriggeredRef.current = false;
              setEditedImageUrl('');
            }
            setImageUrl(screenshot);
            setSelectedImage(screenshot);
            if (cartEmpty) {
              setEditedImageUrl('');
              slotStateRef.current = {};
            }
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
            setPrintAreaFit((prev) => (prev && prev !== 'none' ? prev : 'product'));
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

  const autoFitCartIndexRef = useRef({});

  // If Select Product is still empty (single-item cart hides the cart picker),
  // match the previewed cart item automatically.
  useEffect(() => {
    if (selectedCartProductIndex === null) return;
    const product = cartProducts[selectedCartProductIndex];
    if (!product?.name) return;
    const matched = matchPrintAreaProductName(product.name);
    if (!matched) return;
    setSelectedProductName((prev) => {
      if (fitUserSetRef.current[selectedCartProductIndex] && prev) return prev;
      return matched || prev;
    });
    if (!autoFitCartIndexRef.current[selectedCartProductIndex]) {
      autoFitCartIndexRef.current[selectedCartProductIndex] = true;
      setPrintAreaFit((prev) => {
        if (fitUserSetRef.current[selectedCartProductIndex]) return prev;
        if (prev && prev !== 'none') return prev;
        if (imageOrientation === 'landscape') return prev;
        return 'product';
      });
    }
    setProductSelectClicked(true);
  }, [selectedCartProductIndex, cartProducts, imageOrientation]);

  // When Fit to Print names a product that is not the current cart item,
  // load that product's mockup so the screenshot can be tested on it.
  useEffect(() => {
    const name = selectedProductName;
    const cartProduct = selectedCartProductIndex != null ? cartProducts[selectedCartProductIndex] : null;
    const cartMatched = cartProduct
      ? (matchPrintAreaProductName(cartProduct.name) || cartProduct.name)
      : '';
    if (!name || name === cartMatched) {
      setFitPreviewImageUrl('');
      return;
    }
    let cancelled = false;
    fetch(apiJoin(`/api/product-preview-url?name=${encodeURIComponent(name)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.url) setFitPreviewImageUrl(data.url);
        else if (!cancelled) setFitPreviewImageUrl('');
      })
      .catch(() => {
        if (!cancelled) setFitPreviewImageUrl('');
      });
    return () => { cancelled = true; };
  }, [selectedProductName, selectedCartProductIndex, cartProducts]);

  // Listen for storage events and set up upgrade checking
  useEffect(() => {
    // Listen for storage events (when print quality upgrade completes from other tabs)
    const applyWorkingScreenshot = (data) => {
      // Cart items own their screenshots. Do not paste leftover pending_merch
      // art over every product when the user is testing other cart items.
      const items = readCartItems();
      if (Array.isArray(items) && items.length > 0) {
        return;
      }
      const screenshot = data?.selected_screenshot || '';
      if (!screenshot) {
        if (imageUrl || editedImageUrl) {
          setImageUrl('');
          setSelectedImage('');
          setEditedImageUrl('');
        }
      } else if (screenshot !== imageUrl) {
        setImageUrl(screenshot);
        setSelectedImage(screenshot);
        setEditedImageUrl('');
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'pending_merch_data' || e.key === 'cart_items') {
        try {
          applyWorkingScreenshot(readPendingMerchData());
        } catch (err) {
          console.warn('Could not parse storage data:', err);
        }
      }
    };
    
    // Listen for custom event (when print quality upgrade completes in same tab)
    const handleLocalStorageUpdate = () => {
      try {
        applyWorkingScreenshot(readPendingMerchData());
      } catch (err) {
        console.warn('Could not parse storage data:', err);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleLocalStorageUpdate);
    window.addEventListener(PENDING_MERCH_UPDATED_EVENT, handleLocalStorageUpdate);
    window.addEventListener(CART_UPDATED_EVENT, handleLocalStorageUpdate);
    
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
      window.removeEventListener(PENDING_MERCH_UPDATED_EVENT, handleLocalStorageUpdate);
      window.removeEventListener(CART_UPDATED_EVENT, handleLocalStorageUpdate);
      clearInterval(checkInterval);
    };
  }, [searchParams, imageUrl]);

  // Same quadratic path used to clip the image and to paint the frame.
  const addRoundedRectPath = (ctx, x, y, width, height, radius) => {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    addRoundedRectPath(ctx, x, y, width, height, radius);
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

  const selectedCartProduct = (selectedCartProductIndex !== null && cartProducts[selectedCartProductIndex])
    ? cartProducts[selectedCartProductIndex]
    : null;
  const fitProductSize = selectedCartProduct?.size || null;

  // Apply edits to image
  useEffect(() => {
    if (!imageUrl) return;
    if (switchingSlotRef.current) return;
    // Don't rasterize Original/uncropped while Product Specific is still pending.
    const idx = selectedCartProductIndex;
    const awaitingAutoProductFit =
      idx !== null &&
      cartProducts[idx] &&
      printAreaFit === 'none' &&
      imageOrientation !== 'landscape' &&
      !fitUserSetRef.current[idx] &&
      matchPrintAreaProductName(cartProducts[idx].name);
    if (awaitingAutoProductFit) return;
    if (printAreaFit === 'product' && !selectedProductName) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      if (cancelled) return;
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
          const dimensions = getPrintAreaDimensions(selectedProductName, fitProductSize, 'front');
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

      // Paint the frame as a filled ring on the same path as the image clip.
      // A stroke using the raw % slider looked square; this follows Angle Radius.
      if (frameEnabled) {
        ctx.fillStyle = frameColor;
        if (isCircle) {
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, maxCornerRadius, 0, Math.PI * 2);
          ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            Math.max(0, maxCornerRadius - frameWidth),
            0,
            Math.PI * 2,
            true
          );
          ctx.fill('evenodd');
        } else if (effectiveCornerRadius > 0) {
          ctx.beginPath();
          addRoundedRectPath(ctx, 0, 0, canvas.width, canvas.height, effectiveCornerRadius);
          addRoundedRectPath(
            ctx,
            frameWidth,
            frameWidth,
            canvas.width - frameWidth * 2,
            canvas.height - frameWidth * 2,
            Math.max(0, effectiveCornerRadius - frameWidth)
          );
          ctx.fill('evenodd');
        } else {
          ctx.fillRect(0, 0, canvas.width, frameWidth);
          ctx.fillRect(0, 0, frameWidth, canvas.height);
          ctx.fillRect(canvas.width - frameWidth, 0, frameWidth, canvas.height);
          ctx.fillRect(0, canvas.height - frameWidth, canvas.width, frameWidth);
        }

        if (doubleFrame) {
          const innerFrameOffset = frameWidth * 1.5;
          const innerFrameWidth = frameWidth * 0.7;
          const innerOuter = frameWidth + innerFrameOffset;
          const innerInner = innerOuter + innerFrameWidth;

          if (isCircle) {
            ctx.beginPath();
            ctx.arc(
              canvas.width / 2,
              canvas.height / 2,
              Math.max(0, maxCornerRadius - innerOuter),
              0,
              Math.PI * 2
            );
            ctx.arc(
              canvas.width / 2,
              canvas.height / 2,
              Math.max(0, maxCornerRadius - innerInner),
              0,
              Math.PI * 2,
              true
            );
            ctx.fill('evenodd');
          } else if (effectiveCornerRadius > 0) {
            ctx.beginPath();
            addRoundedRectPath(
              ctx,
              innerOuter,
              innerOuter,
              canvas.width - innerOuter * 2,
              canvas.height - innerOuter * 2,
              Math.max(0, effectiveCornerRadius - innerOuter)
            );
            addRoundedRectPath(
              ctx,
              innerInner,
              innerInner,
              canvas.width - innerInner * 2,
              canvas.height - innerInner * 2,
              Math.max(0, effectiveCornerRadius - innerInner)
            );
            ctx.fill('evenodd');
          } else {
            ctx.beginPath();
            ctx.rect(innerOuter, innerOuter, canvas.width - innerOuter * 2, canvas.height - innerOuter * 2);
            ctx.rect(innerInner, innerInner, canvas.width - innerInner * 2, canvas.height - innerInner * 2);
            ctx.fill('evenodd');
          }
        }
      }

      // Apply text overlay if enabled (position: textOffsetX/Y are 0-100, 50 = center)
      if (textEnabled && textContent && textContent.trim()) {
        // Ensure font is loaded before drawing (required for Google/fringe fonts to show)
        if (typeof document !== 'undefined' && document.fonts) {
          try {
            await document.fonts.ready;
            const loadPromise = document.fonts.load(`16px "${textFont}"`);
            await Promise.race([loadPromise, new Promise((r) => setTimeout(r, 3000))]);
          } catch (_) {
            // Fallback font will be used
          }
        }
        if (cancelled) return;
        ctx.save();
        // Headline-style: textSize 100 = ~22% of image min dimension so it stands out (not sentence-sized)
        const minDim = Math.min(canvas.width, canvas.height);
        const fontSize = Math.max(12, Math.min(300, Math.round((textSize / 100) * minDim * 0.22)));
        ctx.font = `${fontSize}px "${textFont}", Arial, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = (canvas.width * textOffsetX) / 100;
        const centerY = (canvas.height * textOffsetY) / 100;
        const lines = textContent.trim().split('\n');
        const lineHeight = fontSize * 1.2;
        const startY = centerY - (lines.length - 1) * lineHeight / 2;
        lines.forEach((line, i) => {
          ctx.fillText(line, centerX, startY + i * lineHeight);
        });
        ctx.restore();
      }

      // Convert to data URL
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (_) {
        try {
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        } catch (err) {
          console.error('Failed to export edited image', err);
          return;
        }
      }
      if (cancelled) return;
      setEditedImageUrl(dataUrl);
    };
    img.onerror = () => {
      if (cancelled) return;
      console.error('Failed to load image');
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, featherEdge, cornerRadius, frameEnabled, frameColor, frameWidth, doubleFrame, textEnabled, textContent, textFont, textColor, textSize, textOffsetX, textOffsetY, printAreaFit, imageOffsetX, imageOffsetY, selectedProductName, fitProductSize, slotSwitchTick, selectedCartProductIndex, cartProducts, imageOrientation]);

  const rotateScreenshotClockwise = () => {
    const src = (imageUrl || '').trim();
    if (!src) {
      alert('No image to rotate. Load a screenshot first.');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('Could not rotate this image.');
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (_) {
        alert('Could not rotate this image. Try again after it fully loads.');
        return;
      }

      // Persist so loadScreenshot / cart poll cannot restore the unrotated original
      if (selectedCartProductIndex !== null) {
        slotStateRef.current[selectedCartProductIndex] = {
          ...(slotStateRef.current[selectedCartProductIndex] || {}),
          editedImageUrl: '',
        };
      }

      setImageUrl(dataUrl);
      setSelectedImage(dataUrl);
      setEditedImageUrl('');
      upgradeTriggeredRef.current = false;

      setCartProducts((prev) => {
        if (selectedCartProductIndex === null || !prev[selectedCartProductIndex]) return prev;
        return prev.map((p, i) =>
          i === selectedCartProductIndex ? { ...p, screenshot: dataUrl } : p
        );
      });

      try {
        const cartItems = readCartItems();
        const selected =
          selectedCartProductIndex !== null ? cartProducts[selectedCartProductIndex] : null;
        const cartIndex =
          selected && typeof selected.originalCartIndex === 'number'
            ? selected.originalCartIndex
            : -1;
        if (cartIndex >= 0 && cartItems[cartIndex]) {
          cartItems[cartIndex] = {
            ...cartItems[cartIndex],
            screenshot: dataUrl,
          };
          writeCartItems(cartItems);
        }
      } catch (e) {
        console.warn('Could not persist rotated screenshot to cart:', e);
      }

      try {
        const data = { ...readPendingMerchData() };
        data.edited_screenshot = dataUrl;
        data.selected_screenshot = dataUrl;
        if (Array.isArray(data.screenshots) && data.screenshots.length) {
          data.screenshots = [dataUrl, ...data.screenshots.slice(1)];
        }
        savePendingMerchData(data);
      } catch (e) {
        console.warn('Could not persist rotated screenshot to pending merch session:', e);
      }
    };
    img.onerror = () => alert('Could not load image to rotate.');
    img.src = src;
  };

  const handleDownload = () => {
    const imageToDownload = editedImageUrl || imageUrl;
    if (!imageToDownload || !imageToDownload.trim()) {
      alert('No image to download. Please load a screenshot first.');
      return;
    }
    const orderId = searchParams.get('order_id') || '';
    const baseName = orderId ? 'screenmerch-' + orderId : 'screenmerch-print-ready';
    const filename = baseName + '.png';

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

  const handleGenerate300Dpi = async () => {
    const imageToUse = editedImageUrl || imageUrl;
    if (!imageToUse || !imageToUse.trim()) {
      alert('No image to use. Please load a screenshot first.');
      return;
    }
    setGenerating300Dpi(true);
    setPrintQualityImageUrl('');
    setPrintQualityMeta(null);
    try {
      const payload = {
        thumbnail_data: imageToUse,
        print_dpi: 300,
        soft_corners: false,
        edge_feather: false
      };
      if (selectedProductName && printAreaFit === 'product') {
        try {
          const dims = getPrintAreaDimensions(selectedProductName, fitProductSize, 'front');
          if (dims && dims.width && dims.height) {
            const scale = screenshotScale / 100;
            payload.print_area_width = dims.width * scale;
            payload.print_area_height = dims.height * scale;
          }
        } catch (_) {}
      }
      const apiUrl = import.meta.env.DEV
        ? 'http://127.0.0.1:5000/api/process-thumbnail-print-quality'
        : apiJoin('/api/process-thumbnail-print-quality');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.screenshot) {
          setPrintQualityImageUrl(result.screenshot);
          setPrintQualityMeta({
            dimensions: result.dimensions || { width: 0, height: 0, dpi: 300 },
            file_size: result.file_size,
            format: result.format || 'PNG',
            quality: result.quality || 'Print Ready'
          });
        } else {
          alert('Generated but no image returned.');
        }
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Failed to generate 300 DPI image.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error. Try again.');
    } finally {
      setGenerating300Dpi(false);
    }
  };

  const handleDownloadPrintQuality = () => {
    if (!printQualityImageUrl || !printQualityImageUrl.trim()) {
      alert('Generate a 300 DPI image first.');
      return;
    }
    const orderId = searchParams.get('order_id') || '';
    const baseName = orderId ? 'screenmerch-300dpi-' + orderId : 'screenmerch-300dpi';
    const filename = baseName + '.png';
    if (printQualityImageUrl.startsWith('data:image')) {
      try {
        const comma = printQualityImageUrl.indexOf(',');
        const base64 = comma >= 0 ? printQualityImageUrl.slice(comma + 1) : '';
        const mime = printQualityImageUrl.match(/data:([^;]+);/);
        const type = (mime && mime[1]) || 'image/png';
        if (base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const url = URL.createObjectURL(new Blob([bytes], { type }));
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        alert('Download failed.');
      }
    } else {
      alert('Download failed. No valid image.');
    }
  };

  const handleApplyEdits = () => {
    // When opened from order email (order_id in URL): always download, never go to checkout (avoids empty cart)
    const hasOrderId = searchParams.get('order_id') ||
      (typeof window !== 'undefined' && (
        (window.location.search && new URLSearchParams(window.location.search).get('order_id')) ||
        (window.location.href && window.location.href.includes('order_id='))
      )) ||
      isFromOrderEmail;
    if (hasOrderId) {
      handleDownload();
      return;
    }

    if (!editedImageUrl) {
      alert('Please wait for the image to process, or select a screenshot first.');
      return;
    }
    
    // Save edited image to merch session
    try {
      const data = { ...readPendingMerchData() };
      data.edited_screenshot = editedImageUrl;
      data.tools_used = {
        featherEdge,
        cornerRadius,
        frameEnabled,
        frameColor,
        frameWidth,
        doubleFrame,
        textEnabled,
        textContent,
        textFont,
        textColor,
        textSize,
        textOffsetX,
        textOffsetY,
        printAreaFit,
        imageOffsetX,
        imageOffsetY
      };
      savePendingMerchData(data);
      
      // Also update cart items if they exist
      const cartItems = readCartItems();
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
                textEnabled,
                textContent,
                textFont,
                textColor,
                textSize,
                textOffsetX,
                textOffsetY,
                printAreaFit,
                imageOrientation
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
      
      writeCartItems(updatedCart);
    } catch (e) {
      console.error('Failed to save edited image:', e);
    }
    
    // Navigate directly to cart
    navigate('/checkout');
  };

  const switchToCartSlot = (newIndex) => {
    if (newIndex == null || !cartProducts[newIndex] || newIndex === selectedCartProductIndex) return;
    switchingSlotRef.current = true;
    const oldIndex = selectedCartProductIndex;
    if (oldIndex !== null && cartProducts[oldIndex]) {
      const cartIndex = cartProducts[oldIndex].originalCartIndex;
      const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
      slotStateRef.current[oldIndex] = {
        editedImageUrl,
        screenshotScale,
        selectedProductName,
        printAreaFit,
        imageOrientation,
        imageOffsetX,
        imageOffsetY,
        printQualityImageUrl,
        printQualityMeta,
        offsetX: offset.x,
        offsetY: offset.y,
        fitUserSet: Boolean(fitUserSetRef.current[oldIndex]),
        sourceScreenshot: imageUrl || cartProducts[oldIndex].screenshot || ''
      };
    }
    setSelectedCartProductIndex(newIndex);
    const matchedName = matchPrintAreaProductName(cartProducts[newIndex].name) || '';
    if (matchedName) {
      setSelectedProductName(matchedName);
      setPrintAreaFit('product');
      setProductSelectClicked(true);
    }
    setScreenshotSizeInteracted(false);
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

  const goBackFromTools = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/merchandise');
  };

  return (
    <div className="tools-page-container" ref={containerRef}>
      <button
        type="button"
        ref={backBtnRef}
        className="tools-back-btn tools-back-btn-page"
        onClick={goBackFromTools}
        aria-label="Back"
      >
        ←
      </button>
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
              {(() => {
                const product = cartProducts[selectedCartProductIndex];
                const cartIndex = product.originalCartIndex;
                const offset = productImageOffsets[cartIndex] || { x: 0, y: 0 };
                const currentImage = editedImageUrl || imageUrl;
                const showingFitOverride = Boolean(fitPreviewImageUrl);
                const displayName = showingFitOverride ? selectedProductName : product.name;
                
                return (
                  <div className="product-preview-inner-card" style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '2px solid #dee2e6',
                    position: 'relative'
                  }}>
                    <h3 className="product-preview-heading">
                      <span className="edit-tools-inline-title">Edit Tools</span>
                      <span className="product-preview-heading-label">
                        Product Preview ({selectedCartProductIndex + 1} of {cartProducts.length})
                      </span>
                    </h3>
                    <div className="product-preview-name-row" style={{
                      position: 'relative',
                      marginBottom: '10px',
                      minHeight: '30px',
                      padding: '0 36px'
                    }}>
                      <span className="product-preview-index-badge" style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: '#007bff',
                        color: 'white',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {selectedCartProductIndex + 1}
                      </span>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-word' }}>{displayName}</div>
                        {!showingFitOverride && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {product.color} • {product.size}
                        </div>
                        )}
                      </div>
                    </div>
                    {/* Product Preview - Handle different product types */}
                    <div className="product-preview-image-row">
                      <button
                        type="button"
                        className="tools-back-btn tools-back-btn-preview"
                        onClick={goBackFromTools}
                        aria-label="Back"
                      >
                        ←
                      </button>
                      <div className="product-preview-visual">
                    {(() => {
                      const productName = selectedProductName || product.name || '';
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
                                key={`${cartIndex}|${shotFingerprint(placeholderImage)}|${shotFingerprint(currentImage)}`}
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
                                textEnabled={textEnabled}
                                textOffsetX={textOffsetX}
                                textOffsetY={textOffsetY}
                                onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                                featherEdge={editedImageUrl ? 0 : featherEdge}
                                cornerRadius={editedImageUrl ? 0 : cornerRadius}
                                printAreaFit={printAreaFit}
                                selectedProductName={selectedProductName}
                                screenshotScale={screenshotScale}
                                imageOffsetX={imageOffsetX}
                                imageOffsetY={imageOffsetY}
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
                              key={`${cartIndex}|${shotFingerprint(hatImage)}|${shotFingerprint(currentImage)}`}
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
                              textEnabled={textEnabled}
                              textOffsetX={textOffsetX}
                              textOffsetY={textOffsetY}
                              onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                              featherEdge={editedImageUrl ? 0 : featherEdge}
                              cornerRadius={editedImageUrl ? 0 : cornerRadius}
                              printAreaFit={printAreaFit}
                              selectedProductName={selectedProductName}
                              screenshotScale={screenshotScale}
                              imageOffsetX={imageOffsetX}
                              imageOffsetY={imageOffsetY}
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
                        const productImg = fitPreviewImageUrl || product.productImage || getPlaceholderProductImage();
                        return (
                          <ProductPreviewWithDrag
                            key={`${cartIndex}|${shotFingerprint(productImg)}|${shotFingerprint(currentImage)}`}
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
                            textEnabled={textEnabled}
                            textOffsetX={textOffsetX}
                            textOffsetY={textOffsetY}
                            onTextPositionChange={textEnabled ? (px, py) => { setTextOffsetX(px); setTextOffsetY(py); } : undefined}
                            featherEdge={editedImageUrl ? 0 : featherEdge}
                            cornerRadius={editedImageUrl ? 0 : cornerRadius}
                            printAreaFit={printAreaFit}
                            selectedProductName={selectedProductName}
                            screenshotScale={screenshotScale}
                            imageOffsetX={imageOffsetX}
                            imageOffsetY={imageOffsetY}
                          />
                        );
                      }
                      
                      return null;
                    })()}
                      </div>
                    </div>
                    {/* Screenshot Size — in the product card so it stays fully visible */}
                    <div className="tool-control-group screenshot-size-under-preview" style={{ marginTop: '12px', marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                        <h3 style={{ textAlign: 'center', margin: 0, fontSize: '15px' }}>Screenshot Size</h3>
                        <button
                          type="button"
                          className="screenshot-rotate-btn"
                          onClick={rotateScreenshotClockwise}
                          title="Rotate 90° clockwise"
                          aria-label="Rotate image 90 degrees clockwise"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 4a8 8 0 1 1-7.07 4.07"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M5 3v5h5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
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
                );
              })()}
              </div>
            )}

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
                  const newIndex = parseInt(e.target.value);
                  switchToCartSlot(newIndex);
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
            
            {/* Portrait / Landscape - landscape = No Fit for uncropped image */}
            <div className="select-control" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Image orientation:</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="imageOrientation"
                    value="portrait"
                    checked={imageOrientation === 'portrait'}
                    onChange={() => {
                      setImageOrientation('portrait');
                    }}
                  />
                  <span>Portrait</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="imageOrientation"
                    value="landscape"
                    checked={imageOrientation === 'landscape'}
                    onChange={() => {
                      setImageOrientation('landscape');
                      setPrintAreaFit('none'); // No Fit = uncropped landscape image
                      if (selectedCartProductIndex !== null) {
                        fitUserSetRef.current[selectedCartProductIndex] = true;
                      }
                    }}
                  />
                  <span>Landscape (No Fit – show more image, less crop)</span>
                </label>
              </div>
            </div>
            
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
                  const value = e.target.value;
                  setSelectedProductName(value);
                  setProductSelectClicked(true);
                  setScreenshotSizeInteracted(false);
                  if (value) {
                    setPrintAreaFit('product');
                  }
                  if (selectedCartProductIndex !== null) {
                    fitUserSetRef.current[selectedCartProductIndex] = true;
                  }
                  const matchIdx = cartProducts.findIndex((p) => {
                    const n = matchPrintAreaProductName(p.name) || p.name;
                    return n === value || p.name === value;
                  });
                  if (matchIdx >= 0) {
                    switchToCartSlot(matchIdx);
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
                  const value = e.target.value;
                  setPrintAreaFit(value);
                  if (selectedCartProductIndex !== null) {
                    fitUserSetRef.current[selectedCartProductIndex] = true;
                  }
                  if (value !== 'none') setImageOrientation('portrait'); // Fit type = portrait mode
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
            
            {(printAreaFit !== 'none' || imageOrientation === 'landscape') && (
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
                  <h3>Text</h3>
                  <p className="tool-description">Add text to your creation with custom font, color and size</p>
                  <div className="checkbox-control">
                    <label>
                      <input
                        type="checkbox"
                        checked={textEnabled}
                        onChange={(e) => setTextEnabled(e.target.checked)}
                      />
                      Add Text
                    </label>
                  </div>
                  {textEnabled && (
                    <>
                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <label>Text:</label>
                        <textarea
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          placeholder="Enter text to overlay"
                          rows={2}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                        />
                      </div>
                      <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <label style={{ minWidth: '80px' }}>Font:</label>
                        <select
                          value={textFont}
                          onChange={(e) => setTextFont(e.target.value)}
                          style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', maxWidth: '100%' }}
                        >
                          <optgroup label="Classic">
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Courier New">Courier New</option>
                          </optgroup>
                          <optgroup label="Fringe &amp; style">
                            <option value="Permanent Marker">Permanent Marker (Graffiti)</option>
                            <option value="Orbitron">Orbitron (Metal)</option>
                            <option value="Bebas Neue">Bebas Neue</option>
                            <option value="Creepster">Creepster (Scary / Halloween)</option>
                            <option value="Dela Gothic One">Dela Gothic One</option>
                            <option value="Long Cang">Long Cang (Chinese brush)</option>
                            <option value="Pacifico">Pacifico (Hawaiian / surf)</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="color-control" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <label style={{ minWidth: '80px' }}>Color:</label>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="color-picker"
                        />
                        <span className="color-value" style={{ wordBreak: 'break-all' }}>{textColor}</span>
                      </div>
                      <div className="slider-control" style={{ marginTop: '0.5rem' }}>
                        <label>Size (headline scale):</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <input
                            type="range"
                            min="12"
                            max="150"
                            value={Math.min(150, Math.max(12, textSize))}
                            onChange={(e) => setTextSize(parseInt(e.target.value, 10) || 24)}
                            className="slider"
                            style={{ flex: '1 1 120px', minWidth: '100px' }}
                          />
                          <input
                            type="number"
                            min={12}
                            max={200}
                            value={textSize}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!Number.isNaN(v)) setTextSize(Math.max(12, Math.min(200, v)));
                            }}
                            style={{ width: '64px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            title="Type 12–200 for headline size"
                          />
                          <span className="slider-value">{textSize}</span>
                        </div>
                        <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Slider or type 12–200: 100+ = headline size</small>
                      </div>
                      <div className="slider-control" style={{ marginTop: '0.5rem' }}>
                        <label>Horizontal position:</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={textOffsetX}
                          onChange={(e) => setTextOffsetX(parseInt(e.target.value, 10))}
                          className="slider"
                        />
                        <span className="slider-value">{textOffsetX}%</span>
                      </div>
                      <div className="slider-control" style={{ marginTop: '0.5rem' }}>
                        <label>Vertical position:</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={textOffsetY}
                          onChange={(e) => setTextOffsetY(parseInt(e.target.value, 10))}
                          className="slider"
                        />
                        <span className="slider-value">{textOffsetY}%</span>
                      </div>
                      <small style={{ color: '#666', display: 'block', marginTop: '6px' }}>Or drag the product mockup to move the image and text together.</small>
                    </>
                  )}
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
                            key={editedImageUrl}
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
                            key={imageUrl}
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
                    {/* Print Quality Image - only on email Edit Tools page; 300 DPI result parked here for download */}
                    {(searchParams.get('order_id') || (typeof window !== 'undefined' && (window.location.search && new URLSearchParams(window.location.search).get('order_id')) || (window.location.href && window.location.href.includes('order_id='))) || isFromOrderEmail) && (
                      <div style={{
                        flexShrink: 0,
                        width: '200px',
                        background: 'white',
                        borderRadius: '8px',
                        padding: '12px',
                        marginTop: '12px',
                        border: '2px solid #28a745',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#28a745' }}>
                          Print Quality Image
                        </h4>
                        <div style={{
                          width: '100%',
                          minHeight: '120px',
                          maxHeight: '180px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f0f8f0',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #c3e6cb'
                        }}>
                          {printQualityImageUrl ? (
                            <img
                              src={printQualityImageUrl}
                              alt="Print Quality 300 DPI"
                              style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block' }}
                            />
                          ) : (
                            <p style={{ color: '#999', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '10px' }}>
                              Click &quot;Generate 300 DPI Image&quot; to create
                            </p>
                          )}
                        </div>
                        {printQualityMeta && printQualityMeta.dimensions && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#155724', background: '#d4edda', padding: '6px 8px', borderRadius: '4px', border: '1px solid #c3e6cb' }}>
                            <strong>Print quality verified</strong>
                            <div style={{ marginTop: '4px' }}>
                              {printQualityMeta.dimensions.width} × {printQualityMeta.dimensions.height} px
                              {' · '}{printQualityMeta.dimensions.dpi || 300} DPI
                              {printQualityMeta.file_size != null && (
                                <> · {((printQualityMeta.file_size * 3 / 4) / 1024 / 1024).toFixed(1)} MB</>
                              )}
                              {printQualityMeta.format && <> · {printQualityMeta.format}</>}
                              {printQualityMeta.quality && <> · {printQualityMeta.quality}</>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
            {(() => {
              // Email Edit Tools link (order_id in URL): Generate 300 DPI, Order Details, Download Print Quality only (no extra "Download" — avoids confusion with preview resolution)
              const fromParams = searchParams.get('order_id');
              let fromUrl = false;
              if (typeof window !== 'undefined') {
                const q = window.location.search;
                if (q) fromUrl = !!new URLSearchParams(q).get('order_id');
                if (!fromUrl && window.location.href && window.location.href.includes('order_id=')) fromUrl = true;
              }
              const isEmailEditToolsPage = !!(fromParams || fromUrl || isFromOrderEmail);
              const orderId = searchParams.get('order_id') || '';
              if (isEmailEditToolsPage) {
                const orderDetailsUrl = orderId ? `${API_CONFIG.BASE_URL}/admin/orders?order_id=${encodeURIComponent(orderId)}` : '';
                return (
                  <>
                    <div className="tools-actions-email-row">
                      <button
                        type="button"
                        className="tools-email-btn tools-email-btn-300dpi"
                        onClick={handleGenerate300Dpi}
                        disabled={(!editedImageUrl && !imageUrl) || generating300Dpi}
                      >
                        {generating300Dpi ? 'Generating…' : 'Generate 300 DPI Image'}
                      </button>
                      {orderDetailsUrl && (
                        <a
                          href={orderDetailsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tools-email-btn tools-email-btn-order"
                        >
                          Order Details
                        </a>
                      )}
                      <button
                        type="button"
                        className="tools-email-btn tools-email-btn-order"
                        onClick={handleDownloadPrintQuality}
                        disabled={!printQualityImageUrl}
                        title="Downloads the 300 DPI file after you click Generate 300 DPI Image"
                      >
                        Download Print Quality Image
                      </button>
                    </div>
                  </>
                );
              }
              // Cart tools: show Apply Edits (apply and proceed to checkout)
              return (
                <button 
                  className="apply-edits-btn"
                  onClick={handleApplyEdits}
                  disabled={!editedImageUrl}
                >
                  Apply Edits
                </button>
              );
            })()}
            <button 
              className="reset-btn"
              onClick={() => {
                setFeatherEdge(0);
                setCornerRadius(0);
                setFrameEnabled(false);
                setFrameWidth(10);
                setFrameColor('#FF0000');
                setDoubleFrame(false);
                setTextEnabled(false);
                setTextContent('');
                setTextFont('Arial');
                setTextColor('#000000');
                setTextSize(24);
                setTextOffsetX(50);
                setTextOffsetY(50);
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

