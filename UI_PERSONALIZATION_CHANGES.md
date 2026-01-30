# UI Changes with Creator Personalization

## Overview
This document shows how the ScreenMerch UI changes when a creator has personalization enabled and someone visits their subdomain (e.g., `john.screenmerch.com`).

---

## Current UI (Main Domain: screenmerch.com)

### Visual Appearance
- **Logo**: ScreenMerch logo (screenmerch_logo.png)
- **Primary Colors**: Purple gradient (`#667eea` → `#764ba2`)
- **Content**: Shows ALL creators' videos
- **Branding**: "ScreenMerch" visible throughout
- **Favicon**: Default ScreenMerch favicon
- **Page Title**: "ScreenMerch" or generic title

### Key Components

#### 1. Navbar
```
┌─────────────────────────────────────────────────────────┐
│ [ScreenMerch Logo]  [Search]  [Upload]  [Sign In]      │
└─────────────────────────────────────────────────────────┘
```
- White background
- ScreenMerch logo on left
- Standard navigation

#### 2. User Flow Section (Purple Bar)
```
┌─────────────────────────────────────────────────────────┐
│  [1] Choose Video  →  [2] Select Screenshot  →  [3] Make Merch │
└─────────────────────────────────────────────────────────┘
```
- **Background**: Purple gradient (`#667eea` → `#764ba2`)
- **Text**: White
- Shows all creators' content

#### 3. Video Feed
- Displays videos from ALL creators
- Mixed content from different channels
- Standard video grid layout

#### 4. Footer
- "Powered by ScreenMerch" visible
- Standard ScreenMerch branding

---

## Personalized UI (Creator Subdomain: creatorname.screenmerch.com)

### Visual Appearance
- **Logo**: Creator's custom logo (if set) OR ScreenMerch logo
- **Primary Colors**: Creator's custom colors (if set) OR default purple
- **Content**: Shows ONLY that creator's videos
- **Branding**: "Powered by ScreenMerch" can be hidden (if enabled)
- **Favicon**: Creator's custom favicon (if set)
- **Page Title**: Creator's custom meta title (if set)

### Key Component Changes

#### 1. Navbar - BEFORE vs AFTER

**BEFORE (Main Domain):**
```
┌─────────────────────────────────────────────────────────┐
│ [ScreenMerch Logo]  [Search]  [Upload]  [Sign In]      │
└─────────────────────────────────────────────────────────┘
```

**AFTER (Creator Subdomain):**
```
┌─────────────────────────────────────────────────────────┐
│ [Creator's Logo]  [Search]  [Upload]  [Sign In]         │
│                    (or ScreenMerch logo if not set)     │
└─────────────────────────────────────────────────────────┘
```

**Changes:**
- Logo swaps to creator's custom logo URL
- Colors can change if creator set custom primary color
- "Powered by ScreenMerch" text can be hidden (if `hide_screenmerch_branding = true`)

#### 2. User Flow Section - BEFORE vs AFTER

**BEFORE (Main Domain):**
```
┌─────────────────────────────────────────────────────────┐
│  [1] Choose Video  →  [2] Select Screenshot  →  [3] Make Merch │
│  Background: Purple gradient (#667eea → #764ba2)        │
└─────────────────────────────────────────────────────────┘
```

**AFTER (Creator Subdomain):**
```
┌─────────────────────────────────────────────────────────┐
│  [1] Choose Video  →  [2] Select Screenshot  →  [3] Make Merch │
│  Background: Creator's primary_color → secondary_color │
│  (e.g., #FF5733 → #C70039 if creator set red theme)     │
└─────────────────────────────────────────────────────────┘
```

**Changes:**
- Background gradient uses creator's `primary_color` and `secondary_color`
- If not set, defaults to purple gradient
- CSS variables update dynamically: `--primary-color` and `--secondary-color`

#### 3. Video Feed - BEFORE vs AFTER

