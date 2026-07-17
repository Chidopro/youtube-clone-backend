import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './Dashboard.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import { AdminService } from '../../utils/adminService';
import { fetchMyProfileFromBackend, claimSessionTokenIfNeeded } from '../../utils/userService';
import { getBackendUrl } from '../../config/apiConfig';
import { favoriteListsJson } from '../../utils/favoriteListsApi';
import PersonalizationSettings from '../../Components/PersonalizationSettings/PersonalizationSettings.jsx';
import ChannelUmbrella from '../../Components/ChannelUmbrella/ChannelUmbrella.jsx';
import { channelFriendsJson } from '../../utils/channelFriendsApi';
// Force Netlify rebuild

/** Auto-generated umbrella list titles should not prefill the nickname field. */
function isUmbrellaAutoPageName(name) {
    const n = (name || '').replace(/\s*\(owner\)\s*/gi, ' ').trim();
    const stripped = n.replace(/\s*Favorites\s*$/i, '').trim();
    return !stripped || /^collaborator$/i.test(stripped);
}

function formatPayoutDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch (_) {
        return String(iso);
    }
}

function todayPayoutInputDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function cleanFavoritePageNickname(raw) {
    return (raw || '')
        .replace(/\s*\(owner\)\s*/gi, ' ')
        .replace(/\s*—?\s*collaborator\s*page\s*/gi, ' ')
        .replace(/\s*Umbrella\s*Page\s*$/i, '')
        .replace(/\s*Favorites\s*$/i, '')
        .trim();
}

function favoritePageSelectLabel(page) {
    if (!page) return 'Favorites';
    if (page.is_primary) {
        return 'Main Favorites';
    }
    if (page.is_collaborator_page) {
        const nick = cleanFavoritePageNickname(page.member_label || page.display_name || page.slug);
        return nick ? `${nick} Favorites` : 'Favorites';
    }
    return cleanFavoritePageNickname(page.display_name) || page.slug || 'Favorites';
}

function favoritePageNameTaken(pages, name, { ignoreListId } = {}) {
    const target = (name || '').trim().toLowerCase();
    if (!target) return false;
    return (pages || []).some((p) => {
        if (ignoreListId && p.id === ignoreListId) return false;
        const display = (p.display_name || '').trim().toLowerCase();
        const label = favoritePageSelectLabel(p).trim().toLowerCase();
        return display === target || label === target;
    });
}

