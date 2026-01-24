import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSubdomain, getCreatorFromSubdomain, getCreatorFromCustomDomain } from '../utils/subdomainService';
import { supabase } from '../supabaseClient';

const CreatorContext = createContext(null);

export const CreatorProvider = ({ children }) => {
  const [currentCreator, setCurrentCreator] = useState(null);
  const [creatorSettings, setCreatorSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const detectCreator = async () => {
    setLoading(true);
    
    try {
      const hostname = window.location.hostname.toLowerCase();
      let creator = null;
      
      // Check if this is a screenmerch subdomain first (e.g., testcreator.screenmerch.com)
      // Custom domains won't end with .screenmerch.com
      if (hostname.endsWith('.screenmerch.com') || hostname === 'screenmerch.com') {
        const subdomain = getSubdomain();
        if (subdomain) {
          creator = await getCreatorFromSubdomain(subdomain);
        }
      } else {
        // Not a screenmerch subdomain, try custom domain lookup
        creator = await getCreatorFromCustomDomain(hostname);
      }
      
      if (creator) {
        setCurrentCreator(creator);
        
        // The creator object from the API already contains all branding settings
        // Use those directly instead of making another Supabase query (which may be blocked by RLS)
        const userData = {
          custom_logo_url: creator.custom_logo_url || creator.logo_url,  // Prefer custom_logo_url, fallback to logo_url for backward compatibility
          primary_color: creator.primary_color,
          secondary_color: creator.secondary_color,
          hide_screenmerch_branding: creator.hide_screenmerch_branding,
          custom_favicon_url: creator.custom_favicon_url,
          custom_meta_title: creator.custom_meta_title,
          custom_meta_description: creator.custom_meta_description,
          display_name: creator.display_name,
          personalization_enabled: creator.personalization_enabled,
          profile_image_url: creator.profile_image_url
        };
        
        console.log('🎨 Creator settings from API:', userData);
        
        // Apply settings if we found user data (even if personalization_enabled is false, we still want to apply colors if they exist)
        if (userData) {
          // Always set creatorSettings if we have user data (so Footer can access hide_screenmerch_branding)
          // This allows branding settings to apply even if personalization_enabled is false
          setCreatorSettings(userData);
          
          // Always apply colors if they exist (even if personalization_enabled is false)
          // This allows colors to be applied immediately after saving
          const primaryColor = userData.primary_color || '#667eea';
          const secondaryColor = userData.secondary_color || '#764ba2';
          
          if (userData.primary_color || userData.secondary_color) {
            console.log('🎨 Applying creator colors:', {
              primary: primaryColor,
              secondary: secondaryColor,
              personalization_enabled: userData.personalization_enabled
            });
            
            // Apply primary color
            document.documentElement.style.setProperty('--primary-color', primaryColor);
            console.log('✅ Set --primary-color to:', primaryColor);
            
            // Apply secondary color
            document.documentElement.style.setProperty('--secondary-color', secondaryColor);
            console.log('✅ Set --secondary-color to:', secondaryColor);
          }
          
          // Force style recalculation by temporarily modifying and restoring display
          const html = document.documentElement;
          const originalDisplay = html.style.display;
          html.style.display = 'none';
          html.offsetHeight; // Trigger reflow
          html.style.display = originalDisplay;
          
          // Also trigger a repaint on body
          const body = document.body;
          if (body) {
            body.style.display = 'none';
            body.offsetHeight;
            body.style.display = '';
          }
          
          // Force all elements using CSS variables to update
          const style = document.createElement('style');
          style.textContent = `
            * {
              --primary-color: ${primaryColor} !important;
              --secondary-color: ${secondaryColor} !important;
            }
          `;
          document.head.appendChild(style);
          // Remove after a brief moment to let browser process
          setTimeout(() => {
            if (style.parentNode) {
              style.parentNode.removeChild(style);
            }
          }, 100);
          
          // Update favicon
          if (userData.custom_favicon_url) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'shortcut icon';
              document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = userData.custom_favicon_url;
          }
          
          // Update meta tags
          if (userData.custom_meta_title) {
            document.title = userData.custom_meta_title;
          }
          
          if (userData.custom_meta_description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
              metaDesc = document.createElement('meta');
              metaDesc.name = 'description';
              document.getElementsByTagName('head')[0].appendChild(metaDesc);
            }
            metaDesc.content = userData.custom_meta_description;
          }
        }
      } else {
        // Not on a creator's subdomain, reset to defaults
        document.documentElement.style.setProperty('--primary-color', '#667eea');
        document.documentElement.style.setProperty('--secondary-color', '#764ba2');
      }
    } catch (error) {
      // Only log unexpected errors, not expected ones like "creator not found"
      if (error.message && !error.message.includes('404') && !error.message.includes('not found')) {
        console.error('Error detecting creator:', error);
      }
      // Reset to defaults on error
      document.documentElement.style.setProperty('--primary-color', '#667eea');
      document.documentElement.style.setProperty('--secondary-color', '#764ba2');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detectCreator();
    
    // Listen for settings update events
    const handleSettingsUpdate = () => {
      detectCreator();
    };
    
    window.addEventListener('creatorSettingsUpdated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('creatorSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  return (
    <CreatorContext.Provider value={{ currentCreator, creatorSettings, loading, refreshCreator: detectCreator }}>
      {children}
    </CreatorContext.Provider>
  );
};

export const useCreator = () => {
  const context = useContext(CreatorContext);
  if (!context) {
    // Return default values if context is not available (for backward compatibility)
    return { currentCreator: null, creatorSettings: null, loading: false };
  }
  return context;
};