**BEFORE (Main Domain):**
```
┌─────────────────────────────────────────────────────────┐
│  Video Grid:                                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│  │ Vid │ │ Vid │ │ Vid │ │ Vid │                       │
│  │  A  │ │  B  │ │  C  │ │  D  │                       │
│  └─────┘ └─────┘ └─────┘ └─────┘                       │
│  (Videos from Creator A, B, C, D, etc.)                │
└─────────────────────────────────────────────────────────┘
```

**AFTER (Creator Subdomain):**
```
┌─────────────────────────────────────────────────────────┐
│  Video Grid:                                            │
│  ┌─────┐ ┌─────┐ ┌─────┐                               │
│  │ Vid │ │ Vid │ │ Vid │                               │
│  │  A  │ │  A  │ │  A  │                               │
│  └─────┘ └─────┘ └─────┘                               │
│  (ONLY Creator A's videos - filtered by user_id)      │
└─────────────────────────────────────────────────────────┘
```

**Changes:**
- **Content Filtering**: Only shows videos where `videos2.user_id = currentCreator.id`
- Same grid layout, but only one creator's content
- If creator has no videos, shows empty state

#### 4. Footer - BEFORE vs AFTER

**BEFORE (Main Domain):**
```
┌─────────────────────────────────────────────────────────┐
│  Footer Links | Powered by ScreenMerch                 │
└─────────────────────────────────────────────────────────┘
```

**AFTER (Creator Subdomain):**
```
┌─────────────────────────────────────────────────────────┐
│  Footer Links | (Powered by ScreenMerch - HIDDEN if    │
│                 hide_screenmerch_branding = true)       │
└─────────────────────────────────────────────────────────┘
```

**Changes:**
- "Powered by ScreenMerch" text conditionally hidden
- Footer links remain the same

#### 5. Browser Tab - BEFORE vs AFTER

**BEFORE (Main Domain):**
```
┌─────────────────────┐
│ [📦] ScreenMerch    │  ← Tab title and favicon
└─────────────────────┘
```

**AFTER (Creator Subdomain):**
```
┌─────────────────────┐
│ [🎨] John's Merch   │  ← Custom title and favicon
└─────────────────────┘
```

**Changes:**
- **Favicon**: Updates to `custom_favicon_url` if set
- **Page Title**: Updates to `custom_meta_title` if set (e.g., "John's Merchandise")
- **Meta Description**: Updates to `custom_meta_description` for SEO

---

## Detailed Component Changes

### 1. Navbar Component

**Current Code:**
```jsx
<img src={logo} alt="ScreenMerch" />
```

**With Personalization:**
```jsx
{creatorSettings?.custom_logo_url ? (
  <img src={creatorSettings.custom_logo_url} alt={currentCreator?.display_name} />
) : (
  <img src={logo} alt="ScreenMerch" />
)}
```

**Visual Result:**
- If creator uploaded logo → Shows creator logo
- If not set → Shows ScreenMerch logo (backward compatible)

### 2. Color Scheme

**Current CSS:**
```css
.user-flow-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**With Personalization:**
```css
.user-flow-section {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
}
```

**Dynamic CSS Variables (set by CreatorContext):**
```javascript
// If creator set primary_color = #FF5733 and secondary_color = #C70039
document.documentElement.style.setProperty('--primary-color', '#FF5733');
document.documentElement.style.setProperty('--secondary-color', '#C70039');
```

**Visual Result:**
- Purple gradient → Creator's color gradient
- All components using these CSS variables update automatically

### 3. Home Page Content

**Current Code:**
```javascript
let query = supabase
  .from('videos2')
  .select('*')
  .order('created_at', { ascending: false });
```

**With Personalization:**
```javascript
let query = supabase
  .from('videos2')
  .select('*')
  .order('created_at', { ascending: false});

// If on creator's subdomain, filter by creator
if (currentCreator) {
  query = query.eq('user_id', currentCreator.id);
}
```

**Visual Result:**
- Main domain: Shows all videos (unchanged)
- Creator subdomain: Shows only that creator's videos

### 4. Step Indicators (Purple Bar Numbers)

**Current:**
- Step numbers use purple gradient background
- Standard pulsing animation

**With Personalization:**
- Step numbers use creator's `primary_color` for background
- Same animation, but with creator's colors

**Example:**
- If creator set `primary_color = #FF0000` (red)
- Step numbers would have red background instead of purple

