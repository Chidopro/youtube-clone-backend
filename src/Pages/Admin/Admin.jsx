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
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
      const result = await AdminService.getUsers(0, 100, searchTerm, filterStatus);
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
      const data = await AdminService.getSubscriptions();
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
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      let result;
      
      if (action === 'delete') {
        result = await AdminService.deleteUser(userId);
      } else if (action === 'suspend') {
        result = await AdminService.updateUserStatus(userId, 'suspended');
      } else if (action === 'activate') {
        result = await AdminService.updateUserStatus(userId, 'active');
      }

      if (result.success) {
        alert(`User ${action}d successfully`);
        loadUsers();
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesStatus;
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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Portal</h1>
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
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="admin-filter"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="users-table">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-info">
                            <img 
                              src={user.profile_image_url || '/default-avatar.jpg'} 
                              alt={user.display_name}
                              className="user-avatar"
                            />
                            <span>{user.display_name || 'No name'}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-badge ${user.status || 'active'}`}>
                            {user.status || 'active'}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
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
                              disabled={user.status === 'active'}
                            >
                              Activate
                            </button>
                            <button 
                              onClick={() => handleUserAction(user.id, 'delete')}
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
              <div className="subscriptions-table">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Tier</th>
                      <th>Status</th>
                      <th>Start Date</th>
                      <th>End Date</th>
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
                        <td>{new Date(sub.current_period_start).toLocaleDateString()}</td>
                        <td>{new Date(sub.current_period_end).toLocaleDateString()}</td>
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