import { supabase } from '../supabaseClient.js';

export class AdminService {
  /**
   * Check if current user is an admin
   * @returns {Promise<boolean>} True if user is admin
   */
  static async isAdmin() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

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
      const { data, error } = await supabase
        .from('admin_dashboard_stats')
        .select('*')
        .single();

      if (error) throw error;
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
   * @returns {Promise<Object>} Users data with pagination
   */
  static async getUsers(page = 0, limit = 20, search = '', status = 'all') {
    try {
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;

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
   * @returns {Promise<Array>} Subscriptions data
   */
  static async getSubscriptions() {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*, users(display_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      return [];
    }
  }

  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status ('active', 'suspended', 'banned')
   * @returns {Promise<Object>} Result object
   */
  static async updateUserStatus(userId, status) {
    try {
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

      if (error) throw error;

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
   * Delete user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  static async deleteUser(userId) {
    try {
      const response = await fetch(`http://localhost:3002/api/users/${userId}/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to delete user' };
      }

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
  deleteVideo,
  getAdminSettings,
  updateAdminSetting,
  getAdminLogs,
  logAdminAction,
  getRecentActivity
} = AdminService; 