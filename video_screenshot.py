import ffmpeg
import base64
import tempfile
import os
import logging
from PIL import Image
import io
import requests
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class VideoScreenshotCapture:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        logger.info(f"Video screenshot capture initialized with temp dir: {self.temp_dir}")
    
    def capture_screenshot(self, video_url, timestamp=0, quality=85):
        """
        Capture a screenshot from a video at a specific timestamp
        
        Args:
            video_url (str): URL of the video to capture from
            timestamp (float): Timestamp in seconds (default: 0 for first frame)
            quality (int): JPEG quality (1-100, default: 85)
        
        Returns:
            dict: {
                'success': bool,
                'screenshot': str (base64 encoded image),
                'error': str (if any)
            }
        """
        try:
            logger.info(f"Capturing screenshot from {video_url} at timestamp {timestamp}")
            
            # Create temporary file for the screenshot
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False, dir=self.temp_dir) as temp_file:
                screenshot_path = temp_file.name
            
            try:
                # Use ffmpeg to capture the frame
                stream = ffmpeg.input(video_url, ss=timestamp)
                stream = ffmpeg.output(stream, screenshot_path, vframes=1, **{'q:v': 2})
                
                # Run the ffmpeg command
                ffmpeg.run(stream, overwrite_output=True, quiet=True)
                
                # Check if the screenshot was created
                if not os.path.exists(screenshot_path):
                    return {
                        'success': False,
                        'error': 'Failed to create screenshot file'
                    }
                
                # Read the image and convert to base64
                with open(screenshot_path, 'rb') as f:
                    image_data = f.read()
                
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
                
            except Exception as e:
                # Clean up on error
                if os.path.exists(screenshot_path):
                    os.unlink(screenshot_path)
                raise e
                
        except ffmpeg.Error as e:
            error_msg = f"FFmpeg error: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
    
    def capture_multiple_screenshots(self, video_url, timestamps=None, quality=85):
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
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            import shutil
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.error(f"Error cleaning up: {e}")

# Global instance
screenshot_capture = VideoScreenshotCapture() 