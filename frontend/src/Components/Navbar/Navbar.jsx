import React, { useState, useEffect } from 'react'
import './Navbar.css'
import menu_icon from '../../assets/menu.png'
import logo from '../../assets/screenmerch_logo.png.png'
import search_icon from '../../assets/search.png'
import upload_icon from '../../assets/upload.png'
import more_icon from '../../assets/more.png'
import notification_icon from '../../assets/notification.png'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import SubscriptionModal from '../SubscriptionModal/SubscriptionModal'
import CreatorSignupModal from '../CreatorSignupModal/CreatorSignupModal'
import { supabase } from '../../supabaseClient'
import { upsertUserProfile, deleteUserAccount, fetchMyProfileFromBackend } from '../../utils/userService'
import { AdminService } from '../../utils/adminService'
import { useCreator } from '../../contexts/CreatorContext'

const Navbar = ({ setSidebar, resetCategory }) => {
    const { creatorSettings } = useCreator() || {};
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [isCreatorSignupModalOpen, setIsCreatorSignupModalOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [customerUser, setCustomerUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [oauthProcessing, setOauthProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isOrderProcessingAdmin, setIsOrderProcessingAdmin] = useState(false);
    const [isFullAdmin, setIsFullAdmin] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const isOrderSuccessPage = location.pathname === '/success';

    useEffect(() => {
        let isMounted = true;

        // Listen for OAuth success events
        const handleOAuthSuccess = (event) => {
            console.log('📡 Navbar received oauthSuccess event:', event.detail);
            console.log('📡 OAuth user picture:', event.detail?.picture);
            console.log('📡 OAuth user metadata picture:', event.detail?.user_metadata?.picture);
            console.log('📡 OAuth user profile_image_url:', event.detail?.profile_image_url);
            if (isMounted) {
                const googleUser = event.detail;
                setUser(googleUser);
                setLoading(false);
                setOauthProcessing(false);
                console.log('🔄 Navbar state updated from OAuth event');

                // CRITICAL: Set userProfile immediately with profile_image_url from backend
                if (googleUser.profile_image_url || googleUser.picture || googleUser.user_metadata?.picture) {
                    const imageUrl = googleUser.profile_image_url || googleUser.picture || googleUser.user_metadata?.picture;
                    console.log('🖼️ Setting userProfile with image URL:', imageUrl);
                    setUserProfile({
                        profile_image_url: imageUrl,
                        cover_image_url: googleUser.cover_image_url || '',
                        display_name: googleUser.display_name,
                        ...googleUser
                    });
                } else {
                    // Fallback: still set userProfile even without image
                    setUserProfile({
                        profile_image_url: '',
                        cover_image_url: googleUser.cover_image_url || '',
                        display_name: googleUser.display_name,
                        ...googleUser
                    });
                }

                // Force multiple re-renders to ensure state updates
                setTimeout(() => {
                    if (isMounted) {
                        console.log('🔄 Forcing Navbar re-render after OAuth (1st attempt)');
                        setUser(prevUser => ({ ...prevUser, ...googleUser }));
                        if (googleUser.profile_image_url || googleUser.picture) {
                            setUserProfile(prev => ({
                                ...prev,
                                profile_image_url: googleUser.profile_image_url || googleUser.picture || prev?.profile_image_url
                            }));
                        }
                    }
                }, 50);

                setTimeout(() => {
                    if (isMounted) {
                        console.log('🔄 Forcing Navbar re-render after OAuth (2nd attempt)');
                        setUser(googleUser);
                        if (googleUser.profile_image_url || googleUser.picture) {
                            setUserProfile({
                                profile_image_url: googleUser.profile_image_url || googleUser.picture || googleUser.user_metadata?.picture,
                                cover_image_url: googleUser.cover_image_url || '',
                                display_name: googleUser.display_name,
                                ...googleUser
                            });
                        }
                    }
                }, 200);
            }
        };

        window.addEventListener('oauthSuccess', handleOAuthSuccess);

        // "Go to Homepage" from thank-you: clear creator session so they land as visitor
        const handleCreatorThankYouSignOut = async () => {
            if (isMounted) {
                await supabase.auth.signOut();
                setUser(null);
                setUserProfile(null);
                setCustomerUser(null);
                setLoading(false);
            }
        };
        window.addEventListener('creatorThankYouSignOut', handleCreatorThankYouSignOut);

        // Listen for email/password login success
        const handleUserLoggedIn = async (event) => {
            console.log('📡 Navbar received userLoggedIn event:', event.detail);
            if (isMounted && event.detail?.user) {
                const loggedInUser = event.detail.user;
                console.log('🔐 [NAVBAR] Received user from login event:', loggedInUser);
                console.log('🔐 [NAVBAR] Initial user role:', loggedInUser.role, 'status:', loggedInUser.status);
                
                // CRITICAL: Fetch profile from database FIRST before setting user state
                // This ensures we have the correct role/status from the database
                // Use ID if available, otherwise fallback to email
                const userId = loggedInUser.id;
                const userEmail = loggedInUser.email;
                
                if (userId || userEmail) {
                    try {
                        let profile = null;
                        let profileError = null;
                        
                        if (userId) {
                            console.log('🔐 [NAVBAR] Fetching profile from backend for user ID:', userId);
                            profile = await fetchMyProfileFromBackend(userId);
                            profileError = profile ? null : new Error('No profile returned');
                        } else if (userEmail) {
                            console.log('🔐 [NAVBAR] No ID found, using login data');
                            profile = null;
                            profileError = null;
                        }
                        
                        if (profileError) {
                            console.error('❌ [NAVBAR] Error fetching profile:', profileError);
                        }
                        
                        if (profile && isMounted) {
                            console.log('🔐 [NAVBAR] ✅ Found user profile from database:', profile);
                            console.log('🔐 [NAVBAR] Database profile role:', profile.role, 'status:', profile.status);
                            console.log('🔐 [NAVBAR] Backend response role:', loggedInUser.role, 'status:', loggedInUser.status);
                            
                            // CRITICAL: Database profile takes precedence for role and status
                            const mergedProfile = {
                                ...loggedInUser,
                                ...profile,
                                // Ensure ID is set from database if it was missing
                                id: profile.id || loggedInUser.id,
                                // PRIORITIZE database values - they are the source of truth
                                role: profile.role !== null && profile.role !== undefined ? profile.role : (loggedInUser.role || 'customer'),
                                status: profile.status !== null && profile.status !== undefined ? profile.status : (loggedInUser.status || 'active'),
                                profile_image_url: profile.profile_image_url || loggedInUser.profile_image_url || loggedInUser.picture || loggedInUser.user_metadata?.picture,
                                cover_image_url: profile.cover_image_url || loggedInUser.cover_image_url || '',
                                display_name: profile.display_name || loggedInUser.display_name,
                            };
                            
                            setUserProfile(mergedProfile);
                            setUser(mergedProfile);
                            
                            // Update localStorage
                            localStorage.setItem('user', JSON.stringify(mergedProfile));
                            console.log('🔐 [NAVBAR] ✅ Final merged profile role:', mergedProfile.role, 'status:', mergedProfile.status, 'profile_image_url:', mergedProfile.profile_image_url);
                            const willShowProfile = (mergedProfile.role === 'creator' || mergedProfile.role === 'admin') && (mergedProfile.status === 'active' || mergedProfile.status === undefined);
                            console.log('🔐 [NAVBAR] ✅ Will show profile image?', willShowProfile);
                            setLoading(false);
                        } else {
                            console.warn('⚠️ [NAVBAR] No profile found in database, using login data');
                            // Fallback: use login data
                            const fallbackProfile = {
                                profile_image_url: loggedInUser.profile_image_url || loggedInUser.picture || loggedInUser.user_metadata?.picture,
                                cover_image_url: loggedInUser.cover_image_url || '',
                                display_name: loggedInUser.display_name,
                                ...loggedInUser
                            };
                            setUserProfile(fallbackProfile);
                            setUser(fallbackProfile);
                            setLoading(false);
                        }
                    } catch (error) {
                        console.error('❌ [NAVBAR] Error fetching user profile:', error);
                        // Still set user even if profile fetch fails
                        const fallbackProfile = {
                            profile_image_url: loggedInUser.profile_image_url || loggedInUser.picture || loggedInUser.user_metadata?.picture,
                            cover_image_url: loggedInUser.cover_image_url || '',
                            display_name: loggedInUser.display_name,
                            ...loggedInUser
                        };
                        setUserProfile(fallbackProfile);
                        setUser(fallbackProfile);
                        setLoading(false);
                    }
                } else {
                    console.warn('⚠️ [NAVBAR] No user ID or email, cannot fetch profile');
                    setUser(loggedInUser);
                    setLoading(false);
                }
            }
        };

        window.addEventListener('userLoggedIn', handleUserLoggedIn);

        const fetchUser = async () => {
            try {
                // Wait for OAuth processing to complete if it's in progress
                let oauthPending = localStorage.getItem('oauth_confirmation_pending');
                if (oauthPending === 'true') {
                    console.log('🔐 OAuth confirmation pending, waiting...');
                    setOauthProcessing(true);
                    // Wait for OAuth processing to complete
                    let attempts = 0;
                    while (oauthPending === 'true' && attempts < 50) { // Max 5 seconds
                        await new Promise(resolve => setTimeout(resolve, 100));
                        oauthPending = localStorage.getItem('oauth_confirmation_pending');
                        attempts++;
                    }
                    console.log('🔐 OAuth processing completed or timeout reached');
                    setOauthProcessing(false);
                }

                // Additional wait to ensure localStorage is fully updated
                await new Promise(resolve => setTimeout(resolve, 200));

                // Check for authenticated user (OAuth or email/password) in localStorage
                const isAuthenticated = localStorage.getItem('isAuthenticated');
                const userData = localStorage.getItem('user');

                if (isAuthenticated === 'true' && userData) {
                    try {
                        const loggedInUser = JSON.parse(userData);
                        console.log('🔐 [FETCHUSER] Found authenticated user:', loggedInUser);
                        console.log('🔐 [FETCHUSER] Initial role from localStorage:', loggedInUser?.role, 'status:', loggedInUser?.status);
                        
                        if (isMounted) {
                            // CRITICAL: Fetch from database FIRST before setting user state
                            // This ensures we have the correct role/status from database
                            if (loggedInUser.id) {
                                console.log('🔐 [FETCHUSER] Fetching latest user profile from backend for user:', loggedInUser.id);
                                const profile = await fetchMyProfileFromBackend(loggedInUser.id);
                                const profileError = profile ? null : new Error('No profile returned');

                                if (profileError) {
                                    console.error('❌ [FETCHUSER] Error fetching profile:', profileError);
                                }

                                if (profile && isMounted) {
                                    console.log('🔐 [FETCHUSER] ✅ Found user profile from database:', profile);
                                    console.log('🔐 [FETCHUSER] Database role:', profile.role, 'status:', profile.status);
                                    console.log('🔐 [FETCHUSER] Database profile_image_url:', profile.profile_image_url);

                                    // CRITICAL: Database profile takes precedence for role and status
                                    const mergedProfile = {
                                        ...loggedInUser,
                                        ...profile,
                                        // PRIORITIZE database values - they are the source of truth
                                        role: profile.role !== null && profile.role !== undefined ? profile.role : (loggedInUser.role || 'customer'),
                                        status: profile.status !== null && profile.status !== undefined ? profile.status : (loggedInUser.status || 'active'),
                                        // Prioritize database profile_image_url
                                        profile_image_url: profile.profile_image_url || loggedInUser.profile_image_url || loggedInUser.picture || loggedInUser.user_metadata?.picture,
                                        // Prioritize database cover_image_url
                                        cover_image_url: profile.cover_image_url || loggedInUser.cover_image_url || '',
                                        // Update display_name from database if available
                                        display_name: profile.display_name || loggedInUser.display_name,
                                    };

                                    setUserProfile(mergedProfile);

                                    // Update localStorage with merged data so it's available on page refresh
                                    const updatedUser = {
                                        ...loggedInUser,
                                        role: mergedProfile.role,
                                        status: mergedProfile.status,
                                        profile_image_url: mergedProfile.profile_image_url,
                                        cover_image_url: mergedProfile.cover_image_url,
                                        display_name: mergedProfile.display_name,
                                    };
                                    localStorage.setItem('user', JSON.stringify(updatedUser));
                                    setUser(updatedUser);

                                    console.log('🔐 [FETCHUSER] ✅ Final merged profile role:', mergedProfile.role, 'Status:', mergedProfile.status, 'profile_image_url:', mergedProfile.profile_image_url);
                                    const willShowProfile = (mergedProfile.role === 'creator' || mergedProfile.role === 'admin') && (mergedProfile.status === 'active' || mergedProfile.status === undefined);
                                    console.log('🔐 [FETCHUSER] ✅ Will show profile image?', willShowProfile);
                                } else {
                                    console.warn('⚠️ [FETCHUSER] No user profile found in database, using stored data:', profileError);
                                    // Fallback: use stored data if database fetch fails
                                    const fallbackProfile = {
                                        profile_image_url: loggedInUser.profile_image_url || loggedInUser.picture || loggedInUser.user_metadata?.picture,
                                        cover_image_url: loggedInUser.cover_image_url || '',
                                        display_name: loggedInUser.display_name,
                                        ...loggedInUser
                                    };
                                    setUserProfile(fallbackProfile);
                                    setUser(fallbackProfile);
                                }
                            } else {
                                console.warn('⚠️ [FETCHUSER] User has no ID, using stored data as-is');
                                const fallbackProfile = {
                                    profile_image_url: loggedInUser.profile_image_url || loggedInUser.picture || loggedInUser.user_metadata?.picture,
                                    cover_image_url: loggedInUser.cover_image_url || '',
                                    display_name: loggedInUser.display_name,
                                    ...loggedInUser
                                };
                                setUserProfile(fallbackProfile);
                                setUser(fallbackProfile);
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing user data:', error);
                    }
                } else {
                    console.log('🔐 No authenticated user found. isAuthenticated:', isAuthenticated, 'userData:', userData);
                }

                // Check for customer authentication (merchandise buyers)
                const customerAuthenticated = localStorage.getItem('customer_authenticated');
                const customerData = localStorage.getItem('customer_user');

                if (customerAuthenticated === 'true' && customerData) {
                    try {
                        const customer = JSON.parse(customerData);
                        console.log('🛒 Found customer user:', customer);
                        if (isMounted) {
                            setCustomerUser(customer);
                        }
                    } catch (error) {
                        console.error('Error parsing customer user data:', error);
                    }
                }

                // Set loading to false after checking both auth types
                if (isMounted) {
                    setLoading(false);
                }

                // Only check Supabase auth if we don't have a Google OAuth user
                if (!isAuthenticated || !userData) {
                    console.log('🔐 No Google OAuth user found, checking Supabase auth...');
                    // Fallback to Supabase auth with timeout
                    const authPromise = supabase.auth.getUser();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Auth timeout')), 5000)
                    );

                    const { data: { user } } = await Promise.race([authPromise, timeoutPromise]);

                    if (isMounted) {
                        console.log('🔐 Supabase auth result:', user);
                        setUser(user);
                        setLoading(false);

                        if (user) {
                            // Upsert user profile in users table (non-blocking)
                            const upsertPayload = {
                                id: user.id,
                                username: user.user_metadata?.name?.replace(/\s+/g, '').toLowerCase() || user.email,
                                display_name: user.user_metadata?.name || user.email,
                                email: user.email
                            };
                            console.log('Upserting user profile with:', upsertPayload);
                            upsertUserProfile(upsertPayload).catch(error =>
                                console.error('Upsert error:', error)
                            );
                        }
                    }
                } else {
                    console.log('🔐 Google OAuth user found, skipping Supabase auth check');
                }
            } catch (error) {
                console.error('Auth fetch error:', error);
                if (isMounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        };

        fetchUser();

        // Listen for auth state changes with debouncing
        let authChangeTimeout;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (authChangeTimeout) {
                clearTimeout(authChangeTimeout);
            }
            authChangeTimeout = setTimeout(() => {
                if (isMounted) {
                    // Only refetch if we don't have a Google OAuth user
                    const isAuthenticated = localStorage.getItem('isAuthenticated');
                    const userData = localStorage.getItem('user');

                    console.log('🔄 Auth state change detected:', event, 'Google OAuth user exists:', !!(isAuthenticated && userData));

                    if (!isAuthenticated || !userData) {
                        console.log('🔄 No Google OAuth user, refetching from Supabase...');
                        fetchUser();
                    } else {
                        console.log('🔄 Google OAuth user exists, skipping Supabase refetch');
                    }
                }
            }, 100);
        });

        return () => {
            isMounted = false;
            window.removeEventListener('oauthSuccess', handleOAuthSuccess);
            window.removeEventListener('creatorThankYouSignOut', handleCreatorThankYouSignOut);
            window.removeEventListener('userLoggedIn', handleUserLoggedIn);
            if (authChangeTimeout) {
                clearTimeout(authChangeTimeout);
            }
            subscription.unsubscribe();
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        // Detect if mobile device
        const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;

        const handleClickOutside = (event) => {
            if (isMobile) {
                // Mobile: Use a small delay to allow the button click to process first
                setTimeout(() => {
                    // Check if click is outside the user profile container and dropdown
                    const isClickInside = event.target.closest('.user-profile-container') ||
                        event.target.closest('.user-dropdown');
                    if (dropdownOpen && !isClickInside) {
                        console.log('🔄 Closing dropdown - clicked outside (mobile)');
                        setDropdownOpen(false);
                    }
                }, 10);
            } else {
                // Desktop: Use capture phase (original behavior)
                const isClickInside = event.target.closest('.user-profile-container') ||
                    event.target.closest('.user-dropdown');
                if (dropdownOpen && !isClickInside) {
                    console.log('🔄 Closing dropdown - clicked outside (desktop)');
                    setDropdownOpen(false);
                }
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && dropdownOpen) {
                console.log('🔄 Closing dropdown - Escape key');
                setDropdownOpen(false);
            }
        };

        // Mobile: bubble phase, Desktop: capture phase (original)
        document.addEventListener('click', handleClickOutside, !isMobile);
        document.addEventListener('keydown', handleEscapeKey);

        return () => {
            document.removeEventListener('click', handleClickOutside, !isMobile);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [dropdownOpen]);

    // Check admin role when user changes
    useEffect(() => {
        const checkAdminRole = async () => {
            if (user) {
                try {
                    const isOrderProcessing = await AdminService.isOrderProcessingAdmin();
                    const isFull = await AdminService.isFullAdmin();
                    setIsOrderProcessingAdmin(isOrderProcessing);
                    setIsFullAdmin(isFull);
                } catch (error) {
                    // 406 errors are expected for non-admin users due to RLS - don't log as errors
                    if (error?.code !== 'PGRST116' && !error?.message?.includes('406') && error?.status !== 406) {
                        console.error('Error checking admin role:', error);
                    }
                    setIsOrderProcessingAdmin(false);
                    setIsFullAdmin(false);
                }
            } else {
                setIsOrderProcessingAdmin(false);
                setIsFullAdmin(false);
            }
        };

        checkAdminRole();
    }, [user]);

    const handleLogin = () => {
        // Navigate to login page
        navigate('/login');
    };

    const handleSubscribeClick = () => {
        // Always go to earnings calculator first; from there users can click Get started → creator signup (Pending Approval flow)
        navigate('/subscription-tiers');
    };

    const handleCreatorSignup = async (email, location) => {
        localStorage.setItem('pending_creator_email', email);
        localStorage.setItem('pending_creator_location', location);
        const creatorSignupReturnUrl = 'https://screenmerch.com';
        const apiBase = (window.location.origin === 'https://screenmerch.com' || window.location.origin === 'https://www.screenmerch.com') ? '' : 'https://screenmerch.fly.dev';
        try {
            await fetch(`${apiBase}/api/auth/register-pending-creator`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: (email || '').trim().toLowerCase() }),
                credentials: 'include'
            });
        } catch (_) {}
        const loginUrl = `${apiBase}/api/auth/google/login?return_url=${encodeURIComponent(creatorSignupReturnUrl)}&flow=creator_signup`;
        window.location.href = loginUrl;
    };

    const handleCloseCreatorSignupModal = () => {
        setIsCreatorSignupModalOpen(false);
    };

    const handleLogout = async () => {
        try {
            // Clear ALL authentication data
            localStorage.removeItem('user');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('oauth_confirmation_pending');
            localStorage.removeItem('customer_authenticated');
            localStorage.removeItem('customer_user');
            localStorage.removeItem('user_authenticated');
            localStorage.removeItem('user_email');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('pending_creator_email');
            localStorage.removeItem('pending_creator_location');

            // Clear admin status cache
            AdminService.clearCache();

            // Clear Supabase session
            await supabase.auth.signOut();

            setUser(null);
            setCustomerUser(null);
            setUserProfile(null);
            console.log('✅ Logged out successfully - all auth data cleared');

            // Force a full page reload to clear any cached state
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            // Even if there's an error, still redirect to home
            window.location.href = '/';
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            try {
                const result = await deleteUserAccount();

                if (result.success) {
                    // Sign out and redirect
                    await supabase.auth.signOut();
                    setUser(null);
                    navigate('/');
                    alert('Your account has been successfully deleted.');
                    // Force page reload to clear any cached data
                    window.location.reload();
                } else {
                    alert(`Failed to delete account: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                alert('There was an error deleting your account. Please try again or contact support.');
            }
        }
    };


    const handleSubscribeModalClick = () => {
        setIsSubscriptionModalOpen(true);
    }

    const handleCloseModal = () => {
        setIsSubscriptionModalOpen(false);
    }

    const handleJoinChannel = () => {
        navigate('/join-channel');
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleSearchKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <>
            <nav className='flex-div'>
                <div className="nav-left flex-div">
                    <img
                        src={menu_icon}
                        alt="Menu"
                        className="menu-icon"
                        onClick={() => setSidebar(prev => !prev)}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSidebar(prev => !prev);
                        }}
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    />
                    <Link to="/" onClick={() => { resetCategory(); setSearchQuery(''); }}> <img src={creatorSettings?.custom_logo_url || logo} alt="Logo" className={`logo ${isOrderSuccessPage ? 'order-success-logo' : ''}`} onError={(e) => { e.target.onerror = null; e.target.src = logo; }} /></Link>
                </div>
                <div className="nav-center-right flex-div">
                    <div className="nav-middle flex-div">
                        <div className="search-box flex-div">
                            <input
                                type="text"
                                placeholder="Search channels"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={handleSearchKeyPress}
                            />
                            <img src={search_icon} alt="" onClick={handleSearch} style={{ cursor: 'pointer' }} />
                        </div>
                    </div>
                    <div className="nav-right flex-div">
                        {user && (user.role === 'creator' || user.role === 'admin') && (user.status === 'active' || user.status === undefined) && location.pathname !== '/creator-thank-you' && !(location.pathname === '/subscription-tiers' && (user?.status === 'pending' || user?.status === undefined)) ? (
                            console.log('🎥 Rendering upload link for creator:', user?.display_name, 'User object:', user) ||
                            <Link to="/upload"><img src={upload_icon} alt="Upload" /></Link>
                        ) : oauthProcessing ? (
                            console.log('🎥 OAuth processing - hiding upload button') ||
                            <div style={{ width: '24px', height: '24px' }}></div> // Placeholder to maintain layout
                        ) : (
                            console.log('🎥 No creator user - hiding upload button. User:', user, 'Role:', user?.role, 'Status:', user?.status) ||
                            <div style={{ width: '24px', height: '24px' }}></div> // Hide upload for regular users
                        )}
                        {loading ? (
                            <div className="loading-spinner-navbar"></div>
                        ) : (() => {
                            const isCreatorOrAdmin = user && (user.role === 'creator' || user.role === 'admin');
                            const isActive = user && (user.status === 'active' || user.status === undefined);
                            const isThankYouPage = location.pathname === '/creator-thank-you';
                            const isCalculatorAsPending = location.pathname === '/subscription-tiers' && (user?.status === 'pending' || user?.status === undefined);
                            const shouldShowProfile = isCreatorOrAdmin && isActive && !isThankYouPage && !isCalculatorAsPending;
                            console.log('🔍 Navbar render check:', {
                                hasUser: !!user,
                                role: user?.role,
                                status: user?.status,
                                isCreatorOrAdmin,
                                isActive,
                                isThankYouPage,
                                isCalculatorAsPending,
                                shouldShowProfile
                            });
                            return shouldShowProfile;
                        })() ? (
                            <>
                                {console.log('🎨 Rendering creator profile for:', user?.display_name || user?.user_metadata?.name)}
                                {console.log('🔍 Full user object:', user)}
                                {console.log('🔍 User role:', user?.role, 'User status:', user?.status)}
                                <button
                                    className="subscribe-btn"
                                    onClick={handleSubscribeClick}
                                >
                                    Start Free
                                </button>
                                <button
                                    className="user-profile-container"
                                    type="button"
                                    onClick={(e) => {
                                        console.log('🖱️ Container clicked, current dropdown state:', dropdownOpen);
                                        e.stopPropagation();
                                        const newState = !dropdownOpen;
                                        console.log('🖱️ Setting dropdown to:', newState);
                                        setDropdownOpen(newState);
                                    }}
                                    onTouchStart={(e) => {
                                        // Mobile: use same pattern as menu icon
                                        console.log('👆 Container touched, current dropdown state:', dropdownOpen);
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const newState = !dropdownOpen;
                                        console.log('👆 Setting dropdown to:', newState);
                                        setDropdownOpen(newState);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        touchAction: 'manipulation',
                                        WebkitTapHighlightColor: 'transparent',
                                        borderRadius: '50%',
                                        WebkitBorderRadius: '50%',
                                        overflow: 'visible', /* Allow dropdown to show */
                                        outline: 'none'
                                    }}
                                >
                                    <img
                                        key={`profile-img-${user?.id || 'unknown'}-${userProfile?.profile_image_url || user?.profile_image_url || user?.picture || 'default'}`}
                                        className='user-profile'
                                        src={(() => {
                                            // Prioritize profile_image_url from user object (sent by backend), then userProfile, then user_metadata
                                            // Check all possible sources in order of priority
                                            const imageUrl = user?.profile_image_url ||
                                                user?.picture ||
                                                userProfile?.profile_image_url ||
                                                user?.user_metadata?.picture ||
                                                '/default-avatar.svg';

                                            // Debug logging
                                            console.log('🖼️ [NAVBAR] Resolving profile image URL:', {
                                                'user?.profile_image_url': user?.profile_image_url,
                                                'user?.picture': user?.picture,
                                                'userProfile?.profile_image_url': userProfile?.profile_image_url,
                                                'user?.user_metadata?.picture': user?.user_metadata?.picture,
                                                'final URL': imageUrl
                                            });

                                            return imageUrl;
                                        })()}
                                        alt={user?.user_metadata?.name || user?.display_name || user?.name || 'User'}
                                        onClick={(e) => {
                                            console.log('🖱️ Image clicked, current dropdown state:', dropdownOpen);
                                            e.stopPropagation();
                                            const newState = !dropdownOpen;
                                            console.log('🖱️ Image: Setting dropdown to:', newState);
                                            setDropdownOpen(newState);
                                        }}
                                        onTouchStart={(e) => {
                                            // Mobile: use same pattern as menu icon
                                            console.log('👆 Image touched, current dropdown state:', dropdownOpen);
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newState = !dropdownOpen;
                                            console.log('👆 Image: Setting dropdown to:', newState);
                                            setDropdownOpen(newState);
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            pointerEvents: 'auto',
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            display: 'block',
                                            borderRadius: '50%',
                                            WebkitBorderRadius: '50%',
                                            objectFit: 'cover',
                                            WebkitAppearance: 'none',
                                            width: '35px',
                                            height: '35px',
                                            backgroundColor: 'transparent', // Ensure no background color interferes
                                            zIndex: 1, // Ensure image is above any background
                                            position: 'relative' // Ensure proper stacking context
                                        }}
                                        onError={(e) => {
                                            if (!e.target.dataset.fallbackUsed) {
                                                console.log('🖼️ [NAVBAR] Image failed to load!');
                                                console.log('🖼️ [NAVBAR] Failed URL:', e.target.src);
                                                console.log('🖼️ [NAVBAR] User object:', user);
                                                console.log('🖼️ [NAVBAR] UserProfile object:', userProfile);

                                                // Try all fallback options in order
                                                const fallbackUrl = user?.youtube_channel?.thumbnail ||
                                                    userProfile?.profile_image_url ||
                                                    user?.profile_image_url ||
                                                    user?.picture ||
                                                    user?.user_metadata?.picture ||
                                                    '/default-avatar.svg';

                                                if (e.target.src !== fallbackUrl && fallbackUrl !== '/default-avatar.svg') {
                                                    console.log('🖼️ [NAVBAR] Trying fallback URL:', fallbackUrl);
                                                    e.target.dataset.fallbackUsed = 'true';
                                                    e.target.src = fallbackUrl;
                                                } else {
                                                    console.log('🖼️ [NAVBAR] Using default avatar');
                                                    e.target.dataset.fallbackUsed = 'true';
                                                    e.target.src = '/default-avatar.svg';
                                                }
                                            }
                                        }}
                                        onLoad={(e) => {
                                            console.log('🖼️ [NAVBAR] Profile image loaded successfully');
                                            console.log('🖼️ [NAVBAR] Loaded image src:', e.target.src);
                                            console.log('🖼️ [NAVBAR] Image natural dimensions:', e.target.naturalWidth, 'x', e.target.naturalHeight);
                                            // Ensure image is visible and properly displayed
                                            e.target.style.display = 'block';
                                            e.target.style.visibility = 'visible';
                                            e.target.style.opacity = '1';
                                            e.target.style.width = '35px';
                                            e.target.style.height = '35px';
                                            e.target.style.objectFit = 'cover';
                                            e.target.style.borderRadius = '50%';
                                            // Ensure image is above any background or text
                                            e.target.style.position = 'relative';
                                            e.target.style.zIndex = '10';
                                            // Remove any text content that might be overlaying
                                            if (e.target.parentElement) {
                                                const parent = e.target.parentElement;
                                                // Remove any text nodes or span elements that might show initials
                                                Array.from(parent.childNodes).forEach(node => {
                                                    if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'IMG' && node.tagName !== 'DIV')) {
                                                        if (node.textContent && node.textContent.trim().length === 1) {
                                                            node.remove();
                                                        }
                                                    }
                                                });
                                            }
                                            // Remove any background that might be hiding the image
                                            e.target.style.background = 'none';
                                            e.target.style.backgroundColor = 'transparent';
                                        }}
                                    />
                                </button>
                                {console.log('🔽 Dropdown state:', dropdownOpen, 'Class:', `user-dropdown ${dropdownOpen ? 'open' : ''}`)}
                                <div className={`user-dropdown ${dropdownOpen ? 'open' : ''}`}>
                                    <p>Signed in as <strong>{user?.user_metadata?.name || user?.display_name}</strong></p>
                                    <hr />
                                    {/* Only show Dashboard if NOT order processing admin (order processing admins should only see Admin Portal) */}
                                    {!isOrderProcessingAdmin && (
                                        <button
                                            className="dropdown-item"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('🔗 Navigating to Dashboard');
                                                setDropdownOpen(false);
                                                navigate('/dashboard');
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '8px 16px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Dashboard
                                        </button>
                                    )}
                                    {/* Show Admin Portal for all admins (order processing admins and full admins) */}
                                    {(isOrderProcessingAdmin || isFullAdmin) && (
                                        <button
                                            className="dropdown-item"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('🔗 Navigating to Admin Portal');
                                                setDropdownOpen(false);
                                                navigate('/admin');
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '8px 16px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Admin Portal
                                        </button>
                                    )}
                                    {/* Only show Delete Account if NOT order processing admin */}
                                    {!isOrderProcessingAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDropdownOpen(false);
                                                handleDeleteAccount();
                                            }}
                                            className="dropdown-item delete-account-btn"
                                        >
                                            Delete Account
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDropdownOpen(false);
                                            handleLogout();
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 16px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Logout
                                    </button>
                                </div>
                            </>
                    ) : oauthProcessing ? (
                        <div className="sign-in-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                            Processing...
                        </div>
                    ) : (
                        // Not logged in or customer - show Sign In button
                        <>
                            <button 
                                className="sign-in-btn" 
                                onClick={handleLogin}
                                title="Sign in"
                            >
                                Sign In
                            </button>
                            <button 
                                className="subscribe-btn"
                                onClick={handleSubscribeClick}
                            >
                                Start Free
                            </button>
                        </>
                    )}
                    </div>
                </div>
            </nav>

            <SubscriptionModal
                isOpen={isSubscriptionModalOpen}
                onClose={handleCloseModal}
            />

            <CreatorSignupModal
                isOpen={isCreatorSignupModalOpen}
                onClose={handleCloseCreatorSignupModal}
                onSignup={handleCreatorSignup}
            />
        </>
    )
}

export default Navbar
