import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { SubscriptionService } from '../utils/subscriptionService';

export const useSubscription = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(null);
        return;
      }

      const subscriptionData = await SubscriptionService.getCurrentUserSubscription();
      setSubscription(subscriptionData);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();

    // Listen for auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const subscribeToBasic = async () => {
    try {
      setError(null);
      const result = await SubscriptionService.subscribeToFreeTier();
      
      if (result.success) {
        await fetchSubscription(); // Refresh subscription data
        return { success: true, subscription: result.subscription };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error subscribing to basic tier:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const hasMinimumTier = async (requiredTier) => {
    try {
      return await SubscriptionService.hasMinimumTier(requiredTier);
    } catch (err) {
      console.error('Error checking tier requirement:', err);
      return false;
    }
  };

  const getTierConfig = (tier) => {
    return SubscriptionService.getTierConfig(tier);
  };

  const isCurrentTier = (tierName) => {
    return subscription?.tier === tierName;
  };

  const canAccessFeature = (feature) => {
    if (!subscription?.config) return false;
    
    const featureMap = {
      'revenue_sharing': subscription.config.revenueShare > 0,
      'advanced_analytics': subscription.tier !== 'basic',
      'priority_support': subscription.tier === 'premium' || subscription.tier === 'creator_network',
      'custom_branding': subscription.tier === 'premium' || subscription.tier === 'creator_network',
    };

    return featureMap[feature] || false;
  };

  return {
    subscription,
    loading,
    error,
    subscribeToBasic,
    hasMinimumTier,
    getTierConfig,
    isCurrentTier,
    canAccessFeature,
    refetch: fetchSubscription
  };
}; 