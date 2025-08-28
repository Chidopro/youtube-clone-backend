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
                    setMessage('Redirecting to Stripe checkout... You will be charged $9.99/month after your 7-day free trial ends.');
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
                <p>See how much you could earn with different ScreenMerch tiers</p>
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
                    <h4>💎 Choose Your Earnings Tier</h4>
                    <p>Lower fees = Higher earnings. See the difference each tier makes</p>
                </div>
                
                <div className="tier-comparison-grid">
                    {/* Current Tier (50% fee) */}
                    <div className="tier-card current">
                        <div className="tier-header">
                            <h5>Current Tier</h5>
                            <span className="tier-fee">50% Service Fee</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${(hypotheticalData.totalRevenue * 0.5).toLocaleString()}</span>
                            <span className="revenue-label">You Keep</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">Free</span>
                            <span className="cost-label">Monthly Cost</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">$0</span>
                            <span className="savings-label">Additional Savings</span>
                        </div>
                    </div>

                    {/* Tier 2 (20% fee) */}
                    <div className="tier-card upgrade">
                        <div className="tier-header">
                            <h5>Pro Tier</h5>
                            <span className="tier-fee">20% Service Fee</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${(hypotheticalData.totalRevenue * 0.8).toLocaleString()}</span>
                            <span className="revenue-label">You Keep</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">$99/month</span>
                            <span className="cost-label">Monthly Cost</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">+${(hypotheticalData.totalRevenue * 0.1 - 1200).toLocaleString()}</span>
                            <span className="savings-label">Net Additional Earnings</span>
                        </div>
                    </div>

                    {/* Tier 3 (10% fee) */}
                    <div className="tier-card upgrade">
                        <div className="tier-header">
                            <h5>Premium Tier</h5>
                            <span className="tier-fee">10% Service Fee</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${(hypotheticalData.totalRevenue * 0.9).toLocaleString()}</span>
                            <span className="revenue-label">You Keep</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">$299/month</span>
                            <span className="cost-label">Monthly Cost</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">+${(hypotheticalData.totalRevenue * 0.2 - 3600).toLocaleString()}</span>
                            <span className="savings-label">Net Additional Earnings</span>
                        </div>
                    </div>

                    {/* Enterprise Tier (5% fee) */}
                    <div className="tier-card enterprise">
                        <div className="tier-header">
                            <h5>Enterprise</h5>
                            <span className="tier-fee">5% Service Fee</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${(hypotheticalData.totalRevenue * 0.95).toLocaleString()}</span>
                            <span className="revenue-label">You Keep</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">$7,500</span>
                            <span className="cost-label">One-time License</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">+${(hypotheticalData.totalRevenue * 0.25 - 7500).toLocaleString()}</span>
                            <span className="savings-label">Net Additional Earnings</span>
                        </div>
                    </div>
                </div>

                <div className="calculator-footer">
                    <button 
                        className="upgrade-btn"
                        onClick={() => handleProTier()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : '🚀 Start Pro Trial - Keep 20% More'}
                    </button>
                    <p className="trial-notice">
                        <strong>7-Day Free Trial</strong> • Cancel anytime • No charges during trial
                    </p>
                </div>
            </div>

            {/* Value Proposition */}
            <div className="value-proposition">
                <h3>🎯 Why Upgrade?</h3>
                <div className="value-grid">
                    <div className="value-item">
                        <div className="value-icon">💰</div>
                        <h4>Higher Earnings</h4>
                        <p>Keep up to 25% more of your revenue with premium tiers</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">📈</div>
                        <h4>Scale Faster</h4>
                        <p>Advanced analytics and tools to grow your audience</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🎨</div>
                        <h4>Custom Branding</h4>
                        <p>Professional storefronts that match your brand</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🚀</div>
                        <h4>Priority Support</h4>
                        <p>Get help when you need it most</p>
                    </div>
                </div>
            </div>

            <div className="tiers-footer">
                <div className="success-stories">
                    <h3>💫 Creator Success Stories</h3>
                    <div className="story-grid">
                        <div className="story-card">
                            <p>"Upgraded to Pro and my earnings increased by $2,400 in the first month!"</p>
                            <span className="story-author">- Sarah M., Lifestyle Creator</span>
                        </div>
                        <div className="story-card">
                            <p>"The 20% fee reduction paid for itself in just 2 weeks of sales."</p>
                            <span className="story-author">- Mike R., Tech Reviewer</span>
                        </div>
                        <div className="story-card">
                            <p>"Premium tier gave me the tools to scale to $50K+ monthly revenue."</p>
                            <span className="story-author">- Alex K., Fitness Influencer</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionTiers; 