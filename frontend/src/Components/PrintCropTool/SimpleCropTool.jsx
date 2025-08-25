import React, { useState, useRef, useEffect } from 'react';
import './SimpleCropTool.css';

const SimpleCropTool = ({ isOpen, image, onCrop, onCancel }) => {
    const [cropArea, setCropArea] = useState({ x: 100, y: 100, width: 200, height: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
    const containerRef = useRef(null);

    // Print size requirements (in pixels at 300 DPI)
    const PRINT_SIZES = {
        '4x6': { width: 1200, height: 1800, name: '4" x 6" Photo' },
        '5x7': { width: 1500, height: 2100, name: '5" x 7" Photo' },
        '8x10': { width: 2400, height: 3000, name: '8" x 10" Photo' },
        '11x14': { width: 3300, height: 4200, name: '11" x 14" Photo' },
        'Mug': { width: 800, height: 800, name: 'Coffee Mug' },
        'T-Shirt': { width: 1200, height: 1200, name: 'T-Shirt Print' },
        'Phone Case': { width: 600, height: 1200, name: 'Phone Case' }
    };

    useEffect(() => {
        if (isOpen && image) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const originalWidth = img.width;
                const originalHeight = img.height;
                setImageSize({ width: originalWidth, height: originalHeight });
                
                // Wait for the image to be rendered in the DOM, then get display size
                setTimeout(() => {
                    const displayImg = document.querySelector('.crop-image');
                    if (displayImg) {
                        const displayRect = displayImg.getBoundingClientRect();
                        console.log('Display image size detected:', displayRect);
                        console.log('Image natural size:', { width: displayImg.naturalWidth, height: displayImg.naturalHeight });
                        console.log('Image CSS size:', { width: displayImg.offsetWidth, height: displayImg.offsetHeight });
                        
                        // Use the actual displayed size
                        const displayWidth = displayRect.width;
                        const displayHeight = displayRect.height;
                        
                        setDisplaySize({ width: displayWidth, height: displayHeight });
                        
                        // Initialize crop area to center (in display coordinates)
                        const centerX = displayWidth / 2 - 150;
                        const centerY = displayHeight / 2 - 150;
                        const initialSize = Math.min(300, Math.min(displayWidth, displayHeight) * 0.8);
                        
                        setCropArea({
                            x: Math.max(0, centerX),
                            y: Math.max(0, centerY),
                            width: initialSize,
                            height: initialSize
                        });
                    } else {
                        console.log('Display image not found, using fallback sizes');
                        // Fallback if image not found
                        setDisplaySize({ width: 400, height: 300 });
                        setCropArea({
                            x: 100,
                            y: 100,
                            width: 200,
                            height: 200
                        });
                    }
                }, 300); // Increased timeout for more reliable detection
            };
            img.src = image;
        }
    }, [isOpen, image]);

    const handleMouseDown = (e) => {
        const imageRect = document.querySelector('.crop-image')?.getBoundingClientRect();
        
        if (!imageRect) return;
        
        // Calculate position relative to the image, accounting for any borders/padding
        const x = e.clientX - imageRect.left;
        const y = e.clientY - imageRect.top;
        
        console.log('Mouse down:', { clientX: e.clientX, clientY: e.clientY, imageRect, x, y, cropArea });
        
        // Check if clicking inside crop area
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging && !isResizing) return;
        
        const imageRect = document.querySelector('.crop-image')?.getBoundingClientRect();
        if (!imageRect) return;
        
        // Calculate position relative to the image, accounting for any borders/padding
        const x = e.clientX - imageRect.left;
        const y = e.clientY - imageRect.top;
        
        if (isDragging) {
            const newX = Math.max(0, Math.min(x - dragStart.x, imageSize.width - cropArea.width));
            const newY = Math.max(0, Math.min(y - dragStart.y, imageSize.height - cropArea.height));
            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            let newCropArea = { ...cropArea };
            
            switch (resizeDirection) {
                case 'bottom-right':
                    newCropArea.width = Math.max(50, x - cropArea.x);
                    newCropArea.height = Math.max(50, y - cropArea.y);
                    break;
                case 'bottom-left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 50);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    newCropArea.height = Math.max(50, y - cropArea.y);
                    break;
                case 'top-right':
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 50);
                    newCropArea.width = Math.max(50, x - cropArea.x);
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
                case 'top-left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 50);
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 50);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
            }
            
            // Ensure crop area stays within bounds
            newCropArea.x = Math.max(0, Math.min(newCropArea.x, imageSize.width - newCropArea.width));
            newCropArea.y = Math.max(0, Math.min(newCropArea.y, imageSize.height - newCropArea.height));
            newCropArea.width = Math.min(newCropArea.width, imageSize.width - newCropArea.x);
            newCropArea.height = Math.min(newCropArea.height, imageSize.height - newCropArea.y);
            
            setCropArea(newCropArea);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
    };

    const handleResizeStart = (direction, e) => {
        e.stopPropagation();
        setIsResizing(true);
        setResizeDirection(direction);
    };

    const handleResizeMove = (e) => {
        if (!isResizing) return;
        
        const imageRect = document.querySelector('.crop-image')?.getBoundingClientRect();
        if (!imageRect) return;
        
        // Calculate position relative to the image, not the container
        const x = e.clientX - imageRect.left;
        const y = e.clientY - imageRect.top;
        
        // Update resize logic to use image-relative coordinates
        // This will be handled in handleMouseMove
    };

    // Convert display coordinates to original image coordinates
    const convertToOriginalCoords = (displayCrop) => {
        if (!displaySize.width || !displaySize.height || !imageSize.width || !imageSize.height) {
            console.log('Missing size data:', { displaySize, imageSize });
            return displayCrop;
        }
        
        // Get the actual image element to check its current display size
        const displayImg = document.querySelector('.crop-image');
        let actualDisplayWidth = displaySize.width;
        let actualDisplayHeight = displaySize.height;
        
        if (displayImg) {
            const rect = displayImg.getBoundingClientRect();
            actualDisplayWidth = rect.width;
            actualDisplayHeight = rect.height;
            console.log('Current display size:', { width: actualDisplayWidth, height: actualDisplayHeight });
        }
        
        // Calculate scale factors
        const scaleX = imageSize.width / actualDisplayWidth;
        const scaleY = imageSize.height / actualDisplayHeight;
        
        // Apply scale factors to convert display coordinates to original image coordinates
        // Add a larger offset adjustment to account for any border/padding issues
        const offsetAdjustment = 8; // Larger adjustment to nudge the crop area left
        const originalCrop = {
            x: Math.round((displayCrop.x - offsetAdjustment) * scaleX),
            y: Math.round(displayCrop.y * scaleY),
            width: Math.round(displayCrop.width * scaleX),
            height: Math.round(displayCrop.height * scaleY)
        };
        
        // Ensure coordinates are within bounds
        originalCrop.x = Math.max(0, Math.min(originalCrop.x, imageSize.width - originalCrop.width));
        originalCrop.y = Math.max(0, Math.min(originalCrop.y, imageSize.height - originalCrop.height));
        
        console.log('Coordinate conversion:', {
            displayCrop,
            originalCrop,
            scaleX,
            scaleY,
            offsetAdjustment,
            imageSize,
            actualDisplaySize: { width: actualDisplayWidth, height: actualDisplayHeight }
        });
        
        return originalCrop;
    };

    const handleCrop = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // Convert display coordinates to original image coordinates
            const originalCropArea = convertToOriginalCoords(cropArea);
            
            console.log('Final crop coordinates:', {
                display: cropArea,
                original: originalCropArea,
                imageSize: imageSize,
                displaySize: displaySize
            });
            
            img.onload = () => {
                canvas.width = originalCropArea.width;
                canvas.height = originalCropArea.height;
                
                console.log('Drawing crop:', {
                    sourceX: originalCropArea.x,
                    sourceY: originalCropArea.y,
                    sourceWidth: originalCropArea.width,
                    sourceHeight: originalCropArea.height,
                    destX: 0,
                    destY: 0,
                    destWidth: originalCropArea.width,
                    destHeight: originalCropArea.height
                });
                
                // Clear canvas and draw the cropped portion
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(
                    img,
                    originalCropArea.x, originalCropArea.y, originalCropArea.width, originalCropArea.height,
                    0, 0, originalCropArea.width, originalCropArea.height
                );
                
                const croppedImageUrl = canvas.toDataURL('image/png');
                onCrop(croppedImageUrl);
            };
            
            img.src = image;
        } catch (error) {
            console.error('Error during crop operation:', error);
            alert('Error cropping image. Please try again.');
        }
    };

    // Check if crop size meets print requirements
    const getPrintSizeStatus = () => {
        const results = {};
        const originalCropArea = convertToOriginalCoords(cropArea);
        
        Object.entries(PRINT_SIZES).forEach(([size, requirements]) => {
            const meetsWidth = originalCropArea.width >= requirements.width;
            const meetsHeight = originalCropArea.height >= requirements.height;
            const isSuitable = meetsWidth && meetsHeight;
            results[size] = { 
                meetsWidth, 
                meetsHeight, 
                isSuitable,
                requirements,
                currentWidth: originalCropArea.width,
                currentHeight: originalCropArea.height
            };
        });
        return results;
    };

    // Get the best print size recommendation
    const getBestPrintSize = () => {
        const printStatus = getPrintSizeStatus();
        const suitableSizes = Object.entries(printStatus)
            .filter(([size, status]) => status.isSuitable)
            .sort((a, b) => {
                // Sort by total pixel count (largest first)
                const aPixels = a[1].currentWidth * a[1].currentHeight;
                const bPixels = b[1].currentWidth * b[1].currentHeight;
                return bPixels - aPixels;
            });
        
        return suitableSizes.length > 0 ? suitableSizes[0] : null;
    };

    const printStatus = getPrintSizeStatus();
    const bestPrintSize = getBestPrintSize();

    if (!isOpen) return null;

    return (
        <div className="simple-crop-overlay">
            <div className="simple-crop-modal">
                <div className="simple-crop-header">
                    <h3>Simple Print Crop Tool</h3>
                    <button className="simple-crop-close" onClick={onCancel}>×</button>
                </div>
                
                                 <div className="simple-crop-content">
                     {/* Simple Print Status Indicator */}
                     <div className="simple-print-status">
                         {bestPrintSize ? (
                             <div className="status-ok">
                                 <span className="status-icon">✓</span>
                                 <span className="status-text">OK for Print</span>
                             </div>
                         ) : (
                             <div className="status-warning">
                                 <span className="status-icon">⚠</span>
                                 <span className="status-text">Too Small for Print</span>
                             </div>
                         )}
                     </div>
                     
                     <div className="crop-instructions">
                         <p>• Click and drag inside the blue box to move it</p>
                         <p>• Drag the corner handles to resize</p>
                         <div className="crop-coordinates">
                             <p><strong>Display:</strong> {Math.round(cropArea.x)}, {Math.round(cropArea.y)} - {Math.round(cropArea.width)}×{Math.round(cropArea.height)}</p>
                             <p><strong>Original:</strong> {Math.round(convertToOriginalCoords(cropArea).x)}, {Math.round(convertToOriginalCoords(cropArea).y)} - {Math.round(convertToOriginalCoords(cropArea).width)}×{Math.round(convertToOriginalCoords(cropArea).height)}</p>
                             <p><strong>Scale:</strong> {displaySize.width && imageSize.width ? (imageSize.width / displaySize.width).toFixed(2) : 'N/A'}x</p>
                             <p><strong>Image Size:</strong> {imageSize.width}×{imageSize.height}px</p>
                             <p><strong>Offset Adjustment:</strong> 8px left</p>
                         </div>
                     </div>
                    
                    <div 
                        className="crop-container"
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <img src={image} alt="Crop" className="crop-image" />
                        
                        <div
                            className="crop-box"
                            style={{
                                left: cropArea.x,
                                top: cropArea.y,
                                width: cropArea.width,
                                height: cropArea.height
                            }}
                        >
                            {/* Corner resize handles */}
                            <div 
                                className="resize-handle top-left"
                                onMouseDown={(e) => handleResizeStart('top-left', e)}
                            />
                            <div 
                                className="resize-handle top-right"
                                onMouseDown={(e) => handleResizeStart('top-right', e)}
                            />
                            <div 
                                className="resize-handle bottom-left"
                                onMouseDown={(e) => handleResizeStart('bottom-left', e)}
                            />
                            <div 
                                className="resize-handle bottom-right"
                                onMouseDown={(e) => handleResizeStart('bottom-right', e)}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="simple-crop-footer">
                    <button className="crop-btn cancel" onClick={onCancel}>Cancel</button>
                    <button className="crop-btn apply" onClick={handleCrop}>Apply Crop</button>
                </div>
            </div>
        </div>
    );
};

export default SimpleCropTool;