### 5. Buttons and Interactive Elements

**Current:**
- Buttons use purple gradient (`#667eea` → `#764ba2`)
- Hover effects use purple shades

**With Personalization:**
- Buttons use creator's `primary_color` and `secondary_color`
- Hover effects use darker shades of creator's colors

**Example:**
```css
/* Current */
.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

/* With Personalization */
.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}
```

---

## Real-World Example

### Scenario: Creator "John" enables personalization

**John's Settings:**
- `subdomain`: "john"
- `custom_logo_url`: "https://john.com/logo.png"
- `primary_color`: "#FF5733" (red-orange)
- `secondary_color`: "#C70039" (dark red)
- `hide_screenmerch_branding`: true
- `custom_meta_title`: "John's Merchandise Store"
- `custom_favicon_url`: "https://john.com/favicon.ico"

### When visiting `john.screenmerch.com`:

1. **Navbar**: Shows John's logo instead of ScreenMerch logo
2. **Purple Bar**: Red-orange gradient instead of purple
3. **Video Feed**: Only John's videos (filtered)
4. **Footer**: No "Powered by ScreenMerch" text
5. **Browser Tab**: "John's Merchandise Store" title with John's favicon
6. **All Buttons**: Red-orange theme instead of purple

### When visiting `screenmerch.com` (main domain):

- Everything stays the same (unchanged)
- Shows all creators' videos
- Standard purple theme
- ScreenMerch branding visible

---

## Backward Compatibility

### What Stays the Same:
- ✅ All existing routes work (`/video/:id`, `/upload`, etc.)
- ✅ Main domain (`screenmerch.com`) unchanged
- ✅ If creator doesn't set custom values, defaults are used
- ✅ All functionality remains the same

### What Changes:
- 🎨 Visual appearance on creator subdomains
- 📝 Content filtering on creator subdomains
- 🏷️ Meta tags and favicon (if set)

---

## Implementation Notes

### CSS Variables Approach
Using CSS variables allows dynamic color changes without modifying individual component styles:

```css
:root {
  --primary-color: #667eea;    /* Default */
  --secondary-color: #764ba2;  /* Default */
}

/* All components use these variables */
.user-flow-section {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}

.btn-primary {
  background: var(--primary-color);
}
```

### Conditional Rendering
Components check for `currentCreator` and `creatorSettings`:

```jsx
const { currentCreator, creatorSettings } = useCreator();

// Only filter if on creator's subdomain
if (currentCreator) {
  // Show only creator's content
}

// Only show custom logo if set
{creatorSettings?.custom_logo_url ? (
  <img src={creatorSettings.custom_logo_url} />
) : (
  <img src={defaultLogo} />
)}
```

---

## Summary of UI Changes

| Component | Main Domain | Creator Subdomain |
|-----------|-------------|-------------------|
| **Logo** | ScreenMerch logo | Creator's logo (if set) |
| **Colors** | Purple gradient | Creator's colors (if set) |
| **Content** | All creators' videos | Only creator's videos |
| **Branding** | "Powered by ScreenMerch" visible | Can be hidden |
| **Favicon** | Default ScreenMerch | Creator's favicon (if set) |
| **Page Title** | "ScreenMerch" | Creator's custom title (if set) |
| **Meta Description** | Default | Creator's custom description (if set) |

---

## User Experience Flow

### For Visitors:
1. Visit `john.screenmerch.com`
2. See John's branded app with only John's content
3. Experience feels like John's own merchandise store
4. Can still access main domain for all creators' content

### For Creators:
1. Enable personalization in dashboard
2. Set subdomain, colors, logo, etc.
3. Share their subdomain with fans
4. Fans see only their content in branded experience

---

## Technical Implementation

The changes are **non-breaking** and **backward compatible**:
- Main domain works exactly as before
- Creator subdomains get personalized experience
- If personalization not enabled, defaults are used
- All existing functionality preserved
