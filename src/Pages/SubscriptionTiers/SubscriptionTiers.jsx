import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';

/** Printful-style costs and retail prices; creator gets a fixed per-sale payout. */
const CREATOR_PAYOUT_PER_MUG = 6.0;

const MUG_EXAMPLES = [
    { size: '11 oz', sellingPrice: 23.99, productCost: 12.44, basePrice: 5.95, shipping: 6.49, creatorEarnings: CREATOR_PAYOUT_PER_MUG },
    { size: '15 oz', sellingPrice: 25.99, productCost: 14.94, basePrice: 7.95, shipping: 6.99, creatorEarnings: CREATOR_PAYOUT_PER_MUG },
    { size: '20 oz', sellingPrice: 29.99, productCost: 17.99, basePrice: 9.5, shipping: 8.49, creatorEarnings: CREATOR_PAYOUT_PER_MUG },
];

const MONTHLY_MUG_SALES_EXAMPLE = 217;

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
                setMessage('Redirecting to PayPal setup...');
                setTimeout(() => {
                    navigate('/payment-setup?flow=new_user');
                }, 1500);
                return;
            }

            const result = await SubscriptionService.subscribeToProTier();

            if (result.success) {
                setMessage('Redirecting to PayPal setup...');
            } else {
                setMessage(result.error || 'An error occurred. Please try again.');
            }
        } catch (error) {
            console.error('Error starting PayPal setup:', error);
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
                <p>See how much you could earn with ScreenMerch&apos;s completely free merch system—fixed per-sale payouts and no monthly fees.</p>
            </div>

            {message && (
                <div className={`message ${message.includes('error') || message.includes('Failed') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <div className="performance-metrics">
                <div className="metrics-header">
                    <h3>📊 Example Creator Performance</h3>
                    <p>Example creator earnings using coffee mugs—one of many products you can offer.</p>
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
                    <div className="pricing-note">
                        <small>💡 Clear per-sale payouts—earn a set amount each time a product sells.</small>
                    </div>
                </div>

                <div className="tier-comparison-grid">
                    <div className="tier-card current">
                        <div className="tier-header">
                            <h5>🎯 Free Plan</h5>
                            <span className="tier-fee">Earn fixed payouts per item sold</span>
                        </div>
                        <div className="tier-revenue">
                            <span className="revenue-amount">${monthlyCreatorEarnings.toLocaleString()}</span>
                            <span className="revenue-label">Monthly Creator Earnings (example)</span>
                        </div>
                        <div className="tier-cost">
                            <span className="cost-amount">Free</span>
                            <span className="cost-label">No monthly fees</span>
                        </div>
                        <div className="tier-savings">
                            <span className="savings-amount">${annualCreatorEarnings.toLocaleString()}</span>
                            <span className="savings-label">Annual Creator Earnings 🔥</span>
                        </div>
                    </div>

                    <div className="tier-card breakdown-card">
                        <div className="tier-header">
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
                        <div className="tier-revenue">
                            <span className="revenue-amount">${exampleMug.creatorEarnings.toFixed(2)}</span>
                            <span className="revenue-label">Your Earnings</span>
                        </div>
                        <div className="item-breakdown-container">
                            <div className="product-visual">
                                <img
                                    src="/calculatorimage.png"
                                    alt="Calculator Example"
                                    className="product-image"
                                />
                                <p className="product-caption">White glossy mug example—one size shown above</p>
                            </div>
                            <div className="item-breakdown">
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

                <div className="calculator-footer">
                    <button
                        className="upgrade-btn"
                        onClick={() => handleGetStarted()}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Processing...' : currentUser ? '🚀 Set Up PayPal & Start Earning' : '🚀 Sign Up & Set Up PayPal'}
                    </button>
                </div>

                <div className="calculation-breakdown">
                    <h5>📊 How We Calculate Your Earnings</h5>
                    <div className="breakdown-grid">
                        <div className="breakdown-item">
                            <strong>Example volume:</strong> {MONTHLY_MUG_SALES_EXAMPLE} mug sales / month
                        </div>
                        <div className="breakdown-item">
                            <strong>Creator payout per mug (example):</strong> ${CREATOR_PAYOUT_PER_MUG.toFixed(2)}
                        </div>
                        <div className="breakdown-item">
                            <strong>Monthly Creator Earnings:</strong> ${monthlyCreatorEarnings.toLocaleString()}
                        </div>
                        <div className="breakdown-item highlight creator-earnings">
                            <strong>🎯 Annual Creator Earnings:</strong> ${annualCreatorEarnings.toLocaleString()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.1rem', fontWeight: '600', color: '#1565c0' }}>
                        Fixed earnings per item sold—no subscription fees
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
                        <p>Simple and intuitive platform to create and sell your merchandise</p>
                    </div>
                    <div className="value-item">
                        <div className="value-icon">🚀</div>
                        <h4>Completely Free</h4>
                        <p>No monthly fees, no recurring charges, no hidden costs—just start earning</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionTiers;
