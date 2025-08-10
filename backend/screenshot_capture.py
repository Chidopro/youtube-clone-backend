#!/usr/bin/env python3
"""
Screenshot Capture Module
Handles video screenshot capture functionality
"""

import cv2
import numpy as np
import requests
import tempfile
import os
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

def capture_screenshot(video_url, timestamp=0, quality=95, crop_area=None):
    """Capture a screenshot from a video at a specific timestamp"""
    try:
        logger.info(f"Capturing screenshot from {video_url} at timestamp {timestamp}")
        
        # Download video to temp file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_video:
            response = requests.get(video_url, stream=True)
            response.raise_for_status()
            
            for chunk in response.iter_content(chunk_size=8192):
                temp_video.write(chunk)
            
            temp_video_path = temp_video.name
        
        try:
            # Open video with OpenCV
            cap = cv2.VideoCapture(temp_video_path)
            
            if not cap.isOpened():
                return {"success": False, "error": "Could not open video file"}
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0
            
            # Calculate frame number for timestamp
            frame_number = int(timestamp * fps)
            frame_number = max(0, min(frame_number, total_frames - 1))
            
            # Set position to frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            
            # Read frame
            ret, frame = cap.read()
            
            if not ret:
                return {"success": False, "error": "Could not read frame from video"}
            
            # Apply crop if specified
            if crop_area:
                x = int(crop_area.get('x', 0))
                y = int(crop_area.get('y', 0))
                width = int(crop_area.get('width', frame.shape[1]))
                height = int(crop_area.get('height', frame.shape[0]))
                
                # Ensure crop area is within frame bounds
                x = max(0, min(x, frame.shape[1] - 1))
                y = max(0, min(y, frame.shape[0] - 1))
                width = min(width, frame.shape[1] - x)
                height = min(height, frame.shape[0] - y)
                
                frame = frame[y:y+height, x:x+width]
            
            # Save screenshot to temp file
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_screenshot:
                cv2.imwrite(temp_screenshot.name, frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                screenshot_path = temp_screenshot.name
            
            # Convert to base64 for response
            with open(screenshot_path, 'rb') as f:
                import base64
                screenshot_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Clean up temp files
            os.unlink(temp_video_path)
            os.unlink(screenshot_path)
            
            return {
                "success": True,
                "screenshot": f"data:image/jpeg;base64,{screenshot_data}",
                "timestamp": timestamp,
                "frame_number": frame_number
            }
            
        finally:
            cap.release()
            
    except Exception as e:
        logger.error(f"Error capturing screenshot: {str(e)}")
        return {"success": False, "error": f"Screenshot capture failed: {str(e)}"}

def capture_multiple_screenshots(video_url, timestamps=[0, 2, 4, 6, 8], quality=95):
    """Capture multiple screenshots from a video at different timestamps"""
    screenshots = []
    
    for timestamp in timestamps:
        result = capture_screenshot(video_url, timestamp, quality)
        if result['success']:
            screenshots.append(result['screenshot'])
        else:
            logger.error(f"Failed to capture screenshot at {timestamp}s: {result['error']}")
    
    return {
        "success": len(screenshots) > 0,
        "screenshots": screenshots,
        "timestamps": timestamps
    }

def get_video_info(video_url):
    """Get video information including duration and dimensions"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_video:
            response = requests.get(video_url, stream=True)
            response.raise_for_status()
            
            for chunk in response.iter_content(chunk_size=8192):
                temp_video.write(chunk)
            
            temp_video_path = temp_video.name
        
        try:
            cap = cv2.VideoCapture(temp_video_path)
            
            if not cap.isOpened():
                return {"success": False, "error": "Could not open video file"}
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = total_frames / fps if fps > 0 else 0
            
            cap.release()
            
            return {
                "success": True,
                "duration": duration,
                "width": width,
                "height": height,
                "fps": fps,
                "total_frames": total_frames
            }
            
        finally:
            os.unlink(temp_video_path)
            
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        return {"success": False, "error": f"Failed to get video info: {str(e)}"}

def create_shirt_ready_image(image_data, feather_radius=10, enhance_quality=True):
    """Process an image to be shirt-print ready with feathered edges"""
    try:
        # Decode base64 image
        import base64
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return None
        
        # Create feathered edge effect
        if feather_radius > 0:
            # Create a mask with feathered edges
            mask = np.ones(image.shape[:2], dtype=np.uint8) * 255
            mask = cv2.GaussianBlur(mask, (feather_radius * 2 + 1, feather_radius * 2 + 1), feather_radius)
            
            # Apply mask to image
            image = cv2.bitwise_and(image, image, mask=mask)
        
        # Enhance quality if requested
        if enhance_quality:
            # Apply slight sharpening
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            image = cv2.filter2D(image, -1, kernel)
        
        # Convert back to base64
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/jpeg;base64,{processed_image_data}"
        
    except Exception as e:
        logger.error(f"Error processing shirt image: {str(e)}")
        return None
