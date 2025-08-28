import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';

const SubscriptionTiers = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Hypothetical but realistic high-potential earnings data
    const hypotheticalData = {
        totalRevenue: 42000, // $42,000 annual revenue (based on $3,500 monthly)
        monthlyRevenue: 3500, // $3,500 average monthly sales
        totalSales: 2100, // 2,100 total products sold (175 monthly × 12)
        monthlySales: 175 // 175 average monthly sales
    };

    // Calculate earnings for each tier
    const calculateEarnings = (revenue, serviceFee, monthlyCost = 0) => {
        const annualSubscriptionCost = monthlyCost * 12;
        const grossEarnings = revenue * (1 - serviceFee);
        const netEarnings = grossEarnings - annualSubscriptionCost;
        return {
            grossEarnings: Math.round(grossEarnings),
            netEarnings: Math.round(netEarnings),
            annualSubscriptionCost
        };
    };

    const freeTierEarnings = calculateEarnings(hypotheticalData.totalRevenue, 0.30, 0);
    const proTierEarnings = calculateEarnings(hypotheticalData.totalRevenue, 0.30, 49);

    const [currentUser, setCurrentUser] = useState(null);
    const [userSubscription, setUserSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setCurrentUser(user);

                if (user) {
                    const subscription = await SubscriptionService.getCurrentUserSubscription();
                    setUserSubscription(subscription);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const handleFreeTierSignup = async () => {
        setActionLoading(true);
        setMessage('');

        try {
            if (!currentUser) {
                navigate('/signup', { 
                    state: { 
                        from: location.pathname,
                        message: 'Sign up to get started with ScreenMerch!' 
                    } 
                });
                return;
            }

            const result = await SubscriptionService.subscribeToFreeTier();
            
            if (result.success) {
                setUserSubscription(result.subscription);
                setMessage('Welcome to ScreenMerch! You now have access to all free features.');
                
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            } else {
                setMessage(result.error || 'Failed to activate free tier. Please try again.');
            }
        } catch (error) {
            console.error('Error subscribing to free tier:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleProTier = async () => {
        setActionLoading(true);
        setMessage('');

        try {
            const result = await SubscriptionService.subscribeToProTier();
            
            if (result.success) {
                if (result.redirecting) {
                    setMessage('Redirecting to Stripe checkout... You will be charged $49/month after your 7-day free trial ends.');
                } else {
                    setUserSubscription(result.subscription);
                    setMessage('Welcome to Pro! Your 7-day free trial is now active.');
                    
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 2000);
                }
            } else {
                setMessage(result.error || 'Failed to start trial. Please try again.');
            }
        } catch (error) {
            console.error('Error subscribing to pro tier:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTierAction = (tierId) => {
        switch (tierId) {
            case 'free':
                handleFreeTierSignup();
                break;
            case 'pro':
                handleProTier();
                break;
            default:
                setMessage('Invalid tier selection.');
        }
    };

    if (loading) {
        return (
            <div className="subscription-tiers">
                <div className="loading">Loading subscription options...</div>
            </div>
        );
    }

    return (
        <div className="subscription-tiers">
            <div className="tiers-header">
                <h1>💰 Creator Earnings Calculator</h1>
                <p>See how much you could earn with ScreenMerch's simple 2-tier system</p>
            </div>

            {message && (
                <div className={`message ${message.includes('error') || message.includes('Failed') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {/* Example Performance Metrics */}
            <div className="performance-metrics">
                <div className="metrics-header">
                    <h3>📊 Example Creator Performance</h3>
                    <p>Based on successful creators with engaged audiences</p>
                </div>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-value">${hypotheticalData.totalRevenue.toLocaleString()}</div>
                        <div className="metric-label">Total Revenue</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${hypotheticalData.monthlyRevenue.toLocaleString()}</div>
                        <div className="metric-label">Monthly Revenue</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{hypotheticalData.totalSales.toLocaleString()}</div>
                        <div className="metric-label">Products Sold</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{hypotheticalData.monthlySales}</div>
                        <div className="metric-label">Monthly Sales</div>
                    </div>
                </div>
            </div>

            {/* Tier Comparison Calculator */}
            <div className="tier-calculator-section">
                <div className="calculator-header">
                    <h4>💎 Simple 2-Tier System</h4>
                    <p>Start free for 7 days, then upgrade to Pro for maximum earnings</p>
                </div>
                
                <div className="tier-comparison-grid">
                    {/* Free Trial Tier (30% fee) */}
                    <div className="tier-card current">
                        <div className="tier-header">
                            <h5>Free Trial</h5>
                            <span className="tier-fee">30% Service Fee</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${freeTierEarnings.grossEarnings.toLocaleString()}</span>
                            <span className="revenue-label">You Keep (Gross)</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">Free</span>
                            <span className="cost-label">7-Day Trial</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">${freeTierEarnings.netEarnings.toLocaleString()}</span>
                            <span className="savings-label">Net Annual Earnings</span>
                        </div>
                    </div>

                    {/* Pro Tier (30% fee, $49/month) */}
                    <div className="tier-card upgrade">
                        <div className="tier-header">
                            <h5>Pro Tier</h5>
                            <span className="tier-fee">30% Service Fee</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${proTierEarnings.grossEarnings.toLocaleString()}</span>
                            <span className="revenue-label">You Keep (Gross)</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">$49/month</span>
                            <span className="cost-label">Monthly Cost</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">${proTierEarnings.netEarnings.toLocaleString()}</span>
                            <span className="savings-label">Net Annual Earnings</span>
                        </div>
                    </div>
                </div>

                <div className="calculator-footer">
                    <button 
                        className="upgrade-btn"
                        onClick={() => handleProTier()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : '🚀 Start 7-Day Free Trial'}
                    </button>
                    <p className="trial-notice">
                        <strong>7-Day Free Trial</strong> • Auto-converts to Pro • Cancel anytime
                    </p>
                </div>

                {/* Calculation Breakdown */}
                <div className="calculation-breakdown">
                    <h5>📊 How We Calculate Your Earnings</h5>
                    <div className="breakdown-grid">
                        <div className="breakdown-item">
                            <strong>Total Revenue:</strong> ${hypotheticalData.totalRevenue.toLocaleString()}
                        </div>
                        <div className="breakdown-item">
                            <strong>Service Fee (30%):</strong> ${(hypotheticalData.totalRevenue * 0.30).toLocaleString()}
                        </div>
                        <div className="breakdown-item">
                            <strong>Gross Earnings:</strong> ${freeTierEarnings.grossEarnings.toLocaleString()}
                        </div>
                        <div className="breakdown-item">
                            <strong>Pro Tier Cost:</strong> ${proTierEarnings.annualSubscriptionCost.toLocaleString()}/year
                        </div>
                        <div className="breakdown-item highlight">
                            <strong>Net Earnings (Pro):</strong> ${proTierEarnings.netEarnings.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Value Proposition */}
            <div className="value-proposition">
                <h3>🎯 Why Choose Pro?</h3>
                <div className="value-grid">
                    <div className="value-item">
                        <div className="value-icon">💰</div>
                        <h4>Same Great Rates</h4>
                        <p>Keep 70% of your earnings with our competitive 30% service fee</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">📈</div>
                        <h4>Advanced Analytics</h4>
                        <p>Track your sales, understand your audience, and optimize for growth</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🎨</div>
                        <h4>Custom Branding</h4>
                        <p>Professional storefronts that match your brand identity</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🚀</div>
                        <h4>Priority Support</h4>
                        <p>Get help when you need it most with dedicated support</p>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default SubscriptionTiers; 