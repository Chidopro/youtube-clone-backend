import { supabase } from '../supabaseClient';

export class SubscriptionService {
  /**
   * Get current user's subscription
   * @returns {Promise<Object|null>} User subscription data
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

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Upsert user subscription
   * @param {string} tier - Subscription tier
   * @param {Object} additionalData - Additional subscription data
   * @returns {Promise<Object|null>} Updated subscription
   */
  static async upsertUserSubscription(tier, additionalData = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const subscriptionData = {
        user_id: user.id,
        tier: tier,
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
        console.error('Error upserting subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error upserting subscription:', error);
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
        name: 'Free',
        price: 'Free',
        features: [
          'Upload videos',
          'Basic analytics',
          'Standard features',
          'Community access'
        ],
        maxUploadSize: '100MB',
        maxVideoLength: '10 minutes'
      },
      pro: {
        name: 'Pro',
        price: '$9.99/month',
        trialDays: 7,
        features: [
          'Everything in Free',
          'Priority support',
          'Custom branding',
          'Enhanced upload limits',
          'Ad-free experience',
          'Early access to new features',
          'Monetization tools'
        ],
        maxUploadSize: '2GB',
        maxVideoLength: '60 minutes'
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
        current_period_end: null // Free tier doesn't expire
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
   * Subscribe user to pro tier with 7-day free trial
   * @returns {Promise<Object>} Operation result
   */
  static async subscribeToProTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Create Stripe checkout session with trial
      const response = await fetch('https://backend-hidden-firefly-7865.fly.dev/api/create-pro-checkout', {
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
   * Activate pro subscription after successful payment
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

      // Calculate trial end date (7 days from now)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const subscription = await this.upsertUserSubscription('pro', {
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        trial_end: trialEnd.toISOString()
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
   * Get user subscription with configuration
   * @returns {Promise<Object>} Subscription with tier config
   */
  static async getUserSubscriptionWithConfig() {
    try {
      const subscription = await this.getCurrentUserSubscription();
      if (!subscription) {
        return {
          subscription: null,
          config: this.getTierConfig('free')
        };
      }

      const config = this.getTierConfig(subscription.tier);
      
      return {
        subscription,
        config
      };
    } catch (error) {
      console.error('Error getting subscription with config:', error);
      return {
        subscription: null,
        config: this.getTierConfig('free')
      };
    }
  }

  /**
   * Check if user is in trial period
   * @returns {Promise<boolean>} Whether user is in trial
   */
  static async isInTrialPeriod() {
    try {
      const subscription = await this.getCurrentUserSubscription();
      if (!subscription || subscription.tier !== 'pro') return false;

      if (!subscription.trial_end) return false;

      const trialEnd = new Date(subscription.trial_end);
      const now = new Date();

      return now < trialEnd;
    } catch (error) {
      console.error('Error checking trial period:', error);
      return false;
    }
  }

  /**
   * Get days remaining in trial
   * @returns {Promise<number>} Days remaining in trial
   */
  static async getTrialDaysRemaining() {
    try {
      const subscription = await this.getCurrentUserSubscription();
      if (!subscription || subscription.tier !== 'pro') return 0;

      if (!subscription.trial_end) return 0;

      const trialEnd = new Date(subscription.trial_end);
      const now = new Date();
      const diffTime = trialEnd - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    } catch (error) {
      console.error('Error getting trial days remaining:', error);
      return 0;
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
  getUserSubscriptionWithConfig,
  isInTrialPeriod,
  getTrialDaysRemaining
} = SubscriptionService; 