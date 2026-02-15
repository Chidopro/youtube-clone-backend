import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { AdminService } from '../../utils/adminService';
import { getPrintAreaDimensions } from '../../config/printAreaConfig';
import './Admin.css';

const Admin = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [recentActivityUsers, setRecentActivityUsers] = useState([]); // 5 most recent signups (all roles) for dashboard
  const [videos, setVideos] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('creator'); // Default to showing creators
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('active'); // Filter for subscriptions
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [creatorsPayoutList, setCreatorsPayoutList] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [pendingApprovalUsers, setPendingApprovalUsers] = useState([]);
  const [pendingApprovalLoading, setPendingApprovalLoading] = useState(false);
  const [addToPendingEmail, setAddToPendingEmail] = useState('');
  const [addToPendingMessage, setAddToPendingMessage] = useState('');
  const [addToPendingLoading, setAddToPendingLoading] = useState(false);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [processingHistory, setProcessingHistory] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [queueStatusFilter, setQueueStatusFilter] = useState('all');
  const [queueLoading, setQueueLoading] = useState(false);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [isOrderProcessingAdmin, setIsOrderProcessingAdmin] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [adminSignupRequests, setAdminSignupRequests] = useState([]);
  const [allAdmins, setAllAdmins] = useState([]);
  const [subdomains, setSubdomains] = useState([]);
  const [subdomainSearchTerm, setSubdomainSearchTerm] = useState('');
  const [subdomainLoading, setSubdomainLoading] = useState(false);
  const [editingSubdomain, setEditingSubdomain] = useState(null);
  const [editSubdomainValue, setEditSubdomainValue] = useState('');
  const [platformRevenue, setPlatformRevenue] = useState(null);
  const [platformRevenueLoading, setPlatformRevenueLoading] = useState(false);
  const [revenueStartDate, setRevenueStartDate] = useState('');
  const [revenueEndDate, setRevenueEndDate] = useState('');
  const [revenueCreatorFilter, setRevenueCreatorFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState(null); // Track which cart item is being processed
  const [step1Processing, setStep1Processing] = useState(false);
  const [step2Processing, setStep2Processing] = useState(false);
  const [step3Processing, setStep3Processing] = useState(false);
  const [processedImage, setProcessedImage] = useState(null);
  const [original300DpiImage, setOriginal300DpiImage] = useState(null); // Store the original 300 DPI image (Step 1 result)
  const [processedImages, setProcessedImages] = useState({}); // Store processed images for each cart item: {itemIndex: {processedImage, original300Dpi}}
  const [printQualitySettings, setPrintQualitySettings] = useState({
    print_dpi: 300,
    edge_feather: false,
    soft_corners: false,
    crop_area: { x: '', y: '', width: '', height: '' },
    feather_edge_percent: 0,
    corner_radius_percent: 0,
    frame_enabled: false,
    frame_color: '#FF0000',
    frame_width: 10,
    double_frame: false,
    add_white_background: false
  });
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

  // Reload recent activity when viewing dashboard so new creator sign-ups appear
  useEffect(() => {
    if (isAdmin && isMasterAdmin && activeTab === 'dashboard') {
      loadRecentActivityUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isMasterAdmin, activeTab]);

  // Reload subscriptions when filter changes
  useEffect(() => {
    if (isAdmin && activeTab === 'subscriptions') {
      loadSubscriptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionStatusFilter, isAdmin, activeTab]);

  // Reload payouts when tab changes
  useEffect(() => {
    if (isAdmin && activeTab === 'payouts') {
      loadPayouts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab]);

  // Reload pending approval list when tab changes
  useEffect(() => {
    if (isAdmin && isMasterAdmin && activeTab === 'pending-approval') {
      loadPendingApprovalUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isMasterAdmin, activeTab]);

  // Reload processing queue when tab changes
  useEffect(() => {
    if (isAdmin && activeTab === 'order-processing') {
      loadProcessingQueue();
      loadProcessingHistory();
      // Only load workers for Master Admins
      if (isMasterAdmin) {
        loadWorkers();
        // Load platform revenue if on that tab
        if (activeTab === 'platform-revenue') {
          loadPlatformRevenue();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab, queueStatusFilter, isMasterAdmin]);


  // Reload admin management data when tab changes
  useEffect(() => {
    if (isMasterAdmin && activeTab === 'admin-management') {
      loadAdminSignupRequests();
      loadAllAdmins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMasterAdmin, activeTab]);

  // Auto-apply effects when slider values change (similar to Tools Page)
  useEffect(() => {
    // Only auto-apply if we have the base 300 DPI image
    if (!original300DpiImage) return;
    
    const hasEffects = 
      (printQualitySettings.edge_feather && printQualitySettings.feather_edge_percent > 0) ||
      (printQualitySettings.soft_corners && printQualitySettings.corner_radius_percent > 0) ||
      (printQualitySettings.frame_enabled && printQualitySettings.frame_width > 0);
    
    // Debounce the API call to avoid too many requests while sliding
    const timeoutId = setTimeout(async () => {
      try {
        if (hasEffects) {
          // Apply effects if any are enabled
          const processedImageUrl = await applyBothEffects();
          if (processedImageUrl && processedImageUrl.startsWith('data:image')) {
            saveProcessedImage(processedImageUrl);
          }
        } else {
          // Reset to original 300 DPI image if no effects are enabled
          setProcessedImage({
            success: true,
            screenshot: original300DpiImage
          });
        }
      } catch (error) {
        console.error('Error auto-applying effects:', error);
        // Don't show alert on auto-apply errors, just log
      }
    }, 500); // 500ms debounce - wait for user to stop sliding

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    original300DpiImage,
    printQualitySettings.feather_edge_percent,
    printQualitySettings.corner_radius_percent,
    printQualitySettings.edge_feather,
    printQualitySettings.soft_corners,
    printQualitySettings.frame_enabled,
    printQualitySettings.frame_width,
    printQualitySettings.frame_color,
    printQualitySettings.double_frame,
    printQualitySettings.add_white_background
  ]);

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
      const isUserMasterAdmin = await AdminService.isMasterAdmin();
      const isUserFullAdmin = await AdminService.isFullAdmin(); // This now only returns true for master_admin
      const isUserOrderProcessingAdmin = await AdminService.isOrderProcessingAdmin();

      console.log('🔐 Admin Status Check:', {
        isUserAdmin,
        isUserFullAdmin,
        isUserOrderProcessingAdmin,
        userEmail: user?.email || user?.user_metadata?.email,
        userId: user?.id
      });

      if (!isUserAdmin) {
        alert('Access denied. Admin privileges required.');
        navigate('/');
        return;
      }

      setIsAdmin(true);
      setIsMasterAdmin(isUserMasterAdmin);
      setIsFullAdmin(isUserFullAdmin); // This is now the same as isMasterAdmin
      setIsOrderProcessingAdmin(isUserOrderProcessingAdmin);
      
      console.log('✅ Admin access granted. Master Admin:', isUserMasterAdmin, 'Order Processing Admin:', isUserOrderProcessingAdmin);
      
      // Set default tab based on role
      if (isUserOrderProcessingAdmin && !isUserMasterAdmin) {
        // Order processing admin only - default to order processing tab
        setActiveTab('order-processing');
        // Don't load workers for order processing admins
        loadProcessingHistory();
        // Load queue after state is set (will be triggered by useEffect)
      } else if (isUserMasterAdmin) {
        // Master admin - default to dashboard
        loadAdminData();
      }
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
      loadRecentActivityUsers(),
      loadVideos(),
      loadSubscriptions(),
      loadStats()
    ]);
  };

  /** Load 5 most recent active (approved) users for Recent Activity. Pending creators show in Pending Approval until approved. */
  const loadRecentActivityUsers = async () => {
    try {
      const result = await AdminService.getUsers(0, 5, '', 'active', 'all');
      setRecentActivityUsers(result.users || []);
    } catch (error) {
      console.error('Error loading recent activity users:', error);
    }
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

  const loadPayouts = async () => {
    setPayoutLoading(true);
    try {
      const [pending, history, creators] = await Promise.all([
        AdminService.getPendingPayouts(),
        AdminService.getPayoutHistory(),
        AdminService.getCreatorsPayoutList()
      ]);
      setPendingPayouts(pending);
      setPayoutHistory(history);
      setCreatorsPayoutList(creators);
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setPayoutLoading(false);
    }
  };

  const loadPendingApprovalUsers = async () => {
    setPendingApprovalLoading(true);
    try {
      const list = await AdminService.getPendingCreators();
      setPendingApprovalUsers(list);
    } catch (error) {
      console.error('Error loading pending approval:', error);
    } finally {
      setPendingApprovalLoading(false);
    }
  };

  const handleApproveCreator = async (userId) => {
    const result = await AdminService.approveCreator(userId);
    if (result.success) {
      await loadPendingApprovalUsers();
      loadStats();
    } else {
      alert(result.error || 'Failed to approve');
    }
  };

  const handleDisapproveCreator = async (userId) => {
    if (!window.confirm('Disapprove this creator? They will not be able to use the platform.')) return;
    const result = await AdminService.disapproveCreator(userId);
    if (result.success) {
      await loadPendingApprovalUsers();
      loadStats();
    } else {
      alert(result.error || 'Failed to disapprove');
    }
  };

  const handleAddToPending = async () => {
    const email = addToPendingEmail.trim().toLowerCase();
    if (!email) {
      setAddToPendingMessage('Please enter an email address.');
      return;
    }
    setAddToPendingMessage('');
    setAddToPendingLoading(true);
    try {
      const result = await AdminService.setCreatorPending(email);
      if (result.success) {
        setAddToPendingEmail('');
        setAddToPendingMessage(result.message || 'Creator added to Pending Approval list.');
        await loadPendingApprovalUsers();
        loadStats();
      } else {
        setAddToPendingMessage(result.error || 'Failed to add to pending');
      }
    } finally {
      setAddToPendingLoading(false);
    }
  };

  const loadProcessingQueue = async () => {
    setQueueLoading(true);
    try {
      const data = await AdminService.getProcessingQueue(queueStatusFilter);
      
      // For Order Processing Admins (not Master Admins), only show orders assigned to them
      if (isOrderProcessingAdmin && !isMasterAdmin) {
        // Get the database user ID from the users table
        const userEmail = user?.email || user?.user_metadata?.email;
        if (userEmail) {
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .ilike('email', userEmail)
            .single();
          
          if (userData?.id) {
            const filteredData = data.filter(queueItem => queueItem.assigned_to === userData.id);
            setProcessingQueue(filteredData);
          } else {
            setProcessingQueue([]);
          }
        } else {
          setProcessingQueue([]);
        }
      } else {
        setProcessingQueue(data);
      }
    } catch (error) {
      console.error('Error loading processing queue:', error);
    } finally {
      setQueueLoading(false);
    }
  };

  const loadProcessingHistory = async () => {
    try {
      const data = await AdminService.getProcessingHistory(50);
      setProcessingHistory(data);
    } catch (error) {
      console.error('Error loading processing history:', error);
    }
  };

  const loadWorkers = async () => {
    try {
      const data = await AdminService.getWorkers();
      setWorkers(data);
    } catch (error) {
      console.error('Error loading workers:', error);
    }
  };

  const loadAdminSignupRequests = async () => {
    try {
      const data = await AdminService.getAdminSignupRequests();
      setAdminSignupRequests(data);
    } catch (error) {
      console.error('Error loading admin signup requests:', error);
    }
  };

  const loadAllAdmins = async () => {
    try {
      const data = await AdminService.getAllAdmins();
      setAllAdmins(data);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const handleApproveAdminRequest = async (requestId, adminRole) => {
    try {
      const result = await AdminService.approveAdminSignupRequest(requestId, adminRole);
      if (result.success) {
        alert('Admin request approved successfully! Please set up the user in Supabase Auth with the provided password.');
        loadAdminSignupRequests();
        loadAllAdmins();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error approving admin request:', error);
      alert('Failed to approve admin request');
    }
  };

  const handleRejectAdminRequest = async (requestId) => {
    const notes = prompt('Enter rejection notes (optional):');
    try {
      const result = await AdminService.rejectAdminSignupRequest(requestId, notes || '');
      if (result.success) {
        alert('Admin request rejected');
        loadAdminSignupRequests();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error rejecting admin request:', error);
      alert('Failed to reject admin request');
    }
  };

  const handleUpdateAdminRole = async (userId, newRole) => {
    try {
      const result = await AdminService.updateAdminRole(userId, newRole);
      if (result.success) {
        alert('Admin role updated successfully');
        loadAllAdmins();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating admin role:', error);
      alert('Failed to update admin role');
    }
  };

  const handleRemoveAdminAccess = async (userId) => {
    if (!window.confirm('Are you sure you want to remove admin access from this user?')) {
      return;
    }
    try {
      const result = await AdminService.removeAdminAccess(userId);
      if (result.success) {
        alert('Admin access removed successfully');
        loadAllAdmins();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing admin access:', error);
      alert('Failed to remove admin access');
    }
  };

  // STEP 1: Generate 300 DPI Image (Standalone) - works with selected cart item
  const generate300DpiImage = async () => {
    if (selectedCartItemIndex === null || !selectedOrder || !selectedOrder.cart) {
      alert('Please select a cart item first');
      return;
    }
    
    const item = selectedOrder.cart[selectedCartItemIndex];
    if (!item || (!item.img && !item.selected_screenshot)) {
      alert('No screenshot found for this item');
      return;
    }

    setStep1Processing(true);
    setProcessedImage(null);
    setOriginal300DpiImage(null);

    try {
      const screenshotData = item.selected_screenshot || item.img;
      const apiUrl = process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev';
      
      // Get print area dimensions for this product
      const productName = item.product || '';
      const productSize = (item.variants || {}).size || null;
      const printDimensions = getPrintAreaDimensions(productName, productSize, 'front');
      
      const requestBody = {
        thumbnail_data: screenshotData,
        print_dpi: printQualitySettings.print_dpi,
        soft_corners: false,  // No effects in step 1
        edge_feather: false,  // No effects in step 1
        frame_enabled: false, // No frame in step 1
        corner_radius_percent: 0,
        feather_edge_percent: 0
      };
      
      // Add print area dimensions if available
      if (printDimensions) {
        requestBody.print_area_width = printDimensions.width;
        requestBody.print_area_height = printDimensions.height;
        console.log(`📐 [PRINT_QUALITY] Using print area dimensions for ${productName} (${productSize || 'default'}): ${printDimensions.width}"x${printDimensions.height}"`);
      } else {
        console.warn(`⚠️ [PRINT_QUALITY] No print area dimensions found for product: ${productName}`);
      }
      
      const response = await fetch(`${apiUrl}/api/process-thumbnail-print-quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate 300 DPI image');
      }

      // Validate that we have image data
      if (!result.screenshot || !result.screenshot.startsWith('data:image')) {
        console.error('Invalid image data received:', result);
        throw new Error('Invalid image data received from server');
      }

      console.log('✅ 300 DPI image generated successfully, length:', result.screenshot.length);
      setOriginal300DpiImage(result.screenshot); // Store original 300 DPI image
      setProcessedImage(result);
    } catch (error) {
      console.error('Error generating 300 DPI image:', error);
      alert(`Error generating 300 DPI image: ${error.message}`);
    } finally {
      setStep1Processing(false);
    }
  };

  // Helper function to apply both effects together (like email generator)
  // Uses the SAME unified API endpoint that the email generator uses
  // This ensures both effects work together correctly
  // Optional settings parameter allows using updated settings before state is updated
  const applyBothEffects = async (settingsOverride = null) => {
    if (!original300DpiImage) {
      throw new Error('No 300 DPI image available. Please complete Step 1 first.');
    }

    // Use override settings if provided, otherwise use current state
    const settings = settingsOverride || printQualitySettings;
    const edgeFeather = settings.edge_feather;
    const softCorners = settings.soft_corners;
    const featherValue = edgeFeather ? (settings.feather_edge_percent || 0) : 0;
    const cornerRadiusPercent = softCorners ? (settings.corner_radius_percent || 0) : 0;
    const apiUrl = process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev';

    const frameEnabled = settings.frame_enabled || false;
    const frameColor = settings.frame_color || '#FF0000';
    const frameWidth = settings.frame_width || 10;
    const doubleFrame = settings.double_frame || false;
    
    console.log(`applyBothEffects: Using unified API (like email generator). Corner: ${cornerRadiusPercent}%, Feather: ${featherValue}%, Frame: ${frameEnabled ? `enabled (${frameColor}, ${frameWidth}px, double: ${doubleFrame})` : 'disabled'}`);

    // Get print area dimensions for this product (same as Step 1)
    let printDimensions = null;
    if (selectedOrder && selectedCartItemIndex !== null) {
      const item = selectedOrder.cart[selectedCartItemIndex];
      if (item) {
        const productName = item.product || '';
        const productSize = (item.variants || {}).size || null;
        printDimensions = getPrintAreaDimensions(productName, productSize, 'front');
      }
    }

    // Use the SAME unified endpoint that the email generator uses
    // This applies both effects together in one call, ensuring they work correctly
    try {
      const requestBody = {
        thumbnail_data: original300DpiImage, // Always start from original 300 DPI image
        print_dpi: settings.print_dpi || 300, // Keep same DPI
        soft_corners: softCorners, // Pass checkbox state
        edge_feather: edgeFeather, // Pass checkbox state
        corner_radius_percent: cornerRadiusPercent, // Pass actual percent (0-100)
        feather_edge_percent: featherValue, // Pass actual percent (0-100)
        frame_enabled: frameEnabled, // Pass frame enabled state
        frame_color: frameColor, // Pass frame color
        frame_width: frameWidth, // Pass frame width
        double_frame: doubleFrame, // Pass double frame flag
        add_white_background: settings.add_white_background || false // Pass white background flag
      };
      
      // Add print area dimensions if available (to maintain exact size)
      if (printDimensions) {
        requestBody.print_area_width = printDimensions.width;
        requestBody.print_area_height = printDimensions.height;
      }
      
      const response = await fetch(`${apiUrl}/api/process-thumbnail-print-quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      console.log(`Unified API response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log(`Unified API result:`, { success: result.success, hasImage: !!result.screenshot });
        
        if (result.success && result.screenshot) {
          console.log('✅ Both effects applied successfully using unified API');
          return result.screenshot;
        } else {
          console.error('Unified API returned success but no screenshot:', result);
          throw new Error(result.error || 'Failed to apply effects - no image returned');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Unified API error:', response.status, errorData);
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error applying effects with unified API:', error);
      throw error;
    }
  };

  // Helper function to save processed image for the selected cart item
  const saveProcessedImage = (processedImageUrl) => {
    if (selectedCartItemIndex !== null) {
      // Validate image URL before saving
      if (!processedImageUrl || !processedImageUrl.startsWith('data:image')) {
        console.error('Invalid image URL in saveProcessedImage:', processedImageUrl?.substring(0, 100));
        alert('Error: Invalid image data received. Please try again.');
        return;
      }
      
      console.log('Saving processed image, URL length:', processedImageUrl.length);
      
      setProcessedImages(prev => ({
        ...prev,
        [selectedCartItemIndex]: {
          processedImage: processedImageUrl,
          original300Dpi: original300DpiImage
        }
      }));
      setProcessedImage({
        success: true,
        screenshot: processedImageUrl
      });
      
      console.log('✅ Processed image saved and displayed');
    }
  };

  // STEP 2: Apply Feather Effect (applies both effects together)
  const applyFeatherEffect = async () => {
    if (selectedCartItemIndex === null) {
      alert('Please select a cart item first');
      return;
    }
    
    if (!printQualitySettings.edge_feather) {
      alert('Please enable "Edge Feathering" first');
      return;
    }

    if (!original300DpiImage) {
      alert('Please complete Step 1 (Generate 300 DPI Image) first');
      return;
    }

    setStep2Processing(true);

    try {
      // applyBothEffects always starts from original300DpiImage and applies both effects
      const processedImageUrl = await applyBothEffects();
      
      if (processedImageUrl) {
        const featherValue = printQualitySettings.feather_edge_percent || 0;
        const cornerRadiusPercent = printQualitySettings.soft_corners ? (printQualitySettings.corner_radius_percent || 0) : 0;
        const cornerRadiusDisplay = cornerRadiusPercent === 100 ? 'Circle' : cornerRadiusPercent + '%';
        const frameEnabled = printQualitySettings.frame_enabled || false;
        let effectsText = '';
        if (featherValue > 0) effectsText += `Feather: ${featherValue}%`;
        if (cornerRadiusPercent > 0) effectsText += (effectsText ? ', ' : '') + `Corner Radius: ${cornerRadiusDisplay}`;
        if (frameEnabled) effectsText += (effectsText ? ', ' : '') + `Frame: ${printQualitySettings.frame_width}px ${printQualitySettings.double_frame ? '(Double)' : ''}`;
        if (!effectsText) effectsText = 'Effects applied';
        
        console.log(`✅ Effects applied: ${effectsText}`);
        
        // Save processed image for this cart item
        saveProcessedImage(processedImageUrl);
      } else {
        throw new Error('Failed to apply effects - no image returned');
      }
    } catch (error) {
      console.error('Error applying feather effect:', error);
      alert(`Error applying feather effect: ${error.message}`);
    } finally {
      setStep2Processing(false);
    }
  };

  // STEP 3: Apply Corner Radius (applies both effects together)
  const applyCornerRadius = async () => {
    if (selectedCartItemIndex === null) {
      alert('Please select a cart item first');
      return;
    }
    
    if (!printQualitySettings.soft_corners) {
      alert('Please enable "Rounded Corners" first');
      return;
    }

    if (printQualitySettings.corner_radius_percent <= 0) {
      alert('Please set a corner radius value greater than 0%');
      return;
    }

    if (!original300DpiImage) {
      alert('Please complete Step 1 (Generate 300 DPI Image) first');
      return;
    }

    setStep3Processing(true);

    try {
      // applyBothEffects always starts from original300DpiImage and applies both effects
      const processedImageUrl = await applyBothEffects();
      
      if (processedImageUrl) {
        // Validate image URL format
        if (!processedImageUrl.startsWith('data:image')) {
          console.error('Invalid image URL format:', processedImageUrl?.substring(0, 100));
          throw new Error('Invalid image data received from server');
        }
        
        console.log('✅ Corner radius applied successfully, image URL length:', processedImageUrl.length);
        
        const cornerRadiusPercent = printQualitySettings.corner_radius_percent || 0;
        const cornerRadiusDisplay = cornerRadiusPercent === 100 ? 'Circle' : cornerRadiusPercent + '%';
        const featherValue = printQualitySettings.edge_feather ? (printQualitySettings.feather_edge_percent || 0) : 0;
        const frameEnabled = printQualitySettings.frame_enabled || false;
        let effectsText = '';
        if (cornerRadiusPercent > 0) effectsText += `Corner Radius: ${cornerRadiusDisplay}`;
        if (featherValue > 0) effectsText += (effectsText ? ', ' : '') + `Feather: ${featherValue}%`;
        if (frameEnabled) effectsText += (effectsText ? ', ' : '') + `Frame: ${printQualitySettings.frame_width}px ${printQualitySettings.double_frame ? '(Double)' : ''}`;
        if (!effectsText) effectsText = 'Effects applied';
        
        console.log(`✅ Effects applied: ${effectsText}`);
        
        // Save processed image for this cart item
        saveProcessedImage(processedImageUrl);
      } else {
        throw new Error('Failed to apply effects - no image returned');
      }
    } catch (error) {
      console.error('Error applying corner radius:', error);
      alert(`Error applying corner radius: ${error.message}`);
    } finally {
      setStep3Processing(false);
    }
  };

  const downloadProcessedImage = () => {
    if (!processedImage || !processedImage.screenshot) {
      return;
    }

    const link = document.createElement('a');
    link.href = processedImage.screenshot;
    link.download = `print-quality-${selectedOrder?.order_id || 'image'}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAssignOrder = async (queueId, workerId) => {
    if (!workerId) {
      alert('Please select a worker');
      return;
    }

    try {
      const result = await AdminService.assignOrderToWorker(queueId, workerId);
      if (result.success) {
        alert('Order assigned successfully');
        loadProcessingQueue();
      } else {
        alert(`Failed to assign order: ${result.error}`);
      }
    } catch (error) {
      console.error('Error assigning order:', error);
      alert('Failed to assign order');
    }
  };

  const handleDeleteOrder = async (queueId, orderId) => {
    if (!confirm(`Are you sure you want to delete order ${orderId ? orderId.slice(0, 8) : queueId}? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await AdminService.deleteOrder(queueId);
      if (result.success) {
        alert('Order deleted successfully');
        loadProcessingQueue();
      } else {
        alert(`Failed to delete order: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order');
    }
  };

  const loadStats = async () => {
    try {
      const data = await AdminService.getDashboardStats();
      setStats({
        totalUsers: data.total_users || 0,
        totalVideos: data.total_videos || 0,
        creatorCount: data.creator_count ?? 0,
        customerCount: data.customer_count ?? 0,
        pendingVideos: data.pending_videos || 0,
        pendingUsers: data.pending_users || 0,
        activeUsers: data.active_users || 0,
        suspendedUsers: data.suspended_users || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPlatformRevenue = async () => {
    setPlatformRevenueLoading(true);
    try {
      const result = await AdminService.getPlatformRevenue(
        revenueStartDate || null,
        revenueEndDate || null,
        revenueCreatorFilter || null
      );
      if (result.success) {
        setPlatformRevenue(result);
      } else {
        console.error('Error loading platform revenue:', result.error);
        alert(`Failed to load platform revenue: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading platform revenue:', error);
      alert('Failed to load platform revenue');
    } finally {
      setPlatformRevenueLoading(false);
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

  const handleResetAnalytics = async (userId, userEmail) => {
    if (!confirm('⚠️ WARNING: This will permanently delete all sales and analytics data for this creator. This action cannot be undone. Are you absolutely sure?')) {
      return;
    }
    
    if (!confirm('This is your final warning. All sales records and analytics will be deleted. Continue?')) {
      return;
    }

    try {
      const result = await AdminService.resetSales(userId);
      
      if (result.success) {
        alert(`✅ Analytics reset successfully! Deleted ${result.deleted_count || 0} sales records for ${userEmail || 'this creator'}.`);
      } else {
        alert(`❌ Failed to reset analytics: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error resetting analytics:', error);
      alert(`❌ Error resetting analytics: ${error.message}`);
    }
  }; // Trigger Netlify rebuild

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

  const handleProcessPayout = async (payout) => {
    if (!payout.paypal_email) {
      alert('This creator has not set up their PayPal email. Please ask them to add it in their dashboard.');
      return;
    }

    const confirmMessage = `Process payout of $${payout.pending_amount.toFixed(2)} to ${payout.display_name}?\n\nPayPal: ${payout.paypal_email}\n\nThis will mark ${payout.earnings_count} earnings as paid.`;
    if (!confirm(confirmMessage)) return;

    setPayoutLoading(true);
    try {
      const earningsIds = payout.earnings.map(e => e.id);
      const result = await AdminService.processPayout(
        payout.user_id,
        payout.pending_amount,
        earningsIds
      );

      if (result.success) {
        alert(`Payout processed successfully! Amount: $${payout.pending_amount.toFixed(2)}`);
        await loadPayouts();
      } else {
        alert(`Failed to process payout: ${result.error}`);
      }
    } catch (error) {
      console.error('Error processing payout:', error);
      alert('Failed to process payout');
    } finally {
      setPayoutLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = user.display_name?.toLowerCase().includes(searchLower) ||
                         user.email?.toLowerCase().includes(searchLower) ||
                         user.subdomain?.toLowerCase().includes(searchLower);
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
          <p>Please sign in with your Google account to access the admin panel.</p>
          <button 
            onClick={async () => {
              const apiBase = (window.location.origin === 'https://screenmerch.com' || window.location.origin === 'https://www.screenmerch.com') ? '' : 'https://screenmerch.fly.dev';
              const url = `${apiBase}/api/auth/google/login?return_url=${encodeURIComponent(window.location.href)}&format=json`;
              try {
                const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
                const data = await res.json().catch(() => ({}));
                if (data.auth_url) { window.location.href = data.auth_url; return; }
              } catch (_) {}
              window.location.href = url.replace('&format=json', '');
            }}
            className="admin-login-btn"
          >
            Sign in with Google
          </button>
          <p className="admin-login-note">
            Only users with admin privileges can access this panel. Admin access requires Google OAuth sign-in for security.
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
          <h1>
            {isMasterAdmin ? 'Admin Portal - UPDATED VERSION 2025' : 'Order Processing Portal'}
          </h1>
          <div className="admin-user-info">
            <span>
              Welcome, {user?.user_metadata?.name || user?.email}
              {isMasterAdmin && (
                <span style={{ fontSize: '14px', color: '#ff6b6b', marginLeft: '10px', fontWeight: 'bold' }}>
                  (Master Admin)
                </span>
              )}
              {isOrderProcessingAdmin && !isFullAdmin && (
                <span style={{ fontSize: '14px', color: '#999', marginLeft: '10px' }}>
                  (Order Processing Admin)
                </span>
              )}
            </span>
            <button onClick={() => navigate('/')} className="admin-logout-btn">
              Back to Site
            </button>
          </div>
        </div>

      <div className="admin-content">
        <div className="admin-sidebar">
          {isFullAdmin && (
            <>
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
                className={`admin-tab ${activeTab === 'payouts' ? 'active' : ''}`}
                onClick={() => setActiveTab('payouts')}
              >
                💰 Payouts
              </button>
              {isMasterAdmin && (
                <button 
                  className={`admin-tab ${activeTab === 'pending-approval' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pending-approval')}
                >
                  ⏳ Pending Approval
                </button>
              )}
            </>
          )}
          {(isFullAdmin || isOrderProcessingAdmin) && (
            <button 
              className={`admin-tab ${activeTab === 'order-processing' ? 'active' : ''}`}
              onClick={() => setActiveTab('order-processing')}
            >
              📦 Order Processing
            </button>
          )}
          {isMasterAdmin && (
            <button 
              className={`admin-tab ${activeTab === 'admin-management' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-management')}
            >
              👥 Admin Management
            </button>
          )}
          {isMasterAdmin && (
            <button 
              className={`admin-tab ${activeTab === 'platform-revenue' ? 'active' : ''}`}
              onClick={() => setActiveTab('platform-revenue')}
            >
              💵 Platform Revenue
            </button>
          )}
        </div>

        <div className="admin-main">
          {activeTab === 'dashboard' && isMasterAdmin && (
            <div className="admin-dashboard">
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Users</h3>
                  <p className="stat-number">{stats.totalUsers}</p>
                </div>
                <div className="stat-card">
                  <h3>Total Videos</h3>
                  <p className="stat-number">{stats.totalVideos}</p>
                </div>
                <div className="stat-card">
                  <h3>Creator Count</h3>
                  <p className="stat-number">{stats.creatorCount}</p>
                </div>
                <div className="stat-card">
                  <h3>Customer Count</h3>
                  <p className="stat-number">{stats.customerCount}</p>
                </div>
              </div>

              <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  {recentActivityUsers.map(user => (
                    <div key={user.id} className="activity-item">
                      <span>New user: {user.display_name || user.email}</span>
                      <span>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && isMasterAdmin && (
            <div className="admin-users">
              <div className="admin-filters">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadUsers(); }}
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
          <table style={{ minWidth: '1400px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Subdomain</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th className="users-table-actions-header">Actions</th>
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
                          <span className={`role-badge role-badge--${user.role === 'creator' ? 'creator' : 'customer'}`}>
                            {user.role || 'customer'}
                          </span>
                        </td>
                        <td>
                          {editingSubdomain === user.id ? (
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={editSubdomainValue}
                                onChange={(e) => setEditSubdomainValue(e.target.value)}
                                placeholder="subdomain"
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  width: '150px'
                                }}
                              />
                              <button
                                onClick={async () => {
                                  const result = await AdminService.updateSubdomain(user.id, editSubdomainValue);
                                  if (result.success) {
                                    alert(result.message || 'Subdomain updated successfully!');
                                    setEditingSubdomain(null);
                                    setEditSubdomainValue('');
                                    loadUsers(); // Reload to get updated data
                                  } else {
                                    alert(`Error: ${result.error}`);
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingSubdomain(null);
                                  setEditSubdomainValue('');
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              {user.subdomain ? (
                                <>
                                  <a
                                    href={`https://${user.subdomain}.screenmerch.com`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: '#667eea',
                                      textDecoration: 'none',
                                      fontSize: '12px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {user.subdomain}
                                  </a>
                                  {isMasterAdmin && (
                                    <>
                                      <button
                                        onClick={async () => {
                                          const result = await AdminService.validateSubdomain(user.subdomain);
                                          if (result.success) {
                                            if (result.is_accessible) {
                                              alert(`✅ Subdomain is accessible! Status: ${result.status_code || 'OK'}`);
                                            } else {
                                              alert(`❌ Subdomain is not accessible. ${result.error || 'Check DNS configuration.'}`);
                                            }
                                          } else {
                                            alert(`Error validating subdomain: ${result.error}`);
                                          }
                                        }}
                                        style={{
                                          padding: '2px 6px',
                                          fontSize: '10px',
                                          backgroundColor: '#667eea',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer'
                                        }}
                                        title="Validate subdomain"
                                      >
                                        🔍
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSubdomain(user.id);
                                          setEditSubdomainValue(user.subdomain);
                                        }}
                                        style={{
                                          padding: '2px 6px',
                                          fontSize: '10px',
                                          backgroundColor: '#ffc107',
                                          color: 'black',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer'
                                        }}
                                        title="Edit subdomain"
                                      >
                                        ✏️
                                      </button>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#999', fontSize: '12px' }}>No subdomain</span>
                                  {isMasterAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSubdomain(user.id);
                                        setEditSubdomainValue('');
                                      }}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                      }}
                                      title="Add subdomain"
                                    >
                                      +
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-badge ${user.status || 'active'}`}>
                            {user.status ? user.status.toUpperCase() : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="users-table-actions-cell">
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
                            {isMasterAdmin && user.role === 'creator' && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleResetAnalytics(user.id, user.email);
                                }}
                                className="action-btn reset-analytics"
                                style={{ 
                                  backgroundColor: '#ff9800', 
                                  color: 'white', 
                                  padding: '8px 16px', 
                                  fontSize: '14px', 
                                  cursor: 'pointer',
                                  marginLeft: '4px'
                                }}
                                title="Reset all sales and analytics data for this creator"
                              >
                                🔄 Reset Analytics
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

          {activeTab === 'videos' && isMasterAdmin && (
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

          {activeTab === 'subscriptions' && isMasterAdmin && (() => {
            const creatorSubs = subscriptions.filter(sub => sub.users?.role === 'creator');
            const customerSubs = subscriptions.filter(sub => sub.users?.role !== 'creator');
            const renderSubTable = (list, emptyLabel) => (
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>User email</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th style={{ backgroundColor: '#ffeb3b', color: '#000', minWidth: '150px', position: 'sticky', right: '0' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '12px', color: '#666' }}>{emptyLabel}</td></tr>
                  ) : (
                    list.map(sub => (
                      <tr key={sub.id}>
                        <td>{sub.users?.display_name || '—'}</td>
                        <td>{sub.users?.email || sub.email || '—'}</td>
                        <td><span className={`tier-badge ${sub.tier}`}>{sub.tier}</span></td>
                        <td><span className={`status-badge ${sub.status}`}>{sub.status}</span></td>
                        <td>{sub.current_period_start ? new Date(sub.current_period_start).toLocaleDateString() : 'N/A'}</td>
                        <td>{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ minWidth: '150px', position: 'sticky', right: '0', backgroundColor: '#fff', zIndex: 10 }}>
                          <div className="action-buttons">
                            {sub.status === 'canceled' ? (
                              <button onClick={() => handleSubscriptionAction(sub.id, 'reactivate')} className="action-btn activate" style={{ backgroundColor: '#28a745', color: 'white' }}>Reactivate</button>
                            ) : (
                              <button onClick={() => handleSubscriptionAction(sub.id, 'delete')} className="action-btn delete" style={{ backgroundColor: '#dc3545', color: 'white' }}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            );
            return (
            <div className="admin-subscriptions">
              <h3>Subscription Management</h3>
              <p className="admin-note" style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                To fully delete a user and reuse their email, you must also delete them in Supabase: <strong>Authentication → Users</strong> (and optionally the row in Table Editor → users).
              </p>
              <div className="admin-filters">
                <select value={subscriptionStatusFilter} onChange={(e) => setSubscriptionStatusFilter(e.target.value)} className="admin-filter">
                  <option value="active">Active Subscriptions</option>
                  <option value="canceled">Canceled Subscriptions</option>
                  <option value="all">All Subscriptions</option>
                </select>
              </div>
              <div className="subscriptions-creator-customer">
                <div className="subscriptions-section">
                  <h4>Creators ({creatorSubs.length})</h4>
                  <div className="subscriptions-table">{renderSubTable(creatorSubs, 'No creator subscriptions.')}</div>
                </div>
                <div className="subscriptions-section">
                  <h4>Customers ({customerSubs.length})</h4>
                  <div className="subscriptions-table">{renderSubTable(customerSubs, 'No customer subscriptions.')}</div>
                </div>
              </div>
            </div>
            );
          })()}

          {activeTab === 'payouts' && isMasterAdmin && (
            <div className="admin-payouts">
              <div className="payouts-header">
                <h3>💰 Payout Management</h3>
                <p>Process payouts to creators who have reached the $50 minimum threshold</p>
              </div>

              {payoutLoading ? (
                <div className="admin-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading payouts...</p>
                </div>
              ) : (
                <>
                  <div className="payouts-section payouts-creators-list">
                    <h4>Creators & payout info</h4>
                    <p className="payouts-section-desc">All creators with PayPal email and pending balance. Process payouts from &quot;Pending Payouts&quot; when balance ≥ $50.</p>
                    {creatorsPayoutList.length === 0 ? (
                      <div className="no-payouts">
                        <p>No creators found.</p>
                      </div>
                    ) : (
                      <div className="payouts-table-wrap">
                        <table className="payouts-table payouts-creators-table">
                          <thead>
                            <tr>
                              <th>Creator</th>
                              <th>Email</th>
                              <th>Subdomain</th>
                              <th>PayPal Email</th>
                              <th>Pending</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {creatorsPayoutList.map(c => (
                              <tr key={c.id}>
                                <td>
                                  <div className="payout-creator-info">
                                    <img src={c.profile_image_url || '/default-avatar.jpg'} alt="" className="payout-creator-avatar" onError={e => { e.target.src = '/default-avatar.jpg'; }} />
                                    <span>{c.display_name}</span>
                                  </div>
                                </td>
                                <td><span className="payout-email-cell">{c.email}</span></td>
                                <td><span className="payout-subdomain-cell">{c.subdomain || '—'}</span></td>
                                <td>
                                  {c.paypal_email ? (
                                    <span className="payout-paypal-ok">{c.paypal_email}</span>
                                  ) : (
                                    <span className="payout-paypal-missing">Not set</span>
                                  )}
                                </td>
                                <td>
                                  <span className="payout-amount-cell">${c.pending_amount.toFixed(2)}</span>
                                </td>
                                <td>
                                  {c.pending_amount >= 50 && c.paypal_email ? (
                                    <span className="payout-status-badge ready">Ready</span>
                                  ) : !c.paypal_email ? (
                                    <span className="payout-status-badge no-paypal">No PayPal</span>
                                  ) : (
                                    <span className="payout-status-badge below">Below $50</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="payouts-section">
                    <h4>Pending Payouts ({pendingPayouts.length})</h4>
                    {pendingPayouts.length === 0 ? (
                      <div className="no-payouts">
                        <p>No pending payouts. All creators with earnings above $50 have been paid.</p>
                      </div>
                    ) : (
                      <div className="payouts-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Creator</th>
                              <th>PayPal Email</th>
                              <th>Pending Amount</th>
                              <th>Earnings Count</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingPayouts.map(payout => (
                              <tr key={payout.user_id}>
                                <td>
                                  <div className="user-info">
                                    <img
                                      src={payout.profile_image_url || '/default-avatar.jpg'}
                                      alt={payout.display_name}
                                      className="user-avatar"
                                      onError={(e) => {
                                        e.target.src = '/default-avatar.jpg';
                                      }}
                                    />
                                    <div>
                                      <div>{payout.display_name}</div>
                                      <div style={{ fontSize: '12px', color: '#666' }}>{payout.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {payout.paypal_email ? (
                                    <span style={{ color: '#28a745', fontWeight: '500' }}>
                                      {payout.paypal_email}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#dc3545', fontStyle: 'italic' }}>
                                      Not set up
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#28a745' }}>
                                    ${payout.pending_amount.toFixed(2)}
                                  </span>
                                </td>
                                <td>{payout.earnings_count} sales</td>
                                <td>
                                  <button
                                    onClick={() => handleProcessPayout(payout)}
                                    className="action-btn approve"
                                    disabled={!payout.paypal_email || payoutLoading}
                                    style={{ 
                                      backgroundColor: payout.paypal_email ? '#28a745' : '#ccc',
                                      color: 'white',
                                      cursor: payout.paypal_email ? 'pointer' : 'not-allowed'
                                    }}
                                  >
                                    Process Payout
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="payouts-section" style={{ marginTop: '40px' }}>
                    <h4>Payout History</h4>
                    {payoutHistory.length === 0 ? (
                      <div className="no-payouts">
                        <p>No payout history yet.</p>
                      </div>
                    ) : (
                      <div className="payouts-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Creator</th>
                              <th>Amount</th>
                              <th>Payment Method</th>
                              <th>Status</th>
                              <th>Processed Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payoutHistory.map(payout => (
                              <tr key={payout.id}>
                                <td>
                                  {payout.user?.display_name || payout.user?.email || 'Unknown'}
                                </td>
                                <td>
                                  <span style={{ fontWeight: '600' }}>
                                    ${parseFloat(payout.amount).toFixed(2)}
                                  </span>
                                </td>
                                <td>{payout.payment_method || 'paypal'}</td>
                                <td>
                                  <span className={`status-badge ${payout.status}`}>
                                    {payout.status?.toUpperCase() || 'COMPLETED'}
                                  </span>
                                </td>
                                <td>
                                  {payout.processed_date 
                                    ? new Date(payout.processed_date).toLocaleDateString()
                                    : new Date(payout.payout_date).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'pending-approval' && isMasterAdmin && (
            <div className="admin-pending-approval">
              <div className="pending-approval-header">
                <h3>⏳ Pending Approval</h3>
                <p>Review and approve or deny new creator sign-ups. Use the sidebar link under Payouts to open this page.</p>
                <button type="button" onClick={loadPendingApprovalUsers} disabled={pendingApprovalLoading} className="pending-approval-refresh-btn">
                  {pendingApprovalLoading ? 'Loading…' : 'Refresh list'}
                </button>
              </div>

              <div className="pending-approval-add-section">
                <label htmlFor="add-to-pending-email" className="pending-approval-add-label">Recovery only: add existing creator to Pending by email (e.g. if a sign-up did not appear automatically)</label>
                <div className="pending-approval-add-row">
                  <input
                    id="add-to-pending-email"
                    type="email"
                    placeholder="e.g. creator@example.com"
                    value={addToPendingEmail}
                    onChange={(e) => { setAddToPendingEmail(e.target.value); setAddToPendingMessage(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddToPending()}
                    className="pending-approval-add-input"
                    disabled={addToPendingLoading}
                  />
                  <button type="button" onClick={handleAddToPending} disabled={addToPendingLoading} className="pending-approval-add-btn">
                    {addToPendingLoading ? 'Adding…' : 'Add to Pending'}
                  </button>
                </div>
                {addToPendingMessage && (
                  <p className={`pending-approval-add-message ${addToPendingMessage.includes('added') || addToPendingMessage.includes('Creator') ? 'success' : 'error'}`}>
                    {addToPendingMessage}
                  </p>
                )}
              </div>

              {pendingApprovalLoading ? (
                <div className="admin-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading pending creators...</p>
                </div>
              ) : pendingApprovalUsers.length === 0 ? (
                <div className="pending-approval-empty">
                  <p>No pending sign-ups. New creators will appear here after they register.</p>
                  <p className="pending-approval-empty-hint">New sign-ups are added automatically when they use Start Free → creator signup → Google. When there are any, a table will show with each creator and <strong>Activate</strong> / <strong>Deny</strong> buttons. Click &quot;Refresh list&quot; to check again.</p>
                </div>
              ) : (
                <div className="pending-approval-table-wrap">
                  <table className="pending-approval-table">
                    <thead>
                      <tr>
                        <th>Creator</th>
                        <th>Email</th>
                        <th>Signed up</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApprovalUsers.map(creator => (
                        <tr key={creator.id} className="pending-approval-row">
                          <td>
                            <div className="pending-approval-creator-cell">
                              <div className="pending-approval-avatar">
                                {creator.profile_image_url ? (
                                  <img src={creator.profile_image_url} alt="" />
                                ) : (
                                  <span className="pending-approval-initial">
                                    {(creator.display_name || creator.email || '?').charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="pending-approval-name">{creator.display_name || '—'}</span>
                            </div>
                          </td>
                          <td className="pending-approval-email-cell">{creator.email}</td>
                          <td className="pending-approval-date-cell">
                            {creator.created_at
                              ? new Date(creator.created_at).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '—'}
                          </td>
                          <td>
                            <div className="pending-approval-actions">
                              <button
                                type="button"
                                onClick={() => handleApproveCreator(creator.id)}
                                className="pending-approval-btn pending-approval-btn-activate"
                              >
                                Activate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDisapproveCreator(creator.id)}
                                className="pending-approval-btn pending-approval-btn-deny"
                              >
                                Deny
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'order-processing' && (isMasterAdmin || isOrderProcessingAdmin) && (
            <div className="admin-order-processing">
              <div className="order-processing-header">
                <h3>📦 Order Processing Queue</h3>
                <p>
                  {isOrderProcessingAdmin && !isMasterAdmin 
                    ? 'View and process your assigned orders' 
                    : 'Manage order processing queue and assign orders to workers'}
                </p>
              </div>

              {queueLoading ? (
                <div className="admin-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading processing queue...</p>
                </div>
              ) : (
                <>
                  <div className="queue-filters">
                    <select 
                      value={queueStatusFilter} 
                      onChange={(e) => setQueueStatusFilter(e.target.value)}
                      className="admin-filter"
                    >
                      <option value="all">All Orders</option>
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                    <button onClick={loadProcessingQueue} className="refresh-btn">Refresh</button>
                  </div>
                  
                  {isOrderProcessingAdmin && !isMasterAdmin && processingQueue.length === 0 && !queueLoading && (
                    <div style={{ 
                      padding: '20px', 
                      background: '#f8f9fa', 
                      borderRadius: '8px', 
                      marginTop: '20px',
                      textAlign: 'center',
                      color: '#666'
                    }}>
                      <p>You don't have any assigned orders at the moment.</p>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>
                        Orders will appear here once they are assigned to you by a Master Admin.
                      </p>
                    </div>
                  )}

                  <div className="processing-queue-section">
                    <h4>Processing Queue ({processingQueue.length} orders)</h4>
                    {processingQueue.length === 0 ? (
                      <div className="no-orders">
                        <p>No orders in the processing queue.</p>
                      </div>
                    ) : (
                      <div className="queue-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Status</th>
                              <th>Priority</th>
                              {isMasterAdmin && <th>Assigned To</th>}
                              <th>Created</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processingQueue.map(queueItem => {
                              const order = queueItem.orders || {};
                              return (
                                <tr key={queueItem.id}>
                                  <td>
                                    <strong>{order.order_id ? order.order_id.slice(0, 8) : 'N/A'}</strong>
                                    {order.cart && (
                                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                        {order.cart.length} item(s)
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`status-badge ${queueItem.status}`}>
                                      {queueItem.status}
                                    </span>
                                  </td>
                                  <td>
                                    {queueItem.priority === 2 && <span style={{ color: '#dc3545', fontWeight: 'bold' }}>Urgent</span>}
                                    {queueItem.priority === 1 && <span style={{ color: '#ff9800', fontWeight: 'bold' }}>High</span>}
                                    {queueItem.priority === 0 && <span style={{ color: '#666' }}>Normal</span>}
                                  </td>
                                  {isMasterAdmin && (
                                    <td>
                                      {queueItem.assigned_to_user ? (
                                        <div>
                                          <div>{queueItem.assigned_to_user.display_name || queueItem.assigned_to_user.email}</div>
                                          <div style={{ fontSize: '11px', color: '#999' }}>
                                            {queueItem.assigned_at ? new Date(queueItem.assigned_at).toLocaleDateString() : ''}
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#999', fontStyle: 'italic' }}>Unassigned</span>
                                      )}
                                    </td>
                                  )}
                                  <td>{new Date(queueItem.created_at).toLocaleDateString()}</td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <button
                                        className="btn-view-details"
                                        onClick={() => {
                                          setSelectedOrder(order);
                                          setSelectedCartItemIndex(null); // Reset selected item
                                          setProcessedImage(null);
                                          setOriginal300DpiImage(null);
                                          setProcessedImages({}); // Reset processed images for new order
                                          
                                          // Reset to default settings
                                          setPrintQualitySettings({
                                            print_dpi: 300,
                                            edge_feather: false,
                                            soft_corners: false,
                                            crop_area: { x: '', y: '', width: '', height: '' },
                                            feather_edge_percent: 0,
                                            corner_radius_percent: 0,
                                            frame_enabled: false,
                                            frame_color: '#FF0000',
                                            frame_width: 10,
                                            double_frame: false,
                                            add_white_background: false
                                          });
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          fontSize: '12px',
                                          background: '#007bff',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        View Details
                                      </button>
                                      {isMasterAdmin && queueItem.status === 'pending' && (
                                        <select
                                          className="worker-select"
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleAssignOrder(queueItem.id, e.target.value);
                                            }
                                          }}
                                          defaultValue=""
                                          style={{ fontSize: '12px', padding: '4px 8px' }}
                                        >
                                          <option value="">Assign...</option>
                                          {workers.map(worker => (
                                            <option key={worker.user_id} value={worker.user_id}>
                                              {worker.user?.display_name || worker.user?.email}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                      {isMasterAdmin && (
                                        <button
                                          onClick={() => handleDeleteOrder(queueItem.id, order.order_id)}
                                          style={{
                                            padding: '4px 12px',
                                            fontSize: '12px',
                                            background: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                          }}
                                          title="Delete order"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                    {queueItem.status === 'completed' && queueItem.notes && (
                                      <div style={{ fontSize: '11px', color: '#666', maxWidth: '200px', marginTop: '4px' }}>
                                        {queueItem.notes}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="processing-history-section" style={{ marginTop: '40px' }}>
                    <h4>Processing History (Last 50)</h4>
                    {processingHistory.length === 0 ? (
                      <div className="no-history">
                        <p>No processing history yet.</p>
                      </div>
                    ) : (
                      <div className="history-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Processed By</th>
                              <th>Status</th>
                              <th>Processing Time</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processingHistory.map(history => (
                              <tr key={history.id}>
                                <td>{history.order_id ? history.order_id.slice(0, 8) : 'N/A'}</td>
                                <td>
                                  {history.processed_by_user ? (
                                    history.processed_by_user.display_name || history.processed_by_user.email
                                  ) : (
                                    'Unknown'
                                  )}
                                </td>
                                <td>
                                  <span className={`status-badge ${history.status}`}>
                                    {history.status}
                                  </span>
                                </td>
                                <td>
                                  {history.processing_time_seconds ? `${history.processing_time_seconds}s` : 'N/A'}
                                </td>
                                <td>{new Date(history.processed_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {isMasterAdmin && (
                    <div className="workers-section" style={{ marginTop: '40px' }}>
                      <h4>Active Workers ({workers.length})</h4>
                      {workers.length === 0 ? (
                        <div className="no-workers">
                          <p>No active workers. Grant processor permissions to users in User Management.</p>
                        </div>
                      ) : (
                        <div className="workers-list">
                          {workers.map(worker => (
                            <div key={worker.user_id} className="worker-card">
                              <div>
                                <strong>{worker.user?.display_name || worker.user?.email}</strong>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                  Max orders/day: {worker.max_orders_per_day || 50}
                                </div>
                              </div>
                              <span className={`status-badge ${worker.is_active ? 'active' : 'inactive'}`}>
                                {worker.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'admin-management' && isMasterAdmin && (
            <div className="admin-management-page">
              <header className="admin-mgmt-header">
                <h2 className="admin-mgmt-title">Admin Management</h2>
                <p className="admin-mgmt-subtitle">Approve signup requests and manage admin roles</p>
              </header>

              <div className="admin-mgmt-grid">
                <section className="admin-mgmt-card admin-mgmt-card-pending">
                  <h3 className="admin-mgmt-card-title">
                    <span className="admin-mgmt-card-icon">📋</span>
                    Pending Signup Requests
                    <span className="admin-mgmt-badge">{adminSignupRequests.filter(r => r.status === 'pending').length}</span>
                  </h3>
                  {adminSignupRequests.filter(r => r.status === 'pending').length === 0 ? (
                    <p className="admin-mgmt-empty">No pending requests. New admins can request access at the signup page.</p>
                  ) : (
                    <div className="admin-mgmt-table-wrap">
                      <table className="admin-table admin-mgmt-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Requested</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminSignupRequests.filter(r => r.status === 'pending').map(request => (
                            <tr key={request.id}>
                              <td>{request.email}</td>
                              <td>{request.requested_at ? new Date(request.requested_at).toLocaleString() : '—'}</td>
                              <td>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleApproveAdminRequest(request.id, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  defaultValue=""
                                  className="admin-mgmt-select"
                                >
                                  <option value="">Approve as...</option>
                                  <option value="master_admin">Master Admin</option>
                                  <option value="order_processing_admin">Order Processing Admin</option>
                                </select>
                                <button type="button" onClick={() => handleRejectAdminRequest(request.id)} className="admin-mgmt-btn admin-mgmt-btn-reject">Reject</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="admin-mgmt-card admin-mgmt-card-admins">
                  <h3 className="admin-mgmt-card-title">
                    <span className="admin-mgmt-card-icon">👤</span>
                    All Admins
                    <span className="admin-mgmt-badge">{allAdmins.length}</span>
                  </h3>
                  {allAdmins.length === 0 ? (
                    <p className="admin-mgmt-empty">No admins in the system yet. Approve a signup request above or add via Supabase.</p>
                  ) : (
                    <div className="admin-mgmt-table-wrap">
                      <table className="admin-table admin-mgmt-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allAdmins.map(admin => (
                            <tr key={admin.id}>
                              <td>{admin.email}</td>
                              <td>{admin.display_name || '—'}</td>
                              <td>
                                <select
                                  value={admin.admin_role || 'admin'}
                                  onChange={(e) => handleUpdateAdminRole(admin.id, e.target.value)}
                                  disabled={admin.admin_role === 'master_admin' && admin.id !== user?.id}
                                  className="admin-mgmt-select"
                                >
                                  <option value="master_admin">Master Admin</option>
                                  <option value="order_processing_admin">Order Processing Admin</option>
                                </select>
                              </td>
                              <td>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—'}</td>
                              <td>
                                {admin.admin_role !== 'master_admin' && (
                                  <button type="button" onClick={() => handleRemoveAdminAccess(admin.id)} className="admin-mgmt-btn admin-mgmt-btn-remove">Remove</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="admin-mgmt-card admin-mgmt-instructions">
                  <h3 className="admin-mgmt-card-title">
                    <span className="admin-mgmt-card-icon">📖</span>
                    How to add new admins
                  </h3>
                  <ol className="admin-mgmt-steps">
                    <li>Approve a signup request above (user is created in the users table).</li>
                    <li>In Supabase Dashboard → Authentication → Users, click “Add user” and enter the approved email.</li>
                    <li>Set a secure password and share it with the admin.</li>
                    <li>They can sign in at the admin login with that email and password.</li>
                  </ol>
                  <p className="admin-mgmt-link">
                    Request form: <a href="/admin-signup" target="_blank" rel="noopener noreferrer">/admin-signup</a>
                  </p>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'platform-revenue' && isMasterAdmin && (
            <div className="platform-revenue">
              <h3>💵 Platform Revenue Analytics</h3>
              <p>Track ScreenMerch earnings from 30% commission on creator sales</p>

              {/* Filters */}
              <div className="revenue-filters" style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Start Date:</label>
                  <input
                    type="date"
                    value={revenueStartDate}
                    onChange={(e) => setRevenueStartDate(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>End Date:</label>
                  <input
                    type="date"
                    value={revenueEndDate}
                    onChange={(e) => setRevenueEndDate(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Creator ID (optional):</label>
                  <input
                    type="text"
                    value={revenueCreatorFilter}
                    onChange={(e) => setRevenueCreatorFilter(e.target.value)}
                    placeholder="Filter by creator ID"
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '200px' }}
                  />
                </div>
                <button
                  onClick={loadPlatformRevenue}
                  disabled={platformRevenueLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: platformRevenueLoading ? 'not-allowed' : 'pointer',
                    opacity: platformRevenueLoading ? 0.6 : 1
                  }}
                >
                  {platformRevenueLoading ? 'Loading...' : 'Apply Filters'}
                </button>
                <button
                  onClick={() => {
                    setRevenueStartDate('');
                    setRevenueEndDate('');
                    setRevenueCreatorFilter('');
                    loadPlatformRevenue();
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              </div>

              {platformRevenueLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>Loading platform revenue data...</p>
                </div>
              ) : platformRevenue && platformRevenue.summary ? (
                <>
                  {/* Summary Cards */}
                  <div className="revenue-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Total Platform Revenue</h4>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                        ${platformRevenue.summary.total_platform_revenue.toFixed(2)}
                      </p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>30% Commission</p>
                    </div>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Total Gross Revenue</h4>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                        ${platformRevenue.summary.total_gross_revenue.toFixed(2)}
                      </p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>All Sales</p>
                    </div>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Creator Payouts</h4>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                        ${platformRevenue.summary.total_creator_payouts.toFixed(2)}
                      </p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>70% to Creators</p>
                    </div>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Total Transactions</h4>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>
                        {platformRevenue.summary.total_transactions}
                      </p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>Sales Count</p>
                    </div>
                  </div>

                  {/* Revenue by Creator */}
                  <div style={{ marginBottom: '30px' }}>
                    <h4>Revenue by Creator</h4>
                    {platformRevenue.revenue_by_creator && platformRevenue.revenue_by_creator.length > 0 ? (
                      <table className="admin-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Creator</th>
                            <th>Subdomain</th>
                            <th>Email</th>
                            <th>Platform Revenue</th>
                            <th>Gross Revenue</th>
                            <th>Creator Payout</th>
                            <th>Transactions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platformRevenue.revenue_by_creator.map((creator, index) => (
                            <tr key={creator.creator_id || index}>
                              <td>{creator.creator_name}</td>
                              <td>
                                {creator.creator_subdomain ? (
                                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>
                                    {creator.creator_subdomain}.screenmerch.com
                                  </span>
                                ) : (
                                  <span style={{ color: '#999', fontStyle: 'italic' }}>No subdomain</span>
                                )}
                              </td>
                              <td>{creator.creator_email}</td>
                              <td style={{ color: '#28a745', fontWeight: 'bold' }}>
                                ${creator.platform_revenue.toFixed(2)}
                              </td>
                              <td>${creator.gross_revenue.toFixed(2)}</td>
                              <td>${creator.creator_payouts.toFixed(2)}</td>
                              <td>{creator.transaction_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No revenue data available</p>
                    )}
                  </div>

                  {/* Revenue by Date Chart */}
                  <div style={{ marginBottom: '30px' }}>
                    <h4>Revenue Over Time</h4>
                    {platformRevenue.revenue_by_date && platformRevenue.revenue_by_date.length > 0 ? (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'flex-end', 
                        gap: '12px', 
                        height: '250px', 
                        padding: '20px 20px 40px 20px', 
                        backgroundColor: '#f8f9fa', 
                        borderRadius: '8px', 
                        border: '1px solid #dee2e6',
                        position: 'relative',
                        justifyContent: 'flex-start',
                        overflowX: 'auto'
                      }}>
                        {platformRevenue.revenue_by_date.map((day, index) => {
                          const maxRevenue = Math.max(...platformRevenue.revenue_by_date.map(d => d.platform_revenue), 1);
                          // Use a more reasonable max height (180px) and ensure minimum bar visibility
                          const barHeight = maxRevenue > 0 ? Math.max((day.platform_revenue / maxRevenue) * 180, day.platform_revenue > 0 ? 8 : 0) : 0;
                          const dateObj = new Date(day.date + 'T00:00:00');
                          const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          
                          // Fixed width for each bar (60px) - bars won't stretch to fill entire width
                          const barWidth = 60;
                          
                          return (
                            <div 
                              key={index} 
                              style={{ 
                                width: `${barWidth}px`,
                                flexShrink: 0,
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                position: 'relative'
                              }}
                            >
                              {day.platform_revenue > 0 && (
                                <span style={{ 
                                  position: 'absolute', 
                                  top: '-20px', 
                                  fontSize: '11px', 
                                  fontWeight: 'bold',
                                  color: '#28a745',
                                  whiteSpace: 'nowrap',
                                  textAlign: 'center',
                                  width: '100%'
                                }}>
                                  ${day.platform_revenue.toFixed(2)}
                                </span>
                              )}
                              <div
                                style={{
                                  width: `${barWidth}px`,
                                  backgroundColor: day.platform_revenue > 0 ? '#28a745' : '#e9ecef',
                                  height: `${barHeight}px`,
                                  minHeight: day.platform_revenue > 0 ? '8px' : '2px',
                                  borderRadius: '4px 4px 0 0',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (day.platform_revenue > 0) {
                                    e.currentTarget.style.backgroundColor = '#218838';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (day.platform_revenue > 0) {
                                    e.currentTarget.style.backgroundColor = '#28a745';
                                  }
                                }}
                                title={`${dateLabel}: $${day.platform_revenue.toFixed(2)} (${day.transaction_count} transaction${day.transaction_count !== 1 ? 's' : ''})`}
                              />
                              <div style={{ 
                                fontSize: '11px', 
                                marginTop: '8px', 
                                textAlign: 'center',
                                color: '#666',
                                whiteSpace: 'nowrap',
                                width: '100%'
                              }}>
                                {dateLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p>No date data available</p>
                    )}
                  </div>

                  {/* Revenue by Product */}
                  <div style={{ marginBottom: '30px' }}>
                    <h4>Revenue by Product</h4>
                    {platformRevenue.revenue_by_product && platformRevenue.revenue_by_product.length > 0 ? (
                      <table className="admin-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Platform Revenue</th>
                            <th>Gross Revenue</th>
                            <th>Transactions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platformRevenue.revenue_by_product.map((product, index) => (
                            <tr key={index}>
                              <td>{product.product_name}</td>
                              <td style={{ color: '#28a745', fontWeight: 'bold' }}>
                                ${product.platform_revenue.toFixed(2)}
                              </td>
                              <td>${product.gross_revenue.toFixed(2)}</td>
                              <td>{product.transaction_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No product data available</p>
                    )}
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <h4>Recent Transactions (Last 100)</h4>
                    {platformRevenue.all_transactions && platformRevenue.all_transactions.length > 0 ? (
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="admin-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Creator</th>
                              <th>Subdomain</th>
                              <th>Product</th>
                              <th>Sale Amount</th>
                              <th>Platform Fee (30%)</th>
                              <th>Creator Share (70%)</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {platformRevenue.all_transactions.map((transaction, index) => (
                              <tr key={transaction.id || index}>
                                <td>{new Date(transaction.created_at).toLocaleDateString()}</td>
                                <td>{transaction.creator_name}</td>
                                <td>
                                  {transaction.creator_subdomain ? (
                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>
                                      {transaction.creator_subdomain}.screenmerch.com
                                    </span>
                                  ) : (
                                    <span style={{ color: '#999', fontStyle: 'italic', fontSize: '11px' }}>—</span>
                                  )}
                                </td>
                                <td>{transaction.product_name}</td>
                                <td>${transaction.sale_amount.toFixed(2)}</td>
                                <td style={{ color: '#28a745', fontWeight: 'bold' }}>
                                  ${transaction.platform_fee.toFixed(2)}
                                </td>
                                <td>${transaction.creator_share.toFixed(2)}</td>
                                <td>
                                  <span 
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      backgroundColor: transaction.status === 'paid' ? '#d4edda' : transaction.status === 'pending' ? '#fff3cd' : '#f8d7da',
                                      color: transaction.status === 'paid' ? '#155724' : transaction.status === 'pending' ? '#856404' : '#721c24',
                                      cursor: transaction.status === 'pending' ? 'help' : 'default'
                                    }}
                                    title={transaction.status === 'pending' ? 'Pending payout to creator (customer payment already received)' : transaction.status === 'paid' ? 'Creator has been paid out' : 'Transaction cancelled'}
                                  >
                                    {transaction.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No transactions available</p>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>Click "Apply Filters" to load platform revenue data</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedOrder(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
              width: '90%'
            }}
          >
            <button 
              className="modal-close" 
              onClick={() => setSelectedOrder(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
            <h2 style={{ marginTop: 0 }}>Order Details</h2>
            <div className="order-details">
              <div style={{ marginBottom: '20px' }}>
                <p><strong>Order ID:</strong> {selectedOrder.order_id || 'N/A'}</p>
                <p><strong>Status:</strong> {selectedOrder.status || 'N/A'}</p>
                <p><strong>Total Amount:</strong> ${selectedOrder.total_amount ? parseFloat(selectedOrder.total_amount).toFixed(2) : '0.00'}</p>
                <p><strong>Customer Email:</strong> {selectedOrder.customer_email || 'N/A'}</p>
                <p><strong>Customer Phone:</strong> {selectedOrder.customer_phone || 'N/A'}</p>
                <p><strong>Created:</strong> {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : 'N/A'}</p>
              </div>

              {selectedOrder.video_title && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <p><strong>Video Title:</strong> {selectedOrder.video_title}</p>
                  <p><strong>Creator:</strong> {selectedOrder.creator_name || 'N/A'}</p>
                  {selectedOrder.video_url && (
                    <p><strong>Video URL:</strong> <a href={selectedOrder.video_url} target="_blank" rel="noopener noreferrer">{selectedOrder.video_url}</a></p>
                  )}
                </div>
              )}

              {selectedOrder.cart && selectedOrder.cart.length > 0 && (
                <div className="cart-items" style={{ marginBottom: '20px' }}>
                  <h3>Cart Items ({selectedOrder.cart.length}):</h3>
                  {selectedOrder.cart.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="cart-item"
                      onClick={() => {
                        // Click cart item to select it for processing
                        setSelectedCartItemIndex(idx);
                        setProcessedImage(null);
                        setOriginal300DpiImage(null);
                        
                        // Load saved tool settings from this cart item if available
                        let savedSettings = {
                          print_dpi: 300,
                          edge_feather: false,
                          soft_corners: false,
                          crop_area: { x: '', y: '', width: '', height: '' },
                          feather_edge_percent: 0,
                          corner_radius_percent: 0,
                          frame_enabled: false,
                          frame_color: '#FF0000',
                          frame_width: 10,
                          double_frame: false,
                          add_white_background: false
                        };
                        
                        if (item.toolSettings) {
                          savedSettings = {
                            print_dpi: 300,
                            edge_feather: item.toolSettings.featherEdge > 0,
                            soft_corners: item.toolSettings.cornerRadius > 0,
                            crop_area: { x: '', y: '', width: '', height: '' },
                            feather_edge_percent: item.toolSettings.featherEdge || 0,
                            corner_radius_percent: item.toolSettings.cornerRadius || 0,
                            frame_enabled: item.toolSettings.frameEnabled || false,
                            frame_color: item.toolSettings.frameColor || '#FF0000',
                            frame_width: item.toolSettings.frameWidth || 10,
                            double_frame: item.toolSettings.doubleFrame || false
                          };
                          console.log('📦 Loaded saved tool settings from cart item:', savedSettings);
                        }
                        
                        setPrintQualitySettings(savedSettings);
                        
                        // If this item already has a processed image, load it
                        if (processedImages[idx]) {
                          setProcessedImage(processedImages[idx].processedImage);
                          setOriginal300DpiImage(processedImages[idx].original300Dpi);
                        }
                      }}
                      style={{
                        border: selectedCartItemIndex === idx ? '3px solid #007bff' : '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '16px',
                        marginBottom: '12px',
                        display: 'flex',
                        gap: '16px',
                        cursor: 'pointer',
                        backgroundColor: selectedCartItemIndex === idx ? '#f0f8ff' : 'white',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {(item.img || item.selected_screenshot) && (
                        <div style={{ flexShrink: 0 }}>
                          <img 
                            src={item.img || item.selected_screenshot} 
                            alt={item.product}
                            style={{
                              width: '120px',
                              height: '120px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' }}>{item.product || 'Unknown Product'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Color:</strong> {item.variants?.color || 'N/A'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Size:</strong> {item.variants?.size || 'N/A'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Price:</strong> ${item.price ? parseFloat(item.price).toFixed(2) : '0.00'}</p>
                        {item.quantity && (
                          <p style={{ margin: '4px 0' }}><strong>Quantity:</strong> {item.quantity}</p>
                        )}
                        {item.note && (
                          <p style={{ margin: '4px 0', fontStyle: 'italic', color: '#666' }}><strong>Note:</strong> {item.note}</p>
                        )}
                        {item.videoName && (
                          <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}><strong>Video:</strong> {item.videoName}</p>
                        )}
                        {item.creatorName && (
                          <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}><strong>Creator:</strong> {item.creatorName}</p>
                        )}
                        {selectedCartItemIndex === idx && (
                          <p style={{ margin: '8px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#007bff' }}>
                            ✓ Selected for Processing
                          </p>
                        )}
                        {processedImages[idx] && (
                          <p style={{ margin: '8px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#28a745' }}>
                            ✓ Processed - Ready for Download
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '20px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <h4>Shipping Address:</h4>
                {selectedOrder.shipping_address ? (
                  typeof selectedOrder.shipping_address === 'string' ? (
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                      {selectedOrder.shipping_address}
                    </pre>
                  ) : (
                    <div style={{ fontFamily: 'inherit' }}>
                      {selectedOrder.shipping_address.name && <p style={{ margin: '4px 0' }}><strong>Name:</strong> {selectedOrder.shipping_address.name}</p>}
                      {selectedOrder.shipping_address.line1 && <p style={{ margin: '4px 0' }}>{selectedOrder.shipping_address.line1}</p>}
                      {selectedOrder.shipping_address.line2 && <p style={{ margin: '4px 0' }}>{selectedOrder.shipping_address.line2}</p>}
                      {(selectedOrder.shipping_address.city || selectedOrder.shipping_address.state || selectedOrder.shipping_address.postal_code) && (
                        <p style={{ margin: '4px 0' }}>
                          {[selectedOrder.shipping_address.city, selectedOrder.shipping_address.state, selectedOrder.shipping_address.postal_code].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {selectedOrder.shipping_address.country && <p style={{ margin: '4px 0' }}>{selectedOrder.shipping_address.country}</p>}
                      {selectedOrder.shipping_address.country_code && <p style={{ margin: '4px 0' }}><strong>Country Code:</strong> {selectedOrder.shipping_address.country_code}</p>}
                      {selectedOrder.shipping_address.zip && <p style={{ margin: '4px 0' }}><strong>ZIP:</strong> {selectedOrder.shipping_address.zip}</p>}
                      {Object.keys(selectedOrder.shipping_address).length === 0 && (
                        <p style={{ color: '#999', fontStyle: 'italic' }}>No address data available</p>
                      )}
                    </div>
                  )
                ) : (
                  <p style={{ color: '#999', fontStyle: 'italic', margin: 0 }}>
                    No shipping address available. Note: Stripe Test Mode may not collect full shipping addresses. 
                    Address will be available in Live Mode.
                  </p>
                )}
              </div>

              {/* Print Quality Image Generator - Only show when item is selected */}
              {selectedCartItemIndex !== null && selectedOrder.cart && selectedOrder.cart[selectedCartItemIndex] && (
                <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '2px solid #007bff' }}>
                  <h3 style={{ marginTop: 0, color: '#007bff' }}>🖨️ Print Quality Image Generator</h3>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                    Processing: <strong>{selectedOrder.cart[selectedCartItemIndex].product}</strong>
                  </p>
                  
                  {(() => {
                    const item = selectedOrder.cart[selectedCartItemIndex];
                    return (
                      <div style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ marginTop: 0 }}>Item {selectedCartItemIndex + 1}: {item.product}</h4>
                        
                        {(item.img || item.selected_screenshot) && (
                          <>
                            <div style={{ marginBottom: '16px' }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Original Screenshot:</p>
                              <img 
                                src={item.img || item.selected_screenshot} 
                                alt={item.product}
                                style={{
                                  maxWidth: '300px',
                                  maxHeight: '300px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                                Print DPI:
                              </label>
                              <select
                                value={printQualitySettings.print_dpi}
                                onChange={(e) => setPrintQualitySettings({...printQualitySettings, print_dpi: parseInt(e.target.value)})}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px' }}
                              >
                                <option value={300}>300 DPI (Standard Print)</option>
                                <option value={150}>150 DPI (Lower Quality)</option>
                              </select>
                            </div>

                            {/* STEP 1: Create 300 DPI Image */}
                            <div style={{ background: '#e8f5e8', padding: '20px', borderRadius: '10px', margin: '20px 0', border: '3px solid #28a745', textAlign: 'center' }}>
                              <h2 style={{ marginTop: 0, color: '#28a745', fontSize: '24px' }}>🎯 STEP 1: Create 300 DPI Image</h2>
                              <p style={{ color: '#666', marginBottom: '20px', fontSize: '16px' }}>Generate high-resolution 300 DPI image for print quality</p>
                              <button
                                type="button"
                                onClick={() => generate300DpiImage()}
                              disabled={step1Processing}
                              style={{
                                background: step1Processing ? '#ccc' : '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '15px 40px',
                                borderRadius: '8px',
                                cursor: step1Processing ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: '18px',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                              }}
                            >
                              {step1Processing ? 'Generating 300 DPI Image...' : '🎯 Generate 300 DPI Image'}
                            </button>
                          </div>

                          {/* STEP 2: Feather Edge Tool (Optional) */}
                          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', margin: '20px 0', border: '2px solid #17a2b8' }}>
                            <h3 style={{ marginTop: 0, color: '#17a2b8' }}>✨ STEP 2: Feather Edge Tool (Optional)</h3>
                            
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={printQualitySettings.edge_feather}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setPrintQualitySettings({
                                      ...printQualitySettings, 
                                      edge_feather: newValue, 
                                      feather_edge_percent: newValue ? printQualitySettings.feather_edge_percent : 0
                                    });
                                    // Auto-apply useEffect will handle the processing
                                  }}
                                  style={{ transform: 'scale(1.2)' }}
                                />
                                Apply Edge Feathering
                              </label>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                Softens edges to reduce harsh contrast on all clothing products and colors
                              </div>
                            </div>

                            {printQualitySettings.edge_feather && (
                              <>
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', marginBottom: '8px' }}>Feather Intensity:</label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={printQualitySettings.feather_edge_percent}
                                    onChange={(e) => setPrintQualitySettings({...printQualitySettings, feather_edge_percent: parseInt(e.target.value)})}
                                    style={{ width: '100%' }}
                                  />
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Adjust the softness of edges (0-100%, higher = more pronounced feather)
                                  </div>
                                  <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#17a2b8' }}>
                                    {printQualitySettings.feather_edge_percent}%
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#17a2b8', marginTop: '8px', fontStyle: 'italic' }}>
                                    ✓ Effects apply automatically when you adjust the slider
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* STEP 3: Corner Radius Tool (Optional) */}
                          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', margin: '20px 0', border: '2px solid #28a745' }}>
                            <h3 style={{ marginTop: 0, color: '#28a745' }}>🔄 STEP 3: Corner Radius Tool (Optional)</h3>
                            
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={printQualitySettings.soft_corners}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setPrintQualitySettings({
                                      ...printQualitySettings, 
                                      soft_corners: newValue, 
                                      corner_radius_percent: newValue ? printQualitySettings.corner_radius_percent : 0
                                    });
                                    // Auto-apply useEffect will handle the processing
                                  }}
                                  style={{ transform: 'scale(1.2)' }}
                                />
                                Apply Rounded Corners
                              </label>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                Adds rounded corners to make images look better on shirts, hoodies, and other apparel
                              </div>
                            </div>

                            {printQualitySettings.soft_corners && (
                              <>
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', marginBottom: '8px' }}>Corner Radius:</label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={printQualitySettings.corner_radius_percent}
                                    onChange={(e) => setPrintQualitySettings({...printQualitySettings, corner_radius_percent: parseInt(e.target.value)})}
                                    style={{ width: '100%' }}
                                  />
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Adjust the roundness of corners (0-100%, 100% = perfect circle)
                                  </div>
                                  <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#28a745' }}>
                                    {printQualitySettings.corner_radius_percent === 100 ? 'Circle' : printQualitySettings.corner_radius_percent + '%'}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#28a745', marginTop: '8px', fontStyle: 'italic' }}>
                                    ✓ Effects apply automatically when you adjust the slider
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* STEP 4: Framed Border Tool (Optional) */}
                          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', margin: '20px 0', border: '2px solid #dc3545' }}>
                            <h3 style={{ marginTop: 0, color: '#dc3545' }}>🖼️ STEP 4: Framed Border Tool (Optional)</h3>
                            
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={printQualitySettings.frame_enabled}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setPrintQualitySettings({
                                      ...printQualitySettings, 
                                      frame_enabled: newValue
                                    });
                                    // Auto-apply useEffect will handle the processing
                                  }}
                                  style={{ transform: 'scale(1.2)' }}
                                />
                                Enable Frame
                              </label>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                Add a decorative border frame around the image
                              </div>
                            </div>

                            {printQualitySettings.frame_enabled && (
                              <>
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', marginBottom: '8px' }}>Frame Color:</label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input
                                      type="color"
                                      value={printQualitySettings.frame_color}
                                      onChange={(e) => setPrintQualitySettings({...printQualitySettings, frame_color: e.target.value})}
                                      style={{ width: '60px', height: '40px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                                    />
                                    <input
                                      type="text"
                                      value={printQualitySettings.frame_color}
                                      onChange={(e) => setPrintQualitySettings({...printQualitySettings, frame_color: e.target.value})}
                                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '100px' }}
                                      placeholder="#FF0000"
                                    />
                                  </div>
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', marginBottom: '8px' }}>Frame Width: {printQualitySettings.frame_width}px</label>
                                  <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={printQualitySettings.frame_width}
                                    onChange={(e) => setPrintQualitySettings({...printQualitySettings, frame_width: parseInt(e.target.value)})}
                                    style={{ width: '100%' }}
                                  />
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Adjust the thickness of the frame border (1-50px)
                                  </div>
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="checkbox"
                                      checked={printQualitySettings.double_frame}
                                      onChange={(e) => setPrintQualitySettings({...printQualitySettings, double_frame: e.target.checked})}
                                      style={{ transform: 'scale(1.2)' }}
                                    />
                                    Double Frame (3D Look)
                                  </label>
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Add a second inner frame for a 3D effect
                                  </div>
                                </div>

                                <div style={{ marginTop: '20px', padding: '15px', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #4a90e2' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold', color: '#4a90e2' }}>
                                    <input
                                      type="checkbox"
                                      checked={printQualitySettings.add_white_background}
                                      onChange={(e) => setPrintQualitySettings({...printQualitySettings, add_white_background: e.target.checked})}
                                      style={{ transform: 'scale(1.2)' }}
                                    />
                                    Add White Background for Printful
                                  </label>
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginLeft: '28px' }}>
                                    Adds a solid white background behind the design. Recommended for Printful to avoid transparency warnings. Preserves all effects (feather, corner radius, frame).
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (selectedCartItemIndex === null) {
                                      alert('Please select a cart item first');
                                      return;
                                    }
                                    
                                    if (!original300DpiImage) {
                                      alert('Please complete Step 1 (Generate 300 DPI Image) first');
                                      return;
                                    }

                                    setStep2Processing(true);
                                    setStep3Processing(true);

                                    try {
                                      const processedImageUrl = await applyBothEffects();
                                      
                                      if (processedImageUrl) {
                                        const cornerRadiusPercent = printQualitySettings.soft_corners ? (printQualitySettings.corner_radius_percent || 0) : 0;
                                        const cornerRadiusDisplay = cornerRadiusPercent === 100 ? 'Circle' : cornerRadiusPercent + '%';
                                        const featherValue = printQualitySettings.edge_feather ? (printQualitySettings.feather_edge_percent || 0) : 0;
                                        const frameEnabled = printQualitySettings.frame_enabled || false;
                                        let effectsText = '';
                                        if (featherValue > 0) effectsText += `Feather: ${featherValue}%`;
                                        if (cornerRadiusPercent > 0) effectsText += (effectsText ? ', ' : '') + `Corner Radius: ${cornerRadiusDisplay}`;
                                        if (frameEnabled) effectsText += (effectsText ? ', ' : '') + `Frame: ${printQualitySettings.frame_width}px ${printQualitySettings.double_frame ? '(Double)' : ''}`;
                                        if (!effectsText) effectsText = 'Effects applied';
                                        
                                        console.log(`✅ Effects applied: ${effectsText}`);
                                        
                                        // Save processed image for this cart item
                                        saveProcessedImage(processedImageUrl);
                                      } else {
                                        throw new Error('Failed to apply effects - no image returned');
                                      }
                                    } catch (error) {
                                      console.error('Error applying frame effect:', error);
                                      alert(`Error applying frame effect: ${error.message}`);
                                    } finally {
                                      setStep2Processing(false);
                                      setStep3Processing(false);
                                    }
                                  }}
                                  disabled={step2Processing || step3Processing || !original300DpiImage}
                                  style={{
                                    background: (step2Processing || step3Processing || !original300DpiImage) ? '#ccc' : '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '5px',
                                    cursor: (step2Processing || step3Processing || !original300DpiImage) ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold',
                                    marginTop: '10px'
                                  }}
                                >
                                  {(step2Processing || step3Processing) ? 'Applying Effects...' : 'Apply Frame Effect'}
                                </button>
                              </>
                            )}
                          </div>

                            {processedImage && processedImage.success && (
                              <div style={{ marginTop: '20px', padding: '16px', background: '#d4edda', borderRadius: '4px', border: '1px solid #c3e6cb' }}>
                                <p style={{ color: '#155724', fontWeight: 'bold', marginBottom: '12px' }}>✅ Image Processed Successfully!</p>
                                <div style={{ marginBottom: '12px' }}>
                                  {processedImage.screenshot ? (
                                    <img 
                                      src={processedImage.screenshot} 
                                      alt="Processed"
                                      onError={(e) => {
                                        console.error('Image failed to load:', processedImage.screenshot?.substring(0, 100));
                                        e.target.style.display = 'none';
                                        alert('Error: Image failed to load. Please try again.');
                                      }}
                                      onLoad={() => {
                                        console.log('Image loaded successfully');
                                      }}
                                      style={{
                                        maxWidth: '400px',
                                        maxHeight: '400px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: '#f0f0f0'
                                      }}
                                    />
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                                      Error: No image data received
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    // Save the processed image for this cart item
                                    if (processedImage.screenshot) {
                                      saveProcessedImage(processedImage.screenshot);
                                      alert('Image saved! You can now process the next item or download all processed images below.');
                                    }
                                  }}
                                  style={{
                                    padding: '10px 20px',
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    marginRight: '10px'
                                  }}
                                >
                                  ✓ Save & Continue to Next Item
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Display all processed images ready for download */}
              {Object.keys(processedImages).length > 0 && (
                <div style={{ marginTop: '30px', padding: '20px', background: '#e8f5e9', borderRadius: '8px', border: '2px solid #28a745' }}>
                  <h3 style={{ marginTop: 0, color: '#28a745' }}>✅ Processed Images Ready for Download</h3>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                    All processed images are ready. Download each one individually for Printful.
                  </p>
                  
                  {selectedOrder.cart.map((item, idx) => {
                    if (!processedImages[idx]) return null;
                    
                    return (
                      <div key={idx} style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '4px', border: '1px solid #28a745' }}>
                        <h4 style={{ marginTop: 0, color: '#28a745' }}>Item {idx + 1}: {item.product}</h4>
                        <div style={{ marginBottom: '12px' }}>
                          <img 
                            src={processedImages[idx].processedImage} 
                            alt={`Processed ${item.product}`}
                            style={{
                              maxWidth: '300px',
                              maxHeight: '300px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = processedImages[idx].processedImage;
                            link.download = `print-quality-${selectedOrder?.order_id || 'image'}-item${idx + 1}-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          style={{
                            padding: '10px 20px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          📥 Download {item.product}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin; 