import { supabase } from '../supabaseClient.js';
import { API_CONFIG } from '../config/apiConfig.js';

export class AdminService {
  /**
   * Check if current user is an admin
   * @returns {Promise<boolean>} True if user is admin
   */
  static async isAdmin() {
    try {
      // Check for Google OAuth user first
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      let user = null;
      
      if (isAuthenticated === 'true' && userData) {
        // Google OAuth user
        user = JSON.parse(userData);
        console.log('🔐 AdminService: Found Google OAuth user:', user);
      } else {
        // Fallback to Supabase auth
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
          user = supabaseUser;
          console.log('🔐 AdminService: Found Supabase user:', user);
        }
      }
      
      if (!user) {
        console.log('🔐 AdminService: No authenticated user found');
        return false;
      }

      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      console.log('🔐 AdminService: Admin check result:', data?.is_admin);
      return data?.is_admin || false;
    } catch (error) {
      console.error('Error in isAdmin:', error);
      return false;
    }
  }

  /**
   * Get admin dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  static async getDashboardStats() {
    try {
      // Get current user ID
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      let user = null;
      if (isAuthenticated === 'true' && userData) {
        user = JSON.parse(userData);
      } else {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        user = supabaseUser;
      }
      
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      // Call backend API
      const response = await fetch(`https://screenmerch.fly.dev/api/admin/dashboard-stats?user_id=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Admin dashboard stats from backend:', data);
      return data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        total_users: 0,
        active_users: 0,
        suspended_users: 0,
        total_videos: 0,
        pending_videos: 0,
        approved_videos: 0,
        total_subscriptions: 0,
        active_subscriptions: 0,
        premium_subscriptions: 0,
        creator_network_subscriptions: 0
      };
    }
  }

  /**
   * Get all users with pagination
   * @param {number} page - Page number (0-based)
   * @param {number} limit - Items per page
   * @param {string} search - Search term
   * @param {string} status - Filter by status
   * @param {string} role - Filter by role ('creator', 'customer', 'all')
   * @returns {Promise<Object>} Users data with pagination
   */
  static async getUsers(page = 0, limit = 20, search = '', status = 'all', role = 'all') {
    try {
      console.log('👥 Fetching users from database...');
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Filter by role - default to showing creators in admin panel
      if (role !== 'all') {
        query = query.eq('role', role);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) {
        console.error('👥 Error fetching users:', error);
        throw error;
      }

      console.log('👥 Users fetched:', data?.length || 0, 'users');
      console.log('👥 Total count:', count);

      return {
        users: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { users: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  /**
   * Get all videos with pagination
   * @param {number} page - Page number (0-based)
   * @param {number} limit - Items per page
   * @param {string} search - Search term
   * @param {string} status - Filter by verification status
   * @returns {Promise<Object>} Videos data with pagination
   */
  static async getVideos(page = 0, limit = 20, search = '', status = 'all') {
    try {
      let query = supabase
        .from('videos2')
        .select('*, users(display_name, email)', { count: 'exact' });

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (status !== 'all') {
        query = query.eq('verification_status', status);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;

      return {
        videos: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching videos:', error);
      return { videos: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  /**
   * Get all subscriptions
   * @param {string} statusFilter - Filter by status ('all', 'active', 'canceled', etc.)
   * @returns {Promise<Array>} Subscriptions data
   */
  static async getSubscriptions(statusFilter = 'active') {
    try {
      let query = supabase
        .from('user_subscriptions')
        .select('*, users(display_name, email)')
        .order('created_at', { ascending: false });

      // Filter subscriptions by status
      if (statusFilter === 'all') {
        // Show all subscriptions including canceled
        // No filter applied
      } else {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      return [];
    }
  }

  /**
   * Soft delete a subscription (marks as canceled, preserves all data)
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Result object
   */
  static async deleteSubscription(subscriptionId) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await this.logAdminAction('delete_subscription', 'subscription', subscriptionId, {
        target_subscription_id: subscriptionId
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error deleting subscription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reactivate a canceled subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Result object
   */
  static async reactivateSubscription(subscriptionId) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await this.logAdminAction('reactivate_subscription', 'subscription', subscriptionId, {
        target_subscription_id: subscriptionId
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status ('active', 'suspended', 'banned', 'pending')
   * @returns {Promise<Object>} Result object
   */
  static async updateUserStatus(userId, status) {
    try {
      console.log(`Updating user ${userId} status to ${status}`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Database update successful:', data);

      // Log admin action
      await this.logAdminAction('update_user_status', 'user', userId, {
        new_status: status,
        target_user_id: userId
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error updating user status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Approve a pending user (changes status from 'pending' to 'active')
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  static async approveUser(userId) {
    return this.updateUserStatus(userId, 'active');
  }

  /**
   * Delete user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  static async deleteUser(userId) {
    try {
      console.log('🗑️ Deleting user:', userId);
      console.log('🗑️ API URL:', `${API_CONFIG.SUBSCRIPTION_API_URL}/api/users/${userId}/delete-account`);
      
      const response = await fetch(`${API_CONFIG.SUBSCRIPTION_API_URL}/api/users/${userId}/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('🗑️ Delete response status:', response.status);
      console.log('🗑️ Delete response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🗑️ Delete error response:', errorData);
        return { success: false, error: errorData.error || 'Failed to delete user' };
      }

      const responseData = await response.json();
      console.log('🗑️ Delete success response:', responseData);

      // Log admin action
      await this.logAdminAction('delete_user', 'user', userId, {
        target_user_id: userId
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update video verification status
   * @param {string} videoId - Video ID
   * @param {string} status - New status ('pending', 'approved', 'rejected')
   * @returns {Promise<Object>} Result object
   */
  static async updateVideoStatus(videoId, status) {
    try {
      const { data, error } = await supabase
        .from('videos2')
        .update({ verification_status: status })
        .eq('id', videoId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await this.logAdminAction('update_video_status', 'video', videoId, {
        new_status: status,
        target_video_id: videoId
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error updating video status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update video details
   * @param {string} videoId - Video ID
   * @param {Object} updates - Object with title, thumbnail, video_url to update
   * @returns {Promise<Object>} Result object
   */
  static async updateVideo(videoId, updates) {
    try {
      // Get current user to verify ownership
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      let user = null;
      if (isAuthenticated === 'true' && userData) {
        user = JSON.parse(userData);
      } else {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        user = supabaseUser;
      }

      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Verify the video belongs to the user
      const { data: video, error: fetchError } = await supabase
        .from('videos2')
        .select('user_id')
        .eq('id', videoId)
        .single();

      if (fetchError) throw fetchError;

      if (video.user_id !== user.id) {
        return { success: false, error: 'You can only edit your own videos' };
      }

      // Build update object with only provided fields
      // Note: updated_at is handled by database trigger, don't set it manually
      const updateData = {};

      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }
      if (updates.thumbnail !== undefined) {
        updateData.thumbnail = updates.thumbnail;
      }
      if (updates.video_url !== undefined) {
        updateData.video_url = updates.video_url;
      }

      const { data, error } = await supabase
        .from('videos2')
        .update(updateData)
        .eq('id', videoId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action (if user is admin) or creator action
      await this.logAdminAction('update_video', 'video', videoId, {
        updates: updateData,
        target_video_id: videoId
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error updating video:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete video
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Result object
   */
  static async deleteVideo(videoId) {
    try {
      // First get the video details to check if it has uploaded files
      const { data: video, error: fetchError } = await supabase
        .from('videos2')
        .select('*')
        .eq('id', videoId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from database
      const { error: deleteError } = await supabase
        .from('videos2')
        .delete()
        .eq('id', videoId);

      if (deleteError) throw deleteError;

      // If the video has uploaded files (not YouTube URLs), try to delete them from storage
      if (video && video.video_url && !video.video_url.includes('youtube.com')) {
        try {
          // Extract file path from URL and delete from storage
          const videoPath = video.video_url.split('/storage/v1/object/public/')[1];
          if (videoPath) {
            await supabase.storage
              .from('videos2')
              .remove([videoPath]);
          }
        } catch (storageError) {
          console.warn('Could not delete video file from storage:', storageError);
          // Don't fail the entire operation if storage deletion fails
        }
      }

      // If there's a thumbnail that's not from YouTube, try to delete it
      if (video && video.thumbnail && !video.thumbnail.includes('ytimg.com')) {
        try {
          const thumbnailPath = video.thumbnail.split('/storage/v1/object/public/')[1];
          if (thumbnailPath) {
            await supabase.storage
              .from('thumbnails')
              .remove([thumbnailPath]);
          }
        } catch (storageError) {
          console.warn('Could not delete thumbnail from storage:', storageError);
          // Don't fail the entire operation if storage deletion fails
        }
      }

      // Log admin action
      await this.logAdminAction('delete_video', 'video', videoId, {
        target_video_id: videoId
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting video:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get admin settings
   * @returns {Promise<Object>} Settings object
   */
  static async getAdminSettings() {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;

      const settings = {};
      data.forEach(setting => {
        settings[setting.setting_key] = setting.setting_value;
      });

      return settings;
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      return {};
    }
  }

  /**
   * Update admin setting
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   * @returns {Promise<Object>} Result object
   */
  static async updateAdminSetting(key, value) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase.rpc('update_admin_setting', {
        p_setting_key: key,
        p_setting_value: value,
        p_admin_user_id: user.id
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating admin setting:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get admin logs
   * @param {number} page - Page number (0-based)
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Logs data with pagination
   */
  static async getAdminLogs(page = 0, limit = 50) {
    try {
      const { data, error, count } = await supabase
        .from('admin_logs')
        .select('*, admin_user:users(display_name, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;

      return {
        logs: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching admin logs:', error);
      return { logs: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  /**
   * Log admin action
   * @param {string} actionType - Type of action
   * @param {string} targetType - Type of target
   * @param {string} targetId - Target ID
   * @param {Object} details - Additional details
   * @returns {Promise<void>}
   */
  static async logAdminAction(actionType, targetType, targetId = null, details = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('log_admin_action', {
        p_admin_user_id: user.id,
        p_action_type: actionType,
        p_target_type: targetType,
        p_target_id: targetId,
        p_details: details
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }

  /**
   * Get recent activity
   * @param {number} limit - Number of recent items
   * @returns {Promise<Array>} Recent activity items
   */
  static async getRecentActivity(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*, admin_user:users(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  }
}

// Export individual functions for convenience
export const {
  isAdmin,
  getDashboardStats,
  getUsers,
  getVideos,
  getSubscriptions,
  updateUserStatus,
  deleteUser,
  updateVideoStatus,
  updateVideo,
  deleteVideo,
  getAdminSettings,
  updateAdminSetting,
  getAdminLogs,
  logAdminAction,
  getRecentActivity
} = AdminService; 