import ffmpeg
import base64
import tempfile
import os
import logging
from PIL import Image, ImageFilter, ImageEnhance
import io
import requests
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class VideoScreenshotCapture:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        logger.info(f"Video screenshot capture initialized with temp dir: {self.temp_dir}")
    
    def _fix_video_url(self, video_url):
        """
        Fix video URL by adding proper file extension if missing
        
        Args:
            video_url (str): Original video URL
            
        Returns:
            str: Fixed video URL with proper extension
        """
        if not video_url:
            return video_url
            
        # Parse the URL
        parsed = urlparse(video_url)
        
        # Check if URL already has a video file extension
        video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v']
        path_lower = parsed.path.lower()
        
        if any(path_lower.endswith(ext) for ext in video_extensions):
            logger.info(f"Video URL already has proper extension: {video_url}")
            return video_url
        
        # For screenmerch.com URLs, add .mp4 extension
        if 'screenmerch.com' in parsed.netloc:
            fixed_url = video_url + '.mp4'
            logger.info(f"Fixed screenmerch.com URL: {video_url} -> {fixed_url}")
            return fixed_url
        
        # For other URLs, try adding .mp4 as default
        if not parsed.path.endswith('/'):
            fixed_url = video_url + '.mp4'
            logger.info(f"Added .mp4 extension to URL: {video_url} -> {fixed_url}")
            return fixed_url
        
        # If URL ends with /, append a default filename
        fixed_url = video_url.rstrip('/') + '/video.mp4'
        logger.info(f"Added video.mp4 to URL: {video_url} -> {fixed_url}")
        return fixed_url
    
    def capture_screenshot(self, video_url, timestamp=0, quality=95, crop_area=None):
        """
        Capture a screenshot from a video at a specific timestamp with optional cropping
        
        Args:
            video_url (str): URL of the video to capture from
            timestamp (float): Timestamp in seconds (default: 0 for first frame)
            quality (int): JPEG quality (1-100, default: 95 for maximum quality)
            crop_area (dict): Optional crop area with x, y, width, height (in pixels)
        
        Returns:
            dict: {
                'success': bool,
                'screenshot': str (base64 encoded image),
                'error': str (if any)
            }
        """
        try:
            logger.info(f"Capturing screenshot from {video_url} at timestamp {timestamp}")
            
            # Fix video URL if it's missing file extension
            processed_video_url = self._fix_video_url(video_url)
            logger.info(f"Processed video URL: {processed_video_url}")
            
            # Create temporary file for the screenshot
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False, dir=self.temp_dir) as temp_file:
                screenshot_path = temp_file.name
            
            # Use ffmpeg to capture the frame with optimized settings for speed
            stream = ffmpeg.input(processed_video_url, ss=timestamp)
            stream = ffmpeg.output(stream, screenshot_path, vframes=1, **{
                'q:v': 2,  # Slightly lower quality for faster processing
                'pix_fmt': 'yuv420p',
                'vf': 'scale=640:-1'  # Scale down for faster processing
            })
            
            # Run the ffmpeg command with timeout using subprocess
            import subprocess
            import signal
            
            # Create the ffmpeg command
            cmd = ffmpeg.compile(stream, overwrite_output=True)
            
            # Run with timeout
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=25, check=True)
            except subprocess.TimeoutExpired:
                return {
                    'success': False,
                    'error': 'Screenshot capture timed out'
                }
            except subprocess.CalledProcessError as e:
                return {
                    'success': False,
                    'error': f'FFmpeg error: {e.stderr.decode()}'
                }
            
            # Check if the screenshot was created
            if not os.path.exists(screenshot_path):
                return {
                    'success': False,
                    'error': 'Failed to create screenshot file'
                }
            
            # Read the image and process it
            with open(screenshot_path, 'rb') as f:
                image_data = f.read()
            
            # Apply cropping if crop_area is provided
            if crop_area and isinstance(crop_area, dict):
                try:
                    # Open the image for cropping
                    image = Image.open(io.BytesIO(image_data))
                    img_width, img_height = image.size
                    
                    # Extract crop coordinates (normalized 0-1)
                    x_norm = float(crop_area.get('x', 0))
                    y_norm = float(crop_area.get('y', 0))
                    width_norm = float(crop_area.get('width', 0))
                    height_norm = float(crop_area.get('height', 0))
                    
                    # Convert normalized coordinates to pixel coordinates
                    x = int(x_norm * img_width)
                    y = int(y_norm * img_height)
                    width = int(width_norm * img_width)
                    height = int(height_norm * img_height)
                    
                    # Ensure crop area is within image bounds
                    x = max(0, min(x, img_width - 1))
                    y = max(0, min(y, img_height - 1))
                    width = max(1, min(width, img_width - x))
                    height = max(1, min(height, img_height - y))
                    
                    # Ensure minimum crop size for merchandise compatibility
                    min_width = max(50, int(img_width * 0.1))  # At least 50px or 10% of image width
                    min_height = max(50, int(img_height * 0.1))  # At least 50px or 10% of image height
                    
                    if width < min_width:
                        # Expand width while keeping center
                        center_x = x + width // 2
                        width = min_width
                        x = max(0, center_x - width // 2)
                        x = min(x, img_width - width)
                    
                    if height < min_height:
                        # Expand height while keeping center
                        center_y = y + height // 2
                        height = min_height
                        y = max(0, center_y - height // 2)
                        y = min(y, img_height - height)
                    
                    # Crop the image
                    cropped_image = image.crop((x, y, x + width, y + height))
                    
                    # Resize for frontend screenshot grid compatibility (120x80 container)
                    target_width = 120
                    target_height = 80
                    
                    # Calculate new dimensions while maintaining aspect ratio
                    img_width, img_height = cropped_image.size
                    crop_aspect_ratio = img_width / img_height
                    container_aspect_ratio = target_width / target_height
                    
                    # Always fit to the container dimensions (120x80) to match other screenshots
                    new_width = target_width
                    new_height = target_height
                    
                    # Resize the cropped image while maintaining aspect ratio
                    cropped_image = cropped_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    logger.info(f"Resized cropped image from {img_width}x{img_height} to {new_width}x{new_height} maintaining aspect ratio")
                    
                    # Convert cropped image back to bytes
                    img_buffer = io.BytesIO()
                    cropped_image.save(img_buffer, format='JPEG', quality=quality)
                    image_data = img_buffer.getvalue()
                    
                    logger.info(f"Image cropped successfully: {width}x{height} at ({x},{y}) from normalized coords ({x_norm:.3f},{y_norm:.3f},{width_norm:.3f},{height_norm:.3f})")
                    
                except Exception as crop_error:
                    logger.error(f"Cropping failed: {crop_error}, returning original image")
                    # If cropping fails, continue with original image
            
            # Convert to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Clean up temporary file
            os.unlink(screenshot_path)
            
            logger.info(f"Screenshot captured successfully, size: {len(base64_image)} chars")
            
            return {
                'success': True,
                'screenshot': f"data:image/jpeg;base64,{base64_image}",
                'timestamp': timestamp
            }
                
        except ffmpeg.Error as e:
            error_msg = f"FFmpeg error: {str(e)}"
            logger.error(error_msg)
            # Clean up on error
            if os.path.exists(screenshot_path):
                os.unlink(screenshot_path)
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            # Clean up on error
            if os.path.exists(screenshot_path):
                os.unlink(screenshot_path)
            return {
                'success': False,
                'error': error_msg
            }
    
    def capture_print_quality_screenshot(self, video_url, timestamp=0, crop_area=None, print_dpi=300):
        """
        Capture a high-quality screenshot optimized for print production
        
        Args:
            video_url (str): URL of the video to capture from
            timestamp (float): Timestamp in seconds (default: 0 for first frame)
            crop_area (dict): Optional crop area with x, y, width, height (in pixels)
            print_dpi (int): DPI for print quality (default: 300 for professional print)
        
        Returns:
            dict: {
                'success': bool,
                'screenshot': str (base64 encoded image),
                'error': str (if any),
                'dimensions': dict (width, height),
                'file_size': int (bytes)
            }
        """
        screenshot_path = None  # for safe cleanup in except
        try:
            logger.info(f"Capturing PRINT QUALITY screenshot from {video_url} at timestamp {timestamp}")

            # Reject URLs the server cannot access (blob URLs, data URLs, empty)
            if not video_url or not isinstance(video_url, str) or not video_url.strip():
                return {'success': False, 'error': 'video_url is required and must be a non-empty string'}
            video_url = video_url.strip()
            if video_url.lower().startswith('blob:'):
                return {'success': False, 'error': 'Server cannot access blob URLs. Use a direct video file URL for print-quality upgrade.'}
            if video_url.lower().startswith('data:'):
                return {'success': False, 'error': 'Server cannot use data URLs for print-quality capture. Use a direct video file URL.'}
            
            # Fix video URL if it's missing file extension
            processed_video_url = self._fix_video_url(video_url)
            logger.info(f"Processed video URL: {processed_video_url}")
            
            # Create temporary file for the screenshot
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir=self.temp_dir) as temp_file:
                screenshot_path = temp_file.name
            
            # Use ffmpeg to capture the frame with MAXIMUM quality settings for print
            stream = ffmpeg.input(processed_video_url, ss=timestamp)
            
            # Get video info first to determine optimal settings
            try:
                probe = ffmpeg.probe(processed_video_url)
                video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
                if video_stream:
                    original_width = int(video_stream['width'])
                    original_height = int(video_stream['height'])
                    logger.info(f"Original video dimensions: {original_width}x{original_height}")
                else:
                    original_width, original_height = 1920, 1080  # Default fallback
            except:
                original_width, original_height = 1920, 1080  # Default fallback
            
            # Calculate optimal dimensions for print quality
            # For 300 DPI print, aim for at least 8x10 inches = 2400x3000 pixels
            min_print_width = 2400
            min_print_height = 3000
            
            # Scale up if original is smaller than print requirements
            scale_factor = max(1.0, min_print_width / original_width, min_print_height / original_height)
            target_width = int(original_width * scale_factor)
            target_height = int(original_height * scale_factor)
            
            # Ensure dimensions are even numbers (required for some codecs)
            target_width = target_width + (target_width % 2)
            target_height = target_height + (target_height % 2)
            
            logger.info(f"Print quality dimensions: {target_width}x{target_height} (scale factor: {scale_factor:.2f})")
            
            # Configure ffmpeg for maximum quality
            stream = ffmpeg.output(stream, screenshot_path, vframes=1, **{
                'q:v': 1,  # Highest quality (1-31, where 1 is best)
                'pix_fmt': 'rgb24',  # RGB format for better color accuracy
                'vf': f'scale={target_width}:{target_height}:flags=lanczos',  # High-quality scaling
                'format': 'png'  # PNG for lossless quality
            })
            
            # Run the ffmpeg command with extended timeout for high-quality processing
            import subprocess
            
            cmd = ffmpeg.compile(stream, overwrite_output=True)
            
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=120, check=True)  # Extended timeout to 120s
            except subprocess.TimeoutExpired:
                return {
                    'success': False,
                    'error': 'Print quality screenshot capture timed out (120s limit). The video may be too large or processing is slow.'
                }
            except subprocess.CalledProcessError as e:
                return {
                    'success': False,
                    'error': f'FFmpeg error: {e.stderr.decode()}'
                }
            
            # Check if the screenshot was created
            if not os.path.exists(screenshot_path):
                return {
                    'success': False,
                    'error': 'Failed to create print quality screenshot file'
                }
            
            # Read the image and process it
            with open(screenshot_path, 'rb') as f:
                image_data = f.read()
            
            # Get file size
            file_size = len(image_data)
            
            # Apply cropping if crop_area is provided
            if crop_area and isinstance(crop_area, dict):
                try:
                    # Open the image for cropping
                    image = Image.open(io.BytesIO(image_data))
                    img_width, img_height = image.size
                    
                    # Extract crop coordinates (normalized 0-1)
                    x_norm = float(crop_area.get('x', 0))
                    y_norm = float(crop_area.get('y', 0))
                    width_norm = float(crop_area.get('width', 0))
                    height_norm = float(crop_area.get('height', 0))
                    
                    # Convert normalized coordinates to pixel coordinates
                    x = int(x_norm * img_width)
                    y = int(y_norm * img_height)
                    width = int(width_norm * img_width)
                    height = int(height_norm * img_height)
                    
                    # Ensure crop area is within image bounds
                    x = max(0, min(x, img_width - 1))
                    y = max(0, min(y, img_height - 1))
                    width = max(1, min(width, img_width - x))
                    height = max(1, min(height, img_height - y))
                    
                    # For print quality, ensure minimum dimensions
                    min_print_crop_width = 1200  # 4 inches at 300 DPI
                    min_print_crop_height = 1200  # 4 inches at 300 DPI
                    
                    if width < min_print_crop_width:
                        center_x = x + width // 2
                        width = min_print_crop_width
                        x = max(0, center_x - width // 2)
                        x = min(x, img_width - width)
                    
                    if height < min_print_crop_height:
                        center_y = y + height // 2
                        height = min_print_crop_height
                        y = max(0, center_y - height // 2)
                        y = min(y, img_height - height)
                    
                    # Crop the image
                    cropped_image = image.crop((x, y, x + width, y + height))
                    
                    # Convert cropped image back to bytes with maximum quality
                    img_buffer = io.BytesIO()
                    cropped_image.save(img_buffer, format='PNG', optimize=False, compress_level=0)  # No compression for max quality
                    image_data = img_buffer.getvalue()
                    file_size = len(image_data)
                    
                    final_width, final_height = cropped_image.size
                    logger.info(f"Print quality image cropped: {final_width}x{final_height} at ({x},{y})")
                    
                except Exception as crop_error:
                    logger.error(f"Print quality cropping failed: {crop_error}, returning original image")
                    # If cropping fails, continue with original image
                    image = Image.open(io.BytesIO(image_data))
                    final_width, final_height = image.size
            else:
                # No cropping, get original dimensions
                image = Image.open(io.BytesIO(image_data))
                final_width, final_height = image.size
            
            # Convert to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Clean up temporary file
            os.unlink(screenshot_path)
            
            logger.info(f"Print quality screenshot captured: {final_width}x{final_height}, {file_size:,} bytes")
            
            return {
                'success': True,
                'screenshot': f"data:image/png;base64,{base64_image}",
                'timestamp': timestamp,
                'dimensions': {
                    'width': final_width,
                    'height': final_height,
                    'dpi': print_dpi
                },
                'file_size': file_size,
                'format': 'PNG',
                'quality': 'Print Ready'
            }
                
        except ffmpeg.Error as e:
            error_msg = f"FFmpeg error: {str(e)}"
            logger.error(error_msg)
            if screenshot_path and os.path.exists(screenshot_path):
                try:
                    os.unlink(screenshot_path)
                except OSError:
                    pass
            return {'success': False, 'error': error_msg}
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"Print quality capture failed: {error_msg}", exc_info=True)
            if screenshot_path and os.path.exists(screenshot_path):
                try:
                    os.unlink(screenshot_path)
                except OSError:
                    pass
            return {'success': False, 'error': error_msg}

    def process_uploaded_image_for_print_quality(self, image_file, print_dpi=300, crop_area=None):
        """
        Process an uploaded image file for print quality generation
        
        Args:
            image_file: Uploaded image file (Flask FileStorage object)
            print_dpi (int): DPI for print quality (default: 300)
            crop_area (dict): Optional crop area with x, y, width, height (normalized 0-1)
        
        Returns:
            dict: {
                'success': bool,
                'screenshot': str (base64 encoded image),
                'error': str (if any),
                'dimensions': dict (width, height),
                'file_size': int (bytes)
            }
        """
        try:
            logger.info(f"Processing uploaded image for print quality: {image_file.filename}, DPI: {print_dpi}")
            
            # Read the uploaded image
            image_data = image_file.read()
            image_file.seek(0)  # Reset file pointer
            
            # Open image with PIL
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            original_width, original_height = image.size
            logger.info(f"Original image dimensions: {original_width}x{original_height}")
            
            # Calculate optimal dimensions for print quality
            # For 300 DPI print, aim for at least 8x10 inches = 2400x3000 pixels
            min_print_width = 2400
            min_print_height = 3000
            
            # Check if image is already at print quality (within 10% tolerance to avoid unnecessary resizing)
            # This prevents quality loss from re-processing images that are already at print quality
            is_already_print_quality = (
                original_width >= min_print_width * 0.9 and 
                original_height >= min_print_height * 0.9
            )
            
            if is_already_print_quality:
                logger.info(f"Image is already at print quality ({original_width}x{original_height}), skipping resize to preserve quality")
                target_width = original_width
                target_height = original_height
                scale_factor = 1.0
            else:
                # Scale up if original is smaller than print requirements
                scale_factor = max(1.0, min_print_width / original_width, min_print_height / original_height)
                target_width = int(original_width * scale_factor)
                target_height = int(original_height * scale_factor)
                
                # Ensure dimensions are even numbers (required for some codecs)
                target_width = target_width + (target_width % 2)
                target_height = target_height + (target_height % 2)
                
                logger.info(f"Print quality dimensions: {target_width}x{target_height} (scale factor: {scale_factor:.2f})")
                
                # Only resize if we need to scale up (avoid downscaling high-res images)
                if scale_factor > 1.0:
                    # Use high-quality resampling for upscaling
                    image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
                else:
                    # Image is larger than target, but we'll keep original size to preserve quality
                    target_width = original_width
                    target_height = original_height
                    logger.info(f"Image is larger than target, keeping original dimensions to preserve quality")
            
            # Apply cropping if specified
            if crop_area and isinstance(crop_area, dict):
                try:
                    # Extract crop coordinates (normalized 0-1)
                    x_norm = float(crop_area.get('x', 0))
                    y_norm = float(crop_area.get('y', 0))
                    width_norm = float(crop_area.get('width', 0))
                    height_norm = float(crop_area.get('height', 0))
                    
                    # Convert normalized coordinates to pixel coordinates
                    x = int(x_norm * target_width)
                    y = int(y_norm * target_height)
                    width = int(width_norm * target_width)
                    height = int(height_norm * target_height)
                    
                    # Ensure crop area is within image bounds
                    x = max(0, min(x, target_width - 1))
                    y = max(0, min(y, target_height - 1))
                    width = max(1, min(width, target_width - x))
                    height = max(1, min(height, target_height - y))
                    
                    # For print quality, ensure minimum dimensions
                    min_print_crop_width = 1200  # 4 inches at 300 DPI
                    min_print_crop_height = 1200  # 4 inches at 300 DPI
                    
                    if width < min_print_crop_width:
                        center_x = x + width // 2
                        width = min_print_crop_width
                        x = max(0, center_x - width // 2)
                        x = min(x, target_width - width)
                    
                    if height < min_print_crop_height:
                        center_y = y + height // 2
                        height = min_print_crop_height
                        y = max(0, center_y - height // 2)
                        y = min(y, target_height - height)
                    
                    # Crop the image
                    image = image.crop((x, y, x + width, y + height))
                    logger.info(f"Applied crop: {x},{y} to {x+width},{y+height}")
                    
                except Exception as crop_error:
                    logger.warning(f"Crop failed, using full image: {str(crop_error)}")
            
            # Get final dimensions
            final_width, final_height = image.size
            
            # Save as high-quality PNG
            output_buffer = io.BytesIO()
            image.save(output_buffer, format='PNG', optimize=True)
            processed_image_data = output_buffer.getvalue()
            
            # Get file size
            file_size = len(processed_image_data)
            
            # Convert to base64
            base64_image = base64.b64encode(processed_image_data).decode('utf-8')
            
            logger.info(f"Print quality image processed: {final_width}x{final_height}, {file_size:,} bytes")
            
            return {
                'success': True,
                'screenshot': f"data:image/png;base64,{base64_image}",
                'dimensions': {
                    'width': final_width,
                    'height': final_height,
                    'dpi': print_dpi
                },
                'file_size': file_size,
                'format': 'PNG',
                'quality': 'Print Ready'
            }
                
        except Exception as e:
            error_msg = f"Image processing error: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }

    def process_screenshot_data_for_print_quality(self, screenshot_data, print_dpi=300, crop_area=None, soft_corners=False, edge_feather=False):
        """
        Process screenshot data (base64) for print quality generation
        
        Args:
            screenshot_data (str): Base64 encoded screenshot data
            print_dpi (int): DPI for print quality (default: 300)
            crop_area (dict): Optional crop area with x, y, width, height (normalized 0-1)
            soft_corners (bool): Whether to apply soft rounded corners (default: False)
            edge_feather (bool): Whether to apply extreme edge feathering (default: False)
        
        Returns:
            dict: {
                'success': bool,
                'screenshot': str (base64 encoded image),
                'error': str (if any),
                'dimensions': dict (width, height),
                'file_size': int (bytes)
            }
        """
        try:
            logger.info(f"Processing screenshot data for print quality, DPI: {print_dpi}")
            
            # Handle different input types
            if hasattr(screenshot_data, 'read'):
                # If it's a file-like object (BytesIO), read the data
                image_bytes = screenshot_data.read()
                screenshot_data.seek(0)  # Reset file pointer
            elif isinstance(screenshot_data, str):
                # If it's a string, treat it as base64
                if screenshot_data.startswith('data:image'):
                    # Remove data URL prefix
                    screenshot_data = screenshot_data.split(',')[1]
                image_bytes = base64.b64decode(screenshot_data)
            else:
                # If it's already bytes
                image_bytes = screenshot_data
            
            # Open image with PIL
            try:
                image = Image.open(io.BytesIO(image_bytes))
            except Exception as pil_error:
                logger.error(f"PIL image opening failed: {str(pil_error)}")
                return {
                    'success': False,
                    'error': f"Invalid image format: {str(pil_error)}"
                }
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            original_width, original_height = image.size
            logger.info(f"Original screenshot dimensions: {original_width}x{original_height}")
            
            # Calculate optimal dimensions for print quality
            # For 300 DPI print, aim for at least 8x10 inches = 2400x3000 pixels
            min_print_width = 2400
            min_print_height = 3000
            
            # Scale up if original is smaller than print requirements
            scale_factor = max(1.0, min_print_width / original_width, min_print_height / original_height)
            target_width = int(original_width * scale_factor)
            target_height = int(original_height * scale_factor)
            
            # Ensure dimensions are even numbers (required for some codecs)
            target_width = target_width + (target_width % 2)
            target_height = target_height + (target_height % 2)
            
            logger.info(f"Print quality dimensions: {target_width}x{target_height} (scale factor: {scale_factor:.2f})")
            
            # Resize image for print quality
            if scale_factor > 1.0:
                # Use high-quality resampling for upscaling
                image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Apply cropping if specified
            if crop_area and isinstance(crop_area, dict):
                try:
                    # Extract crop coordinates (normalized 0-1)
                    x_norm = float(crop_area.get('x', 0))
                    y_norm = float(crop_area.get('y', 0))
                    width_norm = float(crop_area.get('width', 0))
                    height_norm = float(crop_area.get('height', 0))
                    
                    # Convert normalized coordinates to pixel coordinates
                    x = int(x_norm * target_width)
                    y = int(y_norm * target_height)
                    width = int(width_norm * target_width)
                    height = int(height_norm * target_height)
                    
                    # Ensure crop area is within image bounds
                    x = max(0, min(x, target_width - 1))
                    y = max(0, min(y, target_height - 1))
                    width = max(1, min(width, target_width - x))
                    height = max(1, min(height, target_height - y))
                    
                    # For print quality, ensure minimum dimensions
                    min_print_crop_width = 1200  # 4 inches at 300 DPI
                    min_print_crop_height = 1200  # 4 inches at 300 DPI
                    
                    if width < min_print_crop_width:
                        center_x = x + width // 2
                        width = min_print_crop_width
                        x = max(0, center_x - width // 2)
                        x = min(x, target_width - width)
                    
                    if height < min_print_crop_height:
                        center_y = y + height // 2
                        height = min_print_crop_height
                        y = max(0, center_y - height // 2)
                        y = min(y, target_height - height)
                    
                    # Crop the image
                    image = image.crop((x, y, x + width, y + height))
                    logger.info(f"Applied crop: {x},{y} to {x+width},{y+height}")
                    
                except Exception as crop_error:
                    logger.warning(f"Crop failed, using full image: {str(crop_error)}")
            
            # Get final dimensions
            final_width, final_height = image.size
            
            # Apply image enhancements if requested
            if soft_corners or edge_feather:
                logger.info(f"Applying enhancements: soft_corners={soft_corners}, edge_feather={edge_feather}")
                
                # Convert to RGBA for transparency support
                if image.mode != 'RGBA':
                    image = image.convert('RGBA')
                
                # Apply soft corners if requested
                if soft_corners:
                    # Create rounded corners with radius based on image size (more visible)
                    corner_radius = min(final_width, final_height) // 20  # 5% of smallest dimension (MUCH smaller radius)
                    logger.info(f"Applying soft corners with radius: {corner_radius} for image size: {final_width}x{final_height}")
                    image = self._apply_rounded_corners(image, corner_radius)
                
                # Apply extreme edge feathering if requested
                if edge_feather:
                    # Use extreme feather radius for clearly visible effect (reduced by 10% more)
                    feather_radius = min(final_width, final_height) // 3  # 33.3% of smallest dimension (EXTREMELY visible feather effect)
                    image = self._apply_extreme_feathering(image, feather_radius)
            
            # Save as high-quality PNG
            output_buffer = io.BytesIO()
            image.save(output_buffer, format='PNG', optimize=True)
            processed_image_data = output_buffer.getvalue()
            
            # Get file size
            file_size = len(processed_image_data)
            
            # Convert to base64
            base64_image = base64.b64encode(processed_image_data).decode('utf-8')
            
            logger.info(f"Print quality screenshot processed: {final_width}x{final_height}, {file_size:,} bytes")
            
            return {
                'success': True,
                'screenshot': f"data:image/png;base64,{base64_image}",
                'dimensions': {
                    'width': final_width,
                    'height': final_height,
                    'dpi': print_dpi
                },
                'file_size': file_size,
                'format': 'PNG',
                'quality': 'Print Ready'
            }
                
        except Exception as e:
            error_msg = f"Screenshot processing error: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }

    def create_shirt_ready_image(self, image_data, feather_radius=38, enhance_quality=True):
        """
        Process an image to be shirt-print ready with feathered edges
        
        Args:
            image_data (str): Base64 encoded image data
            feather_radius (int): Radius for edge feathering (default: 38)
            enhance_quality (bool): Whether to enhance image quality (default: True)
        
        Returns:
            str: Base64 encoded processed image
        """
        try:
            # Decode base64 image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGBA if not already
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Create a mask for feathering
            mask = Image.new('L', image.size, 0)
            
            # Create a gradient mask for smooth edges
            for y in range(image.size[1]):
                for x in range(image.size[0]):
                    # Calculate distance from edge
                    dist_x = min(x, image.size[0] - x - 1)
                    dist_y = min(y, image.size[1] - y - 1)
                    dist = min(dist_x, dist_y)
                    
                    # Apply feathering
                    if dist < feather_radius:
                        alpha = int(255 * (dist / feather_radius))
                        mask.putpixel((x, y), alpha)
                    else:
                        mask.putpixel((x, y), 255)
            
            # Apply the mask to the image
            image.putalpha(mask)
            
            # Enhance quality if requested
            if enhance_quality:
                # Sharpen the image slightly
                enhancer = ImageEnhance.Sharpness(image)
                image = enhancer.enhance(1.2)
                
                # Enhance contrast slightly
                enhancer = ImageEnhance.Contrast(image)
                image = enhancer.enhance(1.1)
            
            # Convert back to base64
            buffer = io.BytesIO()
            image.save(buffer, format='PNG', optimize=True, quality=95)
            processed_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return f"data:image/png;base64,{processed_image}"
            
        except Exception as e:
            logger.error(f"Error processing shirt image: {str(e)}")
            return image_data  # Return original if processing fails
    
    def capture_multiple_screenshots(self, video_url, timestamps=None, quality=95):
        """
        Capture multiple screenshots from a video at different timestamps
        
        Args:
            video_url (str): URL of the video to capture from
            timestamps (list): List of timestamps in seconds (default: [0, 2, 4, 6, 8])
            quality (int): JPEG quality (1-100, default: 85)
        
        Returns:
            dict: {
                'success': bool,
                'screenshots': list of base64 encoded images,
                'error': str (if any)
            }
        """
        if timestamps is None:
            timestamps = [0, 2, 4, 6, 8]  # Default timestamps
        
        screenshots = []
        errors = []
        
        for timestamp in timestamps:
            result = self.capture_screenshot(video_url, timestamp, quality)
            if result['success']:
                screenshots.append(result['screenshot'])
            else:
                errors.append(f"Timestamp {timestamp}: {result['error']}")
        
        if screenshots:
            return {
                'success': True,
                'screenshots': screenshots,
                'timestamps': timestamps,
                'errors': errors if errors else None
            }
        else:
            return {
                'success': False,
                'error': f"Failed to capture any screenshots. Errors: {errors}"
            }
    
    def get_video_info(self, video_url):
        """
        Get video information including duration and dimensions
        
        Args:
            video_url (str): URL of the video
        
        Returns:
            dict: Video information
        """
        try:
            probe = ffmpeg.probe(video_url)
            video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
            
            if video_stream:
                duration = float(probe['format']['duration'])
                width = int(video_stream['width'])
                height = int(video_stream['height'])
                
                return {
                    'success': True,
                    'duration': duration,
                    'width': width,
                    'height': height,
                    'format': probe['format']['format_name']
                }
            else:
                return {
                    'success': False,
                    'error': 'No video stream found'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get video info: {str(e)}"
            }
    
    def _apply_rounded_corners(self, image, radius):
        """Apply rounded corners to an image"""
        try:
            from PIL import ImageDraw
            logger.info(f"Creating rounded corners mask with radius: {radius} for image size: {image.size}")
            
            # Ensure radius is not too large
            max_radius = min(image.size) // 2
            if radius > max_radius:
                radius = max_radius
                logger.info(f"Adjusted radius to maximum: {radius}")
            
            # Create a mask for rounded corners
            mask = Image.new('L', image.size, 0)
            draw = ImageDraw.Draw(mask)
            
            # Draw rounded rectangle mask - ensure we use the full image dimensions
            width, height = image.size
            draw.rounded_rectangle([0, 0, width, height], radius=radius, fill=255)
            
            # Apply the mask to the alpha channel
            image.putalpha(mask)
            logger.info(f"Successfully applied rounded corners with radius: {radius} to {width}x{height} image")
            return image
        except Exception as e:
            logger.error(f"Error applying rounded corners: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return image
    
    def _apply_extreme_feathering(self, image, feather_radius):
        """Apply extreme edge feathering for clearly visible effect"""
        try:
            # Create a mask for feathering
            mask = Image.new('L', image.size, 0)
            
            # Create a gradient mask for smooth edges with extreme feathering
            for y in range(image.size[1]):
                for x in range(image.size[0]):
                    # Calculate distance from edge
                    dist_x = min(x, image.size[0] - x - 1)
                    dist_y = min(y, image.size[1] - y - 1)
                    dist = min(dist_x, dist_y)
                    
                    # Apply extreme feathering - much more aggressive than before
                    if dist < feather_radius:
                        # Use a much more gradual falloff for EXTREMELY visible effect
                        alpha = int(255 * (dist / feather_radius) ** 0.3)  # Even more gradual falloff for dramatic effect
                        mask.putpixel((x, y), alpha)
                    else:
                        mask.putpixel((x, y), 255)
            
            # Apply the mask to the image
            image.putalpha(mask)
            return image
        except Exception as e:
            logger.error(f"Error applying extreme feathering: {e}")
            return image

    def cleanup(self):
        """Clean up temporary files"""
        try:
            import shutil
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.error(f"Error cleaning up: {e}")
    
    def process_thumbnail_for_print(self, image_data, print_dpi=300, soft_corners=False, edge_feather=False, crop_area=None, corner_radius_percent=0, feather_edge_percent=0, frame_enabled=False, frame_color='#FF0000', frame_width=10, double_frame=False, add_white_background=False, print_area_width=None, print_area_height=None):
        """Process a thumbnail image for print quality output"""
        try:
            # Import the function from the screenshot_capture module
            import screenshot_capture as sc_module
            return sc_module.process_thumbnail_for_print(
                image_data, 
                print_dpi=print_dpi, 
                soft_corners=soft_corners, 
                edge_feather=edge_feather, 
                crop_area=crop_area,
                corner_radius_percent=corner_radius_percent,
                feather_edge_percent=feather_edge_percent,
                frame_enabled=frame_enabled,
                frame_color=frame_color,
                frame_width=frame_width,
                double_frame=double_frame,
                add_white_background=add_white_background,
                print_area_width=print_area_width,
                print_area_height=print_area_height
            )
        except Exception as e:
            logger.error(f"Error processing thumbnail for print: {str(e)}")
            return {"success": False, "error": f"Failed to process thumbnail: {str(e)}"}

# Global instance
screenshot_capture = VideoScreenshotCapture() 