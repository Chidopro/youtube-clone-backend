# ScreenMerch Creator Personalization Plan

## Overview
Transform ScreenMerch from a single multi-creator platform into a white-label solution where each creator can have their own personalized app with only their content, custom branding, and their own domain/subdomain.

## Architecture Approach

### Option 1: Subdomain-Based (Recommended for MVP)
- Each creator gets: `creatorname.screenmerch.com`
- Single codebase, dynamic content filtering based on subdomain
- Easy to implement, no DNS management needed
- Example: `john.screenmerch.com` shows only John's content

### Option 2: Custom Domain (Premium Feature)
- Creators can connect their own domain: `merch.creatorsname.com`
- Requires DNS configuration and SSL certificate management
- More professional, better branding
- Example: `merch.johnsmith.com` → points to John's ScreenMerch app

### Option 3: Path-Based (Current Partial Implementation)
- Current: `screenmerch.com/channel/creatorname`
- Keep as fallback, but enhance with full personalization

## Implementation Steps

### Phase 1: Database Schema Updates

#### 1.1 Add Creator Personalization Fields to `users` table

```sql
-- Add personalization fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subdomain VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS custom_logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#667eea', -- Hex color
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#764ba2',
ADD COLUMN IF NOT EXISTS hide_screenmerch_branding BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_favicon_url TEXT,
ADD COLUMN IF NOT EXISTS custom_meta_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS custom_meta_description TEXT,
ADD COLUMN IF NOT EXISTS personalization_enabled BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain);
CREATE INDEX IF NOT EXISTS idx_users_custom_domain ON users(custom_domain);
CREATE INDEX IF NOT EXISTS idx_users_personalization_enabled ON users(personalization_enabled);
```

#### 1.2 Create Creator Settings Table (Optional - for more complex settings)

```sql
CREATE TABLE IF NOT EXISTS creator_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_creator_settings_user_id ON creator_settings(user_id);
```

### Phase 2: Frontend Implementation

#### 2.1 Subdomain Detection Utility

Create `frontend/src/utils/subdomainService.js`:

```javascript
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
  if (parts.length >= 3) {
    // Return the first part as subdomain
    return parts[0];
  }
  
  return null;
};

/**
 * Get creator ID from subdomain
 * @returns {Promise<string|null>} Creator user ID or null
 */
export const getCreatorFromSubdomain = async (subdomain) => {
  if (!subdomain) return null;
  
  const { supabase } = await import('../supabaseClient');
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, personalization_enabled')
    .eq('subdomain', subdomain)
    .eq('personalization_enabled', true)
    .single();
  
  if (error || !data) return null;
  return data;
};

/**
 * Check if current domain is a custom domain
 * @returns {Promise<Object|null>} Creator info or null
 */
export const getCreatorFromCustomDomain = async (hostname) => {
  const { supabase } = await import('../supabaseClient');
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, personalization_enabled')
    .eq('custom_domain', hostname)
    .eq('personalization_enabled', true)
    .single();
  
  if (error || !data) return null;
  return data;
};
```

#### 2.2 Creator Context Provider

Create `frontend/src/contexts/CreatorContext.jsx`:

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSubdomain, getCreatorFromSubdomain, getCreatorFromCustomDomain } from '../utils/subdomainService';
import { supabase } from '../supabaseClient';

const CreatorContext = createContext(null);

export const CreatorProvider = ({ children }) => {
  const [currentCreator, setCurrentCreator] = useState(null);
  const [creatorSettings, setCreatorSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectCreator = async () => {
      setLoading(true);
      
      const hostname = window.location.hostname;
      let creator = null;
      
      // Try custom domain first
      creator = await getCreatorFromCustomDomain(hostname);
      
      // If no custom domain, try subdomain
      if (!creator) {
        const subdomain = getSubdomain();
        if (subdomain) {
          creator = await getCreatorFromSubdomain(subdomain);
        }
      }
      
      if (creator) {
        setCurrentCreator(creator);
        
        // Fetch creator's branding settings
        const { data: userData } = await supabase
          .from('users')
          .select('custom_logo_url, primary_color, secondary_color, hide_screenmerch_branding, custom_favicon_url, custom_meta_title, custom_meta_description')
          .eq('id', creator.id)
          .single();
        
        if (userData) {
          setCreatorSettings(userData);
          
          // Apply custom colors to CSS variables
          if (userData.primary_color) {
            document.documentElement.style.setProperty('--primary-color', userData.primary_color);
          }
          if (userData.secondary_color) {
            document.documentElement.style.setProperty('--secondary-color', userData.secondary_color);
          }
          
          // Update favicon
          if (userData.custom_favicon_url) {
            const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = userData.custom_favicon_url;
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          
          // Update meta tags
          if (userData.custom_meta_title) {
            document.title = userData.custom_meta_title;
          }
          if (userData.custom_meta_description) {
            const metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
            metaDesc.name = 'description';
            metaDesc.content = userData.custom_meta_description;
            document.getElementsByTagName('head')[0].appendChild(metaDesc);
          }
        }
      }
      
      setLoading(false);
    };
    
    detectCreator();
  }, []);

  return (
    <CreatorContext.Provider value={{ currentCreator, creatorSettings, loading }}>
      {children}
    </CreatorContext.Provider>
  );
};

