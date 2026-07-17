import React, { useState, useEffect } from "react";
import Feed from "../../Components/Feed/Feed";
import CreatorDirectory, { SCREENMERCH_INTRO_TITLE } from "../../Components/Feed/CreatorDirectory";
import { supabase } from '../../supabaseClient';
import './Home.css'
import { useNavigate, Link } from 'react-router-dom';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain, isCreatorStorefrontHostname } from '../../utils/subdomainService';
import { fetchPublicFavoriteLists, fetchPublicFavoritesByList, listPreviewImages, favoriteImageUrl } from '../../utils/favoriteListsApi';
import { isCollaboratorFavoriteList } from '../../utils/favoriteListLabels';
import ColorPickerModal from '../../Components/ColorPickerModal/ColorPickerModal';
import { apiJoin } from '../../config/apiConfig';

const Home = ({sidebar, category, selectedCategory, setSelectedCategory}) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [favoritesPreview, setFavoritesPreview] = useState([]);
  const [friendPagePreview, setFriendPagePreview] = useState([]);
  const navigate = useNavigate();
  const { creatorSettings, currentCreator, refreshCreator, loading: creatorLoading } = useCreator();
  const isMainSite = !isCreatorStorefrontHostname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#storefront-videos') return;
    const t = window.setTimeout(() => {
      document.getElementById('storefront-videos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [loading, videos.length]);

  const introVideo = React.useMemo(() => {
    if (!videos.length) return null;
    const match = videos.find((v) =>
      (v.title || '').trim().toLowerCase() === SCREENMERCH_INTRO_TITLE.toLowerCase()
      || /screenmerch\s*introduction/i.test(v.title || '')
    );
    return match || null;
  }, [videos]);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError('');

      // Creator storefronts: wait until creator context finishes loading
      if (!isMainSite) {
        if (creatorLoading) {
          setVideos([]);
          return;
        }
        if (!currentCreator?.id) {
          setVideos([]);
          setLoading(false);
          return;
        }
      }

      const params = new URLSearchParams();
      if (category && category !== 'All') params.set('category', category);
      if (currentCreator?.id) params.set('user_id', currentCreator.id);
      // Same-origin /api on *.screenmerch.com (Netlify → Fly) so CSP cannot block video loads
      const url = `${apiJoin('/api/videos')}${params.toString() ? `?${params.toString()}` : ''}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          setVideos([]);
          if (isMainSite) setError('Failed to load videos');
        } else {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setVideos(
            list.map((v) => ({
              ...v,
              thumbnail: v.thumbnail || v.thumbnail_url || '',
            }))
          );
        }
      } catch (_) {
        setVideos([]);
        if (isMainSite) setError('Failed to load videos');
      }
      setLoading(false);
    };
    fetchVideos();
  }, [category, currentCreator?.id, isMainSite, creatorLoading]);

  // Hub previews: one favorite-lists call (includes preview_images per list)
  useEffect(() => {
    const fetchHubPreviews = async () => {
      const sub = getSubdomain();
      if (!sub || !currentCreator?.id || creatorLoading) {
        if (!creatorLoading) {
          setFavoritesPreview([]);
          setFriendPagePreview([]);
        }
        return;
      }
      try {
        const { ok, data } = await fetchPublicFavoriteLists(sub);
        if (!ok || !data?.success) {
          setFavoritesPreview([]);
          setFriendPagePreview([]);
          return;
        }
        const lists = Array.isArray(data.lists) ? data.lists : [];
        const ownerList = lists.find((L) => L.is_primary || L.slug === 'owner');
        let ownerImages = listPreviewImages(ownerList);
        if (!ownerImages.length && ownerList) {
          const { ok: okOwner, data: ownerData } = await fetchPublicFavoritesByList(
            sub,
            ownerList.slug || 'owner'
          );
          if (okOwner && ownerData?.success) {
            ownerImages = (ownerData.favorites || [])
              .map((f) => favoriteImageUrl(f))
              .filter(Boolean);
          }
        }
        if (ownerList?.id) {
          try {
            localStorage.setItem('sm_favorite_list_id', ownerList.id);
            localStorage.setItem('sm_favorite_list_slug', ownerList.slug || 'owner');
          } catch (_) {
            /* ignore */
          }
        }
        setFavoritesPreview(ownerImages);

        const friendLists = lists.filter(
          (L) =>
            !L.is_primary &&
            L.slug !== 'owner' &&
            isCollaboratorFavoriteList(L, currentCreator.id)
        );
        let friendImages = friendLists.flatMap((L) => listPreviewImages(L));
        if (!friendImages.length && friendLists.length) {
          for (const L of friendLists) {
            const slug = (L.slug || '').trim();
            if (!slug) continue;
            const { ok: okFriend, data: friendData } = await fetchPublicFavoritesByList(sub, slug);
            if (!okFriend || !friendData?.success) continue;
            friendImages.push(
              ...(friendData.favorites || []).map((f) => favoriteImageUrl(f)).filter(Boolean)
            );
          }
        }
        setFriendPagePreview(friendImages);
      } catch (err) {
        console.error('Error fetching hub previews:', err);
        setFavoritesPreview([]);
        setFriendPagePreview([]);
      }
    };
    fetchHubPreviews();
  }, [currentCreator?.id, creatorLoading]);

  // Check if user can edit colors (must be authenticated and own the subdomain)
  useEffect(() => {
    const checkEditPermission = async () => {
      const currentSubdomain = getSubdomain();
      if (!currentSubdomain || !currentCreator) {
        console.log('🔒 [HOME] No subdomain or creator:', { currentSubdomain, currentCreator });
        setCanEdit(false);
        return;
      }

      // Get logged-in user
      let loggedInUserId = null;
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');

      if (isAuthenticated === 'true' && userData) {
        try {
          const authenticatedUser = JSON.parse(userData);
          loggedInUserId = authenticatedUser.id;
          if (!loggedInUserId && authenticatedUser.email) {
            const { data: profileData } = await supabase
              .from('users')
              .select('id')
              .eq('email', authenticatedUser.email)
              .single();
            if (profileData) loggedInUserId = profileData.id;
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }

      if (!loggedInUserId) {
        try {
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser) loggedInUserId = supabaseUser.id;
        } catch (e) {
          console.error('Error getting Supabase user:', e);
        }
      }

      // Check if logged-in user owns this subdomain
      const canEditColors = loggedInUserId && currentCreator && loggedInUserId === currentCreator.id;
      console.log('🔒 [HOME] Edit permission check:', {
        loggedInUserId,
        creatorId: currentCreator?.id,
        canEdit: canEditColors,
        subdomain: currentSubdomain
      });
      setCanEdit(canEditColors);
    };

    checkEditPermission();
  }, [currentCreator]);

  // Apply colors from creatorSettings when they change
  useEffect(() => {
    if (creatorSettings?.primary_color && creatorSettings?.secondary_color) {
      const progressBar = document.querySelector('.user-flow-section');
      if (progressBar) {
        // Use setProperty with important flag to override CSS !important rules
        progressBar.style.setProperty(
          'background', 
          `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%)`, 
          'important'
        );
        console.log('🎨 [HOME] Applied colors from creatorSettings:', {
          primary: creatorSettings.primary_color,
          secondary: creatorSettings.secondary_color
        });
      }
    }
  }, [creatorSettings?.primary_color, creatorSettings?.secondary_color]);

  return (
    <>
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        {/* Launch banner: under navbar, above purple bar */}
        <Link
          to="/release"
          className="home-launch-banner"
          aria-label="Launch announcement: The Content Creator Revolution Now Has a Storefront"
        >
          The Content Creator Revolution Now Has a Storefront.
        </Link>

        {/* User Flow Section */}
        <div
          className="user-flow-section"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            position: 'relative',
            background: creatorSettings?.primary_color && creatorSettings?.secondary_color
              ? `linear-gradient(135deg, ${creatorSettings.primary_color} 0%, ${creatorSettings.secondary_color} 100%) !important`
              : undefined
          }}
        >
          {canEdit && (
            <button
              className="progress-bar-edit-btn"
              onClick={() => setShowColorPicker(true)}
              style={{
                opacity: isHovering ? 1 : 0.7,
                transition: 'opacity 0.2s ease'
              }}
              title="Edit colors"
            >
              ✏️
            </button>
          )}
          <div className="flow-steps">
            <div className="flow-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Choose Video</h3>
                <p>Browse and select your favorite video content</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Select Screenshot</h3>
                <p>Select the perfect moment to capture</p>
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Make Merch</h3>
                <p>Create custom products with your screenshot</p>
              </div>
            </div>
          </div>
        </div>

        <ColorPickerModal
          isOpen={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          currentPrimaryColor={creatorSettings?.primary_color}
          currentSecondaryColor={creatorSettings?.secondary_color}
          onSave={async (primary, secondary) => {
            // Wait a moment for database to update, then refresh creator context
            setTimeout(() => {
              if (refreshCreator) {
                refreshCreator();
              }
              // Also trigger the event for other listeners
              window.dispatchEvent(new CustomEvent('creatorSettingsUpdated'));
            }, 800);
          }}
        />


        {/* Main site: creator directory. Subdomains: hub row + video feed. */}
        {loading && <div style={{padding: 24}}>Loading...</div>}
        {error && <div style={{padding: 24, color: 'red'}}>{error}</div>}
        {!loading && !error && isMainSite && (
          <CreatorDirectory
            introVideo={introVideo}
            onIntroUpdated={(next) => {
              if (next?.id) {
                setVideos((prev) => {
                  const rest = prev.filter((v) => v.id !== next.id);
                  return [next, ...rest];
                });
              }
            }}
          />
        )}
        {!loading && !error && !isMainSite && (
          <>
            <Feed
              videos={videos}
              favoritesPreview={favoritesPreview}
              friendPagePreview={friendPagePreview}
              showHubs
            />
            {videos.length === 0 && (
              <div className="storefront-empty">
                <div
                  className={`storefront-empty-card${canEdit ? ' storefront-empty-card--clickable' : ''}`}
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={canEdit ? () => navigate('/dashboard?tab=videos') : undefined}
                  onKeyDown={
                    canEdit
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/dashboard?tab=videos');
                          }
                        }
                      : undefined
                  }
                >
                  <h3>No videos yet</h3>
                  <p>
                    {canEdit
                      ? 'This storefront is live. Add your first video from the dashboard to start selling merch.'
                      : 'This creator hasn\'t added videos yet. Check back soon.'}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      className="storefront-empty-cta"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/upload');
                      }}
                    >
                      Add videos
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Home;
