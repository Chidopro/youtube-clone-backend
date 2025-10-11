import { supabase } from '../supabaseClient';

export class PaymentService {
  /**
   * Get creator's earnings and payout information
   * @returns {Promise<Object>} Earnings data
   */
  static async getCreatorEarnings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's earnings data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          total_earnings,
          pending_payout,
          payout_enabled,
          paypal_email,
          last_payout_date,
          payout_threshold
        `)
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Get recent earnings
      const { data: earnings, error: earningsError } = await supabase
        .from('creator_earnings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (earningsError) throw earningsError;

      // Get recent payouts
      const { data: payouts, error: payoutsError } = await supabase
        .from('payouts')
        .select('*')
        .eq('user_id', user.id)
        .order('payout_date', { ascending: false })
        .limit(5);

      if (payoutsError) throw payoutsError;

      return {
        success: true,
        data: {
          user: userData,
          recentEarnings: earnings || [],
          recentPayouts: payouts || []
        }
      };
    } catch (error) {
      console.error('Error getting creator earnings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update PayPal email for payouts
   * @param {string} paypalEmail - PayPal Business email
   * @returns {Promise<Object>} Result
   */
  static async updatePaypalEmail(paypalEmail) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(paypalEmail)) {
        throw new Error('Please enter a valid PayPal email address');
      }

      const { error } = await supabase
        .from('users')
        .update({
          paypal_email: paypalEmail,
          payout_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      return {
        success: true,
        message: 'PayPal email updated successfully'
      };
    } catch (error) {
      console.error('Error updating PayPal email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update tax information
   * @param {string} taxId - Tax ID or SSN
   * @returns {Promise<Object>} Result
   */
  static async updateTaxInfo(taxId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('users')
        .update({
          tax_id: taxId,
          tax_info_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      return {
        success: true,
        message: 'Tax information updated successfully'
      };
    } catch (error) {
      console.error('Error updating tax info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get payout schedule information
   * @returns {Object} Payout schedule
   */
  static getPayoutSchedule() {
    return {
      frequency: 'monthly',
      day: 1, // 1st of month
      minimumAmount: 50.00,
      processingDays: 3,
      fees: {
        paypal: 0.029, // 2.9%
        platform: 0.30 // $0.30
      }
    };
  }

  /**
   * Calculate next payout date
   * @returns {Date} Next payout date
   */
  static getNextPayoutDate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  /**
   * Check if creator is eligible for payout
   * @param {number} pendingAmount - Pending payout amount
   * @returns {boolean} Is eligible
   */
  static isEligibleForPayout(pendingAmount) {
    const schedule = this.getPayoutSchedule();
    return pendingAmount >= schedule.minimumAmount;
  }

  /**
   * Format currency for display
   * @param {number} amount - Amount to format
   * @returns {string} Formatted amount
   */
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Get earnings summary for dashboard
   * @returns {Promise<Object>} Earnings summary
   */
  static async getEarningsSummary() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get current month earnings
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyEarnings, error: monthlyError } = await supabase
        .from('creator_earnings')
        .select('creator_share')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (monthlyError) throw monthlyError;

      const monthlyTotal = monthlyEarnings.reduce((sum, earning) => sum + earning.creator_share, 0);

      // Get user's total data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('total_earnings, pending_payout, payout_enabled')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      return {
        success: true,
        data: {
          monthlyEarnings: monthlyTotal,
          totalEarnings: userData.total_earnings || 0,
          pendingPayout: userData.pending_payout || 0,
          payoutEnabled: userData.payout_enabled || false,
          nextPayoutDate: this.getNextPayoutDate(),
          isEligible: this.isEligibleForPayout(userData.pending_payout || 0)
        }
      };
    } catch (error) {
      console.error('Error getting earnings summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
