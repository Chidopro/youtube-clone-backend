import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import CreatorSignupModal from '../../Components/CreatorSignupModal/CreatorSignupModal';

const SubscriptionTiers = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Realistic earnings data based on actual ScreenMerch mug pricing
    // Mug selling price: $14.95, Product overhead cost: $4.95, House commission: $3.00, Your profit: $7.00 per mug
    // Based on ONE mug design selling 50 units per week for a full year
    const hypotheticalData = {
        totalRevenue: 18228, // $18,228 annual revenue
        monthlyRevenue: 1519, // $1,519 average monthly revenue
        totalProductsSold: 2600, // 2,600 total products sold (50 weekly × 52 weeks)
        monthlyProductsSold: 217, // 217 average monthly products sold
        averageProductPrice: 14.95, // Mug selling price
        productOverheadCost: 4.95, // Product overhead cost
        houseCommission: 3.00, // House commission per mug
        yourProfitPerItem: 7.00 // $14.95 - $4.95 - $3.00 = $7.00 profit per mug
    };

    // Calculate earnings for free subscription
    // Based on actual profit per item after overhead and commission
    const calculateEarnings = () => {
        const totalGrossProfit = hypotheticalData.totalProductsSold * (hypotheticalData.averageProductPrice - hypotheticalData.productOverheadCost);
        const totalHouseCommission = hypotheticalData.totalProductsSold * hypotheticalData.houseCommission;
        const netEarnings = totalGrossProfit - totalHouseCommission;
        
        return {
            grossEarnings: Math.round(totalGrossProfit),
            netEarnings: Math.round(netEarnings)
        };
    };

    const freeSubscriptionEarnings = calculateEarnings();

    const [currentUser, setCurrentUser] = useState(null);
    const [userSubscription, setUserSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isCreatorSignupModalOpen, setIsCreatorSignupModalOpen] = useState(false);

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
        if (!currentUser) {
            // For new users, show creator signup modal
            setIsCreatorSignupModalOpen(true);
            return;
        }

        // For existing users, redirect to dashboard payout setup
        navigate('/dashboard?tab=payout');
    };

    const handleCreatorSignup = async (email, location) => {
        // Store email and location for later use if needed
        localStorage.setItem('pending_creator_email', email);
        localStorage.setItem('pending_creator_location', location);
        // Creator signup always returns to main domain so we never land on a subdomain (e.g. testcreator) with another user's session
        const creatorSignupReturnUrl = 'https://screenmerch.com';
        const authUrl = `https://screenmerch.fly.dev/api/auth/google/login?return_url=${encodeURIComponent(creatorSignupReturnUrl)}&flow=creator_signup`;
        console.log('Redirecting to Google OAuth for creator signup (return to main domain):', authUrl);
        // Full-page redirect only; fetch() would hit CORS (backend returns 302 to Google)
        window.location.href = authUrl;
    };

    const handleCloseCreatorSignupModal = () => {
        setIsCreatorSignupModalOpen(false);
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
                <p>See how much you can earn from your content with one of dozens of products to choose from.</p>
                {!currentUser && (
                    <button 
                        className="hero-signup-btn"
                        onClick={() => handleGetStarted()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : 'Sign Up Now'}
                    </button>
                )}
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
                    <p>Example earnings using coffee mugs, one of many available products.</p>
                </div>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-value">{hypotheticalData.monthlyProductsSold}</div>
                        <div className="metric-label">Monthly Products Sold</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${hypotheticalData.monthlyRevenue.toLocaleString()}</div>
                        <div className="metric-label">Monthly Revenue</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${hypotheticalData.totalRevenue.toLocaleString()}</div>
                        <div className="metric-label">Total Revenue (Annual)</div>
                    </div>
                </div>
            </div>

            {/* Free Subscription */}
            <div className="tier-calculator-section">
                <div className="calculator-header">
                    <h4>🎯 ScreenMerch Free Plan</h4>
                    <p>It's completely free to use ScreenMerch! No monthly fees, no recurring charges.</p>
                </div>
                
                <div className="tier-comparison-grid">
                    {/* Free Subscription (30% commission) */}
                    <div className="tier-card current">
                        {/* Header: Plan Details */}
                        <div className="tier-header">
                            <h5>🎯 Free Plan</h5>
                            <span className="tier-fee">Your Profit 70% Net Sales</span>
                        </div>
                        {/* Icon Section */}
                        <div className="tier-icon-container">
                            <img 
                                src="/passive-icon.png" 
                                alt="Passive Income Icon" 
                                className="tier-icon-image"
                            />
                        </div>
                        {/* Bottom: Net Annual Earnings */}
                        <div className="tier-savings earnings-bottom">
                            <span className="savings-amount">$18,228</span>
                            <span className="savings-label">Net Annual Earnings 🔥</span>
                        </div>
                        {/* Plan Info Below Earnings */}
                        <div className="tier-content-centered">
                            <div className="tier-info-text">Free Membership 30% Service Fee</div>
                        </div>
                    </div>

                    {/* Per Item Breakdown */}
                    <div className="tier-card breakdown-card">
                        <div className="tier-header breakdown-header-aligned">
                            <h5>💰 Per Item Example</h5>
                            <span className="tier-fee">$14.95 Mug</span>
                        </div>
                        <div className="item-breakdown-container-vertical">
                            <div className="product-visual-centered">
                                <img 
                                    src="/mug.png" 
                                    alt="Mug Example" 
                                    className="product-image-centered"
                                />
                            </div>
                            <div className="profit-highlight-box">
                                <div className="profit-highlight-row">
                                    <span className="profit-label">Your Profit:</span>
                                    <span className="profit-value">${hypotheticalData.yourProfitPerItem.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="item-breakdown-vertical">
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Your Selling Price:</span>
                                    <span className="breakdown-value">${hypotheticalData.averageProductPrice.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Product Overhead:</span>
                                    <span className="breakdown-value cost">-${hypotheticalData.productOverheadCost.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Service Fee (30%):</span>
                                    <span className="breakdown-value cost">-${hypotheticalData.houseCommission.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
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
                        <p>Simple and intuitive platform to monetize your content</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🚀</div>
                        <h4>Completely Free</h4>
                        <p>No monthly fees, no recurring charges, no hidden costs - just start earning immediately</p>
                    </div>
                </div>
            </div>

            {/* Sign Up CTA Section with Purple Background */}
            {!currentUser && (
                <div className="signup-cta-section">
                    <button 
                        className="hero-signup-btn"
                        onClick={() => handleGetStarted()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : 'Sign Up Now'}
                    </button>
                </div>
            )}

            <CreatorSignupModal
                isOpen={isCreatorSignupModalOpen}
                onClose={handleCloseCreatorSignupModal}
                onSignup={handleCreatorSignup}
            />
        </div>
    );
};

export default SubscriptionTiers;