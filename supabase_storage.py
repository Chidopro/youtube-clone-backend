import os
import base64
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

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
            print(f"Error saving image to Supabase: {str(e)}")
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
        try:
            # Extract filename from URL
            filename = image_url.split('/')[-1]
            
            # Delete from storage
            response = supabase.storage.from_(self.bucket_name).remove([filename])
            return True
            
        except Exception as e:
            print(f"Error deleting image from Supabase: {str(e)}")
            return False

# Create global instance
storage = SupabaseStorage() 