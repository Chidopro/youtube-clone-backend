import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import CreatorSignupModal from '../../Components/CreatorSignupModal/CreatorSignupModal';

const CREATOR_PAYOUT_PER_MUG = 6.0;
const MONTHLY_MUG_SALES_EXAMPLE = 217;

const MUG_EXAMPLES = [
    { size: '11 oz', sellingPrice: 23.99, productCost: 12.44, basePrice: 5.95, shipping: 6.49, creatorEarnings: CREATOR_PAYOUT_PER_MUG },
    { size: '15 oz', sellingPrice: 25.99, productCost: 14.94, basePrice: 7.95, shipping: 6.99, creatorEarnings: CREATOR_PAYOUT_PER_MUG },
    { size: '20 oz', sellingPrice: 29.99, productCost: 17.99, basePrice: 9.5, shipping: 8.49, creatorEarnings: CREATOR_PAYOUT_PER_MUG },
];

function screenmerchProfitForMug(mug) {
    return Math.round((mug.sellingPrice - mug.productCost - mug.creatorEarnings) * 100) / 100;
}

const SubscriptionTiers = () => {
    const navigate = useNavigate();

    const monthlyCreatorEarnings = MONTHLY_MUG_SALES_EXAMPLE * CREATOR_PAYOUT_PER_MUG;
    const annualCreatorEarnings = monthlyCreatorEarnings * 12;

    const [exampleMugIndex, setExampleMugIndex] = useState(0);
    const exampleMug = MUG_EXAMPLES[exampleMugIndex];
    const screenmerchProfit = screenmerchProfitForMug(exampleMug);

    const [currentUser, setCurrentUser] = useState(null);
    const [, setUserSubscription] = useState(null);
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
            setIsCreatorSignupModalOpen(true);
            return;
        }

        navigate('/dashboard?tab=payout');
    };

    const handleCreatorSignup = async (email, location) => {
        localStorage.setItem('pending_creator_email', email);
        localStorage.setItem('pending_creator_location', location);
        const creatorSignupReturnUrl = 'https://screenmerch.com';
        const apiBase = 'https://screenmerch.fly.dev';
        setActionLoading(true);
        try {
            await fetch(`${apiBase}/api/auth/register-pending-creator`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: (email || '').trim().toLowerCase() }),
                credentials: 'include'
            });
        } catch (_) {}
        const loginUrl = `${apiBase}/api/auth/google/login?return_url=${encodeURIComponent(creatorSignupReturnUrl)}&flow=creator_signup`;
        window.location.href = loginUrl;
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
                <p>See how much you can earn from your content with one of dozens of products—fixed per-sale payouts and no monthly fees.</p>
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

            <div className="performance-metrics">
                <div className="metrics-header">
                    <h3>📊 Example Creator Performance</h3>
                    <p>Example creator earnings using coffee mugs, one of many available products.</p>
                </div>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-value">{MONTHLY_MUG_SALES_EXAMPLE}</div>
                        <div className="metric-label">Monthly Products Sold</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${monthlyCreatorEarnings.toLocaleString()}</div>
                        <div className="metric-label">Monthly Creator Earnings</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${annualCreatorEarnings.toLocaleString()}</div>
                        <div className="metric-label">Annual Creator Earnings</div>
                    </div>
                </div>
            </div>

            <div className="tier-calculator-section">
                <div className="calculator-header">
                    <h4>🎯 ScreenMerch Free Plan</h4>
                    <p>It&apos;s completely free to use ScreenMerch! No monthly fees, no recurring charges. Creators earn fixed payouts per approved product sale.</p>
                </div>

                <div className="tier-comparison-grid">
                    <div className="tier-card current">
                        <div className="tier-header">
                            <h5>🎯 Free Plan</h5>
                            <span className="tier-fee">Earn fixed payouts per item sold</span>
                        </div>
                        <div className="tier-icon-container">
                            <img
                                src="/passive-icon.png"
                                alt="Passive Income Icon"
                                className="tier-icon-image"
                            />
                        </div>
                        <div className="tier-savings earnings-bottom">
                            <span className="savings-amount">${annualCreatorEarnings.toLocaleString()}</span>
                            <span className="savings-label">Annual Creator Earnings 🔥</span>
                        </div>
                        <div className="tier-content-centered">
                            <div className="tier-info-text">No monthly fees · Clear per-sale payouts</div>
                        </div>
                    </div>

                    <div className="tier-card breakdown-card">
                        <div className="tier-header breakdown-header-aligned">
                            <h5>💰 Per Item Example</h5>
                            <span className="tier-fee">${exampleMug.sellingPrice.toFixed(2)} · {exampleMug.size} mug</span>
                            <select
                                value={exampleMugIndex}
                                onChange={(e) => setExampleMugIndex(Number(e.target.value))}
                                aria-label="Mug size for example"
                                style={{
                                    display: 'block',
                                    margin: '12px auto 0',
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid #ccc',
                                    fontSize: '0.95rem',
                                    maxWidth: '100%',
                                }}
                            >
                                {MUG_EXAMPLES.map((m, i) => (
                                    <option key={m.size} value={i}>{m.size} mug</option>
                                ))}
                            </select>
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
                                    <span className="profit-label">Your Earnings:</span>
                                    <span className="profit-value">${exampleMug.creatorEarnings.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="item-breakdown-vertical">
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Selling Price:</span>
                                    <span className="breakdown-value">${exampleMug.sellingPrice.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Base (Printful):</span>
                                    <span className="breakdown-value">${exampleMug.basePrice.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Shipping:</span>
                                    <span className="breakdown-value">${exampleMug.shipping.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Product Cost:</span>
                                    <span className="breakdown-value cost">-${exampleMug.productCost.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">ScreenMerch Profit:</span>
                                    <span className="breakdown-value">${screenmerchProfit.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="value-proposition">
                <h3>🎯 Why Choose ScreenMerch?</h3>
                <div className="value-grid">
                    <div className="value-item">
                        <div className="value-icon">💰</div>
                        <h4>Clear Payouts</h4>
                        <p>Fixed earnings per item sold—transparent numbers, no percentage jargon</p>
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
                        <p>No monthly fees, no recurring charges, no hidden costs—just start earning immediately</p>
                    </div>
                </div>
            </div>

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
                apiBase="https://screenmerch.fly.dev"
                isOpen={isCreatorSignupModalOpen}
                onClose={handleCloseCreatorSignupModal}
                onSignup={handleCreatorSignup}
            />
        </div>
    );
};

export default SubscriptionTiers;
