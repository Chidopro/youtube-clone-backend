import { supabase } from '../supabaseClient';

export class SubscriptionService {
  /**
   * Get current user's subscription
   * @returns {Promise<Object>} Subscription data
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
        throw error;
      }

      return data || { tier: 'free', status: 'active' };
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return { tier: 'free', status: 'active' };
    }
  }

  /**
   * Subscribe to free tier
   * @returns {Promise<Object>} Result
   */
  static async subscribeToFreeTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          tier: 'free',
          status: 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        subscription: data
      };
    } catch (error) {
      console.error('Error subscribing to free tier:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subscribe to pro tier (starts 7-day trial)
   * @returns {Promise<Object>} Result
   */
  static async subscribeToProTier() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create Stripe checkout session for Pro tier with 7-day trial
      const response = await fetch('https://copy5-backend.fly.dev/api/create-pro-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id || null, // Allow null for guest checkout
          tier: 'pro',
          email: user?.email || null
        })
      });

      const result = await response.json();

      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
        return {
          success: true,
          redirecting: true
        };
      } else {
        throw new Error(result.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error subscribing to pro tier:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if user has minimum tier requirement
   * @param {string} requiredTier - Required tier
   * @returns {Promise<boolean>} Has minimum tier
   */
  static async hasMinimumTier(requiredTier) {
    try {
      const subscription = await this.getCurrentUserSubscription();
      
      const tierHierarchy = {
        'free': 0,
        'pro': 1
      };

      const userTierLevel = tierHierarchy[subscription?.tier || 'free'];
      const requiredTierLevel = tierHierarchy[requiredTier];

      return userTierLevel >= requiredTierLevel;
    } catch (error) {
      console.error('Error checking tier requirement:', error);
      return false;
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
          'Upload videos (up to 100MB, 10 minutes)',
          'Basic analytics',
          'Standard features',
          'Community access',
          'Grab screenshots',
          'Preview merch',
          'Buy merchandise',
          '7-day free trial period'
        ],
        maxUploadSize: '100MB',
        maxVideoLength: '10 minutes'
      },
      pro: {
        name: 'Pro Plan',
        price: '$49/month',
        serviceFee: 0.30, // 30%
        trialDays: 7,
        features: [
          'Everything in Free Trial',
          'Priority support',
          'Custom branding',
          'Enhanced upload limits (2GB, 60 minutes)',
          'Ad-free experience',
          'Early access to new features',
          'Monetization tools',
          'Revenue tracking',
          'Custom channel colors',
          'Branded merchandise',
          'Advanced analytics'
        ],
        maxUploadSize: '2GB',
        maxVideoLength: '60 minutes'
      }
    };

    return tierConfigs[tier] || tierConfigs.free;
  }

  /**
   * Check if user is in trial period
   * @returns {Promise<boolean>} Is in trial
   */
  static async isInTrialPeriod() {
    try {
      const subscription = await this.getCurrentUserSubscription();
      
      if (!subscription || subscription.tier !== 'pro') {
        return false;
      }

      if (!subscription.trial_end) {
        return false;
      }

      const trialEnd = new Date(subscription.trial_end);
      const now = new Date();

      return now < trialEnd;
    } catch (error) {
      console.error('Error checking trial period:', error);
      return false;
    }
  }

  /**
   * Get remaining trial days
   * @returns {Promise<number>} Days remaining
   */
  static async getTrialDaysRemaining() {
    try {
      const subscription = await this.getCurrentUserSubscription();
      
      if (!subscription || subscription.tier !== 'pro' || !subscription.trial_end) {
        return 0;
      }

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

  /**
   * Activate pro subscription after payment verification
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object>} Result
   */
  static async activateProSubscription(subscriptionId, customerId) {
    try {
      // Use the same auth system as login (check localStorage instead of Supabase)
      const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
      const userEmail = localStorage.getItem('user_email');
      
      if (!isAuthenticated || !userEmail) {
        throw new Error('User not authenticated');
      }

      // For now, we'll use the email as the user ID since we don't have a proper user ID
      // In a real system, you'd want to get the user ID from the backend
      const userId = userEmail; // Using email as temporary user ID

      // Calculate trial end date (7 days from now)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          tier: 'pro',
          status: 'active',
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          trial_end: trialEnd.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Send welcome email
      try {
        await this.sendWelcomeEmail(userEmail);
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the subscription activation if email fails
      }

      return {
        success: true,
        subscription: data
      };
    } catch (error) {
      console.error('Error activating pro subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send welcome email to new subscribers
   * @param {string} email - User email
   * @returns {Promise<Object>} Result
   */
  static async sendWelcomeEmail(email) {
    try {
      const response = await fetch('https://copy5-backend.fly.dev/api/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }
} 