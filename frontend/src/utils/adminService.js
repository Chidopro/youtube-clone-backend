import { supabase } from '../supabaseClient.js';
import { API_CONFIG } from '../config/apiConfig.js';

export class AdminService {
  /**
   * Check if current user is an admin
   * @returns {Promise<boolean>} True if user is admin
   */
  static async isAdmin() {
    try {
      // Check Supabase auth first (for email/password login)
      let user = null;
      let userEmail = null;
      let userId = null;
      
      try {
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
        if (supabaseUser && !authError) {
          user = supabaseUser;
          userEmail = supabaseUser.email?.toLowerCase().trim();
          userId = supabaseUser.id;
          console.log('🔐 AdminService: Found Supabase auth user:', { userId, userEmail });
        }
      } catch (authErr) {
        console.log('🔐 AdminService: No Supabase auth session:', authErr);
      }
      
      // Fallback to localStorage (for Google OAuth)
      if (!user) {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        const userData = localStorage.getItem('user');
        
        if (isAuthenticated === 'true' && userData) {
          try {
            user = JSON.parse(userData);
            userEmail = (user.email || user.user_metadata?.email || user.user?.email)?.toLowerCase().trim();
            userId = user.id || user.user?.id;
            console.log('🔐 AdminService: Found localStorage user (Google OAuth):', { userId, userEmail });
          } catch (parseErr) {
            console.error('🔐 AdminService: Error parsing localStorage user:', parseErr);
          }
        }
      }
      
      if (!user) {
        console.log('🔐 AdminService: No authenticated user found');
        return false;
      }

      // Ensure we have email or ID
      if (!userEmail && !userId) {
        console.error('🔐 AdminService: No user ID or email found');
        return false;
      }
      
      console.log('🔐 AdminService: Checking admin for user:', { userId, userEmail });

      // Try querying by ID first, then fallback to email (case-insensitive)
      let query = supabase.from('users').select('is_admin, admin_role');
      
      if (userId) {
        query = query.eq('id', userId);
      } else if (userEmail) {
        // Use case-insensitive email matching
        query = query.ilike('email', userEmail);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error('Error checking admin status:', error);
        // If query by ID failed, try by email (case-insensitive)
        if (userId && userEmail) {
          console.log('🔐 AdminService: Retrying query by email (case-insensitive)');
          const { data: emailData, error: emailError } = await supabase
            .from('users')
            .select('is_admin, admin_role')
            .ilike('email', userEmail)
            .single();
          
          if (emailError) {
            console.error('Error checking admin status by email:', emailError);
            return false;
          }
          
          console.log('🔐 AdminService: Admin check result (by email):', emailData?.is_admin, 'Role:', emailData?.admin_role);
          return emailData?.is_admin || false;
        }
        return false;
      }

      console.log('🔐 AdminService: Admin check result:', data?.is_admin, 'Role:', data?.admin_role);
      return data?.is_admin || false;
    } catch (error) {
      console.error('Error in isAdmin:', error);
      return false;
    }
  }

  /**
   * Check if current user is a full admin (can manage users, payouts, etc.)
   * @returns {Promise<boolean>} True if user is full admin
   */
  static async isFullAdmin() {
    try {
      // Check Supabase auth first (for email/password login)
      let user = null;
      let userEmail = null;
      let userId = null;
      
      try {
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
        if (supabaseUser && !authError) {
          user = supabaseUser;
          userEmail = supabaseUser.email?.toLowerCase().trim();
          userId = supabaseUser.id;
        }
      } catch (authErr) {
        // No Supabase auth session
      }
      
      // Fallback to localStorage (for Google OAuth)
      if (!user) {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        const userData = localStorage.getItem('user');
        
        if (isAuthenticated === 'true' && userData) {
          try {
            user = JSON.parse(userData);
            userEmail = (user.email || user.user_metadata?.email || user.user?.email)?.toLowerCase().trim();
            userId = user.id || user.user?.id;
          } catch (parseErr) {
            // Error parsing
          }
        }
      }
      
      if (!user || (!userEmail && !userId)) {
        return false;
      }

      let query = supabase.from('users').select('is_admin, admin_role');
      
      if (userId) {
        query = query.eq('id', userId);
      } else if (userEmail) {
        query = query.ilike('email', userEmail);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error('❌ Error checking full admin status:', error);
        console.log('🔍 Retrying with email query...', { userId, userEmail });
        // Try by email if ID failed
        if (userId && userEmail) {
          const { data: emailData, error: emailError } = await supabase
            .from('users')
            .select('is_admin, admin_role')
            .ilike('email', userEmail)
            .single();
          
          if (emailError) {
            console.error('❌ Error checking full admin by email:', emailError);
            return false;
          }
          
          console.log('✅ Full admin check (by email):', {
            email: userEmail,
            is_admin: emailData?.is_admin,
            admin_role: emailData?.admin_role,
            result: emailData?.is_admin && (emailData?.admin_role === 'admin' || emailData?.admin_role === null)
          });
          
          const isFullAdmin = emailData?.is_admin && (
            emailData?.admin_role === 'admin' || 
            emailData?.admin_role === null || 
            emailData?.admin_role === undefined
          );
          return isFullAdmin;
        }
        return false;
      }

      // Full admin: is_admin = true AND (admin_role = 'admin' OR admin_role IS NULL for backward compatibility)
      // If admin_role column doesn't exist, treat is_admin = true as full admin
      const isFullAdmin = data?.is_admin && (
        data?.admin_role === 'admin' || 
        data?.admin_role === null || 
        data?.admin_role === undefined
      );
      console.log('✅ Full admin check result:', {
        userId,
        userEmail,
        is_admin: data?.is_admin,
        admin_role: data?.admin_role,
        isFullAdmin
      });
      return isFullAdmin;
    } catch (error) {
      console.error('Error in isFullAdmin:', error);
      return false;
    }
  }