export const useCreator = () => {
  const context = useContext(CreatorContext);
  if (!context) {
    throw new Error('useCreator must be used within CreatorProvider');
  }
  return context;
};
```

#### 2.3 Update App.jsx to Use Creator Context

```javascript
import { CreatorProvider } from './contexts/CreatorContext';

// Wrap app with CreatorProvider
<CreatorProvider>
  <App />
</CreatorProvider>
```

#### 2.4 Update Home.jsx to Filter by Creator

```javascript
import { useCreator } from '../contexts/CreatorContext';

const Home = ({ sidebar, category, selectedCategory, setSelectedCategory }) => {
  const { currentCreator } = useCreator();
  const [videos, setVideos] = useState([]);
  // ... existing code ...

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError('');
      
      let query = supabase
        .from('videos2')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If on creator's personalized app, only show their videos
      if (currentCreator) {
        query = query.eq('user_id', currentCreator.id);
      }
      
      if (category && category !== 'All') {
        query = query.eq('category', category);
      }
      
      let { data, error } = await query;
      // ... rest of existing code ...
    };
    fetchVideos();
  }, [category, currentCreator]);
  
  // ... rest of component ...
};
```

#### 2.5 Update Navbar to Show Creator Branding

```javascript
import { useCreator } from '../contexts/CreatorContext';

const Navbar = ({ setSidebar, resetCategory }) => {
  const { currentCreator, creatorSettings } = useCreator();
  
  return (
    <nav>
      {creatorSettings?.custom_logo_url ? (
        <img src={creatorSettings.custom_logo_url} alt={currentCreator?.display_name} />
      ) : (
        <span>ScreenMerch</span>
      )}
      {/* Hide ScreenMerch branding if hide_screenmerch_branding is true */}
      {!creatorSettings?.hide_screenmerch_branding && (
        <span className="powered-by">Powered by ScreenMerch</span>
      )}
    </nav>
  );
};
```

### Phase 3: Backend API Updates

#### 3.1 Update Video Endpoints to Support Creator Filtering

In `backend/app.py`, update video endpoints to accept creator context:

```python
@app.route("/api/videos", methods=["GET"])
def get_videos():
    creator_id = request.headers.get('X-Creator-ID')  # From subdomain detection
    # ... filter videos by creator_id if provided ...
```

### Phase 4: Creator Dashboard - Personalization Settings

#### 4.1 Add Personalization Tab to Dashboard

Create `frontend/src/Components/PersonalizationSettings/PersonalizationSettings.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { UserService } from '../../utils/userService';

