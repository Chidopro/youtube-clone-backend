import { supabase } from '../supabaseClient.js';
import { API_CONFIG } from '../config/apiConfig.js';

// Cache for admin status to avoid repeated API calls
let adminStatusCache = null;
let adminStatusCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/** When on screenmerch.com, use same-origin /api so Netlify proxies to Fly and avoids CORS/403. */
function getAdminApiBase() {
  if (typeof window !== 'undefined') {
    const o = (window.location?.origin || '').toLowerCase();
    if (o === 'https://screenmerch.com' || o === 'https://www.screenmerch.com') return '';
  }
  return API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
}

export class AdminService {
  /**
   * Get current user info from Supabase auth or localStorage
   * @returns {Object|null} User object with id and email
   */
  static async getCurrentUser() {
    let user = null;
    let userEmail = null;
    let userId = null;
    
    // Try Supabase auth first
    try {
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
      if (supabaseUser && !authError) {
        user = supabaseUser;
        userEmail = supabaseUser.email?.toLowerCase().trim();
        userId = supabaseUser.id;
      }
    } catch (authErr) {
      // No Supabase auth session - this is normal for email/password login
    }
    
    // Fallback to localStorage (for email/password login and Google OAuth)
    if (!user) {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      if (isAuthenticated === 'true' && userData) {
        try {
          user = JSON.parse(userData);
          userEmail = (user.email || user.user_metadata?.email || user.user?.email)?.toLowerCase().trim();
          userId = user.id || user.user?.id;
        } catch (parseErr) {
          console.error('🔐 AdminService: Error parsing localStorage user:', parseErr);
        }
      }
    }
    
    if (!user || (!userEmail && !userId)) {
      return null;
    }
    
    return { user, userId, userEmail };
  }

  /**
   * Check admin status via backend API (bypasses RLS)
   * @returns {Promise<Object>} Admin status object
   */
  static async checkAdminStatus() {
    // Check cache first
    const now = Date.now();
    if (adminStatusCache && (now - adminStatusCacheTime) < CACHE_DURATION) {
      console.log('🔐 AdminService: Using cached admin status');
      return adminStatusCache;
    }
    
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      console.log('🔐 AdminService: No authenticated user found');
      return {
        isAdmin: false,
        isFullAdmin: false,
        isMasterAdmin: false,
        isOrderProcessingAdmin: false,
        adminRole: null
      };
    }
    
    const { userId, userEmail } = currentUser;
    console.log('🔐 AdminService: Checking admin status via backend for:', { userId, userEmail });
    
    try {
      const apiUrl = getAdminApiBase();
      const response = await fetch(`${apiUrl}/api/auth/check-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          email: userEmail
        })
      });
      
      if (!response.ok) {
        console.error('🔐 AdminService: Backend check failed with status:', response.status);
        return {
          isAdmin: false,
          isFullAdmin: false,
          isMasterAdmin: false,
          isOrderProcessingAdmin: false,
          adminRole: null
        };
      }
      
      const result = await response.json();
      console.log('🔐 AdminService: Backend admin check result:', result);
      
      if (result.success) {
        // Cache the result
        adminStatusCache = {
          isAdmin: result.isAdmin || false,
          isFullAdmin: result.isFullAdmin || false,
          isMasterAdmin: result.isMasterAdmin || false,
          isOrderProcessingAdmin: result.isOrderProcessingAdmin || false,
          adminRole: result.adminRole || null
        };
        adminStatusCacheTime = now;
        return adminStatusCache;
      }
      
      return {
        isAdmin: false,
        isFullAdmin: false,
        isMasterAdmin: false,
        isOrderProcessingAdmin: false,
        adminRole: null
      };
    } catch (error) {
      console.error('🔐 AdminService: Error calling backend:', error);
      return {
        isAdmin: false,
        isFullAdmin: false,
        isMasterAdmin: false,
        isOrderProcessingAdmin: false,
        adminRole: null
      };
    }
  }

  /**
   * Clear the admin status cache (call on login/logout)
   */
  static clearCache() {
    adminStatusCache = null;
    adminStatusCacheTime = 0;
    console.log('🔐 AdminService: Cache cleared');
  }

  /**
   * Check if current user is an admin
   * @returns {Promise<boolean>} True if user is admin
   */
  static async isAdmin() {
    const status = await this.checkAdminStatus();
    return status.isAdmin;
  }

  /**
   * Check if current user is a master admin (full access, oversees all operations)
   * @returns {Promise<boolean>} True if user is master admin
   */
  static async isMasterAdmin() {
    const status = await this.checkAdminStatus();
    return status.isMasterAdmin;
  }

  /**
   * Check if current user is a full admin (can manage users, payouts, etc.)
   * @returns {Promise<boolean>} True if user is full admin
   */
  static async isFullAdmin() {
    const status = await this.checkAdminStatus();
    return status.isFullAdmin;
  }

  /**
   * Check if current user is an order processing admin
   * @returns {Promise<boolean>} True if user can manage order processing
   */
  static async isOrderProcessingAdmin() {
    const status = await this.checkAdminStatus();
    return status.isOrderProcessingAdmin;
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
      const userId = user.id || user.user?.id;
      const userEmail = (user.email || user.user_metadata?.email || user.user?.email || '').trim().toLowerCase();
      const apiUrl = getAdminApiBase();
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      const response = await fetch(`${apiUrl}/api/admin/dashboard-stats?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(userEmail ? { 'X-User-Email': userEmail } : {}),
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
        pending_users: 0,
        total_videos: 0,
        pending_videos: 0,
        approved_videos: 0,
        creator_count: 0,
        customer_count: 0,
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
      const currentUser = await this.getCurrentUser();
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      if (currentUser?.userEmail) {
        const params = new URLSearchParams({ page: String(page), limit: String(limit), status, role });
        if (search) params.set('search', search);
        const res = await fetch(`${apiUrl}/api/admin/users?${params}`, {
          method: 'GET',
          headers: { 'X-User-Email': currentUser.userEmail },
          credentials: 'include'
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.users)) {
            console.log('👥 Fetching users from database...');
            console.log('👥 Users fetched:', json.users.length, 'users');
            console.log('👥 Total count:', json.total ?? json.users.length);
            return {
              users: json.users,
              total: json.total ?? 0,
              page: json.page ?? page,
              limit: json.limit ?? limit,
              totalPages: json.totalPages ?? 1
            };
          }
        }
      }
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

      if (role !== 'all' && (role === 'creator' || role === 'customer')) {
        query = query.eq('role', role);
      }
      /* master_admin and admin are filtered client-side by is_admin/admin_role */

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
   * Update a user's display role (Master Admin, Admin, Creator, Customer). Master Admin only.
   * @param {string} userId - User ID
   * @param {{ display_role: 'master_admin'|'admin'|'creator'|'customer' }} payload
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  static async updateUserRole(userId, payload) {
    try {
      const currentUser = await this.getCurrentUser();
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      if (!currentUser?.userEmail) throw new Error('Not authenticated');
      const res = await fetch(`${apiUrl}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': currentUser.userEmail },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: data.error || res.statusText };
      return data.success ? { success: true } : { success: false, error: data.error || 'Update failed' };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { success: false, error: error.message };
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
        .select('*, users(display_name, email, role)')
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
   * Activate a user (status -> active). For creators, backend sends welcome email once. Master Admin only.
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  static async activateUser(userId) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.userEmail) return { success: false, error: 'Not authenticated' };
      const base = getAdminApiBase();
      const res = await fetch(`${base}/api/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': currentUser.userEmail },
        credentials: 'include',
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || res.statusText };
      return { success: true, data };
    } catch (error) {
      console.error('Error activating user:', error);
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
      const base = getAdminApiBase();
      const url = `${base}/api/users/${userId}/delete-account`;
      console.log('🗑️ Deleting user:', userId);
      console.log('🗑️ API URL:', url);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
   * Get pending creators (new sign-ups awaiting approval). Master Admin only.
   * @returns {Promise<Array>} List of { id, email, display_name, created_at, profile_image_url }
   */
  static async getPendingCreators() {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.userEmail) throw new Error('Not authenticated');
      const base = getAdminApiBase();
      const res = await fetch(`${base}/api/admin/pending-creators`, {
        method: 'GET',
        headers: { 'X-User-Email': currentUser.userEmail },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.pending_creators || [];
    } catch (error) {
      console.error('Error fetching pending creators:', error);
      return [];
    }
  }

  /**
   * Approve a pending creator (set status to active). Master Admin only.
   * @param {string} userId - User UUID
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  static async approveCreator(userId) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.userEmail) throw new Error('Not authenticated');
      const base = getAdminApiBase();
      const res = await fetch(`${base}/api/admin/approve-creator/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': currentUser.userEmail },
        credentials: 'include',
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || res.statusText };
      return { success: true };
    } catch (error) {
      console.error('Error approving creator:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disapprove a pending creator (set status to suspended). Master Admin only.
   * @param {string} userId - User UUID
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  static async disapproveCreator(userId) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.userEmail) throw new Error('Not authenticated');
      const base = getAdminApiBase();
      const res = await fetch(`${base}/api/admin/disapprove-creator/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': currentUser.userEmail },
        credentials: 'include',
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || res.statusText };
      return { success: true };
    } catch (error) {
      console.error('Error disapproving creator:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set an existing creator (by email) to pending so they appear in Pending Approval. Master Admin only.
   * @param {string} email - Creator email
   * @returns {Promise<{ success: boolean, error?: string, message?: string }>}
   */
  static async setCreatorPending(email) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.userEmail) throw new Error('Not authenticated');
      const base = getAdminApiBase();
      const res = await fetch(`${base}/api/admin/set-creator-pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': currentUser.userEmail },
        credentials: 'include',
        body: JSON.stringify({ email: (email || '').trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || res.statusText };
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Error setting creator to pending:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all creators with payout-related info (for admin Payouts page list).
   * @returns {Promise<Array>} List of { id, display_name, email, paypal_email, subdomain, profile_image_url, status, pending_amount }
   */
  static async getCreatorsPayoutList() {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.userEmail) throw new Error('Not authenticated');
      const base = getAdminApiBase();
      const res = await fetch(`${base}/api/admin/creators-payout-list`, {
        method: 'GET',
        headers: { 'X-User-Email': currentUser.userEmail },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.creators || [];
    } catch (error) {
      console.error('Error fetching creators payout list:', error);
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
      const userEmail = await this.getCurrentUserEmail();
      const apiUrl = getAdminApiBase() || (process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      const response = await fetch(`${apiUrl}/api/admin/assign-order`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ queue_id: queueId, worker_id: workerId })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      if (!result.success) {
        throw new Error(result.error || 'Assign failed');
      }
      await this.logAdminAction('assign_order', 'order_processing_queue', queueId, {
        worker_id: workerId,
        queue_id: queueId
      });
      return { success: true, data: result };
    } catch (error) {
      console.error('Error assigning order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk assign multiple queue items to one worker (master admin / order processing admin).
   * @param {string[]} queueIds - Array of queue item IDs
   * @param {string} workerId - User ID of the worker to assign to
   * @returns {Promise<Object>} Result with assigned_count
   */
  static async assignOrdersBulk(queueIds, workerId) {
    try {
      const userEmail = await this.getCurrentUserEmail();
      const apiUrl = getAdminApiBase() || (process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev');
      const headers = { 'Content-Type': 'application/json' };
      if (userEmail) headers['X-User-Email'] = userEmail;
      const response = await fetch(`${apiUrl}/api/admin/assign-orders`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ queue_ids: queueIds, worker_id: workerId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      if (!result.success) throw new Error(result.error || 'Bulk assign failed');
      return result;
    } catch (error) {
      console.error('Error bulk assigning orders:', error);
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

  /**
   * Submit admin signup request
   * @param {string} email - Admin email address
   * @returns {Promise<Object>} Result object
   */
  static async submitAdminSignupRequest(email) {
    try {
      const { data, error } = await supabase
        .from('admin_signup_requests')
        .insert({
          email: email.toLowerCase().trim(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error submitting admin signup request:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all admin signup requests (master admin only)
   * @returns {Promise<Array>} Signup requests
   */
  static async getAdminSignupRequests() {
    try {
      const currentUser = await this.getCurrentUser();
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      if (currentUser?.userEmail) {
        const res = await fetch(`${apiUrl}/api/admin/signup-requests`, {
          method: 'GET',
          headers: { 'X-User-Email': currentUser.userEmail },
          credentials: 'include'
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.requests)) return json.requests;
        }
      }
      const { data, error } = await supabase
        .from('admin_signup_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      if (error?.code === '42P01') {
        console.warn('Admin signup requests table does not exist yet; returning empty list.');
        return [];
      }
      console.error('Error fetching admin signup requests:', error);
      return [];
    }
  }

  /**
   * Approve admin signup request (master admin only)
   * @param {string} requestId - Request ID
   * @param {string} adminRole - Role to assign ('order_processing_admin' or 'admin')
   * @returns {Promise<Object>} Result object
   */
  static async approveAdminSignupRequest(requestId, adminRole = 'order_processing_admin') {
    try {
      // Get the request
      const { data: request, error: requestError } = await supabase
        .from('admin_signup_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      // Get current user (master admin)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Update the request status
      const { error: updateError } = await supabase
        .from('admin_signup_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Find or create user in users table and set admin role
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .ilike('email', request.email)
        .single();

      if (existingUser) {
        // Update existing user
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            is_admin: true,
            admin_role: adminRole
          })
          .eq('id', existingUser.id);

        if (userUpdateError) throw userUpdateError;
      } else {
        // Create new user (they'll need to set password via Supabase Auth)
        // For now, just create a placeholder - master admin will need to set up auth manually
        const { error: userCreateError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            is_admin: true,
            admin_role: adminRole,
            role: 'customer',
            status: 'active'
          });

        if (userCreateError) throw userCreateError;
      }

      // Log admin action
      await this.logAdminAction('approve_admin_signup', 'admin_signup_request', requestId, {
        approved_email: request.email,
        admin_role: adminRole
      });

      return { success: true };
    } catch (error) {
      console.error('Error approving admin signup request:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject admin signup request (master admin only)
   * @param {string} requestId - Request ID
   * @param {string} notes - Optional rejection notes
   * @returns {Promise<Object>} Result object
   */
  static async rejectAdminSignupRequest(requestId, notes = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('admin_signup_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          notes: notes
        })
        .eq('id', requestId);

      if (error) throw error;

      // Log admin action
      await this.logAdminAction('reject_admin_signup', 'admin_signup_request', requestId, {
        notes: notes
      });

      return { success: true };
    } catch (error) {
      console.error('Error rejecting admin signup request:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all admins (master admin only)
   * @returns {Promise<Array>} List of admins
   */
  static async getAllAdmins() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, admin_role, is_admin, created_at')
        .eq('is_admin', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
  }

  /**
   * Update admin role (master admin only)
   * @param {string} userId - User ID
   * @param {string} adminRole - New admin role ('master_admin', 'admin', 'order_processing_admin')
   * @returns {Promise<Object>} Result object
   */
  static async updateAdminRole(userId, adminRole) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ admin_role: adminRole })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await this.logAdminAction('update_admin_role', 'user', userId, {
        new_role: adminRole
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error updating admin role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove admin access (master admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  static async removeAdminAccess(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          is_admin: false,
          admin_role: null
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await this.logAdminAction('remove_admin_access', 'user', userId);

      return { success: true, data };
    } catch (error) {
      console.error('Error removing admin access:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all subdomains with creator info (master admin only)
   * @returns {Promise<Array>} Array of subdomain objects
   */
  static async getSubdomains() {
    try {
      const userEmail = await this.getCurrentUserEmail();
      if (!userEmail) {
        return [];
      }
      
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      const response = await fetch(`${apiUrl}/api/admin/subdomains`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.success) {
        return result.subdomains || [];
      } else {
        throw new Error(result.error || 'Failed to fetch subdomains');
      }
    } catch (error) {
      console.error('Error fetching subdomains:', error);
      return [];
    }
  }

  /**
   * Update subdomain for a user (master admin only)
   * @param {string} userId - User ID
   * @param {string} subdomain - New subdomain (or empty string to remove)
   * @returns {Promise<Object>} Result object
   */
  static async updateSubdomain(userId, subdomain) {
    try {
      const userEmail = await this.getCurrentUserEmail();
      if (!userEmail) {
        return { success: false, error: 'Not authenticated' };
      }
      
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      const response = await fetch(`${apiUrl}/api/admin/subdomains/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail
        },
        credentials: 'include',
        body: JSON.stringify({
          subdomain: subdomain.trim().toLowerCase(),
          admin_email: userEmail
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating subdomain:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate if a subdomain is accessible
   * @param {string} subdomain - Subdomain to validate
   * @returns {Promise<Object>} Validation result
   */
  static async validateSubdomain(subdomain) {
    try {
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      const response = await fetch(`${apiUrl}/api/admin/subdomains/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ subdomain: subdomain.trim().toLowerCase() })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error validating subdomain:', error);
      return { success: false, is_accessible: false, error: error.message };
    }
  }

  /**
   * Delete order from processing queue (master admin only)
   * @param {string} queueId - Queue item ID
   * @returns {Promise<Object>} Result object
   */
  static async deleteOrder(queueId) {
    try {
      const userEmail = await this.getCurrentUserEmail();
      const apiUrl = getAdminApiBase() || (process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      const response = await fetch(`${apiUrl}/api/admin/delete-order/${queueId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log admin action
      await this.logAdminAction('delete_order', 'order_processing_queue', queueId);

      return result;
    } catch (error) {
      console.error('Error deleting order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete multiple orders from processing queue (master admin only)
   * @param {string[]} queueIds - Array of queue item IDs
   * @returns {Promise<Object>} Result object with deleted_count
   */
  static async deleteOrdersBulk(queueIds) {
    try {
      const userEmail = await this.getCurrentUserEmail();
      const apiUrl = getAdminApiBase() || (process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      const response = await fetch(`${apiUrl}/api/admin/delete-orders`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ queue_ids: queueIds })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      await this.logAdminAction('delete_orders_bulk', 'order_processing_queue', null, { count: result.deleted_count });
      return result;
    } catch (error) {
      console.error('Error bulk deleting orders:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset sales/analytics data for a creator (master admin only)
   * @param {string} userId - User ID of the creator
   * @returns {Promise<Object>} Result object
   */
  static async resetSales(userId) {
    try {
      // Get user email for authentication
      const userEmail = await this.getCurrentUserEmail();
      if (!userEmail) {
        return { success: false, error: 'Not authenticated' };
      }
      
      // Use API endpoint
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail
      };
      
      const response = await fetch(`${apiUrl}/api/admin/reset-sales`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          user_id: userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log admin action
      await this.logAdminAction('reset_sales', 'user', userId, {
        target_user_id: userId
      });

      return result;
    } catch (error) {
      console.error('Error resetting sales:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get platform revenue analytics (master admin only)
   * @param {string} startDate - Optional start date filter (YYYY-MM-DD)
   * @param {string} endDate - Optional end date filter (YYYY-MM-DD)
   * @param {string} creatorId - Optional creator ID filter
   * @returns {Promise<Object>} Platform revenue data
   */
  static async getPlatformRevenue(startDate = null, endDate = null, creatorId = null) {
    try {
      // Get user email for authentication
      const userEmail = await this.getCurrentUserEmail();
      if (!userEmail) {
        return { success: false, error: 'Not authenticated' };
      }
      
      // Build query string
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (creatorId) params.append('creator_id', creatorId);
      
      // Use API endpoint
      const apiUrl = API_CONFIG.BASE_URL || 'https://screenmerch.fly.dev';
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail
      };
      
      const queryString = params.toString();
      const url = `${apiUrl}/api/admin/platform-revenue${queryString ? '?' + queryString : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching platform revenue:', error);
      return { success: false, error: error.message };
    }
  }
} 