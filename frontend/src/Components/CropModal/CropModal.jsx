import React, { useState, useRef, useEffect } from 'react';
import './CropModal.css';

const CropModal = ({ isOpen, image, onCrop, onCancel }) => {
    console.log('🎯 CropModal v2.0 loaded with resize handles!', { 
        isOpen, 
        image: image?.substring(0, 50) + '...',
        timestamp: new Date().toISOString(),
        version: '2.0.2',
        cacheBuster: Math.random()
    });
    const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [aspectRatio, setAspectRatio] = useState('free');
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const canvasRef = useRef(null);
    const imageRef = useRef(null);

    useEffect(() => {
        if (isOpen && image) {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Fix CORS issue
            img.onload = () => {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                
                // Set canvas size to match image
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Store image dimensions
                setImageSize({ width: img.width, height: img.height });
                
                // Draw image
                ctx.drawImage(img, 0, 0);
                
                // Initialize crop area to center with reasonable size
                const centerX = img.width / 2 - 150;
                const centerY = img.height / 2 - 150;
                const initialSize = Math.min(300, Math.min(img.width, img.height) * 0.8);
                
                setCropArea({
                    x: Math.max(0, centerX),
                    y: Math.max(0, centerY),
                    width: initialSize,
                    height: initialSize
                });
            };
            img.onerror = () => {
                console.error('Failed to load image with CORS. Trying without CORS...');
                // Fallback: try without CORS
                const fallbackImg = new Image();
                fallbackImg.onload = () => {
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = fallbackImg.width;
                    canvas.height = fallbackImg.height;
                    setImageSize({ width: fallbackImg.width, height: fallbackImg.height });
                    ctx.drawImage(fallbackImg, 0, 0);
                    
                    const centerX = fallbackImg.width / 2 - 150;
                    const centerY = fallbackImg.height / 2 - 150;
                    const initialSize = Math.min(300, Math.min(fallbackImg.width, fallbackImg.height) * 0.8);
                    
                    setCropArea({
                        x: Math.max(0, centerX),
                        y: Math.max(0, centerY),
                        width: initialSize,
                        height: initialSize
                    });
                };
                fallbackImg.src = image;
            };
            img.src = image;
        }
    }, [isOpen, image]);

    const getResizeHandle = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const handleSize = 10;
        
        // Check corners first
        if (x >= cropArea.x - handleSize && x <= cropArea.x + handleSize &&
            y >= cropArea.y - handleSize && y <= cropArea.y + handleSize) {
            return 'top-left';
        }
        if (x >= cropArea.x + cropArea.width - handleSize && x <= cropArea.x + cropArea.width + handleSize &&
            y >= cropArea.y - handleSize && y <= cropArea.y + handleSize) {
            return 'top-right';
        }
        if (x >= cropArea.x - handleSize && x <= cropArea.x + handleSize &&
            y >= cropArea.y + cropArea.height - handleSize && y <= cropArea.y + cropArea.height + handleSize) {
            return 'bottom-left';
        }
        if (x >= cropArea.x + cropArea.width - handleSize && x <= cropArea.x + cropArea.width + handleSize &&
            y >= cropArea.y + cropArea.height - handleSize && y <= cropArea.y + cropArea.height + handleSize) {
            return 'bottom-right';
        }
        
        // Check edges
        if (x >= cropArea.x - handleSize && x <= cropArea.x + handleSize &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            return 'left';
        }
        if (x >= cropArea.x + cropArea.width - handleSize && x <= cropArea.x + cropArea.width + handleSize &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            return 'right';
        }
        if (y >= cropArea.y - handleSize && y <= cropArea.y + handleSize &&
            x >= cropArea.x && x <= cropArea.x + cropArea.width) {
            return 'top';
        }
        if (y >= cropArea.y + cropArea.height - handleSize && y <= cropArea.y + cropArea.height + handleSize &&
            x >= cropArea.x && x <= cropArea.x + cropArea.width) {
            return 'bottom';
        }
        
        return null;
    };

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on resize handle
        const handle = getResizeHandle(e);
        if (handle) {
            setIsResizing(true);
            setResizeHandle(handle);
            setDragStart({ x, y });
            return;
        }
        
        // Check if clicking inside crop area for dragging
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
        }
    };

    const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isDragging) {
            const newX = Math.max(0, Math.min(x - dragStart.x, imageSize.width - cropArea.width));
            const newY = Math.max(0, Math.min(y - dragStart.y, imageSize.height - cropArea.height));
            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            let newCropArea = { ...cropArea };
            
            switch (resizeHandle) {
                case 'top-left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 20);
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 20);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
                case 'top-right':
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 20);
                    newCropArea.width = Math.max(20, x - cropArea.x);
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
                case 'bottom-left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 20);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    newCropArea.height = Math.max(20, y - cropArea.y);
                    break;
                case 'bottom-right':
                    newCropArea.width = Math.max(20, x - cropArea.x);
                    newCropArea.height = Math.max(20, y - cropArea.y);
                    break;
                case 'left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 20);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    break;
                case 'right':
                    newCropArea.width = Math.max(20, x - cropArea.x);
                    break;
                case 'top':
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 20);
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
                case 'bottom':
                    newCropArea.height = Math.max(20, y - cropArea.y);
                    break;
            }
            
            // Apply aspect ratio constraints
            if (aspectRatio !== 'free') {
                newCropArea = applyAspectRatio(newCropArea, aspectRatio);
            }
            
            // Ensure crop area stays within bounds
            newCropArea.x = Math.max(0, Math.min(newCropArea.x, imageSize.width - newCropArea.width));
            newCropArea.y = Math.max(0, Math.min(newCropArea.y, imageSize.height - newCropArea.height));
            newCropArea.width = Math.min(newCropArea.width, imageSize.width - newCropArea.x);
            newCropArea.height = Math.min(newCropArea.height, imageSize.height - newCropArea.y);
            
            setCropArea(newCropArea);
        }
    };

    const applyAspectRatio = (area, ratio) => {
        let newArea = { ...area };
        
        switch (ratio) {
            case 'square':
                const size = Math.min(area.width, area.height);
                newArea.width = size;
                newArea.height = size;
                break;
            case '16:9':
                newArea.height = area.width * (9/16);
                break;
            case '4:3':
                newArea.height = area.width * (3/4);
                break;
            case '3:4':
                newArea.width = area.height * (3/4);
                break;
        }
        
        return newArea;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
    };

    const handleAspectRatioChange = (ratio) => {
        setAspectRatio(ratio);
        if (ratio !== 'free') {
            const newCropArea = applyAspectRatio(cropArea, ratio);
            
            // Ensure crop area stays within canvas bounds
            if (newCropArea.x + newCropArea.width > imageSize.width) {
                newCropArea.x = imageSize.width - newCropArea.width;
            }
            if (newCropArea.y + newCropArea.height > imageSize.height) {
                newCropArea.y = imageSize.height - newCropArea.height;
            }
            
            setCropArea(newCropArea);
        }
    };

    const handleCrop = () => {
        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            // Create a new canvas for the cropped image
            const croppedCanvas = document.createElement('canvas');
            const croppedCtx = croppedCanvas.getContext('2d');
            
            croppedCanvas.width = cropArea.width;
            croppedCanvas.height = cropArea.height;
            
            // Draw the cropped portion
            croppedCtx.drawImage(
                canvas,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );
            
            // Try to convert to data URL with error handling
            let croppedImageUrl;
            try {
                croppedImageUrl = croppedCanvas.toDataURL('image/png');
            } catch (error) {
                console.error('CORS error when creating data URL:', error);
                // Fallback: create a blob URL instead
                croppedCanvas.toBlob((blob) => {
                    const blobUrl = URL.createObjectURL(blob);
                    onCrop(blobUrl);
                }, 'image/png');
                return;
            }
            
            onCrop(croppedImageUrl);
        } catch (error) {
            console.error('Error during crop operation:', error);
            alert('Error cropping image. Please try again.');
        }
    };

    const getCursorStyle = (e) => {
        if (!canvasRef.current) return 'default';
        
        const handle = getResizeHandle(e);
        if (!handle) {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
                y >= cropArea.y && y <= cropArea.y + cropArea.height) {
                return 'move';
            }
            return 'default';
        }
        
        switch (handle) {
            case 'top-left':
            case 'bottom-right':
                return 'nw-resize';
            case 'top-right':
            case 'bottom-left':
                return 'ne-resize';
            case 'left':
            case 'right':
                return 'ew-resize';
            case 'top':
            case 'bottom':
                return 'ns-resize';
            default:
                return 'default';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="crop-modal-overlay" data-version="2.0.2" data-cache-buster={Math.random()}>
            <div className="crop-modal">
                <div className="crop-modal-header">
                    <h3>Crop Screenshot (v2.0.2) - {new Date().toLocaleTimeString()} - CACHE BUSTED</h3>
                    <button 
                        className="crop-modal-close" 
                        onClick={onCancel}
                        style={{marginRight: '10px'}}
                    >×</button>
                    <button 
                        onClick={() => window.location.reload(true)}
                        style={{
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        FORCE REFRESH
                    </button>
                </div>
                
                <div className="crop-modal-content">
                    <div className="crop-tools">
                        <label>Aspect Ratio:</label>
                        <select 
                            value={aspectRatio} 
                            onChange={(e) => handleAspectRatioChange(e.target.value)}
                        >
                            <option value="free">Free</option>
                            <option value="square">Square (1:1)</option>
                            <option value="16:9">Landscape (16:9)</option>
                            <option value="4:3">Standard (4:3)</option>
                            <option value="3:4">Portrait (3:4)</option>
                        </select>
                        
                        <div className="crop-info">
                            <span>Size: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}px</span>
                        </div>
                    </div>
                    
                    <div className="crop-canvas-container">
                        <div className="crop-instructions">
                            Drag to move • Drag handles to resize • Use aspect ratio dropdown
                        </div>
                        <canvas
                            ref={canvasRef}
                            className="crop-canvas"
                            style={{ cursor: getCursorStyle }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                        <div
                            className="crop-overlay"
                            style={{
                                left: cropArea.x,
                                top: cropArea.y,
                                width: cropArea.width,
                                height: cropArea.height
                            }}
                        >
                            {/* Resize handles */}
                            <div className="resize-handle top-left" />
                            <div className="resize-handle top-right" />
                            <div className="resize-handle bottom-left" />
                            <div className="resize-handle bottom-right" />
                            <div className="resize-handle left" />
                            <div className="resize-handle right" />
                            <div className="resize-handle top" />
                            <div className="resize-handle bottom" />
                        </div>
                    </div>
                </div>
                
                <div className="crop-modal-footer">
                    <button className="crop-btn cancel" onClick={onCancel}>Cancel</button>
                    <button className="crop-btn apply" onClick={handleCrop}>Apply Crop</button>
                </div>
            </div>
        </div>
    );
};

export default CropModal; 