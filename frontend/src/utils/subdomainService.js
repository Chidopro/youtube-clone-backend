/**
 * Subdomain Service
 * Handles subdomain detection and creator identification for personalization
 */

const BACKEND_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  "https://screenmerch.fly.dev";

/**
 * Get current subdomain from window location
 * @returns {string|null} Subdomain or null if on main domain
 */
export const getSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // If on localhost or IP, return null
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }
  
  // Check if we're on a subdomain (e.g., creator.screenmerch.com)
  // Main domain: screenmerch.com (2 parts)
  // Subdomain: creator.screenmerch.com (3+ parts)
  // Also handle www subdomain (should be treated as main domain)
  if (parts.length >= 3) {
    const firstPart = parts[0].toLowerCase();
    // Ignore www subdomain
    if (firstPart === 'www') {
      return null;
    }
    // Return the first part as subdomain
    return firstPart;
  }
  
  return null;
};

/**
 * Get creator ID from subdomain using backend API (bypasses RLS)
 * @param {string} subdomain - The subdomain to look up
 * @returns {Promise<Object|null>} Creator info or null
 */
export const getCreatorFromSubdomain = async (subdomain) => {
  if (!subdomain) return null;
  
  try {
    const normalizedSubdomain = subdomain.toLowerCase().trim();
    console.log('🔍 Looking up creator for subdomain via API:', normalizedSubdomain);
    
    // Use backend API endpoint which bypasses RLS
    const response = await fetch(`${BACKEND_URL}/api/subdomain/${normalizedSubdomain}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.creator) {
        console.log('✅ Creator found via API:', data.creator);
        return data.creator;
      } else {
        // No creator found - this is expected for invalid subdomains, don't log as error
        console.log('ℹ️ No creator found for subdomain:', normalizedSubdomain);
        return null;
      }
    } else {
      // Only log non-404 errors (404 means subdomain doesn't exist, which is expected)
      if (response.status !== 404) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('⚠️ Subdomain API returned error:', response.status, errorData);
      } else {
        console.log('ℹ️ Subdomain not found (404) - this is expected for invalid subdomains');
      }
    }
    
    // Don't fallback to direct Supabase query - it will fail due to RLS
    // The backend API is the only reliable way to get creator data
    return null;
  } catch (error) {
    console.error('❌ Error fetching creator from subdomain:', error);
    return null;
  }
};

/**
 * Check if current domain is a custom domain
 * @param {string} hostname - The hostname to check
 * @returns {Promise<Object|null>} Creator info or null
 */
export const getCreatorFromCustomDomain = async (hostname) => {
  if (!hostname) return null;
  
  try {
    const { supabase } = await import('../supabaseClient');
    const normalizedHostname = hostname.toLowerCase().trim();
    
    console.log('🔍 Looking up creator for custom domain:', normalizedHostname);
    
    // First try with personalization_enabled = true (preferred)
    let { data, error } = await supabase
      .from('users')
      .select('id, display_name, personalization_enabled, custom_domain')
      .ilike('custom_domain', normalizedHostname)
      .eq('personalization_enabled', true)
      .single();
    
    // If not found, try without the personalization_enabled requirement
    if (error || !data) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('users')
        .select('id, display_name, personalization_enabled, custom_domain')
        .ilike('custom_domain', normalizedHostname)
        .single();
      
      if (fallbackData && !fallbackError) {
        console.log('✅ Found creator for custom domain (without personalization check):', fallbackData);
        data = fallbackData;
        error = null;
      } else {
        console.log('❌ No creator found for custom domain:', normalizedHostname, error || fallbackError);
        return null;
      }
    }
    
    if (data) {
      console.log('✅ Creator found for custom domain:', normalizedHostname, data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error fetching creator from custom domain:', error);
    return null;
  }
};

/**
 * Get current creator based on hostname (checks both subdomain and custom domain)
 * @returns {Promise<Object|null>} Creator info or null
 */
export const getCurrentCreator = async () => {
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
  
  return creator;
};