  /**
   * Check if current user is an order processing admin
   * @returns {Promise<boolean>} True if user can manage order processing
   */
  static async isOrderProcessingAdmin() {
    try {
      // Check Supabase auth first (for email/password login)
      let user = null;
      let userEmail = null;
      let userId = null;
      
      try {
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
        if (supabaseUser && !authError) {
          user = supabaseUser;
          userEmail = supabaseUser.email?.toLowerCase().trim();
          userId = supabaseUser.id;
        }
      } catch (authErr) {
        // No Supabase auth session
      }
      
      // Fallback to localStorage (for Google OAuth)
      if (!user) {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        const userData = localStorage.getItem('user');
        
        if (isAuthenticated === 'true' && userData) {
          try {
            user = JSON.parse(userData);
            userEmail = (user.email || user.user_metadata?.email || user.user?.email)?.toLowerCase().trim();
            userId = user.id || user.user?.id;
          } catch (parseErr) {
            // Error parsing
          }
        }
      }
      
      if (!user || (!userEmail && !userId)) {
        return false;
      }

      let query = supabase.from('users').select('is_admin, admin_role');
      
      if (userId) {
        query = query.eq('id', userId);
      } else if (userEmail) {
        query = query.ilike('email', userEmail);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error('Error checking order processing admin status:', error);
        // Try by email if ID failed
        if (userId && userEmail) {
          const { data: emailData, error: emailError } = await supabase
            .from('users')
            .select('is_admin, admin_role')
            .ilike('email', userEmail)
            .single();
          
          if (emailError) {
            return false;
          }
          
          const isOrderProcessingAdmin = emailData?.is_admin && (
            emailData?.admin_role === 'order_processing_admin' || 
            emailData?.admin_role === 'admin' ||
            emailData?.admin_role === null
          );
          return isOrderProcessingAdmin;
        }
        return false;
      }

      // Order processing admin: is_admin = true AND (admin_role = 'order_processing_admin' OR admin_role = 'admin')
      const isOrderProcessingAdmin = data?.is_admin && (
        data?.admin_role === 'order_processing_admin' || 
        data?.admin_role === 'admin' ||
        data?.admin_role === null // Backward compatibility: treat null as full admin
      );
      console.log('🔐 AdminService: Order processing admin check result:', isOrderProcessingAdmin);
      return isOrderProcessingAdmin;
    } catch (error) {
      console.error('Error in isOrderProcessingAdmin:', error);
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

  /**
   * Get creators with pending payouts
   * @returns {Promise<Array>} Creators with pending earnings
   */
  static async getPendingPayouts() {
    try {
      // Get all creators with pending earnings
      const { data: earnings, error: earningsError } = await supabase
        .from('creator_earnings')
        .select(`
          *,
          user:users!inner(
            id,
            display_name,
            email,
            paypal_email,
            profile_image_url
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (earningsError) throw earningsError;

      // Group earnings by user and calculate totals
      const payoutMap = new Map();
      
      earnings.forEach(earning => {
        const userId = earning.user_id;
        if (!payoutMap.has(userId)) {
          payoutMap.set(userId, {
            user_id: userId,
            display_name: earning.user.display_name || earning.user.email,
            email: earning.user.email,
            paypal_email: earning.user.paypal_email,
            profile_image_url: earning.user.profile_image_url,
            pending_amount: 0,
            earnings_count: 0,
            earnings: []
          });
        }
        
        const payout = payoutMap.get(userId);
        payout.pending_amount += parseFloat(earning.creator_share || 0);
        payout.earnings_count += 1;
        payout.earnings.push(earning);
      });

      // Convert map to array and filter by minimum threshold ($50)
      const payouts = Array.from(payoutMap.values())
        .filter(payout => payout.pending_amount >= 50.00)
        .sort((a, b) => b.pending_amount - a.pending_amount);

      return payouts;
    } catch (error) {
      console.error('Error fetching pending payouts:', error);
      return [];
    }
  }

  /**
   * Get payout history
   * @returns {Promise<Array>} Payout history
   */
  static async getPayoutHistory() {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(`
          *,
          user:users!inner(
            id,
            display_name,
            email
          )
        `)
        .order('payout_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payout history:', error);
      return [];
    }
  }

  /**
   * Process a payout (mark as paid)
   * @param {string} userId - User ID
   * @param {number} amount - Payout amount
   * @param {Array} earningsIds - Array of earnings IDs to mark as paid
   * @returns {Promise<Object>} Result object
   */
  static async processPayout(userId, amount, earningsIds) {
    try {
      // Create payout record
      const { data: payout, error: payoutError } = await supabase
        .from('payouts')
        .insert({
          user_id: userId,
          amount: amount,
          payment_method: 'paypal',
          status: 'completed',
          processed_date: new Date().toISOString()
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      // Update earnings status to 'paid' and link to payout
      const { error: earningsError } = await supabase
        .from('creator_earnings')
        .update({
          status: 'paid',
          payout_id: payout.id
        })
        .in('id', earningsIds);

      if (earningsError) throw earningsError;

      return { success: true, payout };
    } catch (error) {
      console.error('Error processing payout:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user's email for API authentication
   * @returns {Promise<string|null>} User email or null
   */
  static async getCurrentUserEmail() {
    try {
      // Check Supabase auth first
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser?.email) {
        return supabaseUser.email.toLowerCase().trim();
      }
      
      // Fallback to localStorage (Google OAuth)
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      if (isAuthenticated === 'true' && userData) {
        const user = JSON.parse(userData);
        return (user.email || user.user_metadata?.email || user.user?.email)?.toLowerCase().trim() || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user email:', error);
      return null;
    }
  }

  /**
   * Get order processing queue
   * @param {string} status - Filter by status ('all', 'pending', 'assigned', 'processing', 'completed')
   * @returns {Promise<Array>} Queue items
   */
  static async getProcessingQueue(status = 'all') {
    try {
      // Get user email for authentication
      const userEmail = await this.getCurrentUserEmail();
      
      // Use API endpoint to bypass RLS issues
      const apiUrl = process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev';
      const headers = {
        'Content-Type': 'application/json'
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      const response = await fetch(`${apiUrl}/api/admin/processing-queue?status=${status}`, {
        method: 'GET',
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to fetch processing queue');
      }
    } catch (error) {
      console.error('Error fetching processing queue:', error);
      return [];
    }
  }

  /**
   * Assign order to worker
   * @param {string} queueId - Queue item ID
   * @param {string} workerId - Worker user ID
   * @returns {Promise<Object>} Result object
   */
  static async assignOrderToWorker(queueId, workerId) {
    try {
      const { data, error } = await supabase
        .from('order_processing_queue')
        .update({
          status: 'assigned',
          assigned_to: workerId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', queueId)
        .select()
        .single();

      if (error) throw error;

      await this.logAdminAction('assign_order', 'order_processing_queue', queueId, {
        worker_id: workerId,
        queue_id: queueId
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error assigning order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get processing history
   * @param {number} limit - Number of records to return
   * @returns {Promise<Array>} Processing history
   */
  static async getProcessingHistory(limit = 50) {
    try {
      // Get user email for authentication
      const userEmail = await this.getCurrentUserEmail();
      
      // Use API endpoint to bypass RLS issues
      const apiUrl = process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev';
      const headers = {
        'Content-Type': 'application/json'
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      const response = await fetch(`${apiUrl}/api/admin/processing-history?limit=${limit}`, {
        method: 'GET',
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to fetch processing history');
      }
    } catch (error) {
      console.error('Error fetching processing history:', error);
      return [];
    }
  }

  /**
   * Get workers (users with processor permissions)
   * @returns {Promise<Array>} Workers list
   */
  static async getWorkers() {
    try {
      // Get user email for authentication
      const userEmail = await this.getCurrentUserEmail();
      
      // Use API endpoint to bypass RLS issues
      const apiUrl = process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev';
      const headers = {
        'Content-Type': 'application/json'
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      const response = await fetch(`${apiUrl}/api/admin/workers`, {
        method: 'GET',
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || 'Failed to fetch workers');
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
      return [];
    }
  }

  /**
   * Grant processor permissions to user
   * @param {string} userId - User ID
   * @param {number} maxOrdersPerDay - Maximum orders per day
   * @returns {Promise<Object>} Result object
   */
  static async grantProcessorPermissions(userId, maxOrdersPerDay = 50) {
    try {
      const { data, error } = await supabase
        .from('processor_permissions')
        .upsert({
          user_id: userId,
          role: 'processor',
          is_active: true,
          max_orders_per_day: maxOrdersPerDay
        })
        .select()
        .single();

      if (error) throw error;

      await this.logAdminAction('grant_processor_permissions', 'user', userId, {
        max_orders_per_day: maxOrdersPerDay
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error granting processor permissions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke processor permissions
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  static async revokeProcessorPermissions(userId) {
    try {
      const { data, error } = await supabase
        .from('processor_permissions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      await this.logAdminAction('revoke_processor_permissions', 'user', userId);

      return { success: true, data };
    } catch (error) {
      console.error('Error revoking processor permissions:', error);
      return { success: false, error: error.message };
    }
  }
} 