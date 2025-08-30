import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';

const SubscriptionTiers = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Realistic earnings data based on actual ScreenMerch product prices and product overhead costs
    // Average product price: $21.69 (from your actual t-shirt pricing)
    // Product overhead cost: ~$11.69, Your profit: ~$7.00 per item after 30% house commission
    const hypotheticalData = {
        totalRevenue: 52056, // $52,056 annual revenue (based on $4,338 monthly)
        monthlyRevenue: 4338, // $4,338 average monthly revenue
        totalProductsSold: 2400, // 2,400 total products sold (200 monthly × 12)
        monthlyProductsSold: 200, // 200 average monthly products sold
        averageProductPrice: 21.69, // Average t-shirt price from your product dashboard
        productOverheadCost: 11.69, // Average product overhead cost
        houseCommission: 3.00, // 30% of gross profit ($21.69 - $11.69 = $10.00, then 30% = $3.00)
        yourProfitPerItem: 7.00 // $21.69 - $11.69 - $3.00 (30% commission)
    };

    // Calculate earnings for free subscription
    const calculateEarnings = (revenue, commissionRate) => {
        const grossEarnings = revenue * (1 - commissionRate);
        return {
            grossEarnings: Math.round(grossEarnings),
            netEarnings: Math.round(grossEarnings)
        };
    };

    const freeSubscriptionEarnings = calculateEarnings(hypotheticalData.totalRevenue, 0.30);

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

    const handleGetStarted = async () => {
        setActionLoading(true);
        setMessage('');

        try {
            if (!currentUser) {
                setMessage('Please sign up or log in to get started with ScreenMerch!');
                setTimeout(() => {
                    navigate('/signup', { 
                        state: { 
                            from: location.pathname,
                            message: 'Sign up to get started with ScreenMerch!' 
                        } 
                    });
                }, 1500);
                return;
            }

            // Navigate to dashboard or home page
            navigate('/dashboard', { 
                state: { 
                    from: location.pathname,
                    message: 'Welcome to ScreenMerch! Start creating your merchandise.' 
                } 
            });
        } catch (error) {
            console.error('Error navigating:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="subscription-tiers">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="subscription-tiers">
            <div className="tiers-header">
                <h1>💰 Creator Earnings Calculator</h1>
                <p>See how much you could earn with ScreenMerch's simple free merch system.</p>
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
                        <div className="metric-label">Total Revenue (Annual)</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${hypotheticalData.monthlyRevenue.toLocaleString()}</div>
                        <div className="metric-label">Monthly Revenue</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{hypotheticalData.totalProductsSold.toLocaleString()}</div>
                        <div className="metric-label">Products Sold (Annual)</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{hypotheticalData.monthlyProductsSold}</div>
                        <div className="metric-label">Monthly Products Sold</div>
                    </div>
                </div>
            </div>

            {/* Free Subscription */}
            <div className="tier-calculator-section">
                <div className="calculator-header">
                    <h4>🎯 ScreenMerch Free Plan</h4>
                    <p>It's always free to use ScreenMerch! You earn 70% of all sales, 30% house commission.</p>
                    <div className="pricing-note">
                        <small>💡 Based on actual product overhead costs and 30% house commission structure</small>
                    </div>
                </div>
                
                <div className="tier-comparison-grid">
                    {/* Free Subscription (30% commission) */}
                    <div className="tier-card current">
                        <div className="tier-header">
                            <h5>🎯 Free Plan</h5>
                            <span className="tier-fee">30% House Commission</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${freeSubscriptionEarnings.netEarnings.toLocaleString()}</span>
                            <span className="revenue-label">You Keep (70% of Sales)</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">Free</span>
                            <span className="cost-label">Always Free</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">${freeSubscriptionEarnings.netEarnings.toLocaleString()}</span>
                            <span className="savings-label">Net Annual Earnings 💰</span>
                        </div>
                    </div>

                    {/* Per Item Breakdown */}
                    <div className="tier-card breakdown-card">
                        <div className="tier-header">
                            <h5>💰 Per Item Example</h5>
                            <span className="tier-fee">$21.69 T-Shirt</span>
                        </div>
                        <div className="item-breakdown-container">
                            <div className="product-visual">
                                <img 
                                    src="/calculatorimage.png" 
                                    alt="Calculator Example" 
                                    className="product-image"
                                />
                                <p className="product-caption">Just one T-Shirt 50 sales a week!</p>
                            </div>
                            <div className="item-breakdown">
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Your Selling Price:</span>
                                    <span className="breakdown-value">${hypotheticalData.averageProductPrice}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Product Overhead:</span>
                                    <span className="breakdown-value cost">-${hypotheticalData.productOverheadCost}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">House Commission (30%):</span>
                                    <span className="breakdown-value cost">-${hypotheticalData.houseCommission}</span>
                                </div>
                                <div className="breakdown-row final-profit">
                                    <span className="breakdown-label">Your Profit:</span>
                                    <span className="breakdown-value profit">${hypotheticalData.yourProfitPerItem}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="calculator-footer">
                    <button 
                        className="upgrade-btn"
                        onClick={() => handleGetStarted()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : currentUser ? '🚀 Get Started Free' : '🚀 Sign Up & Get Started Free'}
                    </button>
                </div>

                {/* Calculation Breakdown */}
                <div className="calculation-breakdown">
                    <h5>📊 How We Calculate Your Earnings</h5>
                    <div className="breakdown-grid">
                        <div className="breakdown-item">
                            <strong>Total Revenue:</strong> ${hypotheticalData.totalRevenue.toLocaleString()}
                        </div>
                        <div className="breakdown-item">
                            <strong>Product Overhead Costs:</strong> ${(hypotheticalData.totalProductsSold * hypotheticalData.productOverheadCost).toLocaleString()}
                        </div>
                        <div className="breakdown-item">
                            <strong>House Commission (30%):</strong> ${(hypotheticalData.totalRevenue * 0.30).toLocaleString()}
                        </div>
                        <div className="breakdown-item highlight creator-earnings">
                            <strong>🎯 Your Total Net Earnings:</strong> ${(hypotheticalData.totalProductsSold * hypotheticalData.yourProfitPerItem).toLocaleString()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.1rem', fontWeight: '600', color: '#1565c0' }}>
                        Just One T-Shirt 50 Sales a Week!
                    </div>
                </div>
            </div>

            {/* Value Proposition */}
            <div className="value-proposition">
                <h3>🎯 Why Choose ScreenMerch?</h3>
                <div className="value-grid">
                    <div className="value-item">
                        <div className="value-icon">💰</div>
                        <h4>Great Rates</h4>
                        <p>Keep 70% of your earnings with our competitive 30% service fee</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">📈</div>
                        <h4>Analytics</h4>
                        <p>Track your sales, understand your audience, and optimize for growth</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🎨</div>
                        <h4>Easy Setup</h4>
                        <p>Simple and intuitive platform to create and sell your merchandise</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🚀</div>
                        <h4>Always Free</h4>
                        <p>No monthly fees, no hidden costs - just start earning immediately</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionTiers; 