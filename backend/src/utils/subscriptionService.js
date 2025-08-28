import { supabase } from '../supabaseClient.js';

export class SubscriptionService {
  /**
   * Get current user's subscription tier
   * @returns {Promise<Object|null>} Subscription data or null if not found
   */
  static async getCurrentUserSubscription() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCurrentUserSubscription:', error);
      return null;
    }
  }

  /**
   * Create or update user subscription tier
   * @param {string} tier - Tier name ('free', 'pro')
   * @param {Object} additionalData - Additional subscription data
   * @returns {Promise<Object|null>} Updated subscription or null on error
   */
  static async upsertUserSubscription(tier, additionalData = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const subscriptionData = {
        user_id: user.id,
        tier,
        status: 'active',
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert(subscriptionData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting user subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in upsertUserSubscription:', error);
      return null;
    }
  }

  /**
   * Get subscription tier details
   * @param {string} tier - Tier name
   * @returns {Object} Tier configuration
   */
  static getTierConfig(tier) {
    const tierConfigs = {
      free: {
        name: 'Free Trial',
        price: 'Free',
        serviceFee: 0.30, // 30%
        features: [
          'Upload videos',
          'Basic analytics',
          'Standard features',
          'Community access',
          '7-day free trial period'
        ],
        maxFriends: 0,
        revenueShare: 0,
        canInviteFriends: false,
        showFriendsSidebar: false
      },
      pro: {
        name: 'Pro Plan',
        price: '$49/month',
        serviceFee: 0.30, // 30%
        features: [
          'Everything in Free Trial',
          'Advanced analytics',
          'Priority support',
          'Custom branding',
          'Enhanced upload limits',
          'Advanced monetization tools'
        ],
        maxFriends: 0,
        revenueShare: 0,
        canInviteFriends: false,
        showFriendsSidebar: false
      }
    };

    return tierConfigs[tier] || tierConfigs.free;
  }

  /**
   * Subscribe user to free tier
   * @returns {Promise<Object>} Operation result
   */
  static async subscribeToFreeTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const subscription = await this.upsertUserSubscription('free', {
        current_period_start: new Date().toISOString(),
        // Free tier doesn't expire
        current_period_end: null
      });

      if (subscription) {
        return { 
          success: true, 
          subscription,
          tier: this.getTierConfig('free')
        };
      } else {
        return { success: false, error: 'Failed to create subscription' };
      }
    } catch (error) {
      console.error('Error subscribing to free tier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe user to pro tier with Stripe
   * @returns {Promise<Object>} Operation result
   */
  static async subscribeToProTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Create Stripe checkout session
      const response = await fetch('http://localhost:3002/api/create-pro-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.name || 'User',
          tier: 'pro'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
      
      return { success: true, redirecting: true };
    } catch (error) {
      console.error('Error subscribing to pro tier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle successful pro subscription
   * @param {string} stripeSubscriptionId - Stripe subscription ID
   * @param {string} stripeCustomerId - Stripe customer ID
   * @returns {Promise<Object>} Operation result
   */
  static async activateProSubscription(stripeSubscriptionId, stripeCustomerId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const subscription = await this.upsertUserSubscription('pro', {
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      });

      if (subscription) {
        return { 
          success: true, 
          subscription,
          tier: this.getTierConfig('pro')
        };
      } else {
        return { success: false, error: 'Failed to activate subscription' };
      }
    } catch (error) {
      console.error('Error activating pro subscription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has a specific tier or higher
   * @param {string} requiredTier - Required tier level
   * @returns {Promise<boolean>} Whether user meets tier requirement
   */
  static async hasMinimumTier(requiredTier) {
    try {
      const subscription = await this.getCurrentUserSubscription();
      if (!subscription) return false;

      const tierHierarchy = {
        free: 1,
        pro: 2
      };

      const userTierLevel = tierHierarchy[subscription.tier] || 0;
      const requiredTierLevel = tierHierarchy[requiredTier] || 0;

      return userTierLevel >= requiredTierLevel;
    } catch (error) {
      console.error('Error checking tier requirement:', error);
      return false;
    }
  }

  /**
   * Get user subscription with tier config
   * @returns {Promise<Object|null>} Combined subscription and tier data
   */
  static async getUserSubscriptionWithConfig() {
    try {
      const subscription = await this.getCurrentUserSubscription();
      if (!subscription) return null;

      const tierConfig = this.getTierConfig(subscription.tier);

      return {
        ...subscription,
        config: tierConfig
      };
    } catch (error) {
      console.error('Error getting subscription with config:', error);
      return null;
    }
  }
}

// Export individual functions for convenience
export const {
  getCurrentUserSubscription,
  upsertUserSubscription,
  getTierConfig,
  subscribeToFreeTier,
  subscribeToProTier,
  activateProSubscription,
  hasMinimumTier,
  getUserSubscriptionWithConfig
} = SubscriptionService; 