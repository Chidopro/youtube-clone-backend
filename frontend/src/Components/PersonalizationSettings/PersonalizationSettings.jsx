import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getSubdomain, getCreatorFromSubdomain } from '../../utils/subdomainService';
import { normalizeStorageUrl } from '../../utils/storageUrl';
import { useCreator } from '../../contexts/CreatorContext';
import './PersonalizationSettings.css';

const BUCKET_CREATOR_LOGOS = 'creator-logos';

const PersonalizationSettings = () => {
  const { refreshCreator } = useCreator() || {};
  const [settings, setSettings] = useState({
    subdomain: '',
    custom_domain: '',
    custom_logo_url: '',
    primary_color: '#667eea',
    secondary_color: '#764ba2',
    hide_screenmerch_branding: false,
    custom_favicon_url: '',
    custom_meta_title: '',
    custom_meta_description: '',
    personalization_enabled: false
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // First, check if we're on a subdomain - if so, load settings for that subdomain's user
      const currentSubdomain = getSubdomain();
      let targetUserId = null;
      let targetUserEmail = null;
      
      if (currentSubdomain) {
        console.log('🔍 PersonalizationSettings: Detected subdomain:', currentSubdomain);
        // Load creator data for this subdomain via API
        const creator = await getCreatorFromSubdomain(currentSubdomain);
        if (creator && creator.id) {
          targetUserId = creator.id;
          console.log('✅ PersonalizationSettings: Found creator for subdomain:', creator.display_name, 'ID:', targetUserId);
          
          // Load settings from database using the creator's ID
          const { data, error } = await supabase
            .from('users')
            .select('subdomain, custom_domain, custom_logo_url, primary_color, secondary_color, hide_screenmerch_branding, custom_favicon_url, custom_meta_title, custom_meta_description, personalization_enabled, email')
            .eq('id', targetUserId)
            .single();
          
          if (data && !error) {
            console.log('✅ PersonalizationSettings: Loaded settings for subdomain user:', data);
            setSettings({
              subdomain: data.subdomain || '',
              custom_domain: data.custom_domain || '',
              custom_logo_url: data.custom_logo_url || '',
              primary_color: data.primary_color || '#667eea',
              secondary_color: data.secondary_color || '#764ba2',
              hide_screenmerch_branding: data.hide_screenmerch_branding || false,
              custom_favicon_url: data.custom_favicon_url || '',
              custom_meta_title: data.custom_meta_title || '',
              custom_meta_description: data.custom_meta_description || '',
              personalization_enabled: data.personalization_enabled || false
            });
            setLoading(false);
            return; // Successfully loaded from subdomain
          } else {
            console.error('❌ PersonalizationSettings: Error loading settings for subdomain user:', error);
          }
        } else {
          console.warn('⚠️ PersonalizationSettings: No creator found for subdomain:', currentSubdomain);
        }
      }
      
      // Fallback: Get logged-in user (if not on subdomain or subdomain lookup failed)
      let user = null;
      let userId = null;
      
      // Check for authenticated user first
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      if (isAuthenticated === 'true' && userData) {
        try {
          const authenticatedUser = JSON.parse(userData);
          user = authenticatedUser;
          userId = authenticatedUser.id;
          
          // If user doesn't have id but has email, look up user in database
          if (!userId && authenticatedUser.email) {
            console.log('🔐 PersonalizationSettings: User missing id, looking up by email:', authenticatedUser.email);
            try {
              const { data: profileData, error: lookupError } = await supabase
                .from('users')
                .select('id')
                .eq('email', authenticatedUser.email)
                .single();
              
              if (profileData && profileData.id) {
                userId = profileData.id;
                user = { ...user, id: profileData.id };
                console.log('🔐 PersonalizationSettings: Found user id from database:', userId);
              }
            } catch (lookupErr) {
              console.error('Error looking up user by email:', lookupErr);
            }
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      
      // Fallback to Supabase auth
      if (!user || !userId) {
        try {
          const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
          if (supabaseUser) {
            user = supabaseUser;
            userId = supabaseUser.id;
          }
        } catch (error) {
          console.error('Error getting Supabase user:', error);
        }
      }
      
      if (userId) {
        const { data, error } = await supabase
          .from('users')
          .select('subdomain, custom_domain, custom_logo_url, primary_color, secondary_color, hide_screenmerch_branding, custom_favicon_url, custom_meta_title, custom_meta_description, personalization_enabled')
          .eq('id', userId)
          .single();
        
        if (data && !error) {
          console.log('✅ PersonalizationSettings: Loaded settings from database:', data);
          setSettings({
            subdomain: data.subdomain || '',
            custom_domain: data.custom_domain || '',
            custom_logo_url: data.custom_logo_url || '',
            primary_color: data.primary_color || '#667eea',
            secondary_color: data.secondary_color || '#764ba2',
            hide_screenmerch_branding: data.hide_screenmerch_branding || false,
            custom_favicon_url: data.custom_favicon_url || '',
            custom_meta_title: data.custom_meta_title || '',
            custom_meta_description: data.custom_meta_description || '',
            personalization_enabled: data.personalization_enabled || false
          });
        } else if (error) {
          console.error('❌ PersonalizationSettings: Error loading settings:', error);
        }
      } else if (user && user.email) {
        // Try to load by email if we have email but no id
        console.log('🔐 PersonalizationSettings: Trying to load settings by email:', user.email);
        const { data, error } = await supabase
          .from('users')
          .select('id, subdomain, custom_domain, custom_logo_url, primary_color, secondary_color, hide_screenmerch_branding, custom_favicon_url, custom_meta_title, custom_meta_description, personalization_enabled')
          .eq('email', user.email)
          .single();
        
        if (data && !error) {
          console.log('✅ PersonalizationSettings: Loaded settings by email:', data);
          setSettings({
            subdomain: data.subdomain || '',
            custom_domain: data.custom_domain || '',
            custom_logo_url: data.custom_logo_url || '',
            primary_color: data.primary_color || '#667eea',
            secondary_color: data.secondary_color || '#764ba2',
            hide_screenmerch_branding: data.hide_screenmerch_branding || false,
            custom_favicon_url: data.custom_favicon_url || '',
            custom_meta_title: data.custom_meta_title || '',
            custom_meta_description: data.custom_meta_description || '',
            personalization_enabled: data.personalization_enabled || false
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading settings');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const uploadLogoToSupabase = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setMessage('Please select an image file (PNG, JPG, SVG, or WebP).');
      setMessageType('error');
      return;
    }
    setUploadingLogo(true);
    setMessage('');
    setMessageType('');
    try {
      let userId = null;
      const currentSubdomain = getSubdomain();
      if (currentSubdomain) {
        const creator = await getCreatorFromSubdomain(currentSubdomain);
        if (creator?.id) userId = creator.id;
      }
      if (!userId) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id) userId = authUser.id;
      }
      if (!userId && localStorage.getItem('isAuthenticated') === 'true') {
        try {
          const ud = JSON.parse(localStorage.getItem('user') || '{}');
          if (ud.id) userId = ud.id;
          else if (ud.email) {
            const { data: profileData } = await supabase.from('users').select('id').eq('email', ud.email).single();
            if (profileData?.id) userId = profileData.id;
          }
        } catch (e) {}
      }
      if (!userId) {
        setMessage('Please log in to upload a logo.');
        setMessageType('error');
        setUploadingLogo(false);
        return;
      }
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const fileName = `${userId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET_CREATOR_LOGOS)
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (error) {
        setMessage(error.message || 'Upload failed. Create a Supabase bucket named "creator-logos" and allow public read + authenticated upload.');
        setMessageType('error');
        setUploadingLogo(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET_CREATOR_LOGOS).getPublicUrl(fileName);
      setSettings(prev => ({ ...prev, custom_logo_url: publicUrl }));
      setMessage('Logo uploaded. Click Save Settings to apply.');
      setMessageType('success');
    } catch (err) {
      setMessage(err?.message || 'Upload failed.');
      setMessageType('error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setMessageType('');
    
    try {
      // Declare userId and user variables at the start
      let userId = null;
      let user = null;
      
      // First, check if we're on a subdomain - if so, we need to save to that subdomain's user
      const currentSubdomain = getSubdomain();
      let targetUserId = null;
      
      if (currentSubdomain) {
        console.log('🔍 PersonalizationSettings: Detected subdomain for save:', currentSubdomain);
        // Get creator data for this subdomain via API
        const creator = await getCreatorFromSubdomain(currentSubdomain);
        if (creator && creator.id) {
          targetUserId = creator.id;
          console.log('✅ PersonalizationSettings: Will save to subdomain owner:', creator.display_name, 'ID:', targetUserId);
          
          // Verify the logged-in user owns this subdomain (security check)
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
            } catch (e) {}
          }
          
          if (!loggedInUserId) {
            const { data: { user: supabaseUser } } = await supabase.auth.getUser();
            if (supabaseUser) loggedInUserId = supabaseUser.id;
          }
          
          // Security: Only allow saving if logged-in user owns the subdomain
          if (loggedInUserId && loggedInUserId !== targetUserId) {
            console.error('❌ PersonalizationSettings: Logged-in user does not own this subdomain');
            setMessage('You can only edit settings for your own subdomain. Please log in as the owner of this subdomain.');
            setMessageType('error');
            setSaving(false);
            return;
          }
          
          // Use the subdomain owner's ID for saving
          userId = targetUserId;
        } else {
          console.warn('⚠️ PersonalizationSettings: No creator found for subdomain:', currentSubdomain);
        }
      }
      
      // If not on subdomain or subdomain lookup failed, get logged-in user
      if (!userId) {
        // Get user the same way Dashboard does (supports both Google OAuth and Supabase auth)
        let user = null;
        
        // Check for authenticated user first
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        const userData = localStorage.getItem('user');
        
        if (isAuthenticated === 'true' && userData) {
          try {
            const authenticatedUser = JSON.parse(userData);
            user = authenticatedUser;
            userId = authenticatedUser.id;
            
            // If user doesn't have id but has email, look up user in database
            if (!userId && authenticatedUser.email) {
              console.log('🔐 PersonalizationSettings: User missing id, looking up by email:', authenticatedUser.email);
              try {
                const { data: profileData, error: lookupError } = await supabase
                  .from('users')
                  .select('id')
                  .eq('email', authenticatedUser.email)
                  .single();
                
                if (profileData && profileData.id) {
                  userId = profileData.id;
                  user = { ...user, id: profileData.id };
                  console.log('🔐 PersonalizationSettings: Found user id from database:', userId);
                }
              } catch (lookupErr) {
                console.error('Error looking up user by email:', lookupErr);
              }
            }
          } catch (error) {
            console.error('Error parsing user data:', error);
          }
        }
        
        // Fallback to Supabase auth - this is the most reliable way to get the correct user ID
        // The auth.uid() must match the users.id for RLS policies to work
        if (!userId) {
          try {
            const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
            if (supabaseUser && supabaseUser.id) {
              // Always use the authenticated user's ID from Supabase auth
              // This ensures RLS policies work correctly (auth.uid() = id)
              userId = supabaseUser.id;
              user = supabaseUser;
              console.log('🔐 PersonalizationSettings: Using authenticated user ID from Supabase:', userId);
            } else if (authError) {
              console.error('Error getting Supabase user:', authError);
            }
          } catch (error) {
            console.error('Error getting Supabase user:', error);
          }
        }
      }
      
      if (!userId) {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        const userData = localStorage.getItem('user');
        console.error('🔐 PersonalizationSettings: No user id found. isAuthenticated:', isAuthenticated, 'userData:', userData);
        setMessage('Please log in to save settings');
        setMessageType('error');
        setSaving(false);
        return;
      }
      
      // Validate subdomain format if provided
      if (settings.subdomain) {
        const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
        if (!subdomainRegex.test(settings.subdomain.toLowerCase())) {
          setMessage('Subdomain can only contain lowercase letters, numbers, and hyphens. Cannot start or end with hyphen.');
          setMessageType('error');
          setSaving(false);
          return;
        }
        
        if (settings.subdomain.length < 3 || settings.subdomain.length > 63) {
          setMessage('Subdomain must be between 3 and 63 characters');
          setMessageType('error');
          setSaving(false);
          return;
        }
        
        // Check for reserved subdomains
        const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'test', 'staging', 'dev', 'prod', 'cdn', 'static', 'assets', 'images', 'media', 'blog', 'shop', 'store', 'help', 'support', 'docs', 'status'];
        if (reserved.includes(settings.subdomain.toLowerCase())) {
          setMessage('This subdomain is reserved and cannot be used');
          setMessageType('error');
          setSaving(false);
          return;
        }
      }
      
      // Validate color format
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (settings.primary_color && !colorRegex.test(settings.primary_color)) {
        setMessage('Primary color must be a valid hex color (e.g., #FF5733)');
        setMessageType('error');
        setSaving(false);
        return;
      }
      if (settings.secondary_color && !colorRegex.test(settings.secondary_color)) {
        setMessage('Secondary color must be a valid hex color (e.g., #C70039)');
        setMessageType('error');
        setSaving(false);
        return;
      }
      
      // Normalize subdomain (lowercase, trim)
      const normalizedSubdomain = settings.subdomain ? settings.subdomain.toLowerCase().trim() : null;
      
      console.log('💾 PersonalizationSettings: Saving settings for userId:', userId, 'user:', user);
      console.log('💾 PersonalizationSettings: Settings to save:', {
        subdomain: normalizedSubdomain,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        hide_screenmerch_branding: settings.hide_screenmerch_branding,
        personalization_enabled: settings.personalization_enabled
      });
      
      let updateResult = null;
      let error = null;
      
      // Prepare update data
      const updateData = {
        subdomain: normalizedSubdomain || null,
        custom_domain: settings.custom_domain ? settings.custom_domain.toLowerCase().trim() : null,
        custom_logo_url: settings.custom_logo_url || null,
        primary_color: settings.primary_color || '#667eea',
        secondary_color: settings.secondary_color || '#764ba2',
        hide_screenmerch_branding: settings.hide_screenmerch_branding || false,
        custom_favicon_url: settings.custom_favicon_url || null,
        custom_meta_title: settings.custom_meta_title || null,
        custom_meta_description: settings.custom_meta_description || null,
        personalization_enabled: settings.personalization_enabled || false
      };
      
      // Always update by id (which should match auth.uid() for RLS to work)
      if (userId) {
        console.log('💾 PersonalizationSettings: Attempting to update user with ID:', userId);
        console.log('💾 PersonalizationSettings: Update data:', updateData);
        
        const updateResponse = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select(); // Select to get updated data back
        
        updateResult = updateResponse.data;
        error = updateResponse.error;
        
        if (error) {
          console.error('❌ Update failed with error:', error);
          console.error('   Error code:', error.code);
          console.error('   Error message:', error.message);
          console.error('   Error details:', error.details);
          console.error('   Error hint:', error.hint);
        }
      } else {
        console.error('❌ No userId available for update');
        error = { message: 'No user ID available. Please log in again.' };
      }
      
      console.log('💾 PersonalizationSettings: Update result:', updateResult, 'Error:', error);
      
      if (error) {
        console.error('❌ Error saving settings:', error);
        console.error('   Error details:', JSON.stringify(error, null, 2));
        setMessage(`Error: ${error.message || 'Failed to save settings'}`);
        setMessageType('error');
      } else {
        console.log('✅ Settings saved successfully! Update result:', updateResult);
        
        // Verify the settings were actually saved by querying the database
        if (updateResult && updateResult.length > 0) {
          const savedData = updateResult[0];
          console.log('✅ Verified saved settings from update response:', {
            subdomain: savedData.subdomain,
            primary_color: savedData.primary_color,
            secondary_color: savedData.secondary_color,
            hide_screenmerch_branding: savedData.hide_screenmerch_branding,
            personalization_enabled: savedData.personalization_enabled
          });
          
          // Double-check by querying the database directly
          const { data: verifyData, error: verifyError } = await supabase
            .from('users')
            .select('subdomain, primary_color, secondary_color, personalization_enabled')
            .eq('id', userId)
            .single();
          
          if (!verifyError && verifyData) {
            console.log('✅ Database verification - actual saved values:', verifyData);
            if (verifyData.subdomain !== normalizedSubdomain) {
              console.warn('⚠️ WARNING: Subdomain mismatch! Expected:', normalizedSubdomain, 'Got:', verifyData.subdomain);
            }
          } else {
            console.error('❌ Failed to verify saved settings:', verifyError);
          }
        } else {
          console.warn('⚠️ Update result is empty or null');
        }
        
        if (settings.personalization_enabled && settings.subdomain) {
          setMessage(`✅ Settings saved! Your logo and theme should update now. If the navbar logo doesn’t change, refresh the page (F5).`);
        } else if (settings.subdomain) {
          setMessage(`✅ Settings saved! Don't forget to check "Enable Personalization" and save again to activate your app at ${settings.subdomain}.screenmerch.com`);
        } else {
          setMessage('✅ Settings saved! If the navbar logo doesn’t update, refresh the page (F5).');
        }
        setMessageType('success');
        
        // Reload settings to get updated values from database
        console.log('🔄 Reloading settings after save...');
        await loadSettings();
        
        // Trigger CreatorContext refresh so navbar logo and theme update immediately
        window.dispatchEvent(new CustomEvent('creatorSettingsUpdated'));
        if (typeof refreshCreator === 'function') {
          refreshCreator();
        }
        
        // Force immediate color update (even if not on subdomain yet)
        if (settings.primary_color) {
          document.documentElement.style.setProperty('--primary-color', settings.primary_color);
          console.log('✅ Immediately set --primary-color to:', settings.primary_color);
        }
        if (settings.secondary_color) {
          document.documentElement.style.setProperty('--secondary-color', settings.secondary_color);
          console.log('✅ Immediately set --secondary-color to:', settings.secondary_color);
        }
        
        // Force style recalculation
        const html = document.documentElement;
        const originalDisplay = html.style.display;
        html.style.display = 'none';
        html.offsetHeight;
        html.style.display = originalDisplay;
        
        // If on the subdomain, refresh the page to see changes immediately
        const currentHostname = window.location.hostname.toLowerCase();
        const expectedSubdomain = normalizedSubdomain ? `${normalizedSubdomain}.screenmerch.com` : null;
        if (expectedSubdomain && (currentHostname === expectedSubdomain || currentHostname.includes(normalizedSubdomain))) {
          console.log('🔄 On subdomain, reloading page to apply changes');
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else if (settings.personalization_enabled && normalizedSubdomain) {
          // If not on subdomain but personalization is enabled, redirect to subdomain
          console.log('🔄 Redirecting to subdomain to see changes:', expectedSubdomain);
          setTimeout(() => {
            window.location.href = `https://${expectedSubdomain}${window.location.pathname}`;
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage(`Error: ${error.message || 'Unknown error'}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="personalization-settings-loading">Loading settings...</div>;
  }

  return (
    <div className="personalization-settings">
      <h2>Personalize Your ScreenMerch App</h2>
      <p className="personalization-description">
        Create your own branded ScreenMerch app with a custom subdomain, colors, and branding. 
        Your personalized app will show only your content.
      </p>
      
      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.personalization_enabled}
            onChange={(e) => setSettings({...settings, personalization_enabled: e.target.checked})}
          />
          <span className="setting-label-text">Enable Personalization</span>
        </label>
        <p className="help-text">Turn on to activate your personalized app</p>
      </div>
      
      {settings.personalization_enabled && (
        <div className="personalization-form">
          <div className="setting-group">
            <label className="setting-label">Subdomain *</label>
            <input
              type="text"
              value={settings.subdomain}
              onChange={(e) => setSettings({...settings, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
              placeholder="yourname"
              className="setting-input"
            />
            <p className="help-text">
              Your app will be available at: <strong>{settings.subdomain || 'yourname'}.screenmerch.com</strong>
            </p>
            <p className="help-text-small">
              Only lowercase letters, numbers, and hyphens. 3-63 characters. Cannot start or end with hyphen.
            </p>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Custom Domain (Premium)</label>
            <input
              type="text"
              value={settings.custom_domain}
              onChange={(e) => setSettings({...settings, custom_domain: e.target.value})}
              placeholder="Coming Soon"
              className="setting-input"
            />
            <p className="help-text">Connect your own domain (requires DNS configuration)</p>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Custom Logo URL</label>
            <input
              type="url"
              value={settings.custom_logo_url}
              onChange={(e) => setSettings({...settings, custom_logo_url: e.target.value})}
              placeholder="https://example.com/logo.png"
              className="setting-input"
            />
            <div className="logo-upload-row">
              <label className="logo-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogoToSupabase(file);
                    e.target.value = '';
                  }}
                  disabled={uploadingLogo}
                />
                {uploadingLogo ? 'Uploading…' : 'Upload from Supabase bucket'}
              </label>
              <span className="help-text-inline">Stores in bucket &quot;creator-logos&quot;</span>
            </div>
            {settings.custom_logo_url && (
              <div className="logo-preview-wrap">
                <img src={normalizeStorageUrl(settings.custom_logo_url)} alt="Logo preview" className="logo-preview" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <p className="help-text">URL to your custom logo (recommended: 200x50px PNG or SVG). Upload to Supabase or paste a URL.</p>
          </div>
          
          <div className="color-settings">
            <div className="setting-group">
              <label className="setting-label">Primary Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                  placeholder="#667eea"
                  className="color-text-input"
                />
              </div>
              <p className="help-text">Main brand color used in gradients and buttons</p>
            </div>
            
            <div className="setting-group">
              <label className="setting-label">Secondary Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
                  placeholder="#764ba2"
                  className="color-text-input"
                />
              </div>
              <p className="help-text">Secondary brand color used in gradients</p>
            </div>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Custom Favicon URL</label>
            <input
              type="url"
              value={settings.custom_favicon_url}
              onChange={(e) => setSettings({...settings, custom_favicon_url: e.target.value})}
              placeholder="https://example.com/favicon.ico"
              className="setting-input"
            />
            <p className="help-text">URL to your custom favicon (recommended: 32x32px ICO or PNG)</p>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Custom Meta Title</label>
            <input
              type="text"
              value={settings.custom_meta_title}
              onChange={(e) => setSettings({...settings, custom_meta_title: e.target.value})}
              placeholder="Your Brand Name - Merchandise"
              className="setting-input"
              maxLength={255}
            />
            <p className="help-text">Page title shown in browser tabs and search results</p>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Custom Meta Description</label>
            <textarea
              value={settings.custom_meta_description}
              onChange={(e) => setSettings({...settings, custom_meta_description: e.target.value})}
              placeholder="Description for search engines"
              rows={3}
              className="setting-textarea"
              maxLength={500}
            />
            <p className="help-text">Description shown in search engine results (recommended: 150-160 characters)</p>
          </div>
        </div>
      )}
      
      <div className="settings-actions">
        <button 
          onClick={handleSave} 
          disabled={saving || !settings.personalization_enabled}
          className="save-settings-btn"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
      
      {message && (
        <div className={`settings-message ${messageType}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default PersonalizationSettings;