const Dashboard = ({ sidebar }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('videos');
    const [umbrellaOnly, setUmbrellaOnly] = useState(false);

    // Open tab when URL has ?tab= (e.g. from navbar logo edit or FrameSnag "Add to Favorites")
    useEffect(() => {
        const tab = searchParams.get('tab');
        const listIdParam = (searchParams.get('list_id') || '').trim();
        if (listIdParam) {
            selectedFavoriteListIdRef.current = listIdParam;
            setSelectedFavoriteListId(listIdParam);
            try {
                localStorage.setItem('screenmerch_framesnag_list_id', listIdParam);
            } catch (_) {}
        }
        if (tab === 'personalization') setActiveTab('personalization');
        if (tab === 'analytics') setActiveTab('analytics');
        if (tab === 'favorites') {
            setActiveTab('favorites');
            setShowPasteHint(true); // Show "press Ctrl+V" hint when sent from FrameSnag
        }
    }, [searchParams]);

    useEffect(() => {
        if (!user?.id || userProfile?.role !== 'creator') {
            setUmbrellaOnly(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { ok, data } = await channelFriendsJson('/api/channel-friends/my-umbrella-status', { method: 'GET' });
                if (cancelled) return;
                if (ok && data?.is_umbrella_only) {
                    setUmbrellaOnly(true);
                    const tabParam = new URLSearchParams(window.location.search).get('tab');
                    if (tabParam === 'analytics' || tabParam === 'videos' || tabParam === 'favorites') {
                        setActiveTab(tabParam);
                    } else {
                        setActiveTab('favorites');
                    }
                } else {
                    setUmbrellaOnly(false);
                }
            } catch (_) {
                if (!cancelled) setUmbrellaOnly(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id, userProfile?.role]);

    // Paste-from-FrameSnag: storefront owners only (umbrella collaborators upload manually)
    useEffect(() => {
        if (activeTab !== 'favorites' || umbrellaOnly) return;
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type === 'image/png' || item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) return;
                    const file = new File([blob], `framesnag-${Date.now()}.png`, { type: blob.type || 'image/png' });
                    setNewFavorite({
                        title: 'From FrameSnag',
                        description: '',
                        image: file,
                        imagePreview: URL.createObjectURL(blob)
                    });
                    setShowFavoriteModal(true);
                    setShowPasteHint(false); // Hide hint once they pasted
                    break;
                }
            }
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [activeTab, umbrellaOnly]);

    const [currentUser, setCurrentUser] = useState(null);
    const [payoutData, setPayoutData] = useState({
        paypal_email: '',
        tax_id: ''
    });
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutMessage, setPayoutMessage] = useState('');
    const [favorites, setFavorites] = useState([]);
    const [favoritePages, setFavoritePages] = useState([]);
    const [selectedFavoriteListId, setSelectedFavoriteListId] = useState(null);
    const [newPageName, setNewPageName] = useState('');
    const [umbrellaPageName, setUmbrellaPageName] = useState('');
    const [umbrellaOwnerName, setUmbrellaOwnerName] = useState('');
    const [savingFavoritePage, setSavingFavoritePage] = useState(false);
    const [movingFavoriteId, setMovingFavoriteId] = useState(null);
    const selectedFavoriteListIdRef = useRef(null);
    const [uploadingFavorite, setUploadingFavorite] = useState(false);
    const [showFavoriteModal, setShowFavoriteModal] = useState(false);
    const [showPasteHint, setShowPasteHint] = useState(false);
    const [newFavorite, setNewFavorite] = useState({
        title: '',
        description: '',
        image: null,
        imagePreview: null
    });
    const [analyticsData, setAnalyticsData] = useState({
        total_sales: 0,
        total_revenue: 0,
        products_sold_count: 0,
        videos_with_sales_count: 0,
        avg_order_value: 0,
        products_sold: [],
        recent_sales: [],
        daily_sales: [],
        page_name: '',
        storefront_owner_name: '',
        collaborator_net_owed: 0,
        paid_total: 0,
        last_payout: null,
        payout_note: '',
        payout_summary: {},
        platform_fee_amount: 0,
        pay_collaborator_amount: 0,
    });
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [collaboratorPayoutRows, setCollaboratorPayoutRows] = useState([]);
    const [collaboratorOwedTotal, setCollaboratorOwedTotal] = useState(0);
    const [analyticsPayoutModal, setAnalyticsPayoutModal] = useState(null);
    const [analyticsPayoutAmount, setAnalyticsPayoutAmount] = useState('');
    const [analyticsPayoutDate, setAnalyticsPayoutDate] = useState('');
    const [analyticsPayoutNote, setAnalyticsPayoutNote] = useState('');
    const [recordingAnalyticsPayout, setRecordingAnalyticsPayout] = useState(false);
    const [isMasterAdmin, setIsMasterAdmin] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [editVideoForm, setEditVideoForm] = useState({
        title: '',
        thumbnail: '',
        video_url: ''
    });
    const [uploadingVideoFile, setUploadingVideoFile] = useState(false);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const modalContentRef = useRef(null);
    

    const navigate = useNavigate();


    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Check for authenticated user (email login or OAuth)
                const isAuthenticated = localStorage.getItem('isAuthenticated');
                const userData = localStorage.getItem('user');
                
                let user = null;
                
                if (isAuthenticated === 'true' && userData) {
                    // User from localStorage (email login or OAuth)
                    user = JSON.parse(userData);
                    console.log('🔐 Dashboard: Found authenticated user from localStorage:', user);
                } else {
                    // Fallback to Supabase auth
                    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
                    if (supabaseUser) {
                        user = supabaseUser;
                        console.log('🔐 Dashboard: Found Supabase user:', user);
                    }
                }
                
                if (!user) {
                    console.log('🔐 Dashboard: No authenticated user found, redirecting to home');
                    navigate('/');
                    return;
                }

                setUser(user);

                // CRITICAL: Fetch user profile from backend (safe fields only)
                let profile = null;
                if (user.id) {
                    console.log('🔍 [DASHBOARD] Fetching latest profile from backend for user ID:', user.id);
                    profile = await fetchMyProfileFromBackend(user.id);
                    if (profile) {
                        console.log('✅ [DASHBOARD] Fetched profile from backend:', {
                            profile_image_url: profile?.profile_image_url,
                            cover_image_url: profile?.cover_image_url,
                            display_name: profile?.display_name
                        });
                    }
                }

                if (profile) {
                    // CRITICAL: Use database values directly (same as cover_image_url)
                    // Don't override database values with fallbacks - let the image src handle fallbacks
                    const finalProfileImageUrl = profile.profile_image_url || '';
                    const finalCoverImageUrl = profile.cover_image_url || '';
                    
                    // Merge profile with user data - use database values directly
                    const mergedProfile = {
                        ...profile,
                        profile_image_url: finalProfileImageUrl,
                        cover_image_url: finalCoverImageUrl
                    };
                    
                    setUserProfile(mergedProfile);
                    
                    // CRITICAL: Update localStorage with latest database values
                    const updatedUser = {
                        ...user,
                        id: profile.id || user.id,
                        profile_image_url: finalProfileImageUrl,
                        cover_image_url: finalCoverImageUrl,
                        display_name: profile.display_name || user.display_name || user.user_metadata?.name || '',
                        bio: profile.bio || user.bio || ''
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    console.log('💾 [DASHBOARD] Updated localStorage with profile_image_url:', updatedUser.profile_image_url);
                    
                    // CRITICAL: Also update user state so image src resolution works immediately
                    setUser(updatedUser);
                    console.log('✅ [DASHBOARD] Updated user state with profile_image_url:', updatedUser.profile_image_url);
                    
                    // Load payout data if available
                    setPayoutData({
                        paypal_email: profile.paypal_email || '',
                        tax_id: profile.tax_id || ''
                    });
                } else {
                    // Fallback: For users without database profile, use localStorage data
                    console.log('⚠️ [DASHBOARD] No database profile found, using localStorage data');
                    // Priority: user.profile_image_url > user.picture > user.user_metadata?.picture
                    const profileImageUrl = user.profile_image_url || user.picture || user.user_metadata?.picture || '';
                    const coverImageUrl = user.cover_image_url || '';
                    // Create userProfile object with all available data
                    const userProfileData = {
                        ...user,
                        profile_image_url: profileImageUrl,
                        cover_image_url: coverImageUrl,
                        display_name: user.display_name || user.user_metadata?.name || '',
                        bio: user.bio || ''
                    };
                    setUserProfile(userProfileData);
                }

                // Fetch user subscription
                const userSubscription = await SubscriptionService.getCurrentUserSubscription();
                setSubscription(userSubscription);

                // Fetch user's videos from Supabase (only if user has an ID)
                if (user.id) {
                    const { data: userVideos, error: videosError } = await supabase
                        .from('videos2')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (userVideos) {
                        setVideos(userVideos);
                    }
                    
                } else {
                    // For Google OAuth users without database ID, show empty videos
                    setVideos([]);
                    setFavorites([]);
                }

            } catch (error) {
                console.error('Error fetching data:', error);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    const reloadFavoritesForList = async (userId, listId, pages = favoritePages) => {
        if (!userId || !listId) {
            setFavorites([]);
            return;
        }
        const page = pages.find((p) => p.id === listId);
        const favUserId = page?.is_collaborator_page ? page.owner_user_id : userId;
        const { data, error } = await supabase
            .from('creator_favorites')
            .select('*')
            .eq('user_id', favUserId)
            .eq('list_id', listId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Favorites fetch:', error);
            setFavorites([]);
        } else {
            setFavorites(data || []);
        }
    };

    const persistFramesnagListTarget = (listId) => {
        if (!listId) return;
        try {
            localStorage.setItem('screenmerch_framesnag_list_id', listId);
            localStorage.setItem('screenmerch_framesnag_origin', window.location.origin);
        } catch (_) {}
    };

    useEffect(() => {
        selectedFavoriteListIdRef.current = selectedFavoriteListId;
    }, [selectedFavoriteListId]);

    useEffect(() => {
        if (activeTab !== 'favorites' || !user?.id || userProfile?.role !== 'creator') return;
        let cancelled = false;
        (async () => {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/mine');
            if (cancelled) return;
            if (data?.is_umbrella_only) {
                setUmbrellaOnly(true);
                setUmbrellaOwnerName(data.owner_name || '');
            }
            if (data?.user_id && data.user_id !== user.id) {
                const merged = { ...user, id: data.user_id };
                localStorage.setItem('user', JSON.stringify(merged));
                setUser(merged);
            }
            const listUserId = data?.user_id || user.id;
            if (ok && data?.lists?.length) {
                setFavoritePages(data.lists);
                const collabList = data.lists.find((l) => l.storefront_owner_id) || null;
                const primary = data.is_umbrella_only
                    ? collabList
                    : (data.lists.find((l) => l.is_primary) || data.lists.find((l) => !l.is_collaborator_page) || data.lists[0]);
                const urlListId = (searchParams.get('list_id') || '').trim();
                let storedListId = '';
                try {
                    storedListId = localStorage.getItem('screenmerch_framesnag_list_id') || '';
                } catch (_) {}
                const preferredListId = urlListId || storedListId;
                const prev = selectedFavoriteListIdRef.current;
                const nextId =
                    preferredListId && data.lists.some((l) => l.id === preferredListId)
                        ? preferredListId
                        : prev && data.lists.some((l) => l.id === prev && (!data.is_umbrella_only || l.storefront_owner_id))
                        ? prev
                        : primary?.id || null;
                setSelectedFavoriteListId(nextId);
                if (nextId) persistFramesnagListTarget(nextId);
                if (data.is_umbrella_only && primary) {
                    const rawName = (primary.display_name || '').replace(/\s*\(owner\)\s*/gi, ' ').trim();
                    setUmbrellaPageName(isUmbrellaAutoPageName(rawName) ? '' : rawName);
                }
                if (nextId && listUserId) {
                    const page = data.lists.find((l) => l.id === nextId);
                    const favUserId = page?.is_collaborator_page ? page.owner_user_id : listUserId;
                    await reloadFavoritesForList(favUserId, nextId, data.lists);
                }
            } else {
                setFavoritePages([]);
                setFavorites([]);
            }
        })();
        return () => { cancelled = true; };
    }, [activeTab, user?.id, userProfile?.role]);

    const handleFavoriteListChange = (listId) => {
        if (!user?.id || !listId) return;
        setSelectedFavoriteListId(listId);
        persistFramesnagListTarget(listId);
        const page = favoritePages.find((p) => p.id === listId);
        const favUserId = page?.is_collaborator_page ? page.owner_user_id : user.id;
        reloadFavoritesForList(favUserId, listId);
    };

    const handleSaveUmbrellaPageName = async () => {
        const name = umbrellaPageName.trim();
        const collabList = favoritePages.find((l) => l.storefront_owner_id) || favoritePages[0];
        const listId = collabList?.id || selectedFavoriteListId;
        if (!name) {
            alert('Enter a page name (this nickname appears in the storefront menu — not your email).');
            return;
        }
        if (favoritePageNameTaken(favoritePages, name, { ignoreListId: listId })) {
            alert('That page name is already in use. Choose a different nickname.');
            return;
        }
        setSavingFavoritePage(true);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/rename', {
                method: 'POST',
                body: JSON.stringify({ list_id: listId, display_name: name }),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not save page name');
                return;
            }
            const updated = data.list;
            setFavoritePages((prev) =>
                prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            );
            setUmbrellaPageName(updated.display_name || name);
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not save page name');
        } finally {
            setSavingFavoritePage(false);
        }
    };

    const handleCreateFavoritePage = async () => {
        const name = newPageName.trim();
        if (!name) {
            alert('Enter a display name for the new page.');
            return;
        }
        if (favoritePageNameTaken(favoritePages, name)) {
            alert('A page with this name already exists. Choose a different name.');
            return;
        }
        setSavingFavoritePage(true);
        try {
            const body = { display_name: name };
            const { ok, data } = await favoriteListsJson('/api/favorite-lists', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not create page');
                return;
            }
            const created = data.list;
            setFavoritePages((prev) => [...prev, created].sort((a, b) => {
                const ap = a.is_primary ? 0 : 1;
                const bp = b.is_primary ? 0 : 1;
                if (ap !== bp) return ap - bp;
                return (a.sort_order || 0) - (b.sort_order || 0);
            }));
            setNewPageName('');
            if (created?.id && user?.id) {
                setSelectedFavoriteListId(created.id);
                await reloadFavoritesForList(user.id, created.id);
            }
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not create page');
        } finally {
            setSavingFavoritePage(false);
        }
    };

    const handleMoveFavoriteToList = async (favorite, targetListId) => {
        if (!user?.id || !targetListId) return;
        const cur = favorite.list_id != null ? String(favorite.list_id) : '';
        if (cur === String(targetListId)) return;
        setMovingFavoriteId(favorite.id);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorites/move-list', {
                method: 'POST',
                body: JSON.stringify({ favorite_id: favorite.id, list_id: targetListId }),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not move item to that page');
                return;
            }
            if (String(targetListId) === String(selectedFavoriteListId)) {
                setFavorites((prev) =>
                    prev.map((f) => (f.id === favorite.id ? { ...f, list_id: targetListId } : f))
                );
            } else {
                setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
            }
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not move item');
        } finally {
            setMovingFavoriteId(null);
        }
    };

    const handleDeleteFavoritePage = async () => {
        const row = favoritePages.find((l) => l.id === selectedFavoriteListId);
        if (!row || row.is_primary) return;
        const n = favorites.length;
        const msg =
            n > 0
                ? `Delete favorite page "${row.display_name}"? The ${n} item(s) on this page will move to your main favorites page. This page’s public link will stop working.`
                : `Delete favorite page "${row.display_name}"? This page’s public link will stop working.`;
        if (!window.confirm(msg)) {
            return;
        }
        setSavingFavoritePage(true);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/delete', {
                method: 'POST',
                body: JSON.stringify({ id: row.id }),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not delete page');
                return;
            }
            const nextLists = favoritePages.filter((l) => l.id !== row.id);
            setFavoritePages(nextLists);
            const fallback = nextLists.find((l) => l.is_primary) || nextLists[0];
            const nextId = fallback?.id || null;
            setSelectedFavoriteListId(nextId);
            if (nextId && user?.id) await reloadFavoritesForList(user.id, nextId);
            else setFavorites([]);
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not delete page');
        } finally {
            setSavingFavoritePage(false);
        }
    };

    useEffect(() => {
        const fetchCurrentUser = async () => {
            // Check for Google OAuth user first
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            const userData = localStorage.getItem('user');
            
            if (isAuthenticated === 'true' && userData) {
                // Google OAuth user
                const googleUser = JSON.parse(userData);
                setCurrentUser({ ...googleUser, role: 'creator' });
            } else {
                // Fallback to Supabase auth
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', user.id)
                        .single();
                    setCurrentUser({ ...user, ...profile });
                } else {
                    setCurrentUser(null);
                }
            }
        };
        fetchCurrentUser();
    }, []);


    const handleDeleteVideo = async (videoId, videoTitle, event) => {
        // Prevent the card click event from triggering
        event.stopPropagation();
        
        // Show confirmation dialog
        const isConfirmed = window.confirm(`Are you sure you want to delete "${videoTitle}"? This action cannot be undone.`);
        
        if (!isConfirmed) {
            return;
        }

        try {
            const result = await AdminService.deleteVideo(videoId);
            
            if (result.success) {
                // Remove the video from the local state
                setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
                alert('Video deleted successfully!');
            } else {
                alert(`Failed to delete video: ${result.error}`);
            }
        } catch (error) {
            console.error('Error deleting video:', error);
            alert('Failed to delete video. Please try again.');
        }
    };

    const handleUploadFavorite = async () => {
        if (!newFavorite.title || !newFavorite.image) {
            alert('Please provide a title and image.');
            return;
        }

        // Prefer Flask/backend session user id (Google OAuth + umbrella email/password).
        // Stale Supabase Auth sessions must not override the users-table id.
        let userId = user?.id || null;
        const isFlaskAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        const storedUserRaw = localStorage.getItem('user');
        let storedUser = null;
        if (storedUserRaw) {
            try {
                storedUser = JSON.parse(storedUserRaw);
            } catch (_) {
                storedUser = null;
            }
        }
        if (!userId && storedUser?.id) {
            userId = storedUser.id;
            console.log('Using user ID from localStorage session:', userId);
        }

        const { data: { user: supabaseUser }, error: authErr } = await supabase.auth.getUser();

        if (!userId && supabaseUser?.id) {
            userId = supabaseUser.id;
            console.log('Using Supabase Auth user ID:', userId);
        } else if (!userId && storedUser?.email) {
            const { data: userRecord, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', storedUser.email)
                .maybeSingle();
            if (userRecord?.id) {
                userId = userRecord.id;
                console.log('Found user ID from users table by email:', userId);
            } else {
                console.error('User not found in users table:', userError);
            }
        }

        if (!userId) {
            console.error('Auth error:', authErr);
            alert('Authentication required. Please sign in again from your invite link.');
            return;
        }

        const useBackendUpload = isFlaskAuthenticated || !supabaseUser;
        const accountEmail = (user?.email || storedUser?.email || supabaseUser?.email || '').trim().toLowerCase();
        if (useBackendUpload && !accountEmail) {
            alert('Your session is missing your email. Please sign out and sign in again with your invited email.');
            return;
        }
        if (accountEmail && userId) {
            const synced = await fetchMyProfileFromBackend(userId);
            if (synced?.id && synced.id !== userId) {
                userId = synced.id;
                const merged = { ...(storedUser || user || {}), ...synced, id: synced.id };
                localStorage.setItem('user', JSON.stringify(merged));
                setUser(merged);
            }
        }

        try {
            setUploadingFavorite(true);

            // Validate file size (max 5MB)
            if (newFavorite.image.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB.');
                setUploadingFavorite(false);
                return;
            }

            if (useBackendUpload) {
                // Google OAuth: backend uploads to storage and inserts row (bypasses RLS)
                const channelTitle = userProfile?.display_name || userProfile?.username || 'Unknown';
                const formData = new FormData();
                formData.append('file', newFavorite.image);
                formData.append('user_id', userId);
                formData.append('title', newFavorite.title);
                if (newFavorite.description) formData.append('description', newFavorite.description);
                formData.append('channel_title', channelTitle);
                if (accountEmail) formData.append('email', accountEmail);
                if (selectedFavoriteListId) formData.append('list_id', selectedFavoriteListId);
                let sessionToken = typeof localStorage !== 'undefined' && localStorage.getItem('auth_token');
                if (!sessionToken) sessionToken = await claimSessionTokenIfNeeded(userId);
                if (sessionToken) formData.append('session_token', sessionToken);
                const headers = { 'X-User-Id': userId };
                if (accountEmail) headers['X-User-Email'] = accountEmail;
                if (sessionToken) headers['X-Session-Token'] = sessionToken;
                const res = await fetch(`${getBackendUrl()}/api/favorites/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: formData
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    alert(json.error || `Upload failed (${res.status})`);
                    setUploadingFavorite(false);
                    return;
                }
                if (json.success && json.favorite) {
                    if (json.user_id_corrected && json.user_id) {
                        const merged = { ...(storedUser || user || {}), id: json.user_id, email: accountEmail || (storedUser || user || {}).email };
                        localStorage.setItem('user', JSON.stringify(merged));
                        setUser(merged);
                    } else if (json.user_id && json.user_id !== userId && !json.collaborator_upload) {
                        const merged = { ...(storedUser || user || {}), id: json.user_id };
                        localStorage.setItem('user', JSON.stringify(merged));
                        setUser(merged);
                    }
                    setFavorites(prev => [json.favorite, ...prev]);
                    setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                    setShowFavoriteModal(false);
                    alert('Favorite uploaded successfully!');
                } else {
                    alert(json.error || 'Upload failed');
                }
                setUploadingFavorite(false);
                return;
            }

            // Supabase Auth user: upload and insert via client
            const fileExt = newFavorite.image.name.split('.').pop();
            const fileName = `${userId}/favorites/${Date.now()}.${fileExt}`;
            
            console.log('Uploading favorite image:', fileName);
            console.log('User ID:', userId);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, newFavorite.image, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Error uploading image:', uploadError);
                console.error('Error details:', JSON.stringify(uploadError, null, 2));
                
                if (uploadError.message && uploadError.message.includes('not found')) {
                    alert('Storage bucket not found. Please check your Supabase storage configuration.');
                } else if (uploadError.message && uploadError.message.includes('row-level security')) {
                    alert('Permission denied. Please check your Supabase storage policies.');
                } else {
                    alert(`Failed to upload image: ${uploadError.message || 'Unknown error'}`);
                }
                setUploadingFavorite(false);
                return;
            }

            console.log('Image uploaded successfully:', uploadData);

            const { data: { publicUrl } } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(fileName);

            console.log('Public URL:', publicUrl);

            const channelTitle = userProfile?.display_name || userProfile?.username || 'Unknown';
            console.log('Saving favorite to database with channelTitle:', channelTitle);

            let insertData = {
                user_id: userId,
                channelTitle: channelTitle,
                title: newFavorite.title,
                description: newFavorite.description || null,
                image_url: publicUrl,
                thumbnail_url: publicUrl,
                ...(selectedFavoriteListId ? { list_id: selectedFavoriteListId } : {}),
            };
            
            const { data, error } = await supabase
                .from('creator_favorites')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Error saving favorite:', error);
                if (error.message && (error.message.includes('channelTitle') || error.message.includes('channeltitle'))) {
                    const retryData = {
                        user_id: userId,
                        channeltitle: channelTitle,
                        title: newFavorite.title,
                        description: newFavorite.description || null,
                        image_url: publicUrl,
                        thumbnail_url: publicUrl,
                        ...(selectedFavoriteListId ? { list_id: selectedFavoriteListId } : {}),
                    };
                    const { data: retryData_result, error: retryError } = await supabase
                        .from('creator_favorites')
                        .insert(retryData)
                        .select()
                        .single();
                    if (retryError) {
                        alert(`Failed to save favorite: ${retryError.message || 'Unknown error'}.`);
                    } else {
                        setFavorites(prev => [retryData_result, ...prev]);
                        setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                        setShowFavoriteModal(false);
                        alert('Favorite uploaded successfully!');
                    }
                } else {
                    alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
                }
            } else {
                console.log('Favorite saved successfully:', data);
                setFavorites(prev => [data, ...prev]);
                setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                setShowFavoriteModal(false);
                alert('Favorite uploaded successfully!');
            }
        } catch (error) {
            console.error('Error uploading favorite:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to upload favorite: ${error.message || 'Unknown error'}`);
        } finally {
            setUploadingFavorite(false);
        }
    };

    const handleMakeMerchFromFavorite = async (favorite) => {
        // Check if user is authenticated
        const isAuthenticated = localStorage.getItem('user_authenticated');
        const googleAuthenticated = localStorage.getItem('isAuthenticated');
        const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');
        
        if (!isLoggedIn) {
            // Store favorite data for after login
            const merchData = {
                thumbnail: favorite.image_url || favorite.thumbnail_url,
                screenshots: [favorite.image_url || favorite.thumbnail_url],
                videoUrl: window.location.href,
                videoTitle: favorite.title || 'Favorite Image',
                creatorName: favorite.channeltitle || favorite.channelTitle || userProfile?.display_name || userProfile?.username || 'Unknown Creator'
            };
            localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
            alert('Please log in to create merchandise');
            return;
        }
        
        // User is authenticated, save data and navigate to merchandise page
        const merchData = {
            thumbnail: favorite.image_url || favorite.thumbnail_url,
            screenshots: [favorite.image_url || favorite.thumbnail_url],
            videoUrl: window.location.href,
            videoTitle: favorite.title || 'Favorite Image',
            creatorName: favorite.channeltitle || favorite.channelTitle || userProfile?.display_name || userProfile?.username || 'Unknown Creator'
        };
        localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
        
        // Navigate to merchandise categories page
        navigate('/merchandise');
    };

    const handleDeleteFavorite = async (favoriteId, favoriteTitle) => {
        const isConfirmed = window.confirm(`Are you sure you want to delete "${favoriteTitle}"? This action cannot be undone.`);
        
        if (!isConfirmed) {
            return;
        }

        try {
            const { error } = await supabase
                .from('creator_favorites')
                .delete()
                .eq('id', favoriteId);

            if (error) {
                console.error('Error deleting favorite:', error);
                alert('Failed to delete favorite. Please try again.');
            } else {
                // Remove from local state
                setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
                alert('Favorite deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting favorite:', error);
            alert('Failed to delete favorite. Please try again.');
        }
    };

    const handleEditVideo = (video, event) => {
        event.stopPropagation();
        setEditingVideo(video);
        setEditVideoForm({
            title: video.title || '',
            thumbnail: video.thumbnail || '',
            video_url: video.video_url || ''
        });
        setThumbnailPreview(null);
    };

    // Reset scroll position when modal opens and ensure content is visible
    useEffect(() => {
        if (editingVideo && modalContentRef.current) {
            // Reset scroll to top
            modalContentRef.current.scrollTop = 0;
            // Force a reflow to ensure content is properly positioned
            modalContentRef.current.offsetHeight;
        }
    }, [editingVideo]);

    const handleCancelEdit = () => {
        setEditingVideo(null);
        setEditVideoForm({ title: '', thumbnail: '', video_url: '' });
        setThumbnailPreview(null);
    };

    const uploadThumbnailToSupabase = async (file) => {
        try {
            setUploadingThumbnail(true);
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/thumbnails/${Date.now()}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading thumbnail:', error);
                alert('Failed to upload thumbnail. Please try again.');
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Error in uploadThumbnailToSupabase:', error);
            alert('Failed to upload thumbnail. Please try again.');
            return null;
        } finally {
            setUploadingThumbnail(false);
        }
    };

    const uploadVideoToSupabase = async (file) => {
        try {
            setUploadingVideoFile(true);
            
            if (!user || !user.id) {
                alert('User not found. Please sign in again.');
                return null;
            }
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/videos/${Date.now()}.${fileExt}`;
            
            console.log('Attempting to upload video:', fileName);
            console.log('User ID:', user.id);
            
            const { data, error } = await supabase.storage
                .from('videos2')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading video:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                
                if (error.message && error.message.includes('row-level security')) {
                    alert('Upload failed: Permission denied. The storage policies may not allow uploads for your account. Please use the Video URL field instead, or ensure you are authenticated through Supabase Auth.');
                } else if (error.message && error.message.includes('new row violates')) {
                    alert('Upload failed: Storage policy error. Please check your Supabase storage policies or use the Video URL field instead.');
                } else {
                    alert(`Failed to upload video: ${error.message || 'Unknown error. Please try using the Video URL field instead.'}`);
                }
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('videos2')
                .getPublicUrl(fileName);

            console.log('Video uploaded successfully:', publicUrl);
            return publicUrl;
        } catch (error) {
            console.error('Error in uploadVideoToSupabase:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to upload video: ${error.message || 'Please try again or use the Video URL field instead.'}`);
            return null;
        } finally {
            setUploadingVideoFile(false);
        }
    };

    const handleThumbnailChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setThumbnailPreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // Upload to Supabase
        const thumbnailUrl = await uploadThumbnailToSupabase(file);
        if (thumbnailUrl) {
            setEditVideoForm(prev => ({ ...prev, thumbnail: thumbnailUrl }));
        }
    };

    const handleVideoFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file.');
            return;
        }

        // Upload to Supabase
        const videoUrl = await uploadVideoToSupabase(file);
        if (videoUrl) {
            setEditVideoForm(prev => ({ ...prev, video_url: videoUrl }));
        }
    };

    const handleSaveVideo = async () => {
        if (!editingVideo) return;

        try {
            const updates = {};
            if (editVideoForm.title.trim()) {
                updates.title = editVideoForm.title.trim();
            }
            if (editVideoForm.thumbnail) {
                updates.thumbnail = editVideoForm.thumbnail;
            }
            if (editVideoForm.video_url) {
                updates.video_url = editVideoForm.video_url;
            }

            if (Object.keys(updates).length === 0) {
                alert('No changes to save.');
                return;
            }

            const result = await AdminService.updateVideo(editingVideo.id, updates);
            
            if (result.success) {
                // Update the video in the local state
                setVideos(prevVideos => 
                    prevVideos.map(video => 
                        video.id === editingVideo.id 
                            ? { ...video, ...updates }
                            : video
                    )
                );
                alert('Video updated successfully!');
                handleCancelEdit();
            } else {
                alert(`Failed to update video: ${result.error}`);
            }
        } catch (error) {
            console.error('Error updating video:', error);
            alert('Failed to update video. Please try again.');
        }
    };

    // Check if current user is master admin (so we only show Reset Sales to them)
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user?.email) return;
            try {
                const status = await AdminService.checkAdminStatus();
                if (mounted) setIsMasterAdmin(status?.isMasterAdmin || false);
            } catch (_) {
                if (mounted) setIsMasterAdmin(false);
            }
        })();
        return () => { mounted = false; };
    }, [user?.email]);

    // Fetch analytics data (owner: all sales; umbrella collaborator: their page only)
    const fetchAnalytics = async () => {
        if (!user || !user.id) {
            console.warn('Cannot fetch analytics: user not found');
            return;
        }

        setAnalyticsLoading(true);
        try {
            let data;
            if (umbrellaOnly) {
                const { ok, data: payload } = await favoriteListsJson('/api/favorite-lists/my-analytics');
                if (!ok) {
                    throw new Error(payload?.error || 'Could not load page analytics');
                }
                data = payload;
            } else {
                const BACKEND_URL =
                    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
                    'https://screenmerch.fly.dev';

                const response = await fetch(`${BACKEND_URL}/api/analytics?user_id=${user.id}`, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        'Cache-Control': 'no-cache',
                    },
                });

                if (!response.ok) {
                    throw new Error(`Analytics API error: ${response.status}`);
                }

                data = await response.json();
            }

            console.log('📊 Analytics data received:', data);

            setAnalyticsData({
                total_sales: data.total_sales || 0,
                total_revenue: data.total_revenue || 0,
                avg_order_value: data.avg_order_value || 0,
                products_sold_count: data.products_sold_count || 0,
                videos_with_sales_count: data.videos_with_sales_count || 0,
                sales_data: data.sales_data || [],
                products_sold: data.products_sold || [],
                videos_with_sales: data.videos_with_sales || [],
                recent_sales: data.recent_sales || [],
                daily_sales: data.daily_sales || [],
                page_name: data.page_name || '',
                storefront_owner_name: data.storefront_owner_name || '',
                collaborator_net_owed: data.collaborator_net_owed || 0,
                paid_total: data.paid_total || 0,
                last_payout: data.last_payout || null,
                payout_note: data.payout_note || '',
                payout_summary: data.payout_summary || {},
                platform_fee_amount: data.platform_fee_amount ?? data.payout_summary?.platform_fee_amount ?? 0,
                pay_collaborator_amount: data.pay_collaborator_amount ?? data.payout_summary?.collaborator_pay_total ?? 0,
            });

            if (!umbrellaOnly) {
                try {
                    const { ok: sumOk, data: sumData } = await favoriteListsJson('/api/favorite-lists/sales-summary');
                    if (sumOk) {
                        const collabRows = (sumData?.by_list || []).filter((r) => r.is_collaborator_page);
                        setCollaboratorPayoutRows(collabRows);
                        setCollaboratorOwedTotal(Number(sumData?.collaborator_owed_total || 0));
                    }
                } catch (_) {
                    /* non-fatal */
                }
            } else {
                setCollaboratorPayoutRows([]);
                setCollaboratorOwedTotal(0);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const openAnalyticsPayoutModal = (row) => {
        const balance = Number(row.balance_owed ?? 0);
        setAnalyticsPayoutModal(row);
        setAnalyticsPayoutAmount(balance > 0 ? balance.toFixed(2) : '');
        setAnalyticsPayoutDate(todayPayoutInputDate());
        setAnalyticsPayoutNote('');
    };

    const closeAnalyticsPayoutModal = () => {
        if (recordingAnalyticsPayout) return;
        setAnalyticsPayoutModal(null);
    };

    const submitAnalyticsPayout = async (e) => {
        e.preventDefault();
        if (!analyticsPayoutModal?.favorite_list_id) return;
        const amount = Number(analyticsPayoutAmount);
        if (!amount || amount <= 0) return;
        if (amount < 50) {
            alert('Minimum collaborator payout is $50.');
            return;
        }
        setRecordingAnalyticsPayout(true);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/record-collaborator-payout', {
                method: 'POST',
                body: JSON.stringify({
                    favorite_list_id: analyticsPayoutModal.favorite_list_id,
                    amount,
                    paid_at: analyticsPayoutDate,
                    note: analyticsPayoutNote.trim() || undefined,
                }),
            });
            if (!ok) {
                alert(data?.error || 'Could not record payment');
                return;
            }
            setAnalyticsPayoutModal(null);
            await fetchAnalytics();
        } catch (err) {
            alert(err.message || 'Network error');
        } finally {
            setRecordingAnalyticsPayout(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'analytics' && umbrellaOnly && user?.id) {
            fetchAnalytics();
        }
    }, [activeTab, umbrellaOnly, user?.id]);



    // Check if user has proper role or needs to be created/updated
    if (currentUser && (!currentUser.role || currentUser.role !== 'creator')) {
        console.log('User role issue:', currentUser.role, 'User:', currentUser);
        return <div className="dashboard-error">
            Access denied. Only creators can view this page.
            <br />
            <button onClick={async () => {
                try {
                    console.log('Fixing role for user:', currentUser.id);
                    
                    // First check if user exists in users table
                    const { data: existingUser, error: checkError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', currentUser.id)
                        .single();
                    
                    if (checkError && checkError.code === 'PGRST116') {
                        // User doesn't exist, create them
                        console.log('User not found, creating new user record');
                        const { data: newUser, error: createError } = await supabase
                            .from('users')
                            .upsert({
                                id: currentUser.id,
                                email: currentUser.email,
                                username: currentUser.email?.split('@')[0] || 'user',
                                display_name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
                                role: 'creator',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            })
                            .select();
                        
                        if (createError) {
                            console.error('Error creating user:', createError);
                            // If it's a duplicate key error, try to update instead
                            if (createError.message.includes('duplicate key')) {
                                console.log('Duplicate key detected, updating existing user');
                                const { data: updatedUser, error: updateError } = await supabase
                                    .from('users')
                                    .update({
                                        role: 'creator',
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', currentUser.id)
                                    .select();
                                
                                if (updateError) {
                                    console.error('Error updating user:', updateError);
                                    alert('Failed to update user: ' + updateError.message);
                                } else {
                                    console.log('User updated successfully:', updatedUser);
                                    alert('User updated! Reloading page...');
                                    window.location.reload();
                                }
                            } else {
                                alert('Failed to create user: ' + createError.message);
                            }
                        } else {
                            console.log('User created successfully:', newUser);
                            alert('User created! Reloading page...');
                            window.location.reload();
                        }
                    } else if (existingUser) {
                        // User exists, update their role
                        const { data, error } = await supabase
                            .from('users')
                            .update({ role: 'creator' })
                            .eq('id', currentUser.id)
                            .select();
                        
                        if (error) {
                            console.error('Error updating role:', error);
                            alert('Failed to update role: ' + error.message);
                        } else {
                            console.log('Role updated successfully:', data);
                            alert('Role updated! Reloading page...');
                            window.location.reload();
                        }
                    } else {
                        console.error('Unexpected error checking user:', checkError);
                        alert('Error checking user: ' + checkError.message);
                    }
                } catch (err) {
                    console.error('Error in role fix:', err);
                    alert('Error fixing role: ' + err.message);
                }
            }} style={{marginTop: '10px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
                Fix Role & Reload
            </button>
        </div>;
    }

    if (loading) {
        return <div className="dashboard-loading">Loading your dashboard...</div>;
    }

    if (!user) {
        return <div className="dashboard-error">Please log in to see your dashboard.</div>;
    }

    return (
        <div className={`dashboard-container ${sidebar ? "" : " large-container"}`}>
            {/* Tab Navigation */}
            <div className="dashboard-tabs">
                <button 
                    className={`tab-button ${activeTab === 'videos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('videos')}
                >
                    📹 Videos ({videos.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('favorites');
                    }}
                >
                    ⭐ Favorites ({favorites.length})
                </button>
                {umbrellaOnly ? (
                <button
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('analytics');
                        fetchAnalytics();
                    }}
                >
                    📊 Analytics
                </button>
                ) : null}
                {!umbrellaOnly && (
                <>
                <button 
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('analytics');
                        fetchAnalytics();
                    }}
                >
                    📊 Analytics
                </button>
                <button 
                    className={`tab-button ${activeTab === 'payout' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payout')}
                >
                    💰 Payout Setup
                </button>
                <button 
                    className={`tab-button ${activeTab === 'personalization' ? 'active' : ''}`}
                    onClick={() => setActiveTab('personalization')}
                >
                    🎨 Personalization
                </button>
                {userProfile?.role === 'creator' && (
                    <button
                        className={`tab-button ${activeTab === 'umbrella' ? 'active' : ''}`}
                        onClick={() => setActiveTab('umbrella')}
                    >
                        ☂️ Umbrella
                    </button>
                )}
                </>
                )}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Videos Tab */}
                {activeTab === 'videos' && (
                    <div className="videos-tab">
                        {/* Getting Started Tips - Moved to top */}
                        <div className="getting-started-section">
                            <h2>Getting Started</h2>
                            <div className="tips-grid">
                                {!umbrellaOnly && (
                                <div className="tip-card clickable" onClick={() => setActiveTab('personalization')}>
                                    <h4>🎨 Customize Your Channel</h4>
                                    <p>Add a cover image, profile picture, and bio in Personalization.</p>
                                    <div className="card-action">Open Personalization →</div>
                                </div>
                                )}
                                <div className="tip-card clickable" onClick={() => navigate('/upload')}>
                                    <h4>📹 Upload Content</h4>
                                    <p>Start sharing your videos and build your audience.</p>
                                    <div className="card-action">Click to upload →</div>
                                </div>
                                <div className="tip-card">
                                    <h4>📊 Check Your Analytics</h4>
                                    <p>Monitor your sales and track your performance.</p>
                                </div>
                            </div>
                        </div>

                        {/* User's Videos Section */}
                        <div className="user-videos-section">
                            <div className="section-header">
                                <h2>Your Videos ({videos.length})</h2>
                                <button
                                    type="button"
                                    className="add-favorite-btn"
                                    onClick={() => navigate('/upload')}
                                >
                                    Upload video
                                </button>
                            </div>
                            
                            {videos.length > 0 ? (
                                <div className="dashboard-video-grid">
                                    {videos.map(video => (
                                        <div 
                                            key={video.id} 
                                            className="dashboard-video-card"
                                            onClick={() => {
                                                // For creators, navigate to screenshot selection page (product page in creator mode)
                                                // Save video data to localStorage for ProductPage to use
                                                // Note: videos2 table doesn't have screenshots field, so we'll use empty array
                                                // Screenshots can be generated from video or added later
                                                const merchData = {
                                                    thumbnail: video.thumbnail || '',
                                                    screenshots: video.screenshots || [], // Empty if not available
                                                    videoUrl: video.video_url || '',
                                                    videoTitle: video.title || 'Unknown Video',
                                                    creatorName: userProfile?.display_name || userProfile?.username || 'Unknown Creator',
                                                    videoId: video.id
                                                };
                                                localStorage.setItem('pending_merch_data', JSON.stringify(merchData));
                                                localStorage.setItem('creator_favorites_mode', 'true');
                                                // Navigate to product page in creator favorites mode
                                                navigate('/product/browse?category=mens&creatorMode=favorites');
                                            }}
                                        >
                                            <img src={video.thumbnail} alt={video.title} className="dashboard-video-thumbnail" />
                                            <div className="dashboard-video-info">
                                                <h4>{video.title}</h4>
                                                <p>{new Date(video.created_at).toLocaleDateString()}</p>
                                                <span className="video-views">0 views</span>
                                            </div>
                                            <button className="edit-video-btn" onClick={(e) => handleEditVideo(video, e)} title="Edit Video">
                                                ✏️
                                            </button>
                                            <button className="delete-video-btn" onClick={(e) => handleDeleteVideo(video.id, video.title, e)} title="Delete Video">
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    className="no-videos-placeholder no-videos-placeholder--clickable"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate('/upload')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigate('/upload');
                                        }
                                    }}
                                >
                                    <div className="placeholder-content">
                                        <h3>No videos yet</h3>
                                        <p>Start building your content library by uploading your first video!</p>
                                        <button
                                            type="button"
                                            className="add-favorite-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/upload');
                                            }}
                                        >
                                            + Add your first video
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Favorites Tab */}
                {activeTab === 'favorites' && (
                    <div className="favorites-tab">
                        <div className="favorites-tab-controls">
                        {userProfile?.role === 'creator' && umbrellaOnly && favoritePages.length > 0 && (
                            <div className="umbrella-fav-page-bar">
                                <div className="umbrella-fav-page-intro">
                                    <p>
                                        Your favorites on <strong>{umbrellaOwnerName || 'this storefront'}</strong>.
                                        Choose a <strong>nickname</strong> for your page — customers see this in the
                                        Favorites menu, not your email.
                                    </p>
                                </div>
                                <div className="umbrella-fav-page-row">
                                    <input
                                        id="umbrella-page-name"
                                        type="text"
                                        className="favorite-pages-input umbrella-page-name-input"
                                        placeholder="Page Name"
                                        value={umbrellaPageName}
                                        onChange={(e) => setUmbrellaPageName(e.target.value)}
                                        aria-label="Page Name"
                                    />
                                    <button
                                        type="button"
                                        className="save-btn"
                                        disabled={savingFavoritePage || !umbrellaPageName.trim()}
                                        onClick={handleSaveUmbrellaPageName}
                                    >
                                        {savingFavoritePage ? 'Saving…' : 'Save name'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {userProfile?.role === 'creator' && !umbrellaOnly && favoritePages.length > 0 && (
                            <div className="favorite-pages-toolbar">
                                <div className="favorite-pages-choose-row">
                                    <label className="favorite-pages-label" htmlFor="dashboard-fav-list-select">Choose Favorites Page</label>
                                    <select
                                        id="dashboard-fav-list-select"
                                        className="favorite-pages-select"
                                        value={selectedFavoriteListId || ''}
                                        onChange={(e) => handleFavoriteListChange(e.target.value)}
                                    >
                                        {favoritePages.some((p) => !p.is_collaborator_page) && (
                                            <optgroup label="Your pages">
                                                {favoritePages.filter((p) => !p.is_collaborator_page).map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {favoritePageSelectLabel(p)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {favoritePages.some((p) => p.is_collaborator_page) && (
                                            <optgroup label="Umbrella collaborators">
                                                {favoritePages.filter((p) => p.is_collaborator_page).map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {favoritePageSelectLabel(p)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                    {favoritePages.find((l) => l.id === selectedFavoriteListId)?.is_primary === false
                                        && !favoritePages.find((l) => l.id === selectedFavoriteListId)?.is_collaborator_page && (
                                        <button
                                            type="button"
                                            className="cancel-btn favorite-page-delete"
                                            disabled={savingFavoritePage}
                                            onClick={handleDeleteFavoritePage}
                                        >
                                            Delete page
                                        </button>
                                    )}
                                </div>
                                <div className="favorite-pages-new">
                                    <input
                                        type="text"
                                        placeholder="New page name"
                                        value={newPageName}
                                        onChange={(e) => setNewPageName(e.target.value)}
                                        className="favorite-pages-input favorite-pages-input--name"
                                    />
                                    <button
                                        type="button"
                                        className="save-btn"
                                        disabled={savingFavoritePage || !newPageName.trim()}
                                        onClick={handleCreateFavoritePage}
                                    >
                                        {savingFavoritePage ? '…' : 'Create page'}
                                    </button>
                                </div>
                            </div>
                        )}
                            <button
                                type="button"
                                className="add-favorite-btn favorites-upload-btn"
                                onClick={() => {
                                    if (umbrellaOnly) {
                                        navigate('/upload');
                                        return;
                                    }
                                    setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                                    setShowFavoriteModal(true);
                                }}
                            >
                                {umbrellaOnly ? 'Upload video' : 'Upload'}
                            </button>
                        </div>
                        {!umbrellaOnly && (
                        <p className="paste-hint">
                            Paste from FrameSnag (Ctrl+V) to add a captured image. Uploads go to the page selected above
                            {favoritePages.some((p) => p.is_collaborator_page) ? ' — including umbrella collaborator pages.' : '.'}
                        </p>
                        )}

                        {/* Prominent hint when sent from FrameSnag */}
                        {!umbrellaOnly && showPasteHint && (
                            <div className="framesnag-paste-banner">
                                <span>📋 You were sent here from FrameSnag. <strong>Press Ctrl+V</strong> (or Cmd+V on Mac) to add your screenshot to favorites.</span>
                                <button type="button" className="framesnag-paste-banner-dismiss" onClick={() => setShowPasteHint(false)} aria-label="Dismiss">×</button>
                            </div>
                        )}

                        {/* FrameSnag — storefront owners only */}
                        {!umbrellaOnly && (
                        <div className="framesnag-promo-section">
                            <div className="framesnag-promo-content">
                                <div className="framesnag-promo-text">
                                    <h3>📸 Capture YouTube Screenshots with FrameSnag</h3>
                                    <p>Capture high-quality thumbnails and screenshots from your YouTube videos, then add them to your favorites!</p>
                                    <div className="framesnag-instructions">
                                        <p><strong>How to install:</strong></p>
                                        <ol>
                                            <li>Click &quot;Install FrameSnag&quot; below to download the extension ZIP</li>
                                            <li>Unzip the file, then open Chrome → Extensions → Developer mode → Load unpacked</li>
                                            <li>Select the unzipped FrameSnag folder</li>
                                            <li>Open any YouTube video and click the FrameSnag icon to capture and add to favorites</li>
                                        </ol>
                                    </div>
                                    <div className="framesnag-promo-code">
                                        <span className="promo-label">Your Free Pro Access Code:</span>
                                        <code className="promo-code">SCREENMERCH</code>
                                    </div>
                                </div>
                                <a 
                                    href="https://framesnag.com/download/FrameSnag-extension.zip"
                                    download="FrameSnag-extension.zip"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="framesnag-btn"
                                >
                                    Install FrameSnag →
                                </a>
                            </div>
                        </div>
                        )}

                                                {favorites.length > 0 ? (
                            <div className="dashboard-video-grid">
                                {favorites.map(favorite => (
                                    <div 
                                        key={favorite.id} 
                                        className="dashboard-video-card"
                                    >
                                        <img 
                                            src={favorite.image_url || favorite.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Image'} 
                                            alt={favorite.title} 
                                            className="dashboard-video-thumbnail" 
                                        />
                                        <div className="dashboard-video-info">
                                            <h4>{favorite.title}</h4>
                                            {favorite.description && <p>{favorite.description}</p>}
                                            <span className="video-views">{new Date(favorite.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {userProfile?.role === 'creator' && !umbrellaOnly && favoritePages.length > 1 && (
                                            <div className="favorite-card-page-row">
                                                <label htmlFor={`fav-list-${favorite.id}`}>Page</label>
                                                <select
                                                    id={`fav-list-${favorite.id}`}
                                                    className="favorite-card-list-select"
                                                    value={String(favorite.list_id || selectedFavoriteListId || favoritePages[0]?.id || '')}
                                                    disabled={movingFavoriteId === favorite.id || savingFavoritePage}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        handleMoveFavoriteToList(favorite, v);
                                                    }}
                                                >
                                                    {favoritePages.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {favoritePageSelectLabel(p)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <button 
                                            className="make-merch-btn-favorite-dashboard"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMakeMerchFromFavorite(favorite);
                                            }}
                                        >
                                            Make Merch
                                        </button>
                                        <button 
                                            className="delete-video-btn" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFavorite(favorite.id, favorite.title);
                                            }} 
                                            title="Delete Favorite"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-videos-placeholder">
                                <div className="placeholder-content">
                                    <h3>No favorites yet</h3>
                                    <p>Upload your favorite images for users to create merchandise from!</p>
                                    <button 
                                        className="add-favorite-btn"
                                        onClick={() => {
                                            setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                                            setShowFavoriteModal(true);
                                        }}
                                    >
                                        + Add Your First Favorite
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Favorite Upload Modal */}
                        {showFavoriteModal && (
                            <div className="favorite-modal-overlay" onClick={() => setShowFavoriteModal(false)}>
                                <div className="favorite-modal-content" onClick={(e) => e.stopPropagation()} ref={modalContentRef}>
                                    <span className="favorite-modal-close" onClick={() => setShowFavoriteModal(false)}>&times;</span>
                                    <h2>Upload Favorite Image</h2>
                                <div className="upload-form">
                                    <div className="form-group">
                                        <label>Title *</label>
                                        <input
                                            type="text"
                                            value={newFavorite.title}
                                            onChange={(e) => setNewFavorite({...newFavorite, title: e.target.value})}
                                            placeholder="Enter favorite title"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            value={newFavorite.description}
                                            onChange={(e) => setNewFavorite({...newFavorite, description: e.target.value})}
                                            placeholder="Enter description (optional)"
                                            rows="3"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Image *</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        setNewFavorite({
                                                            ...newFavorite,
                                                            image: file,
                                                            imagePreview: event.target.result
                                                        });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                        {newFavorite.imagePreview && (
                                            <img 
                                                src={newFavorite.imagePreview} 
                                                alt="Preview" 
                                                className="favorite-upload-preview"
                                            />
                                        )}
                                    </div>
                                    <div className="form-actions">
                                        <button 
                                            className="save-btn" 
                                            onClick={handleUploadFavorite}
                                            disabled={uploadingFavorite || !newFavorite.title || !newFavorite.image}
                                        >
                                            {uploadingFavorite ? 'Uploading...' : 'Upload Favorite'}
                                        </button>
                                        <button 
                                            className="cancel-btn" 
                                            onClick={() => {
                                                setShowFavoriteModal(false);
                                                setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                    <>
                    <div className="analytics-tab">
                        {/* Sales Analytics Section */}
                        <div className="sales-analytics-section">
                            <div className="section-header">
                                <h2>
                                    📊 Sales Analytics
                                    {umbrellaOnly && analyticsData.page_name ? ` — ${analyticsData.page_name}` : ''}
                                </h2>
                                {umbrellaOnly ? (
                                    <p className="umbrella-analytics-intro">
                                        Sales from shoppers who checked out while viewing your{' '}
                                        <strong>{analyticsData.page_name || 'favorites page'}</strong>
                                        {analyticsData.storefront_owner_name ? (
                                            <> on <strong>{analyticsData.storefront_owner_name}</strong></>
                                        ) : null}
                                        .
                                    </p>
                                ) : null}
                                <div className="analytics-summary">
                                    <span className="total-sales">Total Sales: {analyticsLoading ? 'Loading...' : analyticsData.total_sales}</span>
                                    <span className="total-revenue">Total Revenue: ${analyticsLoading ? '0.00' : analyticsData.total_revenue.toFixed(2)}</span>
                                    {isMasterAdmin && !umbrellaOnly && (
                                    <button 
                                        onClick={async () => {
                                            if (!window.confirm('⚠️ WARNING: This will permanently delete all your sales data. This action cannot be undone. Are you absolutely sure?')) {
                                                return;
                                            }
                                            
                                            if (!window.confirm('This is your final warning. All sales records will be deleted. Continue?')) {
                                                return;
                                            }
                                            
                                            try {
                                                const BACKEND_URL = 
                                                    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
                                                    "https://screenmerch.fly.dev";
                                                
                                                const userEmail = user?.email || userProfile?.email;
                                                
                                                const response = await fetch(`${BACKEND_URL}/api/admin/reset-sales`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'X-User-Email': userEmail
                                                    },
                                                    body: JSON.stringify({
                                                        user_id: user.id
                                                    })
                                                });
                                                
                                                const data = await response.json();
                                                
                                                if (data.success) {
                                                    alert(`✅ Sales reset successfully! Deleted ${data.deleted_count || 0} sales records.`);
                                                    // Refresh analytics
                                                    fetchAnalytics();
                                                } else {
                                                    alert(`❌ Failed to reset sales: ${data.error || 'Unknown error'}`);
                                                }
                                            } catch (error) {
                                                console.error('Error resetting sales:', error);
                                                alert(`❌ Error resetting sales: ${error.message}`);
                                            }
                                        }}
                                        style={{
                                            marginLeft: '20px',
                                            padding: '8px 16px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                        title="Reset all sales data (Master Admin only)"
                                    >
                                        🔄 Reset Sales
                                    </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="analytics-dashboard">
                                {/* Sales Per Day Overview */}
                                <div className="analytics-overview-cards">
                                    <div className="analytics-card">
                                        <h4>📈 Sales Per Day</h4>
                                        <div className="analytics-amount">{analyticsLoading ? '...' : analyticsData.total_sales}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.total_sales > 0 ? 'Active sales' : 'No data yet'}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>🛍️ Products Sold</h4>
                                        <div className="analytics-amount">{analyticsLoading ? '...' : analyticsData.products_sold_count}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.products_sold_count > 0 ? 'Products selling' : 'No data yet'}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>{umbrellaOnly ? '📄 Your page' : '🎬 Videos with Sales'}</h4>
                                        <div className="analytics-amount">
                                            {analyticsLoading ? '...' : (umbrellaOnly ? (analyticsData.page_name || '—') : analyticsData.videos_with_sales_count)}
                                        </div>
                                        <div className="analytics-change">
                                            {analyticsLoading ? 'Loading...' : umbrellaOnly ? 'Attributed to your favorites page' : (analyticsData.videos_with_sales_count > 0 ? 'Videos performing' : 'No data yet')}
                                        </div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>💰 Avg Order Value</h4>
                                        <div className="analytics-amount">${analyticsLoading ? '0.00' : analyticsData.avg_order_value.toFixed(2)}</div>
                                        <div className="analytics-change">{analyticsLoading ? 'Loading...' : analyticsData.avg_order_value > 0 ? 'Good average' : 'No data yet'}</div>
                                    </div>
                                </div>
                                
                                {/* Enhanced Sales Chart */}
                                <div className="sales-chart-section">
                                                                         <div className="chart-header">
                                         <h3>📊 Sales Analytics Dashboard</h3>
                                         <div className="service-fee-info">
                                             <span className="fee-badge">$6/item platform share</span>
                                             <span className="fee-explanation">Markup split — not 30% of gross</span>
                                         </div>
                                     </div>
                                    
                                    {/* Daily Sales Chart */}
                                    <div className="chart-section">
                                        <h4>📅 Daily Sales (Last 7 Days)</h4>
                                        <div className="daily-chart-container">
                                            <div className="daily-chart-bars">
                                                {analyticsData.daily_sales && analyticsData.daily_sales.length > 0 ? (() => {
                                                    const dailySales = analyticsData.daily_sales;
                                                    const maxSales = Math.max(...dailySales.map(d => d.sales_count || 0), 1);
                                                    const maxBarHeightPx = 160;
                                                    return dailySales.map((dayData, i) => {
                                                        const isToday = i === dailySales.length - 1;
                                                        const salesCount = dayData.sales_count || 0;
                                                        const netRevenue = dayData.net_revenue || 0;
                                                        const revenue = dayData.revenue || 0;
                                                        const barHeightPx = salesCount > 0 ? Math.max((salesCount / maxSales) * maxBarHeightPx, 20) : 0;
                                                        return (
                                                            <div key={i} className="daily-bar-container">
                                                                <div 
                                                                    className={`daily-bar ${salesCount > 0 ? 'has-sales' : 'no-sales'} ${isToday ? 'today' : ''}`}
                                                                    style={{ height: `${barHeightPx}px` }}
                                                                    title={`${dayData.date_display}: ${salesCount} sales | Gross: $${revenue.toFixed(2)} | Your payout: $${netRevenue.toFixed(2)}`}
                                                                >
                                                                    <span className="daily-bar-value">{salesCount}</span>
                                                                </div>
                                                                <div className="daily-bar-label">{dayData.date_display}</div>
                                                                {salesCount > 0 && (
                                                                    <div className="daily-bar-revenue">${Number(revenue).toFixed(2)}</div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })() : (
                                                    // Fallback if daily_sales is not available yet
                                                    Array.from({length: 7}, (_, i) => {
                                                        const date = new Date();
                                                        date.setDate(date.getDate() - (6 - i));
                                                        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                                        const isToday = i === 6;
                                                        const salesCount = 0;
                                                        
                                                        return (
                                                            <div key={i} className="daily-bar-container">
                                                                <div 
                                                                    className={`daily-bar no-sales ${isToday ? 'today' : ''}`}
                                                                    style={{height: '0px'}}
                                                                    title={`${dateStr}: 0 sales`}
                                                                >
                                                                    <span className="daily-bar-value">0</span>
                                                                </div>
                                                                <div className="daily-bar-label">{dateStr}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Weekly Summary */}
                                    <div className="weekly-summary">
                                        <h4>📊 Weekly Summary</h4>
                                        {(() => {
                                            const ps = analyticsData.payout_summary || {};
                                            const gross = Number(ps.gross_amount ?? analyticsData.total_revenue ?? 0);
                                            // Umbrella: platform + collaborator come from the same payout_summary ($6/$6)
                                            const collabPay = umbrellaOnly
                                                ? Number(
                                                    ps.collaborator_pay_total
                                                    ?? analyticsData.pay_collaborator_amount
                                                    ?? 0
                                                )
                                                : Number(ps.collaborator_pay_total ?? 0);
                                            const platformFee = umbrellaOnly
                                                ? Number(
                                                    ps.platform_fee_amount
                                                    ?? analyticsData.platform_fee_amount
                                                    ?? collabPay
                                                )
                                                : Number(ps.platform_fee_amount ?? 0);
                                            const ownerPayout = Number(ps.owner_net_payout ?? 0);
                                            const collabPayTotal = collabPay;
                                            const merchCost = Number(ps.merch_cost_amount ?? 0);
                                            const netLabel = umbrellaOnly ? 'Your payout' : 'Your payout';
                                            const netValue = umbrellaOnly
                                                ? (collabPay || (Number(analyticsData.collaborator_net_owed ?? 0) + Number(analyticsData.paid_total ?? 0)))
                                                : ownerPayout;
                                            const netSubtitle = umbrellaOnly
                                                ? 'Earned on your favorites page ($6/item)'
                                                : 'From your page sales ($6/item)';
                                            return (
                                        <div className="summary-grid">
                                            <div className="summary-card">
                                                <div className="summary-label">This Week</div>
                                                <div className="summary-value">{analyticsData.total_sales}</div>
                                                <div className="summary-subtitle">Total Sales</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-label">Gross Revenue</div>
                                                <div className="summary-value">${gross.toFixed(2)}</div>
                                                <div className="summary-subtitle">Before fees</div>
                                            </div>
                                            <div className="summary-card highlight">
                                                <div className="summary-label">{netLabel}</div>
                                                <div className="summary-value">${netValue.toFixed(2)}</div>
                                                <div className="summary-subtitle">{netSubtitle}</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-label">Platform fee</div>
                                                <div className="summary-value">${platformFee.toFixed(2)}</div>
                                                <div className="summary-subtitle">ScreenMerch ($6/item)</div>
                                            </div>
                                            {!umbrellaOnly && collabPayTotal > 0 ? (
                                                <div className="summary-card">
                                                    <div className="summary-label">Collaborator pay</div>
                                                    <div className="summary-value">${collabPayTotal.toFixed(2)}</div>
                                                    <div className="summary-subtitle">Umbrella pages ($6/item)</div>
                                                </div>
                                            ) : null}
                                            {!umbrellaOnly && merchCost > 0 ? (
                                                <div className="summary-card">
                                                    <div className="summary-label">Merch cost</div>
                                                    <div className="summary-value">${merchCost.toFixed(2)}</div>
                                                    <div className="summary-subtitle">Fulfillment overhead</div>
                                                </div>
                                            ) : null}
                                            {!umbrellaOnly && collaboratorPayoutRows.length > 0 ? (
                                                <div className="summary-card highlight-collab">
                                                    <div className="summary-label">Owed to collaborators</div>
                                                    <div className="summary-value">${collaboratorOwedTotal.toFixed(2)}</div>
                                                    <div className="summary-subtitle">Pay off-platform</div>
                                                </div>
                                            ) : null}
                                            {umbrellaOnly && analyticsData.collaborator_net_owed > 0 ? (
                                                <div className="summary-card highlight-collab">
                                                    <div className="summary-label">Unpaid balance</div>
                                                    <div className="summary-value">${Number(analyticsData.collaborator_net_owed).toFixed(2)}</div>
                                                    <div className="summary-subtitle">From {analyticsData.storefront_owner_name || 'store owner'}</div>
                                                </div>
                                            ) : null}
                                        </div>
                                            );
                                        })()}
                                        {!umbrellaOnly && collaboratorPayoutRows.length > 0 ? (
                                            <div className="collaborator-payout-panel">
                                                <h5>Collaborator payouts</h5>
                                                <p className="hint">
                                                    Record off-platform payments to umbrella collaborators when their owed balance exceeds $50.
                                                </p>
                                                <ul className="collaborator-payout-list">
                                                    {collaboratorPayoutRows.map((row) => {
                                                        const balance = Number(row.balance_owed ?? 0);
                                                        const payCollab = Number(row.pay_collaborator_amount ?? 0);
                                                        const isPaidUp = row.is_paid_up ?? (payCollab > 0 && balance <= 0);
                                                        const canRecord = row.can_record_payout ?? (payCollab > 0 && balance >= 50);
                                                        return (
                                                            <li key={String(row.favorite_list_id)}>
                                                                <div className="collab-payout-row-main">
                                                                    <strong>{row.display_name}</strong>
                                                                    <span>
                                                                        Pay collaborator ${payCollab.toFixed(2)}
                                                                        {' · '}
                                                                        {payCollab <= 0 ? (
                                                                            <>Owed $0.00</>
                                                                        ) : isPaidUp ? (
                                                                            <span className="paid-up-label">Paid up ✓</span>
                                                                        ) : balance > 0 ? (
                                                                            <>Owed <strong>${balance.toFixed(2)}</strong></>
                                                                        ) : (
                                                                            <>Owed $0.00</>
                                                                        )}
                                                                    </span>
                                                                    {row.last_payout ? (
                                                                        <small>
                                                                            Last paid ${Number(row.last_payout.amount || 0).toFixed(2)} on {formatPayoutDate(row.last_payout.paid_at)}
                                                                            {row.last_payout.note ? ` · ${row.last_payout.note}` : ''}
                                                                        </small>
                                                                    ) : null}
                                                                </div>
                                                                {canRecord ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-record-collab-payout"
                                                                        onClick={() => openAnalyticsPayoutModal(row)}
                                                                    >
                                                                        Record payment
                                                                    </button>
                                                                ) : null}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        ) : null}
                                        {umbrellaOnly && analyticsData.payout_note ? (
                                            <p className="umbrella-analytics-payout-note">{analyticsData.payout_note}</p>
                                        ) : null}
                                        {umbrellaOnly && analyticsData.last_payout ? (
                                            <p className="umbrella-analytics-last-payout">
                                                Last payment from {analyticsData.storefront_owner_name || 'store owner'}:{' '}
                                                ${Number(analyticsData.last_payout.amount || 0).toFixed(2)} on{' '}
                                                {formatPayoutDate(analyticsData.last_payout.paid_at)}
                                                {analyticsData.last_payout.note ? ` (${analyticsData.last_payout.note})` : ''}
                                            </p>
                                        ) : null}
                                    </div>
                                    
                                    {/* Recent Sales Activity */}
                                    <div className="recent-activity">
                                        <h4>🕒 Recent Sales Activity</h4>
                                        <div className="activity-list">
                                            {analyticsData.recent_sales && analyticsData.recent_sales.length > 0 ? (
                                                analyticsData.recent_sales.slice(0, 5).map((sale, index) => {
                                                    // Format time ago
                                                    let timeAgo = 'Recently';
                                                    try {
                                                        if (sale.created_at && sale.created_at !== 'N/A') {
                                                            const saleDate = new Date(sale.created_at);
                                                            const now = new Date();
                                                            const diffMs = now - saleDate;
                                                            const diffMins = Math.floor(diffMs / 60000);
                                                            const diffHours = Math.floor(diffMs / 3600000);
                                                            const diffDays = Math.floor(diffMs / 86400000);
                                                            
                                                            if (diffMins < 1) {
                                                                timeAgo = 'Just now';
                                                            } else if (diffMins < 60) {
                                                                timeAgo = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
                                                            } else if (diffHours < 24) {
                                                                timeAgo = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
                                                            } else {
                                                                timeAgo = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
                                                            }
                                                        }
                                                    } catch (e) {
                                                        timeAgo = 'Recently';
                                                    }
                                                    
                                                    return (
                                                        <div key={index} className="activity-item">
                                                            <div className="activity-icon">💰</div>
                                                            <div className="activity-details">
                                                                <div className="activity-title">Sale completed</div>
                                                                <div className="activity-subtitle">Product: {sale.product} | Share: ${sale.net_amount?.toFixed(2) || '0.00'}</div>
                                                            </div>
                                                            <div className="activity-time">{timeAgo}</div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="activity-item">
                                                    <div className="activity-icon">📊</div>
                                                    <div className="activity-details">
                                                        <div className="activity-title">No recent sales</div>
                                                        <div className="activity-subtitle">Start making sales to see activity here</div>
                                                    </div>
                                                    <div className="activity-time">—</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Products Sold Chart */}
                                <div className="products-sold-chart">
                                    <h3>🛍️ Products Sold</h3>
                                    
                                    {analyticsData.products_sold && analyticsData.products_sold.length > 0 ? (
                                        <div className="products-chart-container">
                                            {analyticsData.products_sold.map((product, index) => {
                                                const maxQuantity = Math.max(...analyticsData.products_sold.map(p => p.quantity));
                                                const barWidth = maxQuantity > 0 ? (product.quantity / maxQuantity) * 100 : 0;
                                                
                                                return (
                                                    <div key={index} className="product-chart-item">
                                                        <div className="product-chart-header">
                                                            <div className="product-name">{product.product}</div>
                                                            <div className="product-stats">
                                                                <span className="quantity">{product.quantity} sold</span>
                                                                <span className="revenue">${product.revenue.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="product-chart-bar-container">
                                                            <div 
                                                                className="product-chart-bar" 
                                                                style={{width: `${barWidth}%`}}
                                                                title={`${product.quantity} units sold - $${product.revenue.toFixed(2)} revenue`}
                                                            >
                                                                <span className="bar-label">{product.quantity}</span>
                                                            </div>
                                                        </div>
                                                        <div className="product-source">
                                                            <small>From: {umbrellaOnly ? (analyticsData.page_name || 'Your favorites page') : product.video_source}</small>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="products-chart-empty">
                                            <div className="empty-icon">📦</div>
                                            <h4>No products sold yet</h4>
                                            <p>Start creating content to see your sales data here!</p>
                                        </div>
                                    )}
                                </div>
                                

                                

                            </div>
                        </div>
                    </div>

                    {analyticsPayoutModal ? (
                        <div className="umbrella-payout-modal-backdrop" onClick={closeAnalyticsPayoutModal} role="presentation">
                            <div
                                className="umbrella-payout-modal"
                                role="dialog"
                                aria-labelledby="analytics-record-payout-title"
                                onClick={(ev) => ev.stopPropagation()}
                            >
                                <h3 id="analytics-record-payout-title">Record collaborator payment</h3>
                                <p className="hint">
                                    Confirm you paid <strong>{analyticsPayoutModal.display_name || 'collaborator'}</strong> off-platform.
                                </p>
                                <form onSubmit={submitAnalyticsPayout}>
                                    <label>
                                        Amount
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={analyticsPayoutAmount}
                                            onChange={(ev) => setAnalyticsPayoutAmount(ev.target.value)}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Date paid
                                        <input
                                            type="date"
                                            value={analyticsPayoutDate}
                                            onChange={(ev) => setAnalyticsPayoutDate(ev.target.value)}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Note (optional)
                                        <input
                                            type="text"
                                            placeholder="PayPal, Zelle, cash…"
                                            value={analyticsPayoutNote}
                                            onChange={(ev) => setAnalyticsPayoutNote(ev.target.value)}
                                        />
                                    </label>
                                    <div className="umbrella-payout-modal-actions">
                                        <button type="button" onClick={closeAnalyticsPayoutModal} disabled={recordingAnalyticsPayout}>
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={recordingAnalyticsPayout}>
                                            {recordingAnalyticsPayout ? 'Saving…' : 'Confirm payment'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : null}
                    </>
                )}

                {/* Personalization Tab */}
                {activeTab === 'personalization' && (
                    <div className="personalization-tab">
                        <PersonalizationSettings />
                    </div>
                )}

                {activeTab === 'umbrella' && userProfile?.role === 'creator' && (
                    <div className="umbrella-tab">
                        <div className="section-header">
                            <h2>Umbrella network</h2>
                            <p className="payout-main-description">
                                Manage invites and approved collaborators. Pending responses also appear under{' '}
                                <Link to="/channel-invites">Channel invites</Link> for each user.
                            </p>
                        </div>
                        <ChannelUmbrella />
                    </div>
                )}

                {/* Payout Setup Tab */}
                {activeTab === 'payout' && (
                    <div className="payout-tab">
                        <div className="payout-section">
                            <div className="section-header">
                                <p className="payout-main-description">Configure your payment information to receive earnings from your sales</p>
                            </div>

                            {payoutMessage && (
                                <div className={`payout-message ${payoutMessage.includes('error') || payoutMessage.includes('Failed') ? 'error' : 'success'}`}>
                                    {payoutMessage}
                                </div>
                            )}

                            <form 
                                className="payout-form"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setPayoutLoading(true);
                                    setPayoutMessage('');

                                    try {
                                        if (!user || !user.id) {
                                            throw new Error('User not found');
                                        }

                                        const updateData = {
                                            paypal_email: payoutData.paypal_email.trim(),
                                            tax_id: payoutData.tax_id.trim() || null
                                        };

                                        const backendUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'https://screenmerch.fly.dev';
                                        const res = await fetch(`${backendUrl}/api/update-creator-settings`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                                            body: JSON.stringify({ user_id: user.id, ...updateData })
                                        });
                                        const apiData = await res.json().catch(() => ({}));

                                        if (res.ok && apiData.success) {
                                            setPayoutMessage('Payout information saved successfully!');
                                            setUserProfile({ ...userProfile, ...updateData });
                                            setTimeout(() => setPayoutMessage(''), 3000);
                                        } else {
                                            const { error } = await supabase
                                                .from('users')
                                                .update(updateData)
                                                .eq('id', user.id)
                                                .select()
                                                .single();
                                            if (error) throw error;
                                            setPayoutMessage('Payout information saved successfully!');
                                            setUserProfile({ ...userProfile, ...updateData });
                                            setTimeout(() => setPayoutMessage(''), 3000);
                                        }
                                    } catch (error) {
                                        console.error('Error saving payout info:', error);
                                        setPayoutMessage(`Failed to save payout information: ${error.message}`);
                                    } finally {
                                        setPayoutLoading(false);
                                    }
                                }}
                            >
                                <div className="payout-form-group">
                                    <label htmlFor="paypal-email" className="payout-label">
                                        PayPal Email <span className="required">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="paypal-email"
                                        className="payout-input"
                                        placeholder="your.email@example.com"
                                        value={payoutData.paypal_email}
                                        onChange={(e) => setPayoutData({ ...payoutData, paypal_email: e.target.value })}
                                        disabled={payoutLoading}
                                        required
                                    />
                                    <p className="payout-help-text">
                                        This is where we'll send your earnings. Make sure it's a valid PayPal account.
                                    </p>
                                </div>

                                <div className="payout-form-group">
                                    <label htmlFor="tax-id" className="payout-label">
                                        Tax ID / SSN (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        id="tax-id"
                                        className="payout-input"
                                        placeholder="Enter your Tax ID or SSN"
                                        value={payoutData.tax_id}
                                        onChange={(e) => setPayoutData({ ...payoutData, tax_id: e.target.value })}
                                        disabled={payoutLoading}
                                    />
                                    <p className="payout-help-text">
                                        Required for tax reporting in some jurisdictions. Your information is encrypted and secure.
                                    </p>
                                </div>

                                <div className="payout-form-actions">
                                    <button
                                        type="submit"
                                        className="payout-save-btn"
                                        disabled={payoutLoading || !payoutData.paypal_email.trim()}
                                    >
                                        {payoutLoading ? (
                                            <>
                                                <span className="loading-spinner-small"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            '💾 Save Payout Information'
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="payout-info-box">
                                <h3>ℹ️ Important Information</h3>
                                <ul>
                                    <li>Your payout information is encrypted and stored securely</li>
                                    <li>Payments are processed monthly after you reach the minimum payout threshold</li>
                                    <li>You can update your payout information at any time</li>
                                    <li>Make sure your PayPal email is correct to avoid payment delays</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Edit Video Modal */}
            {editingVideo && (
                <div className="edit-video-modal-overlay" onClick={handleCancelEdit}>
                    <div className="edit-video-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-video-modal-header">
                            <h2>Edit Video</h2>
                            <button className="edit-video-modal-close" onClick={handleCancelEdit}>×</button>
                        </div>
                        <div className="edit-video-modal-content" ref={modalContentRef}>
                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-title">Video Name</label>
                                <input
                                    type="text"
                                    id="edit-video-title"
                                    value={editVideoForm.title}
                                    onChange={(e) => setEditVideoForm({ ...editVideoForm, title: e.target.value })}
                                    placeholder="Enter video name"
                                    className="edit-video-input"
                                />
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-thumbnail">Thumbnail</label>
                                <div className="edit-video-thumbnail-preview">
                                    {(thumbnailPreview || editVideoForm.thumbnail) && (
                                        <img 
                                            src={thumbnailPreview || editVideoForm.thumbnail} 
                                            alt="Thumbnail preview" 
                                            className="thumbnail-preview-img"
                                        />
                                    )}
                                </div>
                                <input
                                    type="file"
                                    id="edit-video-thumbnail"
                                    accept="image/*"
                                    onChange={handleThumbnailChange}
                                    disabled={uploadingThumbnail}
                                    className="edit-video-file-input"
                                />
                                <label htmlFor="edit-video-thumbnail" className="edit-video-file-label">
                                    {uploadingThumbnail ? '⏳ Uploading...' : '📷 Choose Thumbnail Image'}
                                </label>
                                <p className="edit-video-tip">Max 5MB, recommended: 1280x720</p>
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-url">Video URL</label>
                                <input
                                    type="text"
                                    id="edit-video-url"
                                    value={editVideoForm.video_url}
                                    onChange={(e) => setEditVideoForm({ ...editVideoForm, video_url: e.target.value })}
                                    placeholder="Enter video URL (YouTube or direct link)"
                                    className="edit-video-input"
                                />
                                <p className="edit-video-tip">Or upload a video file below</p>
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-file">Upload Video File</label>
                                <input
                                    type="file"
                                    id="edit-video-file"
                                    accept="video/*"
                                    onChange={handleVideoFileChange}
                                    disabled={uploadingVideoFile}
                                    className="edit-video-file-input"
                                />
                                <label htmlFor="edit-video-file" className="edit-video-file-label">
                                    {uploadingVideoFile ? '⏳ Uploading...' : '🎬 Choose Video File'}
                                </label>
                                <p className="edit-video-tip">Max file size depends on your plan</p>
                            </div>
                        </div>
                        <div className="edit-video-modal-footer">
                            <button className="edit-video-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                            <button className="edit-video-save-btn" onClick={handleSaveVideo} disabled={uploadingThumbnail || uploadingVideoFile}>
                                {uploadingThumbnail || uploadingVideoFile ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard; 
