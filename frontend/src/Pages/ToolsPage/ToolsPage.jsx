import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPrintAreaConfig, getPrintAreaDimensions, getPrintAreaAspectRatio, getAspectRatio, getPixelDimensions, PRINT_AREA_CONFIG } from '../../config/printAreaConfig';
import API_CONFIG from '../../config/apiConfig';
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
  const [selectedProductName, setSelectedProductName] = useState('');
  const [currentImageDimensions, setCurrentImageDimensions] = useState({ width: 0, height: 0 });
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);
  const upgradeTriggeredRef = useRef(false); // Track if we've already triggered an upgrade for this image

  // Load screenshot and product name from localStorage or URL params
  useEffect(() => {
    const loadScreenshot = () => {
      try {
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
    
    // Listen for storage events (when print quality upgrade completes from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'pending_merch_data' && e.newValue) {
        loadScreenshot();
      }
    };
    
    // Listen for custom event (when print quality upgrade completes in same tab)
    const handleLocalStorageUpdate = () => {
      loadScreenshot();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleLocalStorageUpdate);
    
    // Also check periodically for upgrades (backup in case events don't fire)
    // Check more frequently for first 10 seconds, then every 5 seconds for up to 70 seconds total
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      loadScreenshot();
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
              loadScreenshot();
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
      const effectiveCornerRadius = isCircle ? maxCornerRadius : cornerRadius;

      // Draw image to canvas first (before applying rounded corners)
      ctx.drawImage(tempCanvas, 0, 0);

      // Apply corner radius clipping (or circle if maxed out)
      // Use destination-in composite to clip image to rounded shape (preserves transparency)
      if (effectiveCornerRadius > 0) {
        // Create a mask canvas for the rounded corners
        const roundedMaskCanvas = document.createElement('canvas');
        const roundedMaskCtx = roundedMaskCanvas.getContext('2d');
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
        
        // Use destination-in to clip the image to the rounded shape (removes black background)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(roundedMaskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
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
              // Use new helper function that supports size-specific dimensions
              // For now, size is null (will use default), but can be added later
              const dimensions = getPrintAreaDimensions(selectedProductName, null, 'front');
              if (printConfig && dimensions) {
                const dpi = printConfig.dpi || 300;
                const description = printConfig.description || selectedProductName;
                const targetPixels = getPixelDimensions(dimensions.width, dimensions.height, dpi);
                const currentPixels = currentImageDimensions;
                const widthMatch = Math.abs(currentPixels.width - targetPixels.width) < 50;
                const heightMatch = Math.abs(currentPixels.height - targetPixels.height) < 50;
                const isMatch = widthMatch && heightMatch;
                
                // Determine if image needs enlargement or cropping
                const needsEnlargement = currentPixels.width < targetPixels.width || currentPixels.height < targetPixels.height;
                const needsCropping = currentPixels.width > targetPixels.width || currentPixels.height > targetPixels.height;
                
                let warningMessage = '';
                let warningColor = '#e65100';
                let bgColor = '#fff3e0';
                
                // Show neutral dimension information (no upgrade-related messages for customers)
                if (isMatch) {
                  warningMessage = '✓ Dimensions match!';
                  warningColor = '#2e7d32';
                  bgColor = '#e8f5e9';
                } else if (needsEnlargement && needsCropping) {
                  // Mixed case - might need both
                  warningMessage = 'ℹ️ Image dimensions differ - will be adjusted to fit';
                  warningColor = '#1976d2';
                  bgColor = '#e3f2fd';
                } else if (needsEnlargement) {
                  warningMessage = 'ℹ️ Image will be adjusted to fit print area';
                  warningColor = '#1976d2';
                  bgColor = '#e3f2fd';
                } else if (needsCropping) {
                  warningMessage = 'ℹ️ Image will be cropped to fit print area';
                  warningColor = '#1976d2';
                  bgColor = '#e3f2fd';
                } else {
                  warningMessage = 'ℹ️ Image will be adjusted to fit';
                  warningColor = '#1976d2';
                  bgColor = '#e3f2fd';
                }
                
                return (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    backgroundColor: bgColor,
                    border: `1px solid ${isMatch ? '#4caf50' : '#ff9800'}`,
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {description} - {dimensions.width}" × {dimensions.height}" @ {dpi} DPI
                    </div>
                    <div style={{ fontWeight: 'bold', color: warningColor, marginTop: '0.5rem' }}>
                      {warningMessage}
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

    </div>
  );
};

export default ToolsPage;

