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

def create_shirt_ready_image(image_data, feather_radius=38, enhance_quality=True):
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

def apply_corner_radius(image, corner_radius):
    """Apply rounded corners to an image using simple cropping"""
    try:
        height, width = image.shape[:2]
        
        # Calculate corner radius (don't exceed 1/4 of smaller dimension)
        radius = min(corner_radius, min(width, height) // 4)
        
        if radius <= 0:
            return image
        
        # Create a simple rounded rectangle mask
        mask = np.zeros((height, width), dtype=np.uint8)
        
        # Fill the center rectangle
        cv2.rectangle(mask, (radius, radius), (width - radius, height - radius), 255, -1)
        
        # Fill the corner circles
        cv2.circle(mask, (radius, radius), radius, 255, -1)
        cv2.circle(mask, (width - radius, radius), radius, 255, -1)
        cv2.circle(mask, (radius, height - radius), radius, 255, -1)
        cv2.circle(mask, (width - radius, height - radius), radius, 255, -1)
        
        # Apply the mask
        if len(image.shape) == 3:
            # Color image
            for i in range(3):
                image[:, :, i] = cv2.bitwise_and(image[:, :, i], mask)
        else:
            # Grayscale image
            image = cv2.bitwise_and(image, mask)
        
        return image
        
    except Exception as e:
        logger.error(f"Error applying corner radius: {str(e)}")
        return image


def apply_simple_corner_radius(image_data, corner_radius):
    """Apply simple corner radius by cropping corners - very basic approach"""
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
        
        height, width = image.shape[:2]
        
        # Very simple approach - just crop the corners as squares
        corner_size = min(corner_radius, min(width, height) // 6)  # More conservative
        
        if corner_size <= 0:
            return None
        
        # Create transparent background instead of white
        result = np.zeros_like(image)
        
        # Copy the image with corners cropped
        result[corner_size:height-corner_size, corner_size:width-corner_size] = image[corner_size:height-corner_size, corner_size:width-corner_size]
        
        # Convert back to base64
        _, buffer = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 95])
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/jpeg;base64,{processed_image_data}"
        
    except Exception as e:
        logger.error(f"Error applying simple corner radius: {str(e)}")
        return None

def apply_corner_radius_effect(image_data, corner_radius):
    """Apply simple corner radius effect - fast and reliable"""
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
        
        height, width = image.shape[:2]
        
        # Simple corner cropping approach - much faster
        corner_size = min(corner_radius, min(width, height) // 8)
        
        if corner_size <= 0:
            return None
        
        # Create transparent background instead of white
        result = np.zeros_like(image)
        
        # Copy image with corners cropped
        result[corner_size:height-corner_size, corner_size:width-corner_size] = image[corner_size:height-corner_size, corner_size:width-corner_size]
        
        # Convert back to base64
        _, buffer = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 95])
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/jpeg;base64,{processed_image_data}"
        
    except Exception as e:
        logger.error(f"Error applying corner radius effect: {str(e)}")
        return None

def apply_feather_effect(image_data, feather_radius=10, crop_area=None):
    """Apply feather effect to an image"""
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
        
        # Apply crop if specified
        if crop_area:
            x = int(crop_area['x'] * image.shape[1])
            y = int(crop_area['y'] * image.shape[0])
            w = int(crop_area['width'] * image.shape[1])
            h = int(crop_area['height'] * image.shape[0])
            image = image[y:y+h, x:x+w]
        
        # Create a mask for feathering
        mask = np.ones(image.shape[:2], dtype=np.uint8) * 255
        
        # Apply Gaussian blur to create feather effect
        mask = cv2.GaussianBlur(mask, (feather_radius*2+1, feather_radius*2+1), feather_radius)
        
        # Apply the mask to the image
        image = cv2.bitwise_and(image, image, mask=mask)
        
        # Convert back to base64
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/jpeg;base64,{processed_image_data}"
        
    except Exception as e:
        logger.error(f"Error applying feather effect: {str(e)}")
        return None