const PersonalizationSettings = () => {
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
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    const user = await UserService.getCurrentUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
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
  };
  
  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    
    const user = await UserService.getCurrentUser();
    if (!user) {
      setMessage('Please log in to save settings');
      setLoading(false);
      return;
    }
    
    // Validate subdomain format
    if (settings.subdomain) {
      const subdomainRegex = /^[a-z0-9-]+$/;
      if (!subdomainRegex.test(settings.subdomain)) {
        setMessage('Subdomain can only contain lowercase letters, numbers, and hyphens');
        setLoading(false);
        return;
      }
    }
    
    const { error } = await supabase
      .from('users')
      .update({
        subdomain: settings.subdomain || null,
        custom_domain: settings.custom_domain || null,
        custom_logo_url: settings.custom_logo_url || null,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        hide_screenmerch_branding: settings.hide_screenmerch_branding,
        custom_favicon_url: settings.custom_favicon_url || null,
        custom_meta_title: settings.custom_meta_title || null,
        custom_meta_description: settings.custom_meta_description || null,
        personalization_enabled: settings.personalization_enabled
      })
      .eq('id', user.id);
    
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Settings saved successfully!');
    }
    
    setLoading(false);
  };
  
  return (
    <div className="personalization-settings">
      <h2>Personalize Your ScreenMerch App</h2>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.personalization_enabled}
            onChange={(e) => setSettings({...settings, personalization_enabled: e.target.checked})}
          />
          Enable Personalization
        </label>
        <p className="help-text">Turn on to activate your personalized app</p>
      </div>
      
      {settings.personalization_enabled && (
        <>
          <div className="setting-group">
            <label>Subdomain</label>
            <input
              type="text"
              value={settings.subdomain}
              onChange={(e) => setSettings({...settings, subdomain: e.target.value.toLowerCase()})}
              placeholder="yourname"
            />
            <p className="help-text">
              Your app will be available at: {settings.subdomain || 'yourname'}.screenmerch.com
            </p>
          </div>
          
          <div className="setting-group">
            <label>Custom Domain (Premium)</label>
            <input
              type="text"
              value={settings.custom_domain}
              onChange={(e) => setSettings({...settings, custom_domain: e.target.value})}
              placeholder="merch.yourdomain.com"
            />
            <p className="help-text">Connect your own domain (requires DNS configuration)</p>
          </div>
          
          <div className="setting-group">
            <label>Custom Logo URL</label>
            <input
              type="url"
              value={settings.custom_logo_url}
              onChange={(e) => setSettings({...settings, custom_logo_url: e.target.value})}
              placeholder="https://example.com/logo.png"
            />
          </div>
          
          <div className="setting-group">
            <label>Primary Color</label>
            <input
              type="color"
              value={settings.primary_color}
              onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
            />
          </div>
          
          <div className="setting-group">
            <label>Secondary Color</label>
            <input
              type="color"
              value={settings.secondary_color}
              onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
            />
          </div>
          
          <div className="setting-group">
            <label>
              <input
                type="checkbox"
                checked={settings.hide_screenmerch_branding}
                onChange={(e) => setSettings({...settings, hide_screenmerch_branding: e.target.checked})}
              />
              Hide "Powered by ScreenMerch" branding
            </label>
          </div>
          
          <div className="setting-group">
            <label>Custom Meta Title</label>
            <input
              type="text"
              value={settings.custom_meta_title}
              onChange={(e) => setSettings({...settings, custom_meta_title: e.target.value})}
              placeholder="Your Brand Name - Merchandise"
            />
          </div>
          
          <div className="setting-group">
            <label>Custom Meta Description</label>
            <textarea
              value={settings.custom_meta_description}
              onChange={(e) => setSettings({...settings, custom_meta_description: e.target.value})}
              placeholder="Description for search engines"
              rows={3}
            />
          </div>
        </>
      )}
      
      <button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
      
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default PersonalizationSettings;
```

### Phase 5: DNS and Hosting Configuration

#### 5.1 Netlify Configuration for Subdomains

Update `netlify.toml`:

```toml
[build]
  command = "cd frontend && npm run build"
  publish = "frontend/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Wildcard subdomain support
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

#### 5.2 DNS Configuration

For subdomains:
- Add wildcard DNS record: `*.screenmerch.com` → Netlify IP
- Netlify will handle subdomain routing automatically

For custom domains:
- Creator adds CNAME record: `merch.theirdomain.com` → `screenmerch.com`
- Netlify will verify and provision SSL certificate

### Phase 6: Testing Checklist

- [ ] Subdomain detection works correctly
- [ ] Content filtering shows only creator's videos
- [ ] Custom branding (logo, colors) applies correctly
- [ ] Meta tags update for SEO
- [ ] Favicon updates
- [ ] "Powered by" branding can be hidden
- [ ] Custom domain routing works
- [ ] Dashboard settings save correctly
- [ ] Subdomain validation prevents conflicts
- [ ] Mobile responsiveness maintained

## Migration Path

1. **Phase 1**: Database schema updates (non-breaking)
2. **Phase 2**: Frontend detection and filtering (backward compatible)
3. **Phase 3**: Creator dashboard settings UI
4. **Phase 4**: DNS and hosting configuration
5. **Phase 5**: Beta testing with select creators
6. **Phase 6**: Full rollout

## Pricing Tiers

- **Free**: Basic personalization (subdomain only)
- **Pro**: Custom domain support
- **Enterprise**: Full white-labeling, custom domain, priority support

## Security Considerations

1. **Subdomain Validation**: Prevent reserved subdomains (www, api, admin, etc.)
2. **Content Isolation**: Ensure RLS policies prevent cross-creator data access
3. **Domain Verification**: Verify custom domain ownership before activation
4. **Rate Limiting**: Prevent subdomain abuse

## Future Enhancements

1. **Custom Email**: `support@creatorname.screenmerch.com`
2. **Analytics Dashboard**: Creator-specific analytics
3. **Custom Checkout Pages**: Fully branded checkout experience
4. **Multi-language Support**: Per-creator language settings
5. **Custom Product Categories**: Creator-defined categories
