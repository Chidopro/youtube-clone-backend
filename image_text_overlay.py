import os
import base64
import io
import uuid
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math
from typing import Dict, List, Tuple, Optional, Union
import logging

logger = logging.getLogger(__name__)

class ImageTextOverlay:
    """Stylish image text overlay with multiple effects and customization options"""
    
    def __init__(self):
        self.default_font_size = 48
        self.default_font_color = (255, 255, 255)  # White
        self.default_stroke_color = (0, 0, 0)      # Black
        self.default_stroke_width = 2
        
    def add_text_overlay(self, 
                         image_data: str, 
                         text: str,
                         position: str = "center",
                         font_size: int = None,
                         font_color: Tuple[int, int, int] = None,
                         stroke_color: Tuple[int, int, int] = None,
                         stroke_width: int = None,
                         style: str = "modern",
                         opacity: float = 1.0,
                         rotation: float = 0,
                         shadow: bool = False,
                         glow: bool = False,
                         background: bool = False,
                         background_color: Tuple[int, int, int] = None,
                         background_opacity: float = 0.7) -> str:
        """
        Add stylish text overlay to an image
        
        Args:
            image_data: Base64 encoded image data
            text: Text to overlay
            position: Position on image ("top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right")
            font_size: Font size in pixels
            font_color: RGB color tuple for text
            stroke_color: RGB color tuple for text stroke
            stroke_width: Width of text stroke
            style: Text style ("modern", "vintage", "bold", "elegant", "fun", "minimal")
            opacity: Text opacity (0.0 to 1.0)
            rotation: Text rotation in degrees
            shadow: Whether to add shadow effect
            glow: Whether to add glow effect
            background: Whether to add background behind text
            background_color: RGB color tuple for background
            background_opacity: Background opacity (0.0 to 1.0)
            
        Returns:
            Base64 encoded image with text overlay
        """
        try:
            # Decode image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGBA if needed
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Create a copy for drawing
            overlay_image = image.copy()
            draw = ImageDraw.Draw(overlay_image)
            
            # Set default values
            font_size = font_size or self.default_font_size
            font_color = font_color or self.default_font_color
            stroke_color = stroke_color or self.default_stroke_color
            stroke_width = stroke_width or self.default_stroke_width
            
            # Get font based on style
            font = self._get_font(font_size, style)
            
            # Calculate text position
            text_bbox = draw.textbbox((0, 0), text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            # Calculate position
            x, y = self._calculate_position(position, image.size, text_width, text_height)
            
            # Create background if requested
            if background:
                background_color = background_color or (0, 0, 0)
                padding = 20
                bg_rect = [
                    x - padding,
                    y - padding,
                    x + text_width + padding,
                    y + text_height + padding
                ]
                
                # Create background with opacity
                bg_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
                bg_draw = ImageDraw.Draw(bg_layer)
                bg_draw.rectangle(bg_rect, fill=background_color + (int(255 * background_opacity),))
                
                # Apply rounded corners
                bg_layer = self._apply_rounded_corners(bg_layer, bg_rect, 10)
                overlay_image = Image.alpha_composite(overlay_image, bg_layer)
                draw = ImageDraw.Draw(overlay_image)
            
            # Apply effects
            if shadow:
                self._add_shadow(draw, text, x, y, font, font_color)
            
            if glow:
                self._add_glow(draw, text, x, y, font, font_color)
            
            # Draw main text
            if rotation != 0:
                # Create rotated text
                text_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
                text_draw = ImageDraw.Draw(text_layer)
                text_draw.text((x, y), text, font=font, fill=font_color, stroke_width=stroke_width, stroke_fill=stroke_color)
                
                # Rotate the text layer
                rotated_text = text_layer.rotate(rotation, expand=True, fillcolor=(0, 0, 0, 0))
                
                # Calculate new position for rotated text
                rot_x = x - (rotated_text.width - text_width) // 2
                rot_y = y - (rotated_text.height - text_height) // 2
                
                # Paste rotated text
                overlay_image.paste(rotated_text, (rot_x, rot_y), rotated_text)
            else:
                # Draw text with stroke
                draw.text((x, y), text, font=font, fill=font_color, stroke_width=stroke_width, stroke_fill=stroke_color)
            
            # Apply opacity if needed
            if opacity < 1.0:
                overlay_image = self._apply_opacity(overlay_image, opacity)
            
            # Convert back to base64
            buffer = io.BytesIO()
            overlay_image.save(buffer, format='PNG')
            buffer.seek(0)
            
            result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{result_data}"
            
        except Exception as e:
            logger.error(f"Error adding text overlay: {str(e)}")
            raise
    
    def add_multiple_text_overlays(self, 
                                  image_data: str, 
                                  text_elements: List[Dict]) -> str:
        """
        Add multiple text overlays to an image
        
        Args:
            image_data: Base64 encoded image data
            text_elements: List of dictionaries containing text overlay parameters
            
        Returns:
            Base64 encoded image with multiple text overlays
        """
        try:
            # Decode image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGBA if needed
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Create a copy for drawing
            overlay_image = image.copy()
            draw = ImageDraw.Draw(overlay_image)
            
            # Add each text element
            for element in text_elements:
                text = element.get('text', '')
                position = element.get('position', 'center')
                font_size = element.get('font_size', self.default_font_size)
                font_color = element.get('font_color', self.default_font_color)
                stroke_color = element.get('stroke_color', self.default_stroke_color)
                stroke_width = element.get('stroke_width', self.default_stroke_width)
                style = element.get('style', 'modern')
                opacity = element.get('opacity', 1.0)
                rotation = element.get('rotation', 0)
                shadow = element.get('shadow', False)
                glow = element.get('glow', False)
                background = element.get('background', False)
                background_color = element.get('background_color')
                background_opacity = element.get('background_opacity', 0.7)
                
                # Get font
                font = self._get_font(font_size, style)
                
                # Calculate text position
                text_bbox = draw.textbbox((0, 0), text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                
                # Calculate position
                x, y = self._calculate_position(position, image.size, text_width, text_height)
                
                # Apply effects
                if shadow:
                    self._add_shadow(draw, text, x, y, font, font_color)
                
                if glow:
                    self._add_glow(draw, text, x, y, font, font_color)
                
                # Draw text
                draw.text((x, y), text, font=font, fill=font_color, stroke_width=stroke_width, stroke_fill=stroke_color)
            
            # Convert back to base64
            buffer = io.BytesIO()
            overlay_image.save(buffer, format='PNG')
            buffer.seek(0)
            
            result_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{result_data}"
            
        except Exception as e:
            logger.error(f"Error adding multiple text overlays: {str(e)}")
            raise
    
    def _get_font(self, font_size: int, style: str) -> ImageFont.FreeTypeFont:
        """Get font based on style"""
        try:
            # Try to load system fonts
            font_paths = [
                "/System/Library/Fonts/Arial.ttf",  # macOS
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
                "C:/Windows/Fonts/arial.ttf",  # Windows
                "C:/Windows/Fonts/calibri.ttf",  # Windows
            ]
            
            font_path = None
            for path in font_paths:
                if os.path.exists(path):
                    font_path = path
                    break
            
            if font_path:
                return ImageFont.truetype(font_path, font_size)
            else:
                # Fallback to default font
                return ImageFont.load_default()
                
        except Exception as e:
            logger.warning(f"Could not load custom font: {str(e)}")
            return ImageFont.load_default()
    
    def _calculate_position(self, position: str, image_size: Tuple[int, int], text_width: int, text_height: int) -> Tuple[int, int]:
        """Calculate text position based on position string"""
        img_width, img_height = image_size
        
        if position == "center":
            x = (img_width - text_width) // 2
            y = (img_height - text_height) // 2
        elif position == "top":
            x = (img_width - text_width) // 2
            y = 50
        elif position == "bottom":
            x = (img_width - text_width) // 2
            y = img_height - text_height - 50
        elif position == "top-left":
            x = 50
            y = 50
        elif position == "top-right":
            x = img_width - text_width - 50
            y = 50
        elif position == "bottom-left":
            x = 50
            y = img_height - text_height - 50
        elif position == "bottom-right":
            x = img_width - text_width - 50
            y = img_height - text_height - 50
        else:
            # Default to center
            x = (img_width - text_width) // 2
            y = (img_height - text_height) // 2
        
        return x, y
    
    def _add_shadow(self, draw: ImageDraw.Draw, text: str, x: int, y: int, font: ImageFont.FreeTypeFont, color: Tuple[int, int, int]):
        """Add shadow effect to text"""
        shadow_offset = 3
        shadow_color = (0, 0, 0, 128)  # Semi-transparent black
        
        # Create shadow layer
        shadow_layer = Image.new('RGBA', draw.im.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        shadow_draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)
        
        # Apply blur to shadow
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=2))
        
        # Composite shadow onto main image
        draw.im.paste(shadow_layer, (0, 0), shadow_layer)
    
    def _add_glow(self, draw: ImageDraw.Draw, text: str, x: int, y: int, font: ImageFont.FreeTypeFont, color: Tuple[int, int, int]):
        """Add glow effect to text"""
        glow_radius = 5
        glow_color = color + (128,)  # Semi-transparent version of text color
        
        # Create glow layer
        glow_layer = Image.new('RGBA', draw.im.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_layer)
        
        # Draw multiple layers for glow effect
        for i in range(glow_radius):
            offset = i * 2
            glow_draw.text((x - offset, y - offset), text, font=font, fill=glow_color)
            glow_draw.text((x + offset, y - offset), text, font=font, fill=glow_color)
            glow_draw.text((x - offset, y + offset), text, font=font, fill=glow_color)
            glow_draw.text((x + offset, y + offset), text, font=font, fill=glow_color)
        
        # Apply blur to glow
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=3))
        
        # Composite glow onto main image
        draw.im.paste(glow_layer, (0, 0), glow_layer)
    
    def _apply_rounded_corners(self, image: Image.Image, rect: List[int], radius: int) -> Image.Image:
        """Apply rounded corners to a rectangle"""
        # This is a simplified version - for full rounded corners, you'd need more complex masking
        return image
    
    def _apply_opacity(self, image: Image.Image, opacity: float) -> Image.Image:
        """Apply opacity to an image"""
        # Create a new image with adjusted opacity
        opacity_layer = Image.new('RGBA', image.size, (0, 0, 0, int(255 * (1 - opacity))))
        return Image.alpha_composite(image, opacity_layer)
    
    def get_preset_styles(self) -> Dict[str, Dict]:
        """Get preset text styles"""
        return {
            "modern": {
                "font_size": 48,
                "font_color": (255, 255, 255),
                "stroke_color": (0, 0, 0),
                "stroke_width": 2,
                "shadow": True,
                "glow": False
            },
            "vintage": {
                "font_size": 56,
                "font_color": (255, 215, 0),  # Gold
                "stroke_color": (139, 69, 19),  # Brown
                "stroke_width": 3,
                "shadow": True,
                "glow": False
            },
            "bold": {
                "font_size": 64,
                "font_color": (255, 255, 255),
                "stroke_color": (0, 0, 0),
                "stroke_width": 4,
                "shadow": False,
                "glow": False
            },
            "elegant": {
                "font_size": 42,
                "font_color": (255, 255, 255),
                "stroke_color": (105, 105, 105),
                "stroke_width": 1,
                "shadow": False,
                "glow": True
            },
            "fun": {
                "font_size": 52,
                "font_color": (255, 20, 147),  # Pink
                "stroke_color": (255, 255, 0),  # Yellow
                "stroke_width": 3,
                "shadow": True,
                "glow": True
            },
            "minimal": {
                "font_size": 36,
                "font_color": (255, 255, 255),
                "stroke_color": (0, 0, 0),
                "stroke_width": 1,
                "shadow": False,
                "glow": False
            }
        } 