import { supabase } from '../supabaseClient.js';
import { getBackendUrl } from '../config/apiConfig.js';

/**
 * Fetch current user's profile from backend (safe fields only). Use this instead of reading from Supabase directly.
 * @param {string} userId - Current user id (e.g. from login response / localStorage)
 * @returns {Promise<Object|null>} User profile or null if not found / error
 */
/**
 * True if current origin is a subdomain of screenmerch.com (e.g. testcreator.screenmerch.com).
 * Used to redirect to main domain when session is invalid to avoid cookie/subdomain issues.
 */
function isSubdomainOfScreenMerch() {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return host.endsWith('.screenmerch.com') && host !== 'screenmerch.com' && host !== 'www.screenmerch.com';
}

export async function fetchMyProfileFromBackend(userId) {
  if (!userId) return null;
  try {
    const headers = { 'X-User-Id': userId };
    const token = typeof localStorage !== 'undefined' && localStorage.getItem('auth_token');
    if (token) headers['X-Session-Token'] = token;
    const res = await fetch(`${getBackendUrl()}/api/users/me`, {
      method: 'GET',
      credentials: 'include',
      headers,
    });
    if (res.status === 401 && isSubdomainOfScreenMerch()) {
      const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
      const rawUser = localStorage.getItem('user');
      const isOnThankYou = path === '/creator-thank-you';
      let userRole = null;
      if (rawUser) try { userRole = JSON.parse(rawUser)?.role; } catch (_) {}
      console.warn('[THANKYOU] 401 on subdomain', { path, isOnThankYou, hasUser: !!rawUser, userRole });
      try {
        if (isOnThankYou && rawUser) {
          try {
            const user = JSON.parse(rawUser);
            if (user?.role === 'creator') {
              console.log('[THANKYOU] Redirecting to main domain WITH thank-you + user (preserve page)');
              const encoded = encodeURIComponent(rawUser);
              window.location.replace(`https://screenmerch.com/creator-thank-you?login=success&user=${encoded}`);
              return null;
            }
          } catch (_) {}
        }
        console.log('[THANKYOU] Redirecting to main domain HOME (no thank-you user)');
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
      } catch (_) {}
      window.location.replace('https://screenmerch.com');
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error fetching profile from backend:', err);
    return null;
  }
}

export class UserService {
  /**
   * Get current user's profile (tries backend /api/users/me first if userId available, else Supabase)
   * @returns {Promise<Object|null>} User profile or null if not found
   */
  static async getCurrentUserProfile() {
    try {
      const stored = typeof localStorage !== 'undefined' && localStorage.getItem('user');
      const userId = stored ? (JSON.parse(stored)?.id) : null;
      if (userId) {
        const profile = await fetchMyProfileFromBackend(userId);
        if (profile) return profile;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

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
      console.log('[UPSERT] running for user:', user.id, user.email);


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
        .maybeSingle();
        console.log('[UPSERT] result:', { data, error });


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
        .maybeSingle();

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
      const response = await fetch(`${getBackendUrl()}/api/users/${user.id}/delete-account`, {
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

  /**
   * Check if current user is a creator
   * @returns {Promise<boolean>} True if user is a creator
   */
  static async isCreator() {
    try {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');

      if (isAuthenticated === 'true' && userData) {
        try {
          const user = JSON.parse(userData);
          if (user?.role === 'creator') return true;
          if (user?.role === 'customer') return false;
        } catch (_) {}
      }

      let userId = null;
      try {
        if (userData) {
          const parsed = JSON.parse(userData);
          userId = parsed?.id;
        }
      } catch (_) {}
      if (!userId) {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (!supabaseUser) return false;
        userId = supabaseUser.id;
      }

      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking creator status:', error);
        return false;
      }

      return data?.role === 'creator';
    } catch (error) {
      console.error('Error in isCreator:', error);
      return false;
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
  deleteUserAccount,
  isCreator
} = UserService; 