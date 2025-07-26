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
      const subscriptionData = await SubscriptionService.getCurrentUserSubscription();
      setSubscription(subscriptionData);
      setError(null);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const subscribeToFree = async () => {
    try {
      const result = await SubscriptionService.subscribeToFreeTier();
      if (result.success) {
        setSubscription(result.subscription);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error subscribing to free tier:', err);
      throw err;
    }
  };

  const subscribeToPro = async () => {
    try {
      const result = await SubscriptionService.subscribeToProTier();
      if (result.success) {
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error subscribing to pro tier:', err);
      throw err;
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
    if (!subscription) return false;
    
    const featureMap = {
      'priority_support': subscription.tier === 'pro',
      'custom_branding': subscription.tier === 'pro',
      'enhanced_uploads': subscription.tier === 'pro',
      'ad_free': subscription.tier === 'pro',
      'early_access': subscription.tier === 'pro',
      'monetization_tools': subscription.tier === 'pro',
      'basic_uploads': subscription.tier === 'free' || subscription.tier === 'pro',
      'basic_analytics': subscription.tier === 'free' || subscription.tier === 'pro',
    };

    return featureMap[feature] || false;
  };

  const isInTrialPeriod = async () => {
    try {
      return await SubscriptionService.isInTrialPeriod();
    } catch (err) {
      console.error('Error checking trial period:', err);
      return false;
    }
  };

  const getTrialDaysRemaining = async () => {
    try {
      return await SubscriptionService.getTrialDaysRemaining();
    } catch (err) {
      console.error('Error getting trial days remaining:', err);
      return 0;
    }
  };

  return {
    subscription,
    loading,
    error,
    subscribeToFree,
    subscribeToPro,
    hasMinimumTier,
    getTierConfig,
    isCurrentTier,
    canAccessFeature,
    isInTrialPeriod,
    getTrialDaysRemaining,
    refetch: fetchSubscription
  };
}; 