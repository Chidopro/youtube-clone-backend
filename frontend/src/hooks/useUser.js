import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { UserService } from '../utils/userService.js';

export const useUser = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId) => {
    try {
      setLoading(true);
      const profileData = await UserService.getCurrentUserProfile();
      setProfile(profileData);
      setError(null);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    try {
      setLoading(true);
      const updatedProfile = await UserService.updateUserProfile(updates);
      if (updatedProfile) {
        setProfile(updatedProfile);
        setError(null);
        return { success: true, data: updatedProfile };
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload profile image
  const uploadProfileImage = useCallback(async (file) => {
    try {
      setLoading(true);
      const imageUrl = await UserService.uploadProfileImage(file);
      if (imageUrl) {
        // Update profile with new image URL
        const updatedProfile = await UserService.updateUserProfile({
          profile_image_url: imageUrl
        });
        if (updatedProfile) {
          setProfile(updatedProfile);
          setError(null);
          return { success: true, data: updatedProfile };
        }
      }
      throw new Error('Failed to upload image');
    } catch (err) {
      console.error('Error uploading profile image:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete profile image
  const deleteProfileImage = useCallback(async (imageUrl) => {
    try {
      setLoading(true);
      const success = await UserService.deleteProfileImage(imageUrl);
      if (success) {
        // Update profile to remove image URL
        const updatedProfile = await UserService.updateUserProfile({
          profile_image_url: null
        });
        if (updatedProfile) {
          setProfile(updatedProfile);
          setError(null);
          return { success: true, data: updatedProfile };
        }
      }
      throw new Error('Failed to delete image');
    } catch (err) {
      console.error('Error deleting profile image:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setError(null);
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err.message);
    }
  }, []);

  // Initialize user state
  useEffect(() => {
    // Get initial user
    const getInitialUser = async () => {
      try {
        const { data: { user: initialUser } } = await supabase.auth.getUser();
        setUser(initialUser);
        
        if (initialUser) {
          await fetchProfile(initialUser.id);
        }
      } catch (err) {
        console.error('Error getting initial user:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    getInitialUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setError(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return {
    user,
    profile,
    loading,
    error,
    updateProfile,
    uploadProfileImage,
    deleteProfileImage,
    signOut,
    refetchProfile: () => user && fetchProfile(user.id)
  };
}; 