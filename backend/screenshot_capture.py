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

def _draw_rounded_rect_filled(img, x, y, width, height, radius, color):
    """Helper function to draw a filled rounded rectangle"""
    if radius <= 0:
        cv2.rectangle(img, (x, y), (x + width, y + height), color, -1)
        return
    
    # Draw the four corners as circles
    cv2.circle(img, (x + radius, y + radius), radius, color, -1)  # Top-left
    cv2.circle(img, (x + width - radius, y + radius), radius, color, -1)  # Top-right
    cv2.circle(img, (x + radius, y + height - radius), radius, color, -1)  # Bottom-left
    cv2.circle(img, (x + width - radius, y + height - radius), radius, color, -1)  # Bottom-right
    
    # Draw the rectangles connecting the corners
    cv2.rectangle(img, (x + radius, y), (x + width - radius, y + height), color, -1)  # Horizontal
    cv2.rectangle(img, (x, y + radius), (x + width, y + height - radius), color, -1)  # Vertical

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
    """Process an image to be shirt-print ready with feathered edges - preserves alpha channel"""
    try:
        # Decode base64 image
        import base64
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        # Use IMREAD_UNCHANGED to preserve alpha channel if present
        image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        
        if image is None:
            return None
        
        height, width = image.shape[:2]
        
        # Check if image has alpha channel, if not convert to RGBA
        if len(image.shape) == 2:
            # Grayscale - convert to RGBA
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
        elif image.shape[2] == 3:
            # BGR image - convert to BGRA (add alpha channel)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
        elif image.shape[2] == 4:
            # Already has alpha channel (BGRA)
            pass
        else:
            return None
        
        # Create feathered edge effect on alpha channel
        if feather_radius > 0:
            # Get the current alpha channel (or create full opacity if none)
            alpha_channel = image[:, :, 3].copy() if image.shape[2] == 4 else np.full((height, width), 255, dtype=np.uint8)
            
            # Log alpha channel stats to verify corner radius is preserved
            transparent_pixels_before = np.sum(alpha_channel == 0)
            total_pixels = height * width
            # Removed verbose logging for performance
            
            # Create a binary mask from the existing alpha channel
            # This preserves the exact shape including corner radius
            binary_mask = (alpha_channel > 0).astype(np.uint8) * 255
            
            # Calculate distance from each pixel to the nearest transparent pixel (edge)
            # This gives us the distance to the actual shape edge, including rounded corners
            dist_transform = cv2.distanceTransform(binary_mask, cv2.DIST_L2, 3)
            
            # Create feather mask: pixels closer to edge get lower alpha
            # CRITICAL: Only apply feather to pixels that are already part of the shape (alpha > 0)
            # This ensures we don't override the corner radius shape
            
            # For pixels inside the shape (dist > 0):
            # - Pixels at distance 0 (on edge) should have alpha = 0
            # - Pixels at distance >= feather_radius should keep their ORIGINAL alpha (not just 255)
            # - Pixels in between get interpolated based on their original alpha value
            
            # Create feather factor: 0 at edge, 1 at feather_radius distance and beyond
            # But only apply to pixels that are already part of the shape
            feather_factor = np.clip(dist_transform / feather_radius, 0.0, 1.0).astype(np.float32)
            
            # CRITICAL FIX: Only apply feather to pixels that are already part of the shape
            # Pixels that are transparent (alpha=0) should stay transparent
            # Pixels that are opaque should be feathered based on distance from edge
            # But pixels far from edge (dist >= feather_radius) should keep their ORIGINAL alpha value
            
            # Convert alpha to float for calculations
            alpha_float = alpha_channel.astype(np.float32)
            
            # For pixels inside the shape (dist_transform > 0):
            # - If distance < feather_radius: interpolate between 0 and original alpha
            # - If distance >= feather_radius: keep original alpha (factor = 1)
            # For pixels outside the shape (dist_transform == 0): keep alpha = 0
            
            # Apply feather: 
            # - Outside shape (dist=0): alpha = 0 (already transparent)
            # - Inside shape, close to edge (dist < feather_radius): alpha = original_alpha * feather_factor
            # - Inside shape, far from edge (dist >= feather_radius): alpha = original_alpha (no change)
            
            # Only modify pixels that are inside the shape (have non-zero distance)
            inside_shape = dist_transform > 0
            final_alpha = np.where(
                inside_shape,
                alpha_float * feather_factor,  # Apply feather to pixels inside shape
                alpha_float  # Keep original alpha for pixels outside (should be 0 anyway)
            ).astype(np.uint8)
            
            image[:, :, 3] = final_alpha
            
            # Log alpha channel stats after feather
            transparent_pixels_after = np.sum(final_alpha == 0)
            # Removed verbose logging for performance
        
        # Enhance quality if requested (only on RGB channels, not alpha)
        if enhance_quality:
            # Apply slight sharpening to RGB channels only
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            rgb_channels = image[:, :, :3]
            sharpened_rgb = cv2.filter2D(rgb_channels, -1, kernel)
            image[:, :, :3] = sharpened_rgb
        
        # Convert BGRA to RGBA for PNG encoding
        # Swap B and R channels
        bgra_image = image.copy()
        b_channel = bgra_image[:, :, 0].copy()
        r_channel = bgra_image[:, :, 2].copy()
        bgra_image[:, :, 0] = r_channel  # R to B position
        bgra_image[:, :, 2] = b_channel  # B to R position
        
        # Use PIL to encode as PNG with RGBA to preserve transparency
        try:
            from PIL import Image
            import io
            # Convert numpy array to PIL Image (RGBA format)
            pil_image = Image.fromarray(bgra_image, 'RGBA')
            # Save to bytes buffer
            buffer = io.BytesIO()
            pil_image.save(buffer, format='PNG')
            buffer.seek(0)
            processed_image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{processed_image_data}"
        except Exception as pil_error:
            logger.warning(f"PIL encoding failed, falling back to cv2: {str(pil_error)}")
            # Fallback to cv2 - encode as PNG to preserve transparency
            success, buffer = cv2.imencode('.png', image)
            if success:
                processed_image_data = base64.b64encode(buffer).decode('utf-8')
                return f"data:image/png;base64,{processed_image_data}"
            else:
                logger.error("Failed to encode image as PNG")
                return None
        
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
        # Use IMREAD_UNCHANGED to preserve alpha channel if present
        image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        
        if image is None:
            return {"success": False, "error": "Failed to decode image"}
        
        height, width = image.shape[:2]
        
        # Ensure corner_radius is an integer and within valid bounds
        corner_radius = int(corner_radius)
        max_radius = min(width, height) // 2
        
        # Check if this should be a perfect circle (corner_radius >= max_radius)
        is_circle = corner_radius >= max_radius
        
        if is_circle:
            # Use max_radius for perfect circle
            corner_radius = max_radius
            logger.info(f"Creating perfect circle with radius {corner_radius} for image {width}x{height}")
        else:
            # Clamp corner_radius to valid range
            corner_radius = min(corner_radius, max_radius)
            logger.info(f"Applying corner radius {corner_radius} to image {width}x{height}")
        
        # Check if image has alpha channel, if not convert to RGBA
        if image.shape[2] == 3:
            # Convert BGR to BGRA (add alpha channel)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
        elif image.shape[2] == 4:
            # Already has alpha channel, but OpenCV uses BGRA, ensure it's correct
            pass
        else:
            return {"success": False, "error": "Unsupported image format"}
        
        # Create a proper rounded rectangle mask
        mask = np.zeros((height, width), dtype=np.uint8)
        
        if is_circle:
            # Create perfect circle mask
            center_x = width // 2
            center_y = height // 2
            cv2.circle(mask, (center_x, center_y), corner_radius, 255, -1)
        else:
            # Create rounded rectangle using cv2.ellipse for smooth corners
            # Ensure all coordinates are integers
            corner_radius_int = int(corner_radius)
            width_int = int(width)
            height_int = int(height)
            
            # Top-left corner
            cv2.ellipse(mask, (corner_radius_int, corner_radius_int), (corner_radius_int, corner_radius_int), 180, 0, 90, 255, -1)
            # Top-right corner  
            cv2.ellipse(mask, (width_int - corner_radius_int, corner_radius_int), (corner_radius_int, corner_radius_int), 270, 0, 90, 255, -1)
            # Bottom-left corner
            cv2.ellipse(mask, (corner_radius_int, height_int - corner_radius_int), (corner_radius_int, corner_radius_int), 90, 0, 90, 255, -1)
            # Bottom-right corner
            cv2.ellipse(mask, (width_int - corner_radius_int, height_int - corner_radius_int), (corner_radius_int, corner_radius_int), 0, 0, 90, 255, -1)
            
            # Fill the center rectangle
            cv2.rectangle(mask, (corner_radius_int, 0), (width_int - corner_radius_int, height_int), 255, -1)
            cv2.rectangle(mask, (0, corner_radius_int), (width_int, height_int - corner_radius_int), 255, -1)
        
        # Create a new image with transparent background (RGBA)
        # OpenCV uses BGRA, but PNG/browsers expect RGBA, so we need to convert
        # Convert BGRA to RGBA by swapping B and R channels
        if image.shape[2] == 4:
            # BGRA image - swap B and R channels to get RGBA
            final_image = image.copy()
            # Swap B (channel 0) and R (channel 2) channels
            b_channel = final_image[:, :, 0].copy()
            r_channel = final_image[:, :, 2].copy()
            final_image[:, :, 0] = r_channel  # R goes to position 0
            final_image[:, :, 2] = b_channel  # B goes to position 2
            # G (channel 1) and A (channel 3) stay the same
        else:
            # BGR image - convert to RGBA
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            final_image = np.zeros((height, width, 4), dtype=np.uint8)
            final_image[:, :, :3] = rgb_image
            final_image[:, :, 3] = 255  # Full opacity
        
        # Apply mask to alpha channel: where mask is 255 (inside rounded rect), keep original alpha
        # Where mask is 0 (outside rounded rect), set alpha to 0 (transparent)
        # Check mask statistics for debugging
        mask_pixels = np.sum(mask > 0)
        total_pixels = height * width
        # Removed verbose logging for performance
        
        final_image[:, :, 3] = np.where(mask > 0, final_image[:, :, 3], 0).astype(np.uint8)
        
        # Verify alpha channel was applied correctly
        transparent_pixels = np.sum(final_image[:, :, 3] == 0)
        # Removed verbose logging for performance
        
        # Convert back to base64 as PNG to preserve transparency
        # Note: cv2.imencode with PNG format expects BGRA, but we have RGBA
        # So we need to convert back to BGRA for encoding, then the browser will display it correctly
        # Actually, let's use PIL/Pillow to encode as PNG with RGBA, which handles colors correctly
        try:
            from PIL import Image
            # Convert numpy array to PIL Image (RGBA format)
            pil_image = Image.fromarray(final_image, 'RGBA')
            # Save to bytes buffer
            import io
            buffer = io.BytesIO()
            pil_image.save(buffer, format='PNG')
            buffer.seek(0)
            processed_image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            success = True
        except Exception as pil_error:
            logger.warning(f"PIL encoding failed, falling back to cv2: {str(pil_error)}")
            # Fallback to cv2 - convert RGBA back to BGRA for encoding
            bgra_image = final_image.copy()
            b_channel = bgra_image[:, :, 0].copy()
            r_channel = bgra_image[:, :, 2].copy()
            bgra_image[:, :, 0] = r_channel  # R to B position
            bgra_image[:, :, 2] = b_channel  # B to R position
            success, buffer = cv2.imencode('.png', bgra_image)
            if success:
                processed_image_data = base64.b64encode(buffer).decode('utf-8')
            else:
                logger.error("Failed to encode image as PNG with cv2")
                return {"success": False, "error": "Failed to encode processed image"}
        if not success:
            logger.error("Failed to encode image as PNG")
            return {"success": False, "error": "Failed to encode processed image"}
        
        logger.info(f"Corner radius effect applied successfully. Image size: {len(processed_image_data)} bytes, radius: {corner_radius}px, is_circle: {is_circle}")
        
        return {
            "success": True,
            "processed_image": f"data:image/png;base64,{processed_image_data}"
        }
        
    except Exception as e:
        logger.error(f"Error applying corner radius: {str(e)}")
        return {"success": False, "error": f"Failed to apply corner radius: {str(e)}"}

