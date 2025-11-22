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
            
            # Create a binary mask from the existing alpha channel
            # This preserves the exact shape including corner radius
            binary_mask = (alpha_channel > 0).astype(np.uint8) * 255
            
            # Calculate distance from each pixel to the nearest transparent pixel (edge)
            # This gives us the distance to the actual shape edge, including rounded corners
            dist_transform = cv2.distanceTransform(binary_mask, cv2.DIST_L2, 5)
            
            # Create feather mask: pixels closer to edge get lower alpha
            # Pixels at distance 0 (on edge) should have alpha = 0
            # Pixels at distance >= feather_radius should keep their original alpha
            # Pixels in between get interpolated
            feather_factor = np.clip(dist_transform / feather_radius, 0.0, 1.0).astype(np.float32)
            
            # Apply feather: multiply original alpha by feather factor
            # This preserves the corner radius shape while adding feather to edges
            # Pixels already transparent (alpha=0) stay transparent
            # Pixels at edge (dist=0) become transparent (factor=0)
            # Pixels far from edge (dist>=feather_radius) keep original alpha (factor=1)
            final_alpha = (alpha_channel.astype(np.float32) * feather_factor).astype(np.uint8)
            image[:, :, 3] = final_alpha
        
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
        logger.info(f"Mask statistics: {mask_pixels}/{total_pixels} pixels are inside mask ({100*mask_pixels/total_pixels:.1f}%)")
        
        final_image[:, :, 3] = np.where(mask > 0, final_image[:, :, 3], 0).astype(np.uint8)
        
        # Verify alpha channel was applied correctly
        transparent_pixels = np.sum(final_image[:, :, 3] == 0)
        logger.info(f"Alpha channel applied: {transparent_pixels}/{total_pixels} pixels are transparent ({100*transparent_pixels/total_pixels:.1f}%)")
        
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

def process_thumbnail_for_print(image_data, print_dpi=300, soft_corners=False, edge_feather=False, crop_area=None):
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
        
        # Calculate target dimensions for print quality
        # Preserve aspect ratio but scale to print quality
        original_height, original_width = image.shape[:2]
        aspect_ratio = original_width / original_height
        
        logger.info(f"📐 [PRINT_QUALITY] Original image dimensions: {original_width}x{original_height}, aspect ratio: {aspect_ratio:.2f}")
        
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
                # Use INTER_LANCZOS4 for better quality preservation
                try:
                    image = cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
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
        if soft_corners:
            logger.info(f"Applying corner radius effect to HIGH-RESOLUTION print quality image {target_width}x{target_height}")
            
            # Create a mask for rounded corners
            mask = np.zeros((target_height, target_width), dtype=np.uint8)
            
            # Calculate corner radius (proportional to image size)
            corner_radius = min(target_width, target_height) // 12  # Adjust this ratio as needed
            
            logger.info(f"Using corner radius: {corner_radius} for high-res image")
            
            # Create rounded rectangle mask using ellipses for smooth corners
            # Top-left corner
            cv2.ellipse(mask, (corner_radius, corner_radius), (corner_radius, corner_radius), 180, 0, 90, 255, -1)
            # Top-right corner  
            cv2.ellipse(mask, (target_width - corner_radius, corner_radius), (corner_radius, corner_radius), 270, 0, 90, 255, -1)
            # Bottom-left corner
            cv2.ellipse(mask, (corner_radius, target_height - corner_radius), (corner_radius, corner_radius), 90, 0, 90, 255, -1)
            # Bottom-right corner
            cv2.ellipse(mask, (target_width - corner_radius, target_height - corner_radius), (corner_radius, corner_radius), 0, 0, 90, 255, -1)
            
            # Fill the center rectangle
            cv2.rectangle(mask, (corner_radius, 0), (target_width - corner_radius, target_height), 255, -1)
            cv2.rectangle(mask, (0, corner_radius), (target_width, target_height - corner_radius), 255, -1)
            
            # Apply mask to alpha channel to preserve transparency (not using bitwise_and which creates black)
            # Where mask is 255 (inside rounded rect), keep original alpha
            # Where mask is 0 (outside rounded rect), set alpha to 0 (transparent)
            original_alpha = image[:, :, 3] if image.shape[2] == 4 else np.full((target_height, target_width), 255, dtype=np.uint8)
            image[:, :, 3] = np.where(mask > 0, original_alpha, 0).astype(np.uint8)
            
            logger.info("Corner radius effect applied successfully to high-resolution image with transparency")
        
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
            
            # Apply mask to alpha channel to preserve transparency (not using bitwise_and which creates black)
            # Convert mask to float for smooth blending
            mask_float = mask.astype(np.float32) / 255.0
            # Apply feather to alpha channel
            if image.shape[2] == 4:
                image[:, :, 3] = (image[:, :, 3].astype(np.float32) * mask_float).astype(np.uint8)
            else:
                # If no alpha channel, create one
                alpha = (np.ones((target_height, target_width), dtype=np.float32) * 255 * mask_float).astype(np.uint8)
                image = np.dstack([image, alpha])
            
            logger.info("Feather effect applied successfully to high-resolution image with transparency")
        
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