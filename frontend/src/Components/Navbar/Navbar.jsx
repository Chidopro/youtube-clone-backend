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

const Navbar = ({ setSidebar, resetCategory }) => {
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    // Simplified navbar - no complex authentication logic needed

    // Simplified navbar - authentication handled elsewhere

    const handleSubscribeClick = () => {
        console.log('🚀 Get Started Free clicked - navigating to subscription tiers');
        // Always redirect to the free earnings calculator page
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

    const handleSearchInput = (e) => {
        setSearchQuery(e.target.value);
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

    console.log('🔍 Navbar component rendering - simplified version');
    
    return (
        <>
            <nav className='flex-div' style={{ position: 'sticky', top: 0, zIndex: 9999, pointerEvents: 'auto' }}>
                <div className="nav-left flex-div">
                    <img 
                        src={menu_icon} 
                        alt="Menu" 
                        className="menu-icon" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🍔 Hamburger clicked - redirecting to home');
                            navigate('/');
                        }}
                        style={{ cursor: 'pointer', pointerEvents: 'auto', zIndex: 10001 }}
                        title="Go to Home"
                    />
                    <Link to="/" onClick={resetCategory}> <img src={logo} alt="" className="logo" /></Link>
                </div>
                <div className="nav-middle flex-div">
                    <div className="search-box flex-div">
                        <input 
                            type="text" 
                            placeholder="Search creators..." 
                            value={searchQuery}
                            onChange={handleSearchInput}
                            onKeyPress={handleSearchKeyPress}
                        />
                        <img 
                            src={search_icon} 
                            alt="Search" 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔍 Search icon clicked!');
                                handleSearch();
                            }}
                            style={{ cursor: 'pointer', pointerEvents: 'auto', zIndex: 10000 }}
                            title="Search creators"
                        />
                    </div>
                </div>
                <div className="nav-right flex-div">
                    <img 
                        src={upload_icon} 
                        alt="Upload" 
                        style={{ cursor: 'pointer', pointerEvents: 'auto', zIndex: 10001 }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('📤 Upload button clicked - redirecting to home');
                            navigate('/');
                        }}
                        title="Go to Home"
                    />
                    <Link 
                        to="/subscription-tiers" 
                        className="subscribe-btn"
                        onClick={(e) => {
                            console.log('🚀 Get Started Free Link clicked!');
                        }}
                        style={{ pointerEvents: 'auto', zIndex: 10000 }}
                    >
                        Get Started Free
                    </Link>
                    <button 
                        className="sign-in-btn" 
                        onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔐 Sign In button clicked - initiating Google OAuth');
                            
                            try {
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
                        }}
                        style={{ pointerEvents: 'auto', zIndex: 10001 }}
                        title="Sign in with Google"
                    >
                        Sign In
                    </button>
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
