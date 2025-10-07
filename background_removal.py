#!/usr/bin/env python3
"""
Advanced White Background Removal System
Removes white backgrounds from images and creates transparent backgrounds
"""

import cv2
import numpy as np
import base64
import io
from PIL import Image, ImageFilter, ImageEnhance
import logging

logger = logging.getLogger(__name__)

class BackgroundRemover:
    """Advanced background removal with multiple algorithms"""
    
    def __init__(self):
        self.white_threshold = 240  # Pixels above this are considered white
        self.tolerance = 30  # Color tolerance for white detection
        
    def remove_white_background_advanced(self, image_data, method="adaptive", feather_edges=True):
        """
        Remove white background using advanced algorithms
        
        Args:
            image_data: Base64 encoded image data
            method: "adaptive", "threshold", "color_range", or "edge_detection"
            feather_edges: Whether to feather edges for smooth blending
            
        Returns:
            Base64 encoded image with transparent background
        """
        try:
            # Decode image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGBA for transparency support
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Convert to numpy array for processing
            img_array = np.array(image)
            
            if method == "adaptive":
                mask = self._create_adaptive_mask(img_array)
            elif method == "threshold":
                mask = self._create_threshold_mask(img_array)
            elif method == "color_range":
                mask = self._create_color_range_mask(img_array)
            elif method == "edge_detection":
                mask = self._create_edge_detection_mask(img_array)
            else:
                mask = self._create_adaptive_mask(img_array)
            
            # Apply feathering if requested
            if feather_edges:
                mask = self._feather_mask(mask)
            
            # Apply mask to create transparency
            img_array[:, :, 3] = mask
            
            # Convert back to PIL Image
            result_image = Image.fromarray(img_array, 'RGBA')
            
            # Convert back to base64
            buffer = io.BytesIO()
            result_image.save(buffer, format='PNG')  # PNG supports transparency
            buffer.seek(0)
            
            result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{result_data}"
            
        except Exception as e:
            logger.error(f"Error removing background: {str(e)}")
            raise
    
    def _create_adaptive_mask(self, img_array):
        """Create mask using adaptive white detection"""
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(img_array[:, :, :3], cv2.COLOR_RGB2GRAY)
        
        # Create mask for white/light areas
        mask = np.ones(gray.shape, dtype=np.uint8) * 255
        
        # Adaptive thresholding for white detection
        # Look for pixels that are very bright and have low color variance
        bright_pixels = gray > self.white_threshold
        
        # Check color variance (white areas have low variance)
        color_variance = np.var(img_array[:, :, :3], axis=2)
        low_variance = color_variance < 50  # Low color variance indicates white
        
        # Combine conditions
        white_mask = bright_pixels & low_variance
        
        # Set white areas to transparent
        mask[white_mask] = 0
        
        return mask
    
    def _create_threshold_mask(self, img_array):
        """Create mask using simple threshold"""
        gray = cv2.cvtColor(img_array[:, :, :3], cv2.COLOR_RGB2GRAY)
        
        # Create mask - white areas become transparent
        _, mask = cv2.threshold(gray, self.white_threshold, 255, cv2.THRESH_BINARY_INV)
        
        return mask
    
    def _create_color_range_mask(self, img_array):
        """Create mask using color range detection"""
        # Define white color range
        lower_white = np.array([self.white_threshold, self.white_threshold, self.white_threshold])
        upper_white = np.array([255, 255, 255])
        
        # Create mask for white color range
        mask = cv2.inRange(img_array[:, :, :3], lower_white, upper_white)
        
        # Invert mask (white areas become transparent)
        mask = cv2.bitwise_not(mask)
        
        return mask
    
    def _create_edge_detection_mask(self, img_array):
        """Create mask using edge detection to preserve object boundaries"""
        gray = cv2.cvtColor(img_array[:, :, :3], cv2.COLOR_RGB2GRAY)
        
        # Detect edges
        edges = cv2.Canny(gray, 50, 150)
        
        # Dilate edges to create boundaries
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)
        
        # Create mask based on edges and brightness
        bright_mask = gray > self.white_threshold
        edge_mask = edges > 0
        
        # Combine: keep areas that are not bright white or are near edges
        mask = np.ones(gray.shape, dtype=np.uint8) * 255
        mask[bright_mask & ~edge_mask] = 0
        
        return mask
    
    def _feather_mask(self, mask, feather_radius=5):
        """Apply feathering to mask edges for smooth transitions"""
        # Apply Gaussian blur to feather edges
        feathered = cv2.GaussianBlur(mask, (feather_radius * 2 + 1, feather_radius * 2 + 1), feather_radius)
        return feathered
    
    def remove_background_batch(self, image_data_list, method="adaptive"):
        """Remove backgrounds from multiple images"""
        results = []
        
        for image_data in image_data_list:
            try:
                result = self.remove_white_background_advanced(image_data, method)
                results.append({
                    "success": True,
                    "image_data": result
                })
            except Exception as e:
                results.append({
                    "success": False,
                    "error": str(e)
                })
        
        return results
    
    def enhance_transparency(self, image_data, contrast_boost=1.2, saturation_boost=1.1):
        """Enhance image after background removal"""
        try:
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(contrast_boost)
            
            # Enhance saturation (only RGB channels)
            rgb_image = image.convert('RGB')
            enhancer = ImageEnhance.Color(rgb_image)
            rgb_image = enhancer.enhance(saturation_boost)
            
            # Convert back to RGBA and restore alpha channel
            result = Image.new('RGBA', image.size)
            result.paste(rgb_image, (0, 0))
            result.putalpha(image.getchannel('A'))
            
            # Convert back to base64
            buffer = io.BytesIO()
            result.save(buffer, format='PNG')
            buffer.seek(0)
            
            result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{result_data}"
            
        except Exception as e:
            logger.error(f"Error enhancing transparency: {str(e)}")
            raise

# Global instance
background_remover = BackgroundRemover()

def remove_white_background(image_data, method="adaptive", feather_edges=True):
    """Convenience function for background removal"""
    return background_remover.remove_white_background_advanced(image_data, method, feather_edges)

def enhance_transparent_image(image_data, contrast_boost=1.2, saturation_boost=1.1):
    """Convenience function for enhancing transparent images"""
    return background_remover.enhance_transparency(image_data, contrast_boost, saturation_boost)

def batch_remove_backgrounds(image_data_list, method="adaptive"):
    """Convenience function for batch background removal"""
    return background_remover.remove_background_batch(image_data_list, method)
