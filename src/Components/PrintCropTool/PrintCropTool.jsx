import React, { useState, useRef, useEffect } from 'react';
import './PrintCropTool.css';

const PrintCropTool = ({ isOpen, image, onCrop, onCancel }) => {
    const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const canvasRef = useRef(null);

    // Print size requirements (in pixels at 300 DPI)
    const PRINT_SIZES = {
        '4x6': { width: 1200, height: 1800 },
        '5x7': { width: 1500, height: 2100 },
        '8x10': { width: 2400, height: 3000 },
        '11x14': { width: 3300, height: 4200 }
    };

    useEffect(() => {
        if (isOpen && image) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                setImageSize({ width: img.width, height: img.height });
                ctx.drawImage(img, 0, 0);
                
                // Initialize crop area to center
                const centerX = img.width / 2 - 150;
                const centerY = img.height / 2 - 150;
                const initialSize = Math.min(300, Math.min(img.width, img.height) * 0.8);
                
                const newCropArea = {
                    x: Math.max(0, centerX),
                    y: Math.max(0, centerY),
                    width: initialSize,
                    height: initialSize
                };
                console.log('Initializing crop area:', newCropArea);
                setCropArea(newCropArea);
            };
            img.src = image;
        }
    }, [isOpen, image]);

    const getResizeHandle = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const handleSize = 20; // Increased handle size for easier interaction
        
        // Check corners for resize handles
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
        
        return null;
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        console.log('Mouse down at:', { x, y, cropArea });
        
        // Check if clicking on resize handle
        const handle = getResizeHandle(e);
        if (handle) {
            console.log('Resizing handle:', handle);
            setIsResizing(true);
            setResizeHandle(handle);
            setDragStart({ x, y });
            return;
        }
        
        // Check if clicking inside crop area for dragging
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            console.log('Dragging crop area');
            setIsDragging(true);
            setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
        }
    };

    const handleMouseMove = (e) => {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isDragging) {
            const newX = Math.max(0, Math.min(x - dragStart.x, imageSize.width - cropArea.width));
            const newY = Math.max(0, Math.min(y - dragStart.y, imageSize.height - cropArea.height));
            console.log('Dragging to:', { newX, newY });
            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            let newCropArea = { ...cropArea };
            
            switch (resizeHandle) {
                case 'top-left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 50);
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 50);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
                case 'top-right':
                    newCropArea.y = Math.min(y, cropArea.y + cropArea.height - 50);
                    newCropArea.width = Math.max(50, x - cropArea.x);
                    newCropArea.height = cropArea.y + cropArea.height - newCropArea.y;
                    break;
                case 'bottom-left':
                    newCropArea.x = Math.min(x, cropArea.x + cropArea.width - 50);
                    newCropArea.width = cropArea.x + cropArea.width - newCropArea.x;
                    newCropArea.height = Math.max(50, y - cropArea.y);
                    break;
                case 'bottom-right':
                    newCropArea.width = Math.max(50, x - cropArea.x);
                    newCropArea.height = Math.max(50, y - cropArea.y);
                    break;
            }
            
            // Ensure crop area stays within bounds
            newCropArea.x = Math.max(0, Math.min(newCropArea.x, imageSize.width - newCropArea.width));
            newCropArea.y = Math.max(0, Math.min(newCropArea.y, imageSize.height - newCropArea.height));
            newCropArea.width = Math.min(newCropArea.width, imageSize.width - newCropArea.x);
            newCropArea.height = Math.min(newCropArea.height, imageSize.height - newCropArea.y);
            
            console.log('Resizing to:', newCropArea);
            setCropArea(newCropArea);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
    };

    const handleCrop = () => {
        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            const croppedCanvas = document.createElement('canvas');
            const croppedCtx = croppedCanvas.getContext('2d');
            
            croppedCanvas.width = cropArea.width;
            croppedCanvas.height = cropArea.height;
            
            croppedCtx.drawImage(
                canvas,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, cropArea.width, cropArea.height
            );
            
            const croppedImageUrl = croppedCanvas.toDataURL('image/png');
            onCrop(croppedImageUrl);
        } catch (error) {
            console.error('Error during crop operation:', error);
            alert('Error cropping image. Please try again.');
        }
    };

    const getCursorStyle = (e) => {
        if (!canvasRef.current) return 'default';
        
        const handle = getResizeHandle(e);
        if (handle) {
            return 'crosshair';
        }
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            return 'move';
        }
        return 'default';
    };

    // Add debug logging
    useEffect(() => {
        console.log('Crop area updated:', cropArea);
    }, [cropArea]);

    // Check if crop size meets print requirements
    const getPrintSizeStatus = () => {
        const results = {};
        Object.entries(PRINT_SIZES).forEach(([size, requirements]) => {
            const meetsWidth = cropArea.width >= requirements.width;
            const meetsHeight = cropArea.height >= requirements.height;
            results[size] = { meetsWidth, meetsHeight, requirements };
        });
        return results;
    };

    const printStatus = getPrintSizeStatus();

    if (!isOpen) return null;

    return (
        <div className="print-crop-overlay">
            <div className="print-crop-modal">
                <div className="print-crop-header">
                    <h3>Print Crop Tool</h3>
                    <button className="print-crop-close" onClick={onCancel}>×</button>
                </div>
                
                <div className="print-crop-content">
                    <div className="print-size-indicator">
                        <h4>Print Size Check:</h4>
                        <div className="print-sizes">
                            {Object.entries(printStatus).map(([size, status]) => (
                                <div 
                                    key={size} 
                                    className={`print-size ${status.meetsWidth && status.meetsHeight ? 'meets-requirements' : 'below-requirements'}`}
                                >
                                    <span className="size-name">{size}</span>
                                    <span className="size-status">
                                        {status.meetsWidth && status.meetsHeight ? '✓' : '✗'}
                                    </span>
                                    <span className="size-details">
                                        {Math.round(cropArea.width)}×{Math.round(cropArea.height)}px
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="crop-instructions">
                        <p>• Drag the crop box to move it</p>
                        <p>• Drag the corner handles (crosshair cursor) to resize</p>
                        <p>• Green checkmarks indicate print-ready sizes</p>
                    </div>
                    
                    <div className="crop-canvas-container">
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
                                height: cropArea.height,
                                position: 'absolute'
                            }}
                        >
                            {/* Corner resize handles */}
                            <div className="resize-handle top-left" />
                            <div className="resize-handle top-right" />
                            <div className="resize-handle bottom-left" />
                            <div className="resize-handle bottom-right" />
                        </div>
                    </div>
                </div>
                
                <div className="print-crop-footer">
                    <button className="crop-btn cancel" onClick={onCancel}>Cancel</button>
                    <button className="crop-btn apply" onClick={handleCrop}>Apply Crop</button>
                </div>
            </div>
        </div>
    );
};

export default PrintCropTool;
