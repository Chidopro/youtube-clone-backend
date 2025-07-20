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
   * @param {string} tier - Tier name ('basic', 'premium', 'creator_network')
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
      basic: {
        name: 'Basic Tier',
        price: 'Free',
        features: [
          'Upload videos',
          'Basic analytics',
          'Standard features',
          'Community access'
        ],
        maxFriends: 0,
        revenueShare: 0,
        canInviteFriends: false,
        showFriendsSidebar: false
      },
      premium: {
        name: 'Premium Tier',
        price: '$9.99/month',
        features: [
          'Everything in Basic',
          'Advanced analytics',
          'Priority support',
          'Custom branding',
          'Enhanced upload limits'
        ],
        maxFriends: 0,
        revenueShare: 0,
        canInviteFriends: false,
        showFriendsSidebar: false
      },
      creator_network: {
        name: 'Creator Network Tier',
        price: '$29.99/month',
        features: [
          'Everything in Premium',
          'Invite friends to create content',
          'Friends list sidebar',
          'Revenue sharing (15%)',
          'Advanced creator tools',
          'Network analytics',
          'Up to 50 friends'
        ],
        maxFriends: 50,
        revenueShare: 0.15,
        canInviteFriends: true,
        showFriendsSidebar: true
      }
    };

    return tierConfigs[tier] || tierConfigs.basic;
  }

  /**
   * Subscribe user to basic (free) tier
   * @returns {Promise<Object>} Operation result
   */
  static async subscribeToBasicTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const subscription = await this.upsertUserSubscription('basic', {
        current_period_start: new Date().toISOString(),
        // Basic tier doesn't expire
        current_period_end: null
      });

      if (subscription) {
        return { 
          success: true, 
          subscription,
          tier: this.getTierConfig('basic')
        };
      } else {
        return { success: false, error: 'Failed to create subscription' };
      }
    } catch (error) {
      console.error('Error subscribing to basic tier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe user to premium tier with Stripe
   * @returns {Promise<Object>} Operation result
   */
  static async subscribeToPremiumTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Create Stripe checkout session
      const response = await fetch('http://localhost:3002/api/create-premium-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.name || 'User',
          tier: 'premium'
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
      console.error('Error subscribing to premium tier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe user to creator network tier with Stripe
   * @returns {Promise<Object>} Operation result
   */
  static async subscribeToCreatorNetworkTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Create Stripe checkout session for Creator Network
      const response = await fetch('http://localhost:3002/api/create-creator-network-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.name || 'User',
          tier: 'creator_network'
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
      console.error('Error subscribing to creator network tier:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle successful premium subscription
   * @param {string} stripeSubscriptionId - Stripe subscription ID
   * @param {string} stripeCustomerId - Stripe customer ID
   * @returns {Promise<Object>} Operation result
   */
  static async activatePremiumSubscription(stripeSubscriptionId, stripeCustomerId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const subscription = await this.upsertUserSubscription('premium', {
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      });

      if (subscription) {
        return { 
          success: true, 
          subscription,
          tier: this.getTierConfig('premium')
        };
      } else {
        return { success: false, error: 'Failed to activate subscription' };
      }
    } catch (error) {
      console.error('Error activating premium subscription:', error);
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
        basic: 1,
        premium: 2,
        creator_network: 3
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
  subscribeToBasicTier,
  subscribeToPremiumTier,
  subscribeToCreatorNetworkTier,
  activatePremiumSubscription,
  hasMinimumTier,
  getUserSubscriptionWithConfig
} = SubscriptionService; 