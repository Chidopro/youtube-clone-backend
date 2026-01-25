import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getSubdomain, getCreatorFromSubdomain } from '../../utils/subdomainService';
import './ColorPickerModal.css';

// Using backend API to bypass RLS for color persistence

const ColorPickerModal = ({ isOpen, onClose, currentPrimaryColor, currentSecondaryColor, onSave }) => {
  const [primaryColor, setPrimaryColor] = useState(currentPrimaryColor || '#667eea');
  const [secondaryColor, setSecondaryColor] = useState(currentSecondaryColor || '#764ba2');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPrimaryColor(currentPrimaryColor || '#667eea');
      setSecondaryColor(currentSecondaryColor || '#764ba2');
      setMessage('');
      setMessageType('');
    }
  }, [isOpen, currentPrimaryColor, currentSecondaryColor]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setMessageType('');

    try {
      // Validate color format
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!colorRegex.test(primaryColor)) {
        setMessage('Primary color must be a valid hex color (e.g., #FF5733)');
        setMessageType('error');
        setSaving(false);
        return;
      }
      if (!colorRegex.test(secondaryColor)) {
        setMessage('Secondary color must be a valid hex color (e.g., #C70039)');
        setMessageType('error');
        setSaving(false);
        return;
      }

      // Get current subdomain and user
      const currentSubdomain = getSubdomain();
      if (!currentSubdomain) {
        setMessage('Error: Could not detect subdomain');
        setMessageType('error');
        setSaving(false);
        return;
      }

      // Get creator for this subdomain
      const creator = await getCreatorFromSubdomain(currentSubdomain);
      if (!creator || !creator.id) {
        setMessage('Error: Could not find subdomain owner');
        setMessageType('error');
        setSaving(false);
        return;
      }

      // Verify logged-in user owns this subdomain
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

      if (!loggedInUserId || loggedInUserId !== creator.id) {
        setMessage('You can only edit colors for your own subdomain. Please log in as the owner.');
        setMessageType('error');
        setSaving(false);
        return;
      }

      // Save to database via backend API (bypasses RLS)
      const BACKEND_URL = 
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
        "https://screenmerch.fly.dev";

      const updateData = {
        primary_color: primaryColor,
        secondary_color: secondaryColor
      };

      console.log('💾 [COLOR-PICKER] Saving colors via backend API:', { userId: creator.id, colors: updateData });

      const response = await fetch(`${BACKEND_URL}/api/users/${creator.id}/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('❌ [COLOR-PICKER] Error saving colors:', result.error || 'Unknown error');
        setMessage(`Error: ${result.error || 'Failed to save colors'}`);
        setMessageType('error');
      } else {
        console.log('✅ [COLOR-PICKER] Colors saved successfully via backend API:', result.user);
        
        // Apply colors immediately via inline styles with !important
        const progressBar = document.querySelector('.user-flow-section');
        if (progressBar) {
          // Use setProperty with !important flag
          progressBar.style.setProperty('background', `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`, 'important');
          // Also set as regular style property as fallback
          progressBar.style.background = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
        }

        // Also update CSS variables for other elements
        document.documentElement.style.setProperty('--primary-color', primaryColor);
        document.documentElement.style.setProperty('--secondary-color', secondaryColor);

        // Trigger CreatorContext refresh
        window.dispatchEvent(new CustomEvent('creatorSettingsUpdated'));

        setMessage('✅ Colors saved successfully!');
        setMessageType('success');

        // Call onSave callback if provided
        if (onSave) {
          onSave(primaryColor, secondaryColor);
        }

        // Close modal after a brief delay
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error) {
      console.error('Error saving colors:', error);
      setMessage(`Error: ${error.message || 'Unknown error'}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="color-picker-modal-overlay" onClick={onClose}>
      <div className="color-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="color-picker-modal-header">
          <h3>Edit Progress Bar Colors</h3>
          <button className="color-picker-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="color-picker-modal-content">
          <div className="color-picker-group">
            <label className="color-picker-label">Primary Color</label>
            <div className="color-picker-input-group">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="color-picker-input"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#667eea"
                className="color-picker-text-input"
              />
            </div>
          </div>

          <div className="color-picker-group">
            <label className="color-picker-label">Secondary Color</label>
            <div className="color-picker-input-group">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="color-picker-input"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#764ba2"
                className="color-picker-text-input"
              />
            </div>
          </div>

          {message && (
            <div className={`color-picker-message ${messageType}`}>
              {message}
            </div>
          )}

          <div className="color-picker-preview">
            <div 
              className="color-picker-preview-bar"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
              }}
            >
              <span>Preview</span>
            </div>
          </div>
        </div>

        <div className="color-picker-modal-footer">
          <button 
            className="color-picker-cancel-btn" 
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            className="color-picker-save-btn" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Colors'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorPickerModal;
