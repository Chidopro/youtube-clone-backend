import React, { useState, useEffect } from 'react'
import './Navbar.css'
import menu_icon from '../../assets/menu.png'
import logo from '../../assets/screenmerch_logo.png.png'
import search_icon from '../../assets/search.png'
import upload_icon from '../../assets/upload.png'
import more_icon from '../../assets/more.png'
import notification_icon from '../../assets/notification.png'
import { Link, useNavigate } from 'react-router-dom'
import SubscriptionModal from '../SubscriptionModal/SubscriptionModal'
import { supabase } from '../../supabaseClient'
import { upsertUserProfile, deleteUserAccount } from '../../utils/userService'

const Navbar = ({ setSidebar, resetCategory }) => {
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let isMounted = true;
        
        const fetchUser = async () => {
            try {
                // Check for Google OAuth user in localStorage first
                const isAuthenticated = localStorage.getItem('isAuthenticated');
                const userData = localStorage.getItem('user');
                
                if (isAuthenticated === 'true' && userData) {
                    try {
                        const googleUser = JSON.parse(userData);
                        console.log('🔐 Found Google OAuth user:', googleUser);
                        if (isMounted) {
                            setUser(googleUser);
                            setLoading(false);
                        }
                        return;
                    } catch (error) {
                        console.error('Error parsing Google OAuth user data:', error);
                    }
                }
                
                // Fallback to Supabase auth with timeout
                const authPromise = supabase.auth.getUser();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Auth timeout')), 5000)
                );
                
                const { data: { user } } = await Promise.race([authPromise, timeoutPromise]);
                
                if (isMounted) {
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
                    fetchUser();
                }
            }, 100);
        });

        return () => {
            isMounted = false;
            if (authChangeTimeout) {
                clearTimeout(authChangeTimeout);
            }
            subscription.unsubscribe();
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownOpen && !event.target.closest('.user-profile-container')) {
                setDropdownOpen(false);
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && dropdownOpen) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
        
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [dropdownOpen]);

    const handleLogin = async () => {
        try {
            console.log('🔐 Sign In button clicked - initiating Google OAuth');
            
            // Get the Google OAuth URL from our Flask backend
            const response = await fetch('https://screenmerch.fly.dev/api/auth/google/login', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to initiate Google login');
            }
            
            const data = await response.json();
            
            if (data.success && data.auth_url) {
                // Redirect to Google OAuth URL
                window.location.href = data.auth_url;
            } else {
                throw new Error(data.error || 'Failed to get Google login URL');
            }
        } catch (error) {
            console.error('Google login error:', error);
            alert('Login failed: ' + error.message);
        }
    };

    const handleLogout = async () => {
        // Check if user is logged in via Google OAuth
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        if (isAuthenticated === 'true') {
            // Clear Google OAuth data
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('user');
            console.log('🔓 Google OAuth user logged out');
        } else {
            // Fallback to Supabase logout
            await supabase.auth.signOut();
        }
        setUser(null);
        navigate('/');
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

    const handleSubscribeClick = () => {
        // Always redirect to tiers page for new user signups
        navigate('/subscription-tiers');
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

    return (
        <>
            <nav className='flex-div'>
                <div className="nav-left flex-div">
                    <img src={menu_icon} alt="" className="menu-icon" onClick={() => setSidebar(prev => !prev)} />
                    <Link to="/" onClick={resetCategory}> <img src={logo} alt="" className="logo" /></Link>
                </div>
                <div className="nav-middle flex-div">
                    <div className="search-box flex-div">
                        <input type="text" placeholder="Search" />
                        <img src={search_icon} alt="" />
                    </div>
                </div>
                <div className="nav-right flex-div">
                    {user ? (
                        <Link to="/upload"><img src={upload_icon} alt="Upload" /></Link>
                    ) : (
                        <img 
                            src={upload_icon} 
                            alt="Upload" 
                            style={{ cursor: 'pointer' }}
                            onClick={handleLogin}
                            title="Sign in to upload videos"
                        />
                    )}
                    <button 
                        className="subscribe-btn"
                        onClick={handleSubscribeClick}
                    >
                        Subscribe
                    </button>
                    {loading ? (
                        <div className="loading-spinner-navbar"></div>
                    ) : user ? (
                        <div className="user-profile-container">
                            <img 
                                className='user-profile' 
                                src={user?.user_metadata?.picture || user?.youtube_channel?.thumbnail || '/default-avatar.jpg'} 
                                alt={user?.user_metadata?.name || user?.display_name || 'User'} 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDropdownOpen(!dropdownOpen);
                                }}
                                style={{ cursor: 'pointer' }}
                            />
                            <div className={`user-dropdown ${dropdownOpen ? 'open' : ''}`}>
                                <p>Signed in as <strong>{user?.user_metadata?.name || user?.display_name}</strong></p>
                                <hr/>
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
                        </div>
                    ) : (
                        <button 
                            className="sign-in-btn" 
                            onClick={handleLogin}
                            title="Sign in with Google"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </nav>
            
            <SubscriptionModal 
                isOpen={isSubscriptionModalOpen} 
                onClose={handleCloseModal} 
            />
        </>
    )
}

export default Navbar
