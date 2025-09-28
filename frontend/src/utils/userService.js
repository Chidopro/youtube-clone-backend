import { supabase } from '../supabaseClient.js';

export class UserService {
  /**
   * Get current user's profile
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  static async getCurrentUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCurrentUserProfile:', error);
      return null;
    }
  }

  /**
   * Create or update user profile
   * @param {Object} profileData - User profile data
   * @returns {Promise<Object|null>} Updated user profile or null on error
   */
  static async upsertUserProfile(profileData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const profileToUpsert = {
        id: user.id,
        email: user.email,
        role: 'creator',  // Ensure all users get creator role
        ...profileData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('users')
        .upsert(profileToUpsert, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in upsertUserProfile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated user profile or null on error
   */
  static async updateUserProfile(updates) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      return null;
    }
  }

  /**
   * Get user profile by ID (for public profiles)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  static async getUserProfileById(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, profile_image_url, cover_image_url, bio, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile by ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserProfileById:', error);
      return null;
    }
  }

  /**
   * Upload profile image
   * @param {File} file - Image file to upload
   * @param {string} path - Storage path (e.g., 'profile-images')
   * @returns {Promise<string|null>} Public URL of uploaded image or null on error
   */
  static async uploadProfileImage(file, path = 'profile-images') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${path}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading profile image:', error);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadProfileImage:', error);
      return null;
    }
  }

  /**
   * Delete profile image
   * @param {string} imageUrl - URL of image to delete
   * @returns {Promise<boolean>} Success status
   */
  static async deleteProfileImage(imageUrl) {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `profile-images/${fileName}`;

      const { error } = await supabase.storage
        .from('profile-images')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting profile image:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteProfileImage:', error);
      return false;
    }
  }

  /**
   * Delete user account and all associated data
   * @returns {Promise<{success: boolean, error?: string}>} Result object
   */
  static async deleteUserAccount() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'No authenticated user found' };
      }

      // Call the server endpoint to handle complete account deletion
      const response = await fetch(`https://youtube-clone-dev-backend.fly.dev/api/users/${user.id}/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { 
          success: false, 
          error: errorData.error || 'Failed to delete account' 
        };
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Error in deleteUserAccount:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export individual functions for convenience
export const {
  getCurrentUserProfile,
  upsertUserProfile,
  updateUserProfile,
  getUserProfileById,
  uploadProfileImage,
  deleteProfileImage,
  deleteUserAccount
} = UserService; 