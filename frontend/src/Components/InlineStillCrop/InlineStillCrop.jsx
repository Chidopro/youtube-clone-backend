import React, { useEffect, useRef, useState } from 'react';
import './InlineStillCrop.css';

const MIN_CROP = 50;
const JPEG_MAX_EDGE = 1080;
const JPEG_QUALITY = 0.8;

function clampCropToContent(crop, content) {
  const maxW = Math.max(MIN_CROP, content.width);
  const maxH = Math.max(MIN_CROP, content.height);
  const width = Math.min(Math.max(MIN_CROP, crop.width), maxW);
  const height = Math.min(Math.max(MIN_CROP, crop.height), maxH);
  const x = Math.min(Math.max(content.x, crop.x), content.x + content.width - width);
  const y = Math.min(Math.max(content.y, crop.y), content.y + content.height - height);
  return { x, y, width, height };
}

function containedImageBox(img) {
  if (!img) return { x: 0, y: 0, width: 0, height: 0 };
  const stage = img.parentElement || img;
  const stageRect = stage.getBoundingClientRect();
  const imgRect = img.getBoundingClientRect();
  const nw = img.naturalWidth || img.width || 1;
  const nh = img.naturalHeight || img.height || 1;
  const displayW = imgRect.width;
  const displayH = imgRect.height;
  const imageAspect = nw / nh;
  const boxAspect = displayW / Math.max(1, displayH);
  let width;
  let height;
  let x;
  let y;
  if (boxAspect > imageAspect) {
    height = displayH;
    width = height * imageAspect;
    x = (displayW - width) / 2;
    y = 0;
  } else {
    width = displayW;
    height = width / imageAspect;
    x = 0;
    y = (displayH - height) / 2;
  }
  return {
    x: (imgRect.left - stageRect.left) + x,
    y: (imgRect.top - stageRect.top) + y,
    width,
    height,
  };
}

function loadImage(url, crossOrigin) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

async function imageForCanvas(url) {
  const src = String(url || '').trim();
  if (!src) throw new Error('No image to crop');
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return loadImage(src, false);
  }
  try {
    const img = await loadImage(src, true);
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d');
    if (!ctx) return img;
    ctx.drawImage(img, 0, 0, 1, 1);
    probe.toDataURL('image/jpeg');
    return img;
  } catch {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('Could not load image for crop');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return loadImage(objectUrl, false);
  }
}

function exportJpeg(canvas) {
  try {
    const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return url && url.length > 100 ? url : null;
  } catch {
    return null;
  }
}

function downsampleJpeg(sourceCanvas) {
  if (!sourceCanvas?.width || !sourceCanvas.height) return null;
  const scale = Math.min(1, JPEG_MAX_EDGE / Math.max(sourceCanvas.width, sourceCanvas.height));
  if (scale >= 1) return exportJpeg(sourceCanvas);
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  small.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const ctx = small.getContext('2d');
  if (!ctx) return exportJpeg(sourceCanvas);
  ctx.drawImage(sourceCanvas, 0, 0, small.width, small.height);
  return exportJpeg(small) || exportJpeg(sourceCanvas);
}

const CROP_ICON = (
  <svg
    className="playvideo-crop-toggle-icon"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 2v4h4M18 2v4h-4M6 22v-4h4M18 22v-4h-4M2 6h4v4M22 6h-4v4M2 18h4v-4M22 18h-4v-4" />
  </svg>
);

export default function InlineStillCrop({ sourceUrl, imgRef, onApply, onCropModeChange }) {
  const [isCropMode, setIsCropMode] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const cropAreaRef = useRef(cropArea);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const resizeDirectionRef = useRef(null);
  const isMobile = typeof window !== 'undefined'
    && (window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches);
  const handleSize = isMobile ? 20 : 10;
  const handleOffset = isMobile ? -10 : -5;

  const updateCropArea = (next) => {
    cropAreaRef.current = next;
    setCropArea(next);
  };

  const endPointer = () => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    resizeDirectionRef.current = null;
    setIsDragging(false);
  };

  useEffect(() => {
    cropAreaRef.current = cropArea;
  }, [cropArea]);

  useEffect(() => {
    onCropModeChange?.(isCropMode);
  }, [isCropMode, onCropModeChange]);

  useEffect(() => {
    const img = imgRef?.current;
    if (!img) return undefined;
    img.classList.toggle('screenshot-image--cropping', isCropMode);
    return () => img.classList.remove('screenshot-image--cropping');
  }, [isCropMode, imgRef]);

  useEffect(() => {
    if (!isCropMode) return undefined;
    const img = imgRef?.current;
    if (!img) return undefined;
    const place = () => {
      const content = containedImageBox(img);
      if (!(content.width > 0 && content.height > 0)) return;
      const width = Math.min(200, Math.max(MIN_CROP, content.width * 0.4));
      const height = Math.min(200, Math.max(MIN_CROP, content.height * 0.4));
      updateCropArea(clampCropToContent({
        x: content.x + (content.width - width) / 2,
        y: content.y + (content.height - height) / 2,
        width,
        height,
      }, content));
    };
    const frame = window.requestAnimationFrame(place);
    img.addEventListener('load', place);
    return () => {
      window.cancelAnimationFrame(frame);
      img.removeEventListener('load', place);
    };
  }, [isCropMode, imgRef, sourceUrl]);

  const applyPointerMove = (clientX, clientY) => {
    if (!isDraggingRef.current && !isResizingRef.current) return;
    const img = imgRef?.current;
    if (!img) return;
    const stage = img.parentElement || img;
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const content = containedImageBox(img);
    const prev = cropAreaRef.current;
    if (isDraggingRef.current) {
      updateCropArea(clampCropToContent({
        ...prev,
        x: x - dragStartRef.current.x,
        y: y - dragStartRef.current.y,
      }, content));
      return;
    }
    const dir = resizeDirectionRef.current || '';
    let { x: newX, y: newY, width: newWidth, height: newHeight } = prev;
    if (dir.includes('right')) newWidth = x - prev.x;
    if (dir.includes('left')) {
      newX = x;
      newWidth = prev.x + prev.width - newX;
    }
    if (dir.includes('bottom')) newHeight = y - prev.y;
    if (dir.includes('top')) {
      newY = y;
      newHeight = prev.y + prev.height - newY;
    }
    updateCropArea(clampCropToContent({ x: newX, y: newY, width: newWidth, height: newHeight }, content));
  };

  useEffect(() => {
    if (!isCropMode) return undefined;
    const onMouseMove = (e) => applyPointerMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (!isDraggingRef.current && !isResizingRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) applyPointerMove(touch.clientX, touch.clientY);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', endPointer);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', endPointer);
    document.addEventListener('touchcancel', endPointer);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', endPointer);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', endPointer);
      document.removeEventListener('touchcancel', endPointer);
    };
  }, [isCropMode, imgRef]);

  const startDrag = (clientX, clientY) => {
    const img = imgRef?.current;
    if (!img) return;
    const stage = img.parentElement || img;
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const area = cropAreaRef.current;
    if (x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) {
      isDraggingRef.current = true;
      isResizingRef.current = false;
      dragStartRef.current = { x: x - area.x, y: y - area.y };
      setIsDragging(true);
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCropMode) {
      endPointer();
      setIsCropMode(false);
      setIsApplying(false);
      return;
    }
    setIsCropMode(true);
  };

  const handleCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    endPointer();
    setIsApplying(false);
    setIsCropMode(false);
  };

  const handleApply = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCropMode || isApplying) return;
    const imgEl = imgRef?.current;
    if (!imgEl) return;
    setIsApplying(true);
    try {
      const content = containedImageBox(imgEl);
      const area = cropAreaRef.current || cropArea;
      const source = await imageForCanvas(sourceUrl || imgEl.currentSrc || imgEl.src);
      const sourceWidth = source.naturalWidth || source.width;
      const sourceHeight = source.naturalHeight || source.height;
      const relX = content.width ? (area.x - content.x) / content.width : 0;
      const relY = content.height ? (area.y - content.y) / content.height : 0;
      const relW = content.width ? area.width / content.width : 1;
      const relH = content.height ? area.height / content.height : 1;
      let sx = Math.round(relX * sourceWidth);
      let sy = Math.round(relY * sourceHeight);
      let sw = Math.round(relW * sourceWidth);
      let sh = Math.round(relH * sourceHeight);
      sx = Math.max(0, Math.min(sourceWidth - 1, sx));
      sy = Math.max(0, Math.min(sourceHeight - 1, sy));
      sw = Math.max(1, Math.min(sourceWidth - sx, sw));
      sh = Math.max(1, Math.min(sourceHeight - sy, sh));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not crop image');
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
      const cropped = downsampleJpeg(canvas) || canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      if (!cropped) throw new Error('Could not crop image');
      onApply?.(cropped);
      endPointer();
      setIsCropMode(false);
    } catch (err) {
      try {
        const fallback = imgEl;
        const content = containedImageBox(fallback);
        const area = cropAreaRef.current || cropArea;
        const sourceWidth = fallback.naturalWidth || fallback.width;
        const sourceHeight = fallback.naturalHeight || fallback.height;
        const relX = content.width ? (area.x - content.x) / content.width : 0;
        const relY = content.height ? (area.y - content.y) / content.height : 0;
        const relW = content.width ? area.width / content.width : 1;
        const relH = content.height ? area.height / content.height : 1;
        const canvas = document.createElement('canvas');
        const sw = Math.max(1, Math.round(relW * sourceWidth));
        const sh = Math.max(1, Math.round(relH * sourceHeight));
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw err;
        ctx.drawImage(
          fallback,
          Math.max(0, Math.round(relX * sourceWidth)),
          Math.max(0, Math.round(relY * sourceHeight)),
          sw,
          sh,
          0,
          0,
          sw,
          sh,
        );
        const cropped = downsampleJpeg(canvas) || canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        if (!cropped) throw err;
        onApply?.(cropped);
        endPointer();
        setIsCropMode(false);
      } catch {
        alert(err?.message || 'Failed to crop image. Please try again.');
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleResizeStart = (direction, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isApplying) return;
    isResizingRef.current = true;
    isDraggingRef.current = false;
    resizeDirectionRef.current = direction;
    setIsDragging(false);
  };

  const handleOverlayMouseDown = (e) => {
    e.stopPropagation();
    if (isApplying) return;
    startDrag(e.clientX, e.clientY);
  };

  const handleOverlayTouchStart = (e) => {
    e.stopPropagation();
    if (isApplying) return;
    const touch = e.touches[0];
    if (touch) startDrag(touch.clientX, touch.clientY);
  };

  const handleStyle = {
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    backgroundColor: '#18181B',
    borderRadius: '50%',
    border: isMobile ? '2px solid white' : 'none',
    boxShadow: isMobile ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
    zIndex: 10,
  };

  return (
    <>
      <button
        type="button"
        className={`playvideo-crop-toggle${isCropMode ? ' is-active' : ''}`}
        onClick={handleToggle}
        onContextMenu={(e) => e.preventDefault()}
        title={isCropMode ? 'Exit Crop Mode' : 'Crop Screenshot'}
      >
        {CROP_ICON}
        <span className="playvideo-crop-toggle-label">Crop</span>
      </button>
      {isCropMode ? (
        <div
          className="inline-crop-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            cursor: isDragging ? 'move' : 'default',
            touchAction: 'none',
            userSelect: 'none',
          }}
          onMouseDown={handleOverlayMouseDown}
          onTouchStart={handleOverlayTouchStart}
        >
          <div
            className="crop-area"
            style={{
              position: 'absolute',
              left: cropArea.x,
              top: cropArea.y,
              width: cropArea.width,
              height: cropArea.height,
              border: '2px dashed #fff',
              boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.45)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              cursor: isDragging ? 'move' : 'default',
            }}
          >
            <div
              className="resize-handle"
              style={{ ...handleStyle, top: handleOffset, left: handleOffset, cursor: 'nw-resize' }}
              onMouseDown={(e) => handleResizeStart('top-left', e)}
              onTouchStart={(e) => handleResizeStart('top-left', e)}
            />
            <div
              className="resize-handle"
              style={{ ...handleStyle, top: handleOffset, right: handleOffset, cursor: 'ne-resize' }}
              onMouseDown={(e) => handleResizeStart('top-right', e)}
              onTouchStart={(e) => handleResizeStart('top-right', e)}
            />
            <div
              className="resize-handle"
              style={{ ...handleStyle, bottom: handleOffset, left: handleOffset, cursor: 'sw-resize' }}
              onMouseDown={(e) => handleResizeStart('bottom-left', e)}
              onTouchStart={(e) => handleResizeStart('bottom-left', e)}
            />
            <div
              className="resize-handle"
              style={{ ...handleStyle, bottom: handleOffset, right: handleOffset, cursor: 'se-resize' }}
              onMouseDown={(e) => handleResizeStart('bottom-right', e)}
              onTouchStart={(e) => handleResizeStart('bottom-right', e)}
            />
          </div>
        </div>
      ) : null}
      {isCropMode ? (
        <div
          className="inline-crop-controls"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="inline-crop-btn inline-crop-btn--cancel"
            onClick={handleCancel}
            disabled={isApplying}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-crop-btn inline-crop-btn--apply"
            onClick={handleApply}
            disabled={isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply Crop'}
          </button>
        </div>
      ) : null}
    </>
  );
}