def _cover_crop_to_aspect(image, target_aspect):
    """Center cover-crop so the result matches target_aspect (width/height)."""
    if image is None or not target_aspect or target_aspect <= 0:
        return image
    height, width = image.shape[:2]
    if width <= 0 or height <= 0:
        return image
    img_aspect = width / float(height)
    if abs(img_aspect - target_aspect) < 0.02:
        return image
    if img_aspect > target_aspect:
        new_w = max(1, int(round(height * target_aspect)))
        x = max(0, (width - new_w) // 2)
        return image[:, x:x + new_w]
    new_h = max(1, int(round(width / target_aspect)))
    y = max(0, (height - new_h) // 2)
    return image[y:y + new_h, :]


def _distance_inside_including_canvas_border(binary_mask):
    """Distance to nearest transparent pixel, treating the image border as outside.

    cv2.distanceTransform only sees zeros *inside* the array. A rounded rectangle
    that extends to the canvas edge has no zeros along the straight sides, so
    feather would only appear at the rounded corners.
    """
    padded = cv2.copyMakeBorder(binary_mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    dist = cv2.distanceTransform(padded, cv2.DIST_L2, 5)
    return dist[1:-1, 1:-1]


def _tools_matching_feather_factor(width, height, feather_percent, corner_radius_px=0, is_circle=False):
    """Inward linear fade matching ToolsPage rasterize (overlayFeatherMaskStyle).

    Tools uses (percent/100)*(width/2) on left/right and (percent/100)*(height/2)
    on top/bottom, fully transparent at the edge and fully opaque at that depth.
    The print-quality path used to split the fade half-outside the shape (then
    cover it with the frame), which made 300 DPI look like a thinner band.
    """
    width = int(width)
    height = int(height)
    pct = max(0.0, float(feather_percent))
    y = np.arange(height, dtype=np.float32)[:, None]
    x = np.arange(width, dtype=np.float32)[None, :]
    if is_circle:
        outer = min(width, height) / 2.0
        inner = max(0.0, outer * (1.0 - pct / 100.0))
        span = max(1.0, outer - inner)
        dist = np.hypot(x - (width / 2.0), y - (height / 2.0))
        return np.clip((outer - dist) / span, 0.0, 1.0).astype(np.float32)

    fade_x = max(1.0, (pct / 100.0) * (width * 0.5))
    fade_y = max(1.0, (pct / 100.0) * (height * 0.5))
    dist_left = x
    dist_right = (width - 1) - x
    dist_top = y
    dist_bottom = (height - 1) - y
    dx = np.minimum(dist_left, dist_right)
    dy = np.minimum(dist_top, dist_bottom)
    edge_fade = np.clip(dx / fade_x, 0.0, 1.0) * np.clip(dy / fade_y, 0.0, 1.0)

    r = int(corner_radius_px) if corner_radius_px else 0
    if r > 0:
        in_tl = (dist_left < r) & (dist_top < r)
        in_tr = (dist_right < r) & (dist_top < r)
        in_bl = (dist_left < r) & (dist_bottom < r)
        in_br = (dist_right < r) & (dist_bottom < r)
        in_corner = in_tl | in_tr | in_bl | in_br
        cx = np.where(in_tl | in_bl, float(r), float(width - r))
        cy = np.where(in_tl | in_tr, float(r), float(height - r))
        min_dist = np.maximum(0.0, r - np.hypot(x - cx, y - cy))
        corner_feather = max(fade_x, fade_y)
        corner_fade = np.clip(min_dist / corner_feather, 0.0, 1.0)
        edge_fade = np.where(in_corner, corner_fade, edge_fade)
    return edge_fade.astype(np.float32)


def _orientation_print_area(image_orientation, print_area_width, print_area_height):
    """Portrait uses the product print box. Landscape uses the wide band inside it."""
    try:
        width = float(print_area_width) if print_area_width else 0
        height = float(print_area_height) if print_area_height else 0
    except (TypeError, ValueError):
        width, height = 0, 0
    ori = str(image_orientation or "").strip().lower()
    if ori == "landscape":
        if width <= 0:
            width = 11.5
        if height <= 0 or height > width / 1.45:
            height = width / 1.5
        return width, height
    if ori == "portrait":
        if width <= 0 or height <= 0:
            return 11.5, 13.8
        return width, height
    if width > 0 and height > 0:
        return width, height
    return None, None


def process_thumbnail_for_print(image_data, print_dpi=300, soft_corners=False, edge_feather=False, crop_area=None, corner_radius_percent=0, feather_edge_percent=0, frame_enabled=False, frame_color='#FF0000', frame_width=10, double_frame=False, text_enabled=False, text_content='', text_font='Arial', text_color='#000000', text_size=24, text_offset_x=50, text_offset_y=50, add_white_background=False, print_area_width=None, print_area_height=None, image_orientation=None, fit_mode=None, preserve_edits=False):
    """Process a thumbnail image for print quality output"""
    try:
        # Validate input
        if not image_data:
            logger.error("❌ [PRINT_QUALITY] image_data is None or empty")
            return {"success": False, "error": "No image data provided"}
        
        if not isinstance(image_data, str):
            logger.error(f"❌ [PRINT_QUALITY] image_data is not a string, type: {type(image_data)}")
            return {"success": False, "error": f"Invalid image data type: {type(image_data).__name__}"}
        
        import base64
        import requests
        
        # Handle URL input - download the image first
        if image_data.startswith('http://') or image_data.startswith('https://'):
            logger.info(f"📥 [PRINT_QUALITY] Detected URL, downloading image from: {image_data[:100]}")
            try:
                response = requests.get(image_data, timeout=30)
                response.raise_for_status()
                image_bytes = response.content
                logger.info(f"✅ [PRINT_QUALITY] Image downloaded successfully, bytes length: {len(image_bytes)}")
            except Exception as download_error:
                logger.error(f"❌ [PRINT_QUALITY] Failed to download image from URL: {str(download_error)}")
                return {"success": False, "error": f"Failed to download image from URL: {str(download_error)}"}
        # Handle base64 data URL
        elif image_data.startswith('data:image'):
            logger.info(f"📥 [PRINT_QUALITY] Detected data URL, extracting base64 data")
            try:
                image_data = image_data.split(',')[1]
                image_bytes = base64.b64decode(image_data, validate=True)
                logger.info(f"✅ [PRINT_QUALITY] Base64 decoded successfully, bytes length: {len(image_bytes)}")
            except Exception as decode_error:
                logger.error(f"❌ [PRINT_QUALITY] Base64 decode failed: {str(decode_error)}")
                logger.error(f"❌ [PRINT_QUALITY] Image data preview: {image_data[:100] if len(image_data) > 100 else image_data}")
                return {"success": False, "error": f"Failed to decode base64 image: {str(decode_error)}"}
        # Handle raw base64 string
        else:
            logger.info(f"📥 [PRINT_QUALITY] Detected raw base64 string")
            try:
                image_bytes = base64.b64decode(image_data, validate=True)
                logger.info(f"✅ [PRINT_QUALITY] Base64 decoded successfully, bytes length: {len(image_bytes)}")
            except Exception as decode_error:
                logger.error(f"❌ [PRINT_QUALITY] Base64 decode failed: {str(decode_error)}")
                logger.error(f"❌ [PRINT_QUALITY] Image data preview: {image_data[:100] if len(image_data) > 100 else image_data}")
                return {"success": False, "error": f"Failed to decode base64 image: {str(decode_error)}"}
        
        nparr = np.frombuffer(image_bytes, np.uint8)
        # Use IMREAD_UNCHANGED to preserve alpha channel if present
        image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        
        if image is None:
            logger.error(f"❌ [PRINT_QUALITY] cv2.imdecode returned None - invalid image format or corrupted data")
            logger.error(f"❌ [PRINT_QUALITY] Image bytes length: {len(image_bytes)}, first 20 bytes: {image_bytes[:20]}")
            return {"success": False, "error": "Failed to decode image - invalid format or corrupted data"}
        
        # Check if image has alpha channel, if not convert to BGRA
        if len(image.shape) == 2:
            # Grayscale - convert to BGR then BGRA
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
        elif image.shape[2] == 3:
            # BGR - convert to BGRA (add alpha channel)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
        elif image.shape[2] == 4:
            # Already has alpha channel (BGRA)
            pass
        else:
            return {"success": False, "error": "Unsupported image format"}
        
        # Apply crop if specified
        if crop_area:
            x = int(crop_area['x'] * image.shape[1])
            y = int(crop_area['y'] * image.shape[0])
            w = int(crop_area['width'] * image.shape[1])
            h = int(crop_area['height'] * image.shape[0])
            image = image[y:y+h, x:x+w]

        ori = str(image_orientation or "").strip().lower()
        if ori not in ("portrait", "landscape"):
            ori = None
        preserve = bool(preserve_edits) or str(fit_mode or "").strip().lower() in ("preserve", "none")
        if preserve:
            # Keep baked feather/frame/radius. Cover-crop and print-area stretch
            # clip those edges (often leaving only a corner of the fade).
            logger.info("📐 [PRINT_QUALITY] preserve_edits: skip cover-crop and print-area stretch")
            ori = None
            print_area_width = None
            print_area_height = None
        cover_fit = (not preserve) and (str(fit_mode or "").strip().lower() == "cover" or bool(ori))
        oriented_w, oriented_h = _orientation_print_area(ori, print_area_width, print_area_height)
        if cover_fit and not crop_area:
            target_aspect = None
            if oriented_w and oriented_h:
                target_aspect = oriented_w / oriented_h
            elif ori == "landscape":
                target_aspect = 1.5
            elif ori == "portrait":
                target_aspect = 11.5 / 13.8
            if target_aspect:
                before_h, before_w = image.shape[:2]
                image = _cover_crop_to_aspect(image, target_aspect)
                after_h, after_w = image.shape[:2]
                logger.info(
                    f"📐 [PRINT_QUALITY] Cover-crop {ori or fit_mode}: {before_w}x{before_h} → {after_w}x{after_h} (aspect {target_aspect:.3f})"
                )
        if oriented_w and oriented_h:
            print_area_width = oriented_w
            print_area_height = oriented_h
        
        # Calculate target dimensions for print quality
        # Preserve aspect ratio but scale to print quality
        original_height, original_width = image.shape[:2]
        aspect_ratio = original_width / original_height
        
        logger.info(f"📐 [PRINT_QUALITY] Original image dimensions: {original_width}x{original_height}, aspect ratio: {aspect_ratio:.2f}")
        
        # If print area dimensions are provided, use them to calculate exact target size
        # This ensures the output matches the exact print area for the product
        if print_area_width and print_area_height:
            # Calculate exact pixel dimensions from print area (inches) * DPI
            target_width = int(print_area_width * print_dpi)
            target_height = int(print_area_height * print_dpi)
            
            logger.info(f"📐 [PRINT_QUALITY] Using exact print area dimensions: {print_area_width}\"x{print_area_height}\" → {target_width}x{target_height}px at {print_dpi} DPI")
            
            # Resize image to exact print area dimensions
            # Use INTER_LINEAR for high quality upscaling
            try:
                image = cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LINEAR)
                # Verify resize worked
                actual_height, actual_width = image.shape[:2]
                logger.info(f"✅ [PRINT_QUALITY] Resize successful! Actual dimensions: {actual_width}x{actual_height}")
                if actual_width != target_width or actual_height != target_height:
                    logger.warn(f"⚠️ [PRINT_QUALITY] Resize dimensions mismatch! Expected {target_width}x{target_height}, got {actual_width}x{actual_height}")
                    target_width = actual_width
                    target_height = actual_height
            except Exception as resize_error:
                logger.error(f"❌ [PRINT_QUALITY] Resize failed: {str(resize_error)}")
                # Fall back to original dimensions if resize fails
                target_width = original_width
                target_height = original_height
        else:
            # Fallback to old behavior if print area dimensions not provided
            # Check if image is already at print quality (within 10% tolerance to avoid unnecessary resizing)
            # This prevents quality loss from re-processing images that are already at print quality
            min_print_width = 2400  # 8 inches at 300 DPI
            min_print_height = 3000  # 10 inches at 300 DPI
            is_already_print_quality = (
                original_width >= min_print_width * 0.9 and 
                original_height >= min_print_height * 0.9
            )
            
            if is_already_print_quality:
                logger.info(f"✅ [PRINT_QUALITY] Image is already at print quality ({original_width}x{original_height}), skipping resize to preserve quality")
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
                
                logger.info(f"📐 [PRINT_QUALITY] Calculated target dimensions: {target_width}x{target_height} (from {original_width}x{original_height})")
                
                # Only resize if we need to scale up (avoid downscaling high-res images)
                if target_width > original_width or target_height > original_height:
                    logger.info(f"⬆️ [PRINT_QUALITY] Resizing image from {original_width}x{original_height} to {target_width}x{target_height}")
                    # Resize image to print quality dimensions while preserving aspect ratio
                    # Use INTER_LINEAR for faster processing (still high quality)
                    try:
                        image = cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LINEAR)
                        # Verify resize worked
                        actual_height, actual_width = image.shape[:2]
                        logger.info(f"✅ [PRINT_QUALITY] Resize successful! Actual dimensions: {actual_width}x{actual_height}")
                        if actual_width != target_width or actual_height != target_height:
                            logger.warn(f"⚠️ [PRINT_QUALITY] Resize dimensions mismatch! Expected {target_width}x{target_height}, got {actual_width}x{actual_height}")
                            target_width = actual_width
                            target_height = actual_height
                    except Exception as resize_error:
                        logger.error(f"❌ [PRINT_QUALITY] Resize failed: {str(resize_error)}")
                        # Fall back to original dimensions if resize fails
                        target_width = original_width
                        target_height = original_height
                else:
                    # Image is larger than target, keep original size to preserve quality
                    target_width = original_width
                    target_height = original_height
                    logger.info(f"ℹ️ [PRINT_QUALITY] Image is larger than target, keeping original dimensions to preserve quality")
        
        # Apply corner radius effect to the HIGH-RESOLUTION print quality image (AFTER resize)
        # Support both boolean (legacy) and numeric (0-100) values
        # Calculate corner_radius_value once for use in both corner radius and frame drawing
        if isinstance(corner_radius_percent, (int, float)) and corner_radius_percent > 0:
            corner_radius_value = corner_radius_percent
        elif soft_corners:
            corner_radius_value = 100  # Default to full circle for boolean true
        else:
            corner_radius_value = 0
        
        # Store corner radius mask for final reapplication (to preserve transparency after all effects)
        corner_radius_mask = None
        if corner_radius_value > 0:
            logger.info(f"Applying corner radius effect to HIGH-RESOLUTION print quality image {target_width}x{target_height}")
            
            # Calculate corner radius (0-100% maps to 0-50% of smallest dimension)
            max_radius = min(target_width, target_height) / 2
            corner_radius = int((corner_radius_value / 100) * max_radius) if corner_radius_value < 100 else int(max_radius)
            
            logger.info(f"Using corner radius: {corner_radius} ({corner_radius_value}%) for high-res image")
            
            # Create a PROPER filled rounded rectangle mask using the helper function
            # This ensures the entire mask is filled correctly without gaps
            corner_radius_mask = np.zeros((target_height, target_width), dtype=np.uint8)
            _draw_rounded_rect_filled(corner_radius_mask, 0, 0, target_width, target_height, corner_radius, 255)
            
            # Apply mask to BOTH RGB and alpha channels to ensure entire canvas is rounded
            # Where mask is 255 (inside rounded rect), keep original values
            # Where mask is 0 (outside rounded rect), set to 0 (transparent/black)
            
            # Ensure image has alpha channel before applying mask
            if image.shape[2] == 3:
                # Add alpha channel if missing
                height, width = image.shape[:2]
                alpha_channel = np.ones((height, width), dtype=np.uint8) * 255
                image = np.dstack([image, alpha_channel])
            
            # Apply mask to RGB channels - set to 0 where mask is 0
            for channel in range(3):
                image[:, :, channel] = np.where(corner_radius_mask > 0, image[:, :, channel], 0).astype(np.uint8)
            
            # Apply mask to alpha channel - set to 0 where mask is 0 (transparent)
            image[:, :, 3] = np.where(corner_radius_mask > 0, image[:, :, 3], 0).astype(np.uint8)
            
            logger.info("Corner radius effect applied successfully to high-resolution image (RGB + alpha channels)")
        
        # Apply feather effect to the HIGH-RESOLUTION print quality image (AFTER resize and corner radius)
        # Support both boolean (legacy) and numeric (0-100) values
        feather_value = feather_edge_percent if isinstance(feather_edge_percent, (int, float)) and feather_edge_percent > 0 else (50 if edge_feather else 0)
        
        if feather_value > 0:
            # For very large images: apply feather at reduced resolution then upscale to avoid OOM/timeout (502)
            orig_w, orig_h = target_width, target_height
            pixel_count = target_width * target_height
            need_upscale = False
            if pixel_count > 9_500_000:  # ~3080x3080
                need_upscale = True
                work_scale = (9_500_000 / pixel_count) ** 0.5
                work_w = max(100, int(target_width * work_scale))
                work_h = max(100, int(target_height * work_scale))
                image = cv2.resize(image, (work_w, work_h), interpolation=cv2.INTER_LINEAR)
                target_width, target_height = work_w, work_h
                logger.info(f"[PRINT_QUALITY] Applying feather at reduced resolution {work_w}x{work_h} (will upscale to {orig_w}x{orig_h}) to avoid OOM")
            else:
                logger.info(f"Applying feather effect to HIGH-RESOLUTION print quality image {target_width}x{target_height}")
            
            if image.shape[2] == 3:
                alpha_channel = np.full((target_height, target_width), 255, dtype=np.uint8)
                image = np.dstack([image, alpha_channel])
            else:
                alpha_channel = image[:, :, 3].copy()

            max_radius = min(target_width, target_height) / 2.0
            is_circle = corner_radius_value >= 100
            if is_circle:
                corner_px = int(max_radius)
            elif corner_radius_value > 0:
                corner_px = int((corner_radius_value / 100.0) * max_radius)
            else:
                corner_px = 0

            feather_factor = _tools_matching_feather_factor(
                target_width,
                target_height,
                feather_value,
                corner_radius_px=corner_px,
                is_circle=is_circle,
            )
            final_alpha = np.clip(alpha_channel.astype(np.float32) * feather_factor, 0.0, 255.0).astype(np.uint8)
            image[:, :, 3] = final_alpha
            zero_alpha_mask = final_alpha == 0
            if np.any(zero_alpha_mask):
                image[zero_alpha_mask, :3] = 0
 
            # If we applied feather at reduced resolution, upscale back to original size for frame step
            if need_upscale:
                image = cv2.resize(image, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
                target_width, target_height = orig_w, orig_h
                logger.info(f"[PRINT_QUALITY] Upscaled feathered image back to {target_width}x{target_height}")
        
        # Apply frame border if enabled (AFTER feather to ensure frame is on top and visible)
        if frame_enabled and frame_width > 0:
            # Ensure frame_width is an integer and within bounds
            frame_width = int(frame_width)
            frame_width = max(1, min(100, frame_width))  # Clamp between 1-100px
            
            # Scale frame width based on image size for high-resolution images
            base_width = 1200  # Reference width for 1:1 scaling
            if target_width > base_width:
                scale_factor = target_width / base_width
                scaled_frame_width = int(frame_width * scale_factor)
                logger.info(f"Scaling frame width: {frame_width}px -> {scaled_frame_width}px (scale factor: {scale_factor:.2f} for {target_width}px wide image)")
                frame_width = scaled_frame_width
            else:
                logger.info(f"Frame width: {frame_width}px (no scaling needed for {target_width}px wide image)")
            
            logger.info(f"Applying frame border: color={frame_color}, width={frame_width}px, double={double_frame}, image_size={target_width}x{target_height}")
            
            # Convert hex color to BGR
            try:
                hex_color = frame_color.lstrip('#')
                if len(hex_color) == 6:
                    r = int(hex_color[0:2], 16)
                    g = int(hex_color[2:4], 16)
                    b = int(hex_color[4:6], 16)
                    frame_bgr = (b, g, r)  # OpenCV uses BGR
                else:
                    frame_bgr = (0, 0, 255)  # Default red
            except:
                frame_bgr = (0, 0, 255)  # Default red on error
            
            # Get current alpha channel to determine visible shape (after feather)
            current_alpha = image[:, :, 3] if image.shape[2] == 4 else np.full((target_height, target_width), 255, dtype=np.uint8)
            
            # Calculate effective corner radius for frame (same as used for corner radius effect)
            max_radius = min(target_width, target_height) / 2
            effective_corner_radius = int((corner_radius_value / 100) * max_radius) if corner_radius_value < 100 else int(max_radius)
            
            # Create frame mask - frame should be drawn INSIDE the image bounds
            # Draw frame as a border around the edge, within the image dimensions
            frame_mask = np.zeros((target_height, target_width), dtype=np.uint8)
            
            if corner_radius_value >= 100:  # Circle
                # Draw outer circle for frame (at image boundary)
                cv2.circle(frame_mask, (target_width // 2, target_height // 2), 
                          int(max_radius), 255, -1)
                # Subtract inner circle (inset by frame_width)
                inner_radius = max(0, int(max_radius - frame_width))
                cv2.circle(frame_mask, (target_width // 2, target_height // 2), 
                          inner_radius, 0, -1)
            elif effective_corner_radius > 0:  # Rounded rectangle
                # Draw outer rounded rectangle (at image boundary)
                _draw_rounded_rect_filled(frame_mask, 0, 0, target_width, target_height, 
                                         effective_corner_radius, 255)
                # Subtract inner rounded rectangle (inset by frame_width)
                inner_corner_radius = max(0, effective_corner_radius - frame_width)
                if inner_corner_radius > 0:
                    _draw_rounded_rect_filled(frame_mask, frame_width, frame_width,
                                             target_width - frame_width * 2, 
                                             target_height - frame_width * 2,
                                             inner_corner_radius, 0)
                else:
                    # If corner radius becomes 0, use rectangle
                    cv2.rectangle(frame_mask, (frame_width, frame_width),
                                (target_width - frame_width, target_height - frame_width), 0, -1)
            else:  # Rectangle
                # Draw outer rectangle (at image boundary)
                cv2.rectangle(frame_mask, (0, 0), (target_width, target_height), 255, -1)
                # Subtract inner rectangle (inset by frame_width)
                cv2.rectangle(frame_mask, (frame_width, frame_width),
                            (target_width - frame_width, target_height - frame_width), 0, -1)
            
            # Apply frame to BGR channels - frame should be visible regardless of alpha
            # Frame is drawn on top, so it should be opaque even where image is feathered
            num_channels = image.shape[2] if len(image.shape) > 2 else 1
            if num_channels >= 3:
                for c in range(3):  # BGR channels
                    image[:, :, c] = np.where(frame_mask > 0, frame_bgr[c], image[:, :, c])
            
            # Set alpha to fully opaque where frame is drawn (frame should be visible)
            if num_channels == 4:
                image[:, :, 3] = np.where(frame_mask > 0, 255, image[:, :, 3])
            
            # Draw inner frame for double frame effect
            if double_frame:
                inner_offset = int(frame_width * 1.5)
                inner_width = int(frame_width * 0.7)
                inner_frame_mask = np.zeros((target_height, target_width), dtype=np.uint8)
                
                if corner_radius_value >= 100:  # Circle
                    # Draw outer circle for inner frame (inside the main frame)
                    inner_outer_radius = int(max_radius - frame_width - inner_offset)
                    cv2.circle(inner_frame_mask, (target_width // 2, target_height // 2),
                              inner_outer_radius, 255, -1)
                    # Subtract inner circle
                    cv2.circle(inner_frame_mask, (target_width // 2, target_height // 2),
                              int(inner_outer_radius - inner_width), 0, -1)
                elif effective_corner_radius > 0:  # Rounded rectangle
                    # Inner frame is drawn inside the main frame
                    inner_outer_radius = max(0, effective_corner_radius - frame_width - inner_offset)
                    inner_x = frame_width + inner_offset
                    inner_y = frame_width + inner_offset
                    inner_w = target_width - (frame_width + inner_offset) * 2
                    inner_h = target_height - (frame_width + inner_offset) * 2
                    
                    # Draw outer rounded rectangle for inner frame
                    _draw_rounded_rect_filled(inner_frame_mask, inner_x, inner_y,
                                             inner_w, inner_h,
                                             int(inner_outer_radius), 255)
                    # Subtract inner rounded rectangle
                    inner_inner_radius = max(0, inner_outer_radius - inner_width)
                    if inner_inner_radius > 0:
                        _draw_rounded_rect_filled(inner_frame_mask, 
                                                 inner_x + inner_width,
                                                 inner_y + inner_width,
                                                 inner_w - inner_width * 2,
                                                 inner_h - inner_width * 2,
                                                 int(inner_inner_radius), 0)
                    else:
                        cv2.rectangle(inner_frame_mask,
                                    (inner_x + inner_width, inner_y + inner_width),
                                    (inner_x + inner_w - inner_width, 
                                     inner_y + inner_h - inner_width), 0, -1)
                else:  # Rectangle
                    # Draw outer rectangle for inner frame
                    cv2.rectangle(inner_frame_mask,
                                (frame_width + inner_offset, frame_width + inner_offset),
                                (target_width - frame_width - inner_offset, 
                                 target_height - frame_width - inner_offset), 255, -1)
                    # Subtract inner rectangle
                    cv2.rectangle(inner_frame_mask,
                                (frame_width + inner_offset + inner_width,
                                 frame_width + inner_offset + inner_width),
                                (target_width - frame_width - inner_offset - inner_width,
                                 target_height - frame_width - inner_offset - inner_width), 0, -1)
                
                # Apply inner frame mask to image - inner frame should also be fully visible
                num_channels = image.shape[2] if len(image.shape) > 2 else 1
                if num_channels >= 3:
                    for c in range(3):  # BGR channels
                        image[:, :, c] = np.where(inner_frame_mask > 0, frame_bgr[c], image[:, :, c])
                
                # Set alpha to fully opaque where inner frame is drawn
                if num_channels == 4:
                    image[:, :, 3] = np.where(inner_frame_mask > 0, 255, image[:, :, 3])
            
            logger.info("Frame border applied successfully")
        
        # CRITICAL: Reapply corner radius mask AFTER all effects to ensure transparency is preserved
        # This ensures areas outside the rounded rectangle are fully transparent in the final image
        if corner_radius_mask is not None:
            logger.info("Reapplying corner radius mask to final image to preserve transparency")
            
            # Ensure image has alpha channel
            if image.shape[2] == 3:
                height, width = image.shape[:2]
                alpha_channel = np.ones((height, width), dtype=np.uint8) * 255
                image = np.dstack([image, alpha_channel])
            
            # Apply mask to RGB channels - set to 0 where mask is 0 (outside rounded rect)
            for channel in range(3):
                image[:, :, channel] = np.where(corner_radius_mask > 0, image[:, :, channel], 0).astype(np.uint8)
            
            # Apply mask to alpha channel - set to 0 where mask is 0 (fully transparent outside)
            image[:, :, 3] = np.where(corner_radius_mask > 0, image[:, :, 3], 0).astype(np.uint8)
            
            logger.info("Corner radius mask reapplied - transparency preserved outside rounded rectangle")
        
        # Add white background if requested (for Printful compatibility)
        if add_white_background:
            height, width = image.shape[:2]
            
            # Create white background (BGR = 255, 255, 255)
            white_background = np.ones((height, width, 3), dtype=np.uint8) * 255
            
            # If image has alpha channel, composite over white background
            if image.shape[2] == 4:
                alpha = image[:, :, 3:4].astype(np.float32) / 255.0
                rgb = image[:, :, :3].astype(np.float32)
                
                # Composite: result = alpha * rgb + (1 - alpha) * white
                composite = alpha * rgb + (1.0 - alpha) * 255.0
                image = composite.astype(np.uint8)
            else:
                # No alpha channel, just use RGB channels
                image = image[:, :, :3]
            
            logger.info("White background added for Printful compatibility")
        else:
            # When white background is NOT added, ensure transparency is preserved
            # Make sure image has alpha channel (BGRA format)
            if image.shape[2] == 3:
                # Convert BGR to BGRA by adding fully opaque alpha channel
                height, width = image.shape[:2]
                alpha_channel = np.ones((height, width), dtype=np.uint8) * 255
                image = np.dstack([image, alpha_channel])
            
            # Ensure RGB values are zero where alpha is 0 (prevent black background artifacts)
            if image.shape[2] == 4:
                alpha = image[:, :, 3]
                zero_alpha_mask = alpha == 0
                if np.any(zero_alpha_mask):
                    image[zero_alpha_mask, 0] = 0  # B channel
                    image[zero_alpha_mask, 1] = 0  # G channel
                    image[zero_alpha_mask, 2] = 0  # R channel
                logger.info("Transparency preserved - RGB values zeroed where alpha is 0")
        
        # Convert to PNG with proper DPI metadata using PIL
        # If white background was added, image is now BGR (3 channels), otherwise it's BGRA (4 channels)
        try:
            from PIL import Image, ImageDraw, ImageFont
            import io
            
            # Convert OpenCV image (BGR/BGRA) to PIL Image (RGB/RGBA)
            if image.shape[2] == 4:  # BGRA
                # Convert BGRA to RGBA
                rgba_image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA)
                pil_image = Image.fromarray(rgba_image, 'RGBA')
            else:  # BGR (white background added)
                # Convert BGR to RGB
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_image, 'RGB')
            
            # Draw text overlay if enabled (after all other effects)
            if text_enabled and text_content and text_content.strip():
                try:
                    draw = ImageDraw.Draw(pil_image)
                    width, height = pil_image.size
                    # Headline-style: text_size 100 = ~22% of image min dimension (match frontend)
                    min_dim = min(width, height)
                    font_px = max(12, min(300, int((text_size / 100.0) * min_dim * 0.22)))
                    # Position: 0-100, 50 = center
                    ox = max(0, min(100, text_offset_x if text_offset_x is not None else 50))
                    oy = max(0, min(100, text_offset_y if text_offset_y is not None else 50))
                    center_x = int(width * ox / 100)
                    center_y = int(height * oy / 100)
                    # Try to load font; fallback to default
                    font_paths = []
                    if os.name == 'nt':  # Windows
                        font_dir = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
                        font_map = {'Arial': 'arial.ttf', 'Helvetica': 'arial.ttf', 'Georgia': 'georgia.ttf',
                                    'Times New Roman': 'times.ttf', 'Verdana': 'verdana.ttf', 'Courier New': 'cour.ttf'}
                        fname = font_map.get(text_font, 'arial.ttf')
                        font_paths.append(os.path.join(font_dir, fname))
                    else:
                        for d in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf']:
                            if os.path.isfile(d):
                                font_paths.append(d)
                                break
                    font = None
                    for fp in font_paths:
                        if os.path.isfile(fp):
                            try:
                                font = ImageFont.truetype(fp, font_px)
                                break
                            except Exception:
                                continue
                    if font is None:
                        font = ImageFont.load_default()
                    # Parse hex color to RGB
                    hex_color = (text_color or '#000000').lstrip('#')
                    if len(hex_color) == 6:
                        r = int(hex_color[0:2], 16)
                        g = int(hex_color[2:4], 16)
                        b = int(hex_color[4:6], 16)
                        fill_tuple = (r, g, b) if pil_image.mode == 'RGB' else (r, g, b, 255)
                    else:
                        fill_tuple = (0, 0, 0) if pil_image.mode == 'RGB' else (0, 0, 0, 255)
                    lines = [line.strip() for line in text_content.strip().split('\n') if line.strip()]
                    if lines:
                        # Position text block at center_x, center_y (multiline)
                        line_height = int(font_px * 1.2)
                        total_h = (len(lines) - 1) * line_height
                        start_y = center_y - total_h // 2
                        for i, line in enumerate(lines):
                            # Get bbox to center each line (Pillow 8+ has textbbox; older has textsize)
                            try:
                                bbox = draw.textbbox((0, 0), line, font=font)
                                tw = bbox[2] - bbox[0]
                            except AttributeError:
                                tw, _ = draw.textsize(line, font=font)
                            x = center_x - tw // 2
                            y = start_y + i * line_height
                            draw.text((x, y), line, font=font, fill=fill_tuple)
                    logger.info("Text overlay applied successfully")
                except Exception as text_err:
                    logger.warning("Could not apply text overlay: %s", str(text_err))
            
            # Save to bytes buffer with DPI metadata
            buffer = io.BytesIO()
            # Set DPI metadata (300 DPI for print quality)
            pil_image.save(buffer, format='PNG', dpi=(print_dpi, print_dpi))
            buffer.seek(0)
            processed_image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            logger.info(f"✅ [PRINT_QUALITY] PNG encoded with {print_dpi} DPI metadata using PIL")
        except Exception as pil_error:
            logger.warning(f"⚠️ [PRINT_QUALITY] PIL encoding failed, falling back to cv2 (no DPI metadata): {str(pil_error)}")
            # Fallback to cv2 - encode as PNG (but without DPI metadata)
            _, buffer = cv2.imencode('.png', image, [cv2.IMWRITE_PNG_COMPRESSION, 1])
            processed_image_data = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "success": True,
            "screenshot": f"data:image/png;base64,{processed_image_data}",
            "dimensions": {
                "width": target_width,
                "height": target_height,
                "dpi": print_dpi
            },
            "file_size": len(processed_image_data),
            "format": "PNG",
            "quality": "Print Ready"
        }
        
    except Exception as e:
        logger.error(f"Error processing thumbnail for print: {str(e)}")
        return {"success": False, "error": f"Failed to process thumbnail: {str(e)}"}