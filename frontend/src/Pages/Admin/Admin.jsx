import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { AdminService } from '../../utils/adminService';
import './Admin.css';

const Admin = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('creator'); // Default to showing creators
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('active'); // Filter for subscriptions
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  // Reload users when filters change
  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, filterRole, isAdmin, activeTab]);

  // Reload subscriptions when filter changes
  useEffect(() => {
    if (isAdmin && activeTab === 'subscriptions') {
      loadSubscriptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionStatusFilter, isAdmin, activeTab]);

  const checkAdminStatus = async () => {
    try {
      // Check for Google OAuth user first
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      let user = null;
      
      if (isAuthenticated === 'true' && userData) {
        // Google OAuth user
        user = JSON.parse(userData);
        console.log('🔐 Admin: Found Google OAuth user:', user);
      } else {
        // Fallback to Supabase auth
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
          user = supabaseUser;
          console.log('🔐 Admin: Found Supabase user:', user);
        }
      }
      
      if (!user) {
        console.log('🔐 Admin: No authenticated user found, redirecting to home');
        navigate('/');
        return;
      }

      setUser(user);

      // Check if user is admin using AdminService
      const isUserAdmin = await AdminService.isAdmin();

      if (!isUserAdmin) {
        alert('Access denied. Admin privileges required.');
        navigate('/');
        return;
      }

      setIsAdmin(true);
      loadAdminData();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    await Promise.all([
      loadUsers(),
      loadVideos(),
      loadSubscriptions(),
      loadStats()
    ]);
  };

  const loadUsers = async () => {
    try {
      const result = await AdminService.getUsers(0, 100, searchTerm, filterStatus, filterRole);
      console.log('Loaded users:', result.users);
      setUsers(result.users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const result = await AdminService.getVideos(0, 100, searchTerm, filterStatus);
      setVideos(result.videos);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const data = await AdminService.getSubscriptions(subscriptionStatusFilter);
      setSubscriptions(data);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await AdminService.getDashboardStats();
      setStats({
        totalUsers: data.total_users || 0,
        totalVideos: data.total_videos || 0,
        totalSubscriptions: data.total_subscriptions || 0,
        pendingVideos: data.pending_videos || 0,
        activeUsers: data.active_users || 0,
        suspendedUsers: data.suspended_users || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleUserAction = async (userId, action) => {
    console.log('🎯 handleUserAction called with:', { userId, action });
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      console.log('❌ User cancelled the action');
      return;
    }

    console.log('✅ User confirmed the action, proceeding...');

    try {
      let result;
      
      if (action === 'delete') {
        console.log('🗑️ Calling AdminService.deleteUser...');
        result = await AdminService.deleteUser(userId);
        console.log('🗑️ Delete result:', result);
      } else if (action === 'suspend') {
        console.log(`Suspending user ${userId}...`);
        result = await AdminService.updateUserStatus(userId, 'suspended');
        console.log('Suspend result:', result);
      } else if (action === 'activate') {
        console.log(`Activating user ${userId}...`);
        result = await AdminService.updateUserStatus(userId, 'active');
        console.log('Activate result:', result);
      } else if (action === 'approve') {
        console.log(`Approving user ${userId}...`);
        result = await AdminService.approveUser(userId);
        console.log('Approve result:', result);
      }

      if (result.success) {
        alert(`User ${action}d successfully`);
        console.log('Reloading users...');
        await loadUsers();
        console.log('Users reloaded');
      } else {
        alert(`Failed to ${action} user: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      alert(`Failed to ${action} user`);
    }
  };

  const handleVideoAction = async (videoId, action) => {
    if (!confirm(`Are you sure you want to ${action} this video?`)) return;

    try {
      let result;
      
      if (action === 'delete') {
        result = await AdminService.deleteVideo(videoId);
      } else if (action === 'approve') {
        result = await AdminService.updateVideoStatus(videoId, 'approved');
      } else if (action === 'reject') {
        result = await AdminService.updateVideoStatus(videoId, 'rejected');
      }

      if (result.success) {
        alert(`Video ${action}d successfully`);
        loadVideos();
      } else {
        alert(`Failed to ${action} video: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing video:`, error);
      alert(`Failed to ${action} video`);
    }
  };

  const handleSubscriptionAction = async (subscriptionId, action) => {
    const actionText = action === 'delete' ? 'delete (cancel)' : action;
    if (!confirm(`Are you sure you want to ${actionText} this subscription? All data will be preserved.`)) return;

    try {
      let result;
      
      if (action === 'delete') {
        result = await AdminService.deleteSubscription(subscriptionId);
      } else if (action === 'reactivate') {
        result = await AdminService.reactivateSubscription(subscriptionId);
      }

      if (result.success) {
        alert(`Subscription ${action === 'delete' ? 'canceled' : 'reactivated'} successfully`);
        loadSubscriptions();
      } else {
        alert(`Failed to ${action} subscription: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing subscription:`, error);
      alert(`Failed to ${action} subscription`);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         video.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || video.verification_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-form">
          <h2>Admin Portal Login</h2>
          <p>Please sign in with your admin account to access the admin panel.</p>
          <button 
            onClick={() => {
              // Redirect to Google OAuth login with return URL
              window.location.href = `https://screenmerch.fly.dev/api/auth/google/login?return_url=${encodeURIComponent(window.location.href)}`;
            }}
            className="admin-login-btn"
          >
            Sign in with Google
          </button>
          <p className="admin-login-note">
            Only users with admin privileges can access this panel.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-access-denied">
        <h2>Access Denied</h2>
        <p>You don't have admin privileges to access this panel.</p>
        <button onClick={() => navigate('/')} className="admin-back-btn">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Portal - UPDATED VERSION 2025</h1>
          <div className="admin-user-info">
            <span>Welcome, {user?.user_metadata?.name || user?.email}</span>
            <button onClick={() => navigate('/')} className="admin-logout-btn">
              Back to Site
            </button>
          </div>
        </div>

      <div className="admin-content">
        <div className="admin-sidebar">
          <button 
            className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Management
          </button>
          <button 
            className={`admin-tab ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
          >
            Content Moderation
          </button>
          <button 
            className={`admin-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions
          </button>
          <button 
            className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            System Settings
          </button>
        </div>

        <div className="admin-main">
          {activeTab === 'dashboard' && (
            <div className="admin-dashboard">
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Users</h3>
                  <p className="stat-number">{stats.totalUsers}</p>
                </div>
                <div className="stat-card">
                  <h3>Active Users</h3>
                  <p className="stat-number">{stats.activeUsers}</p>
                </div>
                <div className="stat-card">
                  <h3>Suspended Users</h3>
                  <p className="stat-number">{stats.suspendedUsers}</p>
                </div>
                <div className="stat-card">
                  <h3>Total Videos</h3>
                  <p className="stat-number">{stats.totalVideos}</p>
                </div>
                <div className="stat-card">
                  <h3>Pending Approvals</h3>
                  <p className="stat-number">{stats.pendingVideos}</p>
                </div>
                <div className="stat-card">
                  <h3>Active Subscriptions</h3>
                  <p className="stat-number">{stats.totalSubscriptions}</p>
                </div>
              </div>

              <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  {users.slice(0, 5).map(user => (
                    <div key={user.id} className="activity-item">
                      <span>New user: {user.display_name || user.email}</span>
                      <span>{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="admin-users">
              <div className="admin-filters">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-search"
                />
                <select 
                  value={filterRole} 
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="admin-filter"
                >
                  <option value="all">All Roles</option>
                  <option value="creator">Creators</option>
                  <option value="customer">Customers</option>
                </select>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="admin-filter"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

        <div className="users-table" style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ minWidth: '1200px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th style={{ backgroundColor: '#ffeb3b', color: '#000', minWidth: '200px', position: 'sticky', right: '0' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {console.log('🔍 Rendering users table with', filteredUsers.length, 'users')}
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-info">
                            <img
                              src={user.profile_image_url || user.user_metadata?.picture || user.picture || '/default-avatar.jpg'}
                              alt={user.display_name}
                              className="user-avatar"
                              onError={(e) => {
                                if (!e.target.dataset.fallbackUsed) {
                                  console.log('🖼️ Admin user image failed to load, using default');
                                  e.target.dataset.fallbackUsed = 'true';
                                  e.target.src = '/default-avatar.jpg';
                                }
                              }}
                            />
                            <span>{user.display_name || 'No name'}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            backgroundColor: user.role === 'creator' ? '#e3f2fd' : '#f5f5f5',
                            color: user.role === 'creator' ? '#1976d2' : '#666',
                            textTransform: 'capitalize',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {user.role || 'customer'}
                          </span>
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-badge ${user.status || 'active'}`}>
                            {user.status ? user.status.toUpperCase() : 'ACTIVE'}
                          </span>
                        </td>
                        <td style={{ minWidth: '200px', position: 'sticky', right: '0', backgroundColor: '#fff', zIndex: 10 }}>
                          <div className="action-buttons">
                            {user.status === 'pending' && (
                              <button
                                onClick={() => handleUserAction(user.id, 'approve')}
                                className="action-btn approve"
                                style={{ backgroundColor: '#28a745', color: 'white' }}
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => handleUserAction(user.id, 'suspend')}
                              className="action-btn suspend"
                              disabled={user.status === 'suspended'}
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => handleUserAction(user.id, 'activate')}
                              className="action-btn activate"
                              disabled={user.status === 'active' || user.status === 'pending'}
                            >
                              Activate
                            </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      alert('Delete button clicked!');
                      console.log('🗑️ DELETE BUTTON CLICKED!');
                      console.log('🗑️ User ID:', user.id);
                      console.log('🗑️ User email:', user.email);
                      console.log('🗑️ Event:', e);
                      handleUserAction(user.id, 'delete');
                    }}
                    className="action-btn delete"
                    style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="admin-videos">
              <div className="admin-filters">
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-search"
                />
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="admin-filter"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="videos-table">
                <table>
                  <thead>
                    <tr>
                      <th>Video</th>
                      <th>Creator</th>
                      <th>Status</th>
                      <th>Uploaded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.map(video => (
                      <tr key={video.id}>
                        <td>
                          <div className="video-info">
                            <img 
                              src={video.thumbnail || '/default-thumbnail.jpg'} 
                              alt={video.title}
                              className="video-thumbnail"
                            />
                            <div>
                              <h4>{video.title}</h4>
                              <p>{video.description?.substring(0, 100)}...</p>
                            </div>
                          </div>
                        </td>
                        <td>{video.users?.display_name || video.users?.email}</td>
                        <td>
                          <span className={`status-badge ${video.verification_status}`}>
                            {video.verification_status}
                          </span>
                        </td>
                        <td>{new Date(video.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              onClick={() => handleVideoAction(video.id, 'approve')}
                              className="action-btn approve"
                              disabled={video.verification_status === 'approved'}
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleVideoAction(video.id, 'reject')}
                              className="action-btn reject"
                              disabled={video.verification_status === 'rejected'}
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleVideoAction(video.id, 'delete')}
                              className="action-btn delete"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="admin-subscriptions">
              <h3>Subscription Management</h3>
              <div className="admin-filters">
                <select 
                  value={subscriptionStatusFilter} 
                  onChange={(e) => setSubscriptionStatusFilter(e.target.value)}
                  className="admin-filter"
                >
                  <option value="active">Active Subscriptions</option>
                  <option value="canceled">Canceled Subscriptions</option>
                  <option value="all">All Subscriptions</option>
                </select>
              </div>
              <div className="subscriptions-table">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Tier</th>
                      <th>Status</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th style={{ backgroundColor: '#ffeb3b', color: '#000', minWidth: '150px', position: 'sticky', right: '0' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map(sub => (
                      <tr key={sub.id}>
                        <td>{sub.users?.display_name || sub.users?.email}</td>
                        <td>
                          <span className={`tier-badge ${sub.tier}`}>
                            {sub.tier}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${sub.status}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td>
                          {sub.current_period_start 
                            ? new Date(sub.current_period_start).toLocaleDateString() 
                            : 'N/A'}
                        </td>
                        <td>
                          {sub.current_period_end 
                            ? new Date(sub.current_period_end).toLocaleDateString() 
                            : 'N/A'}
                        </td>
                        <td style={{ minWidth: '150px', position: 'sticky', right: '0', backgroundColor: '#fff', zIndex: 10 }}>
                          <div className="action-buttons">
                            {sub.status === 'canceled' ? (
                              <button
                                onClick={() => handleSubscriptionAction(sub.id, 'reactivate')}
                                className="action-btn activate"
                                style={{ backgroundColor: '#28a745', color: 'white' }}
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSubscriptionAction(sub.id, 'delete')}
                                className="action-btn delete"
                                style={{ backgroundColor: '#dc3545', color: 'white' }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="admin-settings">
              <h3>System Settings</h3>
              <div className="settings-section">
                <h4>Admin Configuration</h4>
                <p>Configure admin emails and system settings here.</p>
                <div className="setting-item">
                  <label>Admin Emails (comma-separated):</label>
                  <input 
                    type="text" 
                    placeholder="admin@example.com, admin2@example.com"
                    className="setting-input"
                  />
                </div>
                <button className="save-settings-btn">Save Settings</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin; 