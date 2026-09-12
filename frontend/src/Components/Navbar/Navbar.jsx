import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Navbar.css'
import logo from '../../assets/screenmerch_logo.png.png'
import search_icon from '../../assets/search.png'
import upload_icon from '../../assets/upload.png'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import SubscriptionModal from '../SubscriptionModal/SubscriptionModal'
import SignUpChoiceModal from '../SignUpChoiceModal/SignUpChoiceModal'
import CreatorSignupModal from '../CreatorSignupModal/CreatorSignupModal'
import { supabase } from '../../supabaseClient'
import { upsertUserProfile, deleteUserAccount, fetchMyProfileFromBackend } from '../../utils/userService'
import { AdminService } from '../../utils/adminService'
import { useCreator } from '../../contexts/CreatorContext'
import { isCreatorStorefrontHostname, peekCachedStorefrontBrand, rememberStorefrontBrand } from '../../utils/subdomainService'
import { CART_UPDATED_EVENT, getCartItemCount } from '../../utils/merchSession'
import { isShopperSignedIn } from '../../utils/shopperAuth'
import { endDemoPreviewSession, isDemoPreviewUser, isDemoStorefront, startDemoPreviewSession } from '../../utils/demoStorefront'
import { cropCustomLogoFromUrl } from '../../utils/logoBackground'
import { apiJoin, getBackendUrl } from '../../config/apiConfig'
import ShipToPicker from '../ShipToPicker/ShipToPicker'

const creatorSearchText = (creator) =>
    [creator?.name, creator?.username, creator?.subdomain]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

const filterCreators = (creators, query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return creators;
    return creators.filter((creator) => creatorSearchText(creator).includes(q));
};

const creatorAutofillSuffix = (query, creators) => {
    const typed = String(query || '');
    if (!typed) return '';
    const match = creators.find((creator) =>
        String(creator?.name || '').toLowerCase().startsWith(typed.toLowerCase())
    );
    if (!match) return '';
    return String(match.name).slice(typed.length);
};

const isUsableHexColor = (value) =>
    typeof value === 'string' && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value.trim());

const hexToRgba = (hex, alpha) => {
    const raw = String(hex || '').trim().replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (!/^[A-Fa-f0-9]{6}$/.test(full)) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const clampOpacityPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 100;
    return Math.max(0, Math.min(100, Math.round(n)));
};

const Navbar = ({ resetCategory }) => {
    const creatorContext = useCreator();
    const creatorSettings = creatorContext?.creatorSettings ?? null;
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [isSignUpChoiceOpen, setIsSignUpChoiceOpen] = useState(false);
    const [isCreatorSignupModalOpen, setIsCreatorSignupModalOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [customerUser, setCustomerUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [oauthProcessing, setOauthProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [creators, setCreators] = useState([]);
    const [creatorsLoaded, setCreatorsLoaded] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const searchWrapRef = useRef(null);
    const [cartCount, setCartCount] = useState(() => getCartItemCount());
    const [isOrderProcessingAdmin, setIsOrderProcessingAdmin] = useState(false);
    const [isFullAdmin, setIsFullAdmin] = useState(false);
    /** Order-processing-only admins see Admin Portal only; master admins keep Dashboard + Channel invites */
    const adminPortalOnlyMenu = isOrderProcessingAdmin && !isFullAdmin;
    const profileToggleLockRef = useRef(false);
    const dropdownOpenRef = useRef(false);
    const profileMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();
    const isOrderSuccessPage = location.pathname === '/success' || location.pathname === '/order-success';
    const isStorefront = isCreatorStorefrontHostname();
    const isMerchStoreRoute = /^\/(merchandise|product|tools|checkout|shop)(\/|$)/.test(location.pathname);
    const showStorefrontCart = isStorefront && (cartCount > 0 || isMerchStoreRoute);
    const storefrontPageActive = /^\/favorites(\/|$)/.test(location.pathname);
    const storefrontFriendsActive = location.pathname === '/friend-pages';
    const storefrontShopActive = isMerchStoreRoute;
    const showStorefrontHeaderLinks = isStorefront && !isOrderSuccessPage;
    const showStorefrontTabBar = showStorefrontHeaderLinks
        && location.pathname !== '/tools'
        && !location.pathname.startsWith('/checkout');
    const customLogoUrl = (creatorSettings?.custom_logo_url || '').trim();
    const logoSrc = customLogoUrl || (!isStorefront ? logo : '');
    const [logoOrientation, setLogoOrientation] = useState(() => {
        const cached = peekCachedStorefrontBrand()?.logo_orientation;
        return cached === 'horizontal' || cached === 'square' ? cached : 'square';
    });

    // Storefront only: Personalization primary+secondary → header gradient; otherwise white
    const storefrontHeaderGradient = (() => {
        if (!isCreatorStorefrontHostname()) return null;
        if (!isUsableHexColor(creatorSettings?.primary_color) || !isUsableHexColor(creatorSettings?.secondary_color)) {
            return null;
        }
        const alpha = clampOpacityPercent(creatorSettings?.header_opacity) / 100;
        return `linear-gradient(135deg, ${hexToRgba(creatorSettings.primary_color, alpha)} 0%, ${hexToRgba(creatorSettings.secondary_color, alpha)} 100%)`;
    })();

    const classifyLogoOrientation = (img) => {
        const next = (!img?.naturalWidth || !img?.naturalHeight)
            ? 'square'
            : (img.naturalWidth / img.naturalHeight >= 1.35 ? 'horizontal' : 'square');
        setLogoOrientation((prev) => (prev === next ? prev : next));
        if (customLogoUrl) {
            rememberStorefrontBrand({ custom_logo_url: customLogoUrl, logo_orientation: next });
        }
    };

    const prepareNavbarLogo = (img) => {
        if (!img) return;
        if (!customLogoUrl || img.dataset.logoCropped === '1') {
            classifyLogoOrientation(img);
            return;
        }
        if (img.dataset.logoCropping === '1') return;
        img.dataset.logoCropping = '1';
        const originalSrc = img.getAttribute('data-logo-original') || customLogoUrl;
        cropCustomLogoFromUrl(originalSrc).then((croppedUrl) => {
            if (!img.isConnected) return;
            if (croppedUrl && img.src !== croppedUrl) {
                img.dataset.logoCropped = '1';
                img.src = croppedUrl;
                return;
            }
            classifyLogoOrientation(img);
        });
    };

    useEffect(() => {
        if (!customLogoUrl) {
            setLogoOrientation('square');
            return;
        }
        const cached = peekCachedStorefrontBrand();
        if (
            cached?.custom_logo_url === customLogoUrl
            && (cached.logo_orientation === 'horizontal' || cached.logo_orientation === 'square')
        ) {
            setLogoOrientation(cached.logo_orientation);
        }
    }, [customLogoUrl]);

    useEffect(() => {
        document.body.classList.toggle('storefront-tab-bar-visible', showStorefrontTabBar);
        return () => document.body.classList.remove('storefront-tab-bar-visible');
    }, [showStorefrontTabBar]);

    useEffect(() => {
        const refreshCartChrome = () => setCartCount(getCartItemCount());
        refreshCartChrome();
        window.addEventListener(CART_UPDATED_EVENT, refreshCartChrome);
        window.addEventListener('storage', refreshCartChrome);
        window.addEventListener('focus', refreshCartChrome);
        return () => {
            window.removeEventListener(CART_UPDATED_EVENT, refreshCartChrome);
            window.removeEventListener('storage', refreshCartChrome);
            window.removeEventListener('focus', refreshCartChrome);
        };
    }, [location.pathname]);

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

                if (isDemoPreviewUser(loggedInUser)) {
                    setUser(loggedInUser);
                    setUserProfile(loggedInUser);
                    setLoading(false);
                    return;
                }

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

                        if (isDemoPreviewUser(loggedInUser)) {
                            if (isMounted) {
                                setUser(loggedInUser);
                                setUserProfile(loggedInUser);
                                setLoading(false);
                            }
                            return;
                        }

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

    // Close dropdown when clicking outside (only while open)
    useEffect(() => {
        dropdownOpenRef.current = dropdownOpen;
    }, [dropdownOpen]);

    useEffect(() => {
        if (!dropdownOpen) return undefined;

        const handleClickOutside = (event) => {
            if (profileToggleLockRef.current) return;
            if (
                !event.target.closest('.user-profile-menu') &&
                !event.target.closest('.user-dropdown--portal')
            ) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [dropdownOpen]);

    // Enrich user with role/status from backend so upload and creator controls show correctly
    useEffect(() => {
        let isMounted = true;
        const userId = user?.id;
        const needsRole = userId && (user.role === undefined || user.role === null);
        if (!needsRole) return;
        (async () => {
            const profile = await fetchMyProfileFromBackend(userId);
            if (!isMounted || !profile) return;
            const role = profile.role ?? user.role;
            const status = profile.status ?? user.status ?? 'active';
            if (role !== user.role || status !== user.status) {
                setUser(prev => (prev && prev.id === userId ? { ...prev, role, status, ...profile } : prev));
            }
        })();
        return () => { isMounted = false; };
    }, [user?.id, user?.role, user?.status]);

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
        if (isDemoStorefront()) {
            startDemoPreviewSession();
            window.location.assign('/dashboard');
            return;
        }
        navigate('/login');
    };

    const handleSubscribeClick = () => {
        // Always go to earnings calculator first; from there users can click Get started → creator signup (Pending Approval flow)
        navigate('/subscription-tiers');
    };

    const handleSignUpClick = () => {
        setIsSignUpChoiceOpen(true);
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
            endDemoPreviewSession();
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
        if (isDemoPreviewUser(user)) return;
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

    const filteredCreators = useMemo(
        () => filterCreators(creators, searchQuery),
        [creators, searchQuery]
    );
    const autofillSuffix = searchOpen ? creatorAutofillSuffix(searchQuery, filteredCreators) : '';

    useEffect(() => {
        if (isStorefront) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(apiJoin('/api/creators/list'));
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (res.ok && data?.success && Array.isArray(data.creators)) {
                    setCreators(
                        data.creators
                            .map((creator) => {
                                const subdomain = (creator.subdomain || '').trim();
                                const username = (creator.username || '').trim();
                                const rawName = String(creator.name || '').trim();
                                const name =
                                    rawName && rawName.toLowerCase() !== 'creator'
                                        ? rawName
                                        : subdomain || username || 'Creator';
                                return {
                                    ...creator,
                                    subdomain,
                                    username,
                                    name,
                                };
                            })
                            .filter((creator) => creator.subdomain || creator.username)
                    );
                } else {
                    setCreators([]);
                }
            } catch (_) {
                if (!cancelled) setCreators([]);
            } finally {
                if (!cancelled) setCreatorsLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isStorefront]);

    useEffect(() => {
        setHighlightIndex(0);
    }, [searchQuery, searchOpen]);

    useEffect(() => {
        if (!searchOpen) return undefined;
        const closeSearchFromOutside = (event) => {
            if (searchWrapRef.current?.contains(event.target)) return;
            setSearchOpen(false);
            searchWrapRef.current?.querySelector('input')?.blur();
            if (window.innerWidth > 768) return;
            const viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) return;
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
            window.setTimeout(() => {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
            }, 50);
        };
        const timer = window.setTimeout(() => {
            document.addEventListener('pointerdown', closeSearchFromOutside);
        }, 0);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', closeSearchFromOutside);
        };
    }, [searchOpen]);

    const goToCreator = (creator) => {
        if (!creator) return;
        const subdomain = (creator.subdomain || '').trim();
        const username = (creator.username || '').trim();
        setSearchOpen(false);
        setSearchQuery('');
        searchWrapRef.current?.querySelector('input')?.blur();
        if (subdomain) {
            window.location.href = `https://${subdomain}.screenmerch.com`;
            return;
        }
        if (username) {
            navigate(`/profile/${encodeURIComponent(username)}`);
        }
    };

    const selectHighlightedCreator = () => {
        const match = filteredCreators[highlightIndex] || filteredCreators[0];
        if (match) {
            goToCreator(match);
            return;
        }
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchOpen(false);
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearchOpen(true);
            setHighlightIndex((prev) =>
                filteredCreators.length ? (prev + 1) % filteredCreators.length : 0
            );
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearchOpen(true);
            setHighlightIndex((prev) =>
                filteredCreators.length
                    ? (prev - 1 + filteredCreators.length) % filteredCreators.length
                    : 0
            );
            return;
        }
        if (e.key === 'Tab' && autofillSuffix) {
            e.preventDefault();
            const match = filteredCreators.find((creator) =>
                String(creator?.name || '').toLowerCase().startsWith(searchQuery.toLowerCase())
            );
            if (match?.name) setSearchQuery(match.name);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            selectHighlightedCreator();
            return;
        }
        if (e.key === 'Escape') {
            setSearchOpen(false);
        }
    };

    const toggleProfileDropdown = (e) => {
        if (e) {
            e.stopPropagation();
        }
        profileToggleLockRef.current = true;
        setDropdownOpen((prev) => !prev);
        window.setTimeout(() => {
            profileToggleLockRef.current = false;
        }, 400);
    };

    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && dropdownOpenRef.current) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('keydown', handleEscapeKey);
        return () => document.removeEventListener('keydown', handleEscapeKey);
    }, []);

    useEffect(() => {
        if (!dropdownOpen) {
            setDropdownPosition(null);
            return undefined;
        }

        const updatePosition = () => {
            const trigger = profileMenuRef.current?.querySelector('.user-profile-container');
            if (!trigger) return;
            const rect = trigger.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 6,
                right: Math.max(10, window.innerWidth - rect.right),
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [dropdownOpen]);

    const renderProfileDropdown = () => {
        if (!dropdownOpen || !dropdownPosition || !user) return null;

        const menu = (
            <div
                className="user-dropdown user-dropdown--portal open"
                style={{
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                }}
                role="menu"
            >
                <p className="user-dropdown-identity">
                    Signed in as
                    <strong>
                        {user?.user_metadata?.name || user?.display_name || user?.email}
                    </strong>
                </p>
                <hr />
                {!adminPortalOnlyMenu && (
                    <button
                        className="dropdown-item"
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDropdownOpen(false);
                            navigate('/dashboard');
                        }}
                    >
                        Dashboard
                    </button>
                )}
                {!adminPortalOnlyMenu && (
                    <button
                        className="dropdown-item"
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDropdownOpen(false);
                            navigate('/channel-invites');
                        }}
                    >
                        Channel invites
                    </button>
                )}
                <button
                    className="dropdown-item"
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropdownOpen(false);
                        navigate('/faq', { state: { fromMenu: true, t: Date.now() } });
                        window.scrollTo(0, 0);
                    }}
                >
                    FAQ
                </button>
                {(isOrderProcessingAdmin || isFullAdmin) && (
                    <button
                        className="dropdown-item"
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDropdownOpen(false);
                            navigate('/admin');
                        }}
                    >
                        Admin Portal
                    </button>
                )}
                {!adminPortalOnlyMenu && (
                    <button
                        type="button"
                        disabled={isDemoPreviewUser(user)}
                        aria-disabled={isDemoPreviewUser(user)}
                        title={isDemoPreviewUser(user) ? 'Not available on the sample dashboard tour' : undefined}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isDemoPreviewUser(user)) return;
                            setDropdownOpen(false);
                            handleDeleteAccount();
                        }}
                        className={`dropdown-item delete-account-btn${isDemoPreviewUser(user) ? ' is-disabled' : ''}`}
                    >
                        Delete Account
                    </button>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropdownOpen(false);
                        handleLogout();
                    }}
                    className="dropdown-item"
                >
                    Logout
                </button>
            </div>
        );

        return createPortal(menu, document.body);
    };

    return (
        <>
            <nav
                className={`flex-div${dropdownOpen ? ' nav-dropdown-active' : ''}${logoOrientation === 'horizontal' ? ' nav--logo-horizontal' : ''}${storefrontHeaderGradient ? ' nav--brand-gradient' : ''}`}
                style={storefrontHeaderGradient ? { backgroundColor: '#fff', backgroundImage: storefrontHeaderGradient } : undefined}
            >
                <div className={`navbar-logo-wrap navbar-logo-wrap--${logoOrientation}`}>
                    <div className="navbar-logo-mark">
                    <Link to="/" onClick={() => { resetCategory(); setSearchQuery(''); }}>
                        {logoSrc ? (
                        <img
                            key={`navbar-logo-${customLogoUrl || 'default'}`}
                            src={logoSrc}
                            alt="Logo"
                            data-logo-original={customLogoUrl || undefined}
                            className={`logo${customLogoUrl ? ' logo--custom' : ''} logo--${logoOrientation}${isOrderSuccessPage ? ' order-success-logo' : ''}`}
                            onLoad={(e) => prepareNavbarLogo(e.target)}
                            ref={(el) => {
                                if (el?.complete && el.naturalWidth) prepareNavbarLogo(el);
                            }}
                            onError={(e) => {
                                e.target.onerror = null;
                                if (isStorefront) {
                                    e.target.removeAttribute('src');
                                    e.target.style.visibility = 'hidden';
                                    return;
                                }
                                e.target.src = logo;
                                setLogoOrientation('square');
                                if (customLogoUrl) console.warn('Custom logo failed to load. Check URL is public and correct:', customLogoUrl);
                            }}
                        />
                        ) : null}
                    </Link>
                    </div>
                    {showStorefrontHeaderLinks ? (
                        <div className="storefront-nav-links" role="navigation" aria-label="Store sections">
                            <Link
                                to="/favorites"
                                className={storefrontPageActive ? 'is-active' : undefined}
                            >
                                Page
                            </Link>
                            <Link
                                to="/friend-pages"
                                className={storefrontFriendsActive ? 'is-active' : undefined}
                            >
                                Friends
                            </Link>
                            <Link
                                to="/shop"
                                className={storefrontShopActive ? 'is-active' : undefined}
                            >
                                Shop
                            </Link>
                        </div>
                    ) : null}
                </div>
                <div className="nav-center-right flex-div">
                    {isStorefront ? null : (
                    <div className="nav-middle flex-div">
                        <div className="search-box-wrap" ref={searchWrapRef}>
                            <div className={`search-box flex-div${searchOpen ? ' is-open' : ''}`}>
                                <div className="search-input-slot">
                                    {autofillSuffix ? (
                                        <div className="search-autofill" aria-hidden="true">
                                            <span className="search-autofill-typed">{searchQuery}</span>
                                            <span className="search-autofill-rest">{autofillSuffix}</span>
                                        </div>
                                    ) : null}
                                    <input
                                        type="text"
                                        placeholder="Search channels"
                                        value={searchQuery}
                                        autoComplete="off"
                                        spellCheck="false"
                                        role="combobox"
                                        aria-autocomplete="list"
                                        aria-expanded={searchOpen}
                                        aria-controls="navbar-creator-suggest"
                                        onFocus={() => setSearchOpen(true)}
                                        onClick={() => setSearchOpen(true)}
                                        onBlur={() => {
                                            window.setTimeout(() => {
                                                if (searchWrapRef.current?.contains(document.activeElement)) return;
                                                setSearchOpen(false);
                                            }, 0);
                                        }}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setSearchOpen(true);
                                        }}
                                        onKeyDown={handleSearchKeyDown}
                                    />
                                </div>
                                <img
                                    src={search_icon}
                                    alt=""
                                    onClick={selectHighlightedCreator}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                            {searchOpen ? (
                                <ul className="search-suggest" id="navbar-creator-suggest" role="listbox">
                                    {filteredCreators.length === 0 ? (
                                        <li className="search-suggest-empty">
                                            {!creatorsLoaded
                                                ? 'Loading creators…'
                                                : searchQuery.trim()
                                                    ? 'No creators found'
                                                    : 'No creators yet'}
                                        </li>
                                    ) : (
                                        filteredCreators.map((creator, index) => (
                                            <li key={creator.id || creator.username || creator.subdomain || index} role="presentation">
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={index === highlightIndex}
                                                    className={index === highlightIndex ? 'is-active' : undefined}
                                                    onMouseEnter={() => setHighlightIndex(index)}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        goToCreator(creator);
                                                    }}
                                                >
                                                    {creator.avatar ? (
                                                        <img src={creator.avatar} alt="" />
                                                    ) : (
                                                        <span className="search-suggest-avatar">
                                                            {(creator.name || '?').charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <span className="search-suggest-copy">
                                                        <span className="search-suggest-name">{creator.name}</span>
                                                        {creator.subdomain ? (
                                                            <span className="search-suggest-host">{creator.subdomain}.screenmerch.com</span>
                                                        ) : null}
                                                    </span>
                                                </button>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            ) : null}
                        </div>
                    </div>
                    )}
                    <div className="nav-right flex-div">
                        {user && !isDemoPreviewUser(user) && (user.role === 'creator' || user.role === 'admin') && (user.status === 'active' || user.status === undefined) && location.pathname !== '/creator-thank-you' && !(location.pathname === '/subscription-tiers' && (user?.status === 'pending' || user?.status === undefined)) ? (
                            console.log('🎥 Rendering upload link for creator:', user?.display_name, 'User object:', user) ||
                            <Link to="/upload"><img src={upload_icon} alt="Upload" /></Link>
                        ) : oauthProcessing ? (
                            console.log('🎥 OAuth processing - hiding upload button') ||
                            <div className="nav-upload-spacer" aria-hidden="true" />
                        ) : (
                            console.log('🎥 No creator user - hiding upload button. User:', user, 'Role:', user?.role, 'Status:', user?.status) ||
                            <div className="nav-upload-spacer" aria-hidden="true" />
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
                                {console.log('🎨 Rendering creator profile for:', user?.display_name ?? user?.user_metadata?.name ?? user?.email ?? 'user')}
                                {console.log('🔍 Full user object:', user)}
                                {console.log('🔍 User role:', user?.role, 'User status:', user?.status)}
                                <button
                                    type="button"
                                    className="subscribe-btn"
                                    onClick={handleSignUpClick}
                                >
                                    Sign Up
                                </button>
                                <div className="user-profile-menu" ref={profileMenuRef}>
                                <button
                                    className="user-profile-container"
                                    type="button"
                                    aria-label="Account menu"
                                    aria-expanded={dropdownOpen}
                                    onClick={toggleProfileDropdown}
                                >
                                    <img
                                        key={`profile-img-${user?.id || 'unknown'}-${userProfile?.profile_image_url || user?.profile_image_url || user?.picture || 'default'}`}
                                        className='user-profile'
                                        src={(() => {
                                            const imageUrl = user?.profile_image_url ||
                                                user?.picture ||
                                                userProfile?.profile_image_url ||
                                                user?.user_metadata?.picture ||
                                                '/default-avatar.svg';
                                            return imageUrl;
                                        })()}
                                        alt={user?.user_metadata?.name || user?.display_name || user?.name || 'User'}
                                        draggable={false}
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
                                </div>
                            </>
                    ) : oauthProcessing ? (
                        <div className="sign-in-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                            Processing...
                        </div>
                    ) : isShopperSignedIn() || customerUser ? (
                        <button
                            className="sign-in-btn"
                            onClick={handleLogout}
                            title="Sign out"
                        >
                            Sign Out
                        </button>
                    ) : (
                        // Not logged in - show Sign In / Sign Up
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
                                onClick={handleSignUpClick}
                            >
                                Sign Up
                            </button>
                        </>
                    )}
                    {isStorefront ? (
                    <>
                    <ShipToPicker />
                    {showStorefrontCart ? (
                    <button
                        type="button"
                        className="nav-cart-btn"
                        onClick={() => {
                            if (isDemoStorefront()) {
                                let category = 'mens';
                                try {
                                    category = localStorage.getItem('last_selected_category') || 'mens';
                                } catch (_) {}
                                navigate(`/product/browse?category=${encodeURIComponent(category)}&openCart=true`);
                                return;
                            }
                            navigate('/checkout');
                        }}
                        aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
                        title="Cart"
                    >
                        <svg className="nav-cart-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zM7.16 14h9.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.07 5H6.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L7.16 14z" />
                        </svg>
                        {cartCount > 0 ? <span className="nav-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span> : null}
                    </button>
                    ) : null}
                    </>
                    ) : null}
                    </div>
                </div>
            </nav>

            {showStorefrontTabBar ? (
                <div className="storefront-tab-bar" role="navigation" aria-label="Store sections">
                    <Link
                        to="/favorites"
                        className={storefrontPageActive ? 'is-active' : undefined}
                    >
                        Page
                    </Link>
                    <Link
                        to="/friend-pages"
                        className={storefrontFriendsActive ? 'is-active' : undefined}
                    >
                        Friends
                    </Link>
                    <Link
                        to="/shop"
                        className={storefrontShopActive ? 'is-active' : undefined}
                    >
                        Shop
                    </Link>
                </div>
            ) : null}

            {renderProfileDropdown()}

            <SubscriptionModal
                isOpen={isSubscriptionModalOpen}
                onClose={handleCloseModal}
            />

            <SignUpChoiceModal
                isOpen={isSignUpChoiceOpen}
                onClose={() => setIsSignUpChoiceOpen(false)}
                onCreatorSignUp={() => setIsCreatorSignupModalOpen(true)}
            />

            <CreatorSignupModal
                isOpen={isCreatorSignupModalOpen}
                onClose={handleCloseCreatorSignupModal}
                onSignup={handleCreatorSignup}
                apiBase={getBackendUrl() || 'https://screenmerch.fly.dev'}
            />
        </>
    )
}

export default Navbar