def apply_feather_to_print_quality(image_data, feather_radius):
    """Apply feather effect to a print quality image"""
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
        
        height, width = image.shape[:2]
        
        # Create feather mask
        mask = np.ones(image.shape[:2], dtype=np.uint8) * 255
        
        # Scale feather radius based on image size for print quality
        scaled_feather_radius = min(feather_radius * (min(width, height) / 1000), min(width, height) // 20)
        
        # Apply Gaussian blur to create feather effect
        mask = cv2.GaussianBlur(mask, (int(scaled_feather_radius*2+1), int(scaled_feather_radius*2+1)), scaled_feather_radius/3)
        
        # Apply the mask to each color channel
        for i in range(3):
            image[:, :, i] = cv2.bitwise_and(image[:, :, i], mask)
        
        # Convert back to base64
        _, buffer = cv2.imencode('.png', image, [cv2.IMWRITE_PNG_COMPRESSION, 1])
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/png;base64,{processed_image_data}"
        
    except Exception as e:
        logger.error(f"Error applying feather to print quality: {str(e)}")
        return None

def apply_corner_radius_only(image_data, corner_radius=15):
    """Apply corner radius effect to an image without changing DPI"""
    try:
        # Decode base64 image
        import base64
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return {"success": False, "error": "Failed to decode image"}
        
        height, width = image.shape[:2]
        
        logger.info(f"Applying corner radius {corner_radius} to image {width}x{height}")
        
        # Create a proper rounded rectangle mask
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        
        # Create rounded rectangle using cv2.ellipse for smooth corners
        # Top-left corner
        cv2.ellipse(mask, (corner_radius, corner_radius), (corner_radius, corner_radius), 180, 0, 90, 255, -1)
        # Top-right corner  
        cv2.ellipse(mask, (width - corner_radius, corner_radius), (corner_radius, corner_radius), 270, 0, 90, 255, -1)
        # Bottom-left corner
        cv2.ellipse(mask, (corner_radius, height - corner_radius), (corner_radius, corner_radius), 90, 0, 90, 255, -1)
        # Bottom-right corner
        cv2.ellipse(mask, (width - corner_radius, height - corner_radius), (corner_radius, corner_radius), 0, 0, 90, 255, -1)
        
        # Fill the center rectangle
        cv2.rectangle(mask, (corner_radius, 0), (width - corner_radius, height), 255, -1)
        cv2.rectangle(mask, (0, corner_radius), (width, height - corner_radius), 255, -1)
        
        # Create a new image with transparent background
        result = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Copy the original image to the result
        result[:, :, :3] = image
        
        # Set alpha channel based on mask
        result[:, :, 3] = mask
        
        # Create a 4-channel image with transparency
        final_image = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Copy the original image to the first 3 channels
        final_image[:, :, :3] = image
        
        # Set alpha channel based on mask (255 = opaque, 0 = transparent)
        final_image[:, :, 3] = mask
        
        # Convert back to base64 as PNG to preserve transparency
        _, buffer = cv2.imencode('.png', final_image)
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        logger.info("Corner radius effect applied successfully")
        
        return {
            "success": True,
            "processed_image": f"data:image/png;base64,{processed_image_data}"
        }
        
    except Exception as e:
        logger.error(f"Error applying corner radius: {str(e)}")
        return {"success": False, "error": f"Failed to apply corner radius: {str(e)}"}

def process_thumbnail_for_print(image_data, print_dpi=300, soft_corners=False, edge_feather=False, crop_area=None):
    """Process a thumbnail image for print quality output"""
    try:
        # Decode base64 image
        import base64
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return {"success": False, "error": "Failed to decode image"}
        
        # Apply crop if specified
        if crop_area:
            x = int(crop_area['x'] * image.shape[1])
            y = int(crop_area['y'] * image.shape[0])
            w = int(crop_area['width'] * image.shape[1])
            h = int(crop_area['height'] * image.shape[0])
            image = image[y:y+h, x:x+w]
        
        # Calculate target dimensions for print quality
        # Preserve aspect ratio but scale to print quality
        original_height, original_width = image.shape[:2]
        aspect_ratio = original_width / original_height
        
        # Check if image is already at print quality (within 10% tolerance to avoid unnecessary resizing)
        # This prevents quality loss from re-processing images that are already at print quality
        min_print_width = 2400  # 8 inches at 300 DPI
        min_print_height = 3000  # 10 inches at 300 DPI
        is_already_print_quality = (
            original_width >= min_print_width * 0.9 and 
            original_height >= min_print_height * 0.9
        )
        
        if is_already_print_quality:
            logger.info(f"Image is already at print quality ({original_width}x{original_height}), skipping resize to preserve quality")
            target_width = original_width
            target_height = original_height
        else:
            # Scale to a reasonable print size while preserving aspect ratio
            # Use 8 inches as the base dimension
            base_size = 8 * print_dpi
            
            if aspect_ratio > 1:  # Landscape
                target_width = int(base_size)
                target_height = int(base_size / aspect_ratio)
            else:  # Portrait
                target_height = int(base_size)
                target_width = int(base_size * aspect_ratio)
            
            # Only resize if we need to scale up (avoid downscaling high-res images)
            if target_width > original_width or target_height > original_height:
                # Resize image to print quality dimensions while preserving aspect ratio
                # Use INTER_LANCZOS4 for better quality preservation
                image = cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
            else:
                # Image is larger than target, keep original size to preserve quality
                target_width = original_width
                target_height = original_height
                logger.info(f"Image is larger than target, keeping original dimensions to preserve quality")
        
        # Apply corner radius effect to the HIGH-RESOLUTION print quality image (AFTER resize)
        if soft_corners:
            logger.info(f"Applying corner radius effect to HIGH-RESOLUTION print quality image {target_width}x{target_height}")
            
            # Create a mask for rounded corners
            mask = np.zeros(image.shape[:2], dtype=np.uint8)
            
            # Calculate corner radius (proportional to image size)
            corner_radius = min(target_width, target_height) // 12  # Adjust this ratio as needed
            
            logger.info(f"Using corner radius: {corner_radius} for high-res image")
            
            # Create rounded rectangle mask
            cv2.rectangle(mask, (0, 0), (target_width, target_height), 255, -1)
            
            # Create rounded corners by drawing circles at corners and subtracting
            # Top-left corner
            cv2.circle(mask, (corner_radius, corner_radius), corner_radius, 0, -1)
            # Top-right corner
            cv2.circle(mask, (target_width - corner_radius, corner_radius), corner_radius, 0, -1)
            # Bottom-left corner
            cv2.circle(mask, (corner_radius, target_height - corner_radius), corner_radius, 0, -1)
            # Bottom-right corner
            cv2.circle(mask, (target_width - corner_radius, target_height - corner_radius), corner_radius, 0, -1)
            
            # Apply the mask to each color channel
            for i in range(3):
                image[:, :, i] = cv2.bitwise_and(image[:, :, i], mask)
            
            logger.info("Corner radius effect applied successfully to high-resolution image")
        
        # Apply feather effect to the HIGH-RESOLUTION print quality image (AFTER resize)
        if edge_feather:
            logger.info(f"Applying feather effect to HIGH-RESOLUTION print quality image {target_width}x{target_height}")
            
            # Create feather mask
            mask = np.ones(image.shape[:2], dtype=np.uint8) * 255
            
            # Use a MUCH larger feather radius for visibility on high-res image
            feather_radius = min(target_width, target_height) // 8  # Even larger radius for high-res
            
            logger.info(f"Using feather radius: {feather_radius} for high-res image")
            
            # Apply multiple blur passes for stronger effect on high-res image
            mask = cv2.GaussianBlur(mask, (feather_radius*2+1, feather_radius*2+1), feather_radius/2)
            mask = cv2.GaussianBlur(mask, (feather_radius*2+1, feather_radius*2+1), feather_radius/2)
            
            # Apply the mask to each color channel
            for i in range(3):
                image[:, :, i] = cv2.bitwise_and(image[:, :, i], mask)
            
            logger.info("Feather effect applied successfully to high-resolution image")
        
        # Convert to PNG for better quality
        _, buffer = cv2.imencode('.png', image)
        processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "success": True,
            "screenshot": f"data:image/png;base64,{processed_image_data}",
            "dimensions": {
                "width": target_width,
                "height": target_height,
                "dpi": print_dpi
            },
            "file_size": len(buffer),
            "format": "PNG",
            "quality": "Print Ready"
        }
        
    except Exception as e:
        logger.error(f"Error processing thumbnail for print: {str(e)}")
        return {"success": False, "error": f"Failed to process thumbnail: {str(e)}"}