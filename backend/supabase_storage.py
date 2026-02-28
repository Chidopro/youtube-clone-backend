import os
import base64
import uuid
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Lazy Supabase client so a bad key does not crash the app at import (avoids restart loop on Fly).
_supabase: Client | None = None
_supabase_failed = False


def _get_supabase() -> Client | None:
    global _supabase, _supabase_failed
    if _supabase is not None:
        return _supabase
    if _supabase_failed:
        return None
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        logger.warning("Supabase storage: missing VITE_SUPABASE_URL/SUPABASE_URL or anon key")
        _supabase_failed = True
        return None
    try:
        client = create_client(url, key)
        _supabase = client
        return _supabase
    except Exception as e:
        logger.warning("Supabase storage: could not create client (check anon key): %s", e)
        _supabase_failed = True
        return None


class SupabaseStorage:
    def __init__(self):
        self.bucket_name = "product-images"
    
    def save_image(self, image_data, filename=None):
        """
        Save an image to Supabase Storage
        
        Args:
            image_data (str): Base64 encoded image data
            filename (str): Optional filename, will generate one if not provided
            
        Returns:
            str: Public URL of the saved image
        """
        supabase = _get_supabase()
        if not supabase:
            return None
        try:
            # Generate filename if not provided
            if not filename:
                file_id = str(uuid.uuid4())
                filename = f"product_{file_id}.png"
            
            # Remove data URL prefix if present
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            # Decode base64 data
            image_bytes = base64.b64decode(image_data)
            
            # Upload to Supabase Storage
            response = supabase.storage.from_(self.bucket_name).upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": "image/png"}
            )
            
            if response:
                # Get public URL
                public_url = supabase.storage.from_(self.bucket_name).get_public_url(filename)
                return public_url
            
            return None
            
        except Exception as e:
            logger.warning("Error saving image to Supabase: %s", e)
            return None
    
    def save_multiple_images(self, images_data, prefix="product"):
        """
        Save multiple images to Supabase Storage
        
        Args:
            images_data (list): List of base64 encoded image data
            prefix (str): Prefix for filenames
            
        Returns:
            list: List of public URLs for saved images
        """
        saved_urls = []
        
        for i, image_data in enumerate(images_data):
            filename = f"{prefix}_{uuid.uuid4()}_{i}.png"
            url = self.save_image(image_data, filename)
            if url:
                saved_urls.append(url)
        
        return saved_urls
    
    def delete_image(self, image_url):
        """
        Delete an image from Supabase Storage
        
        Args:
            image_url (str): Public URL of the image to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        supabase = _get_supabase()
        if not supabase:
            return False
        try:
            # Extract filename from URL
            filename = image_url.split('/')[-1]
            
            # Delete from storage
            supabase.storage.from_(self.bucket_name).remove([filename])
            return True
            
        except Exception as e:
            logger.warning("Error deleting image from Supabase: %s", e)
            return False

# Create global instance
storage = SupabaseStorage() 