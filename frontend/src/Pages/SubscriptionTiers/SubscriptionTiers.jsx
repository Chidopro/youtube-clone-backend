import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import { getBackendUrl } from '../../config/apiConfig';
import CreatorSignupModal from '../../Components/CreatorSignupModal/CreatorSignupModal';

/** Must match backend/utils/payout.py CREATOR_SHARE_PER_MARKUP_SALE */
const CREATOR_PAYOUT_PER_SALE = 6.0;

/** Fixed illustration volume for headline metrics. */
const MONTHLY_UNITS_SOLD_EXAMPLE = 217;

const EXAMPLE_MUG = {
    productName: 'White Glossy Mug',
    productId: 'white_glossy_mug_printful_tbd',
    imageAttempts: ['mug1.png', 'mug1preview.png', '/mug.png'],
};

const IMG_BASE_FALLBACK = 'https://screenmerch.fly.dev/static/images';

const getImgBase = () => {
    const base = getBackendUrl();
    if (!base || typeof base !== 'string') return IMG_BASE_FALLBACK;
    return `${base.replace(/\/$/, '')}/static/images`;
};

function buildExampleMugImageUrls() {
    const base = getImgBase();
    const urls = EXAMPLE_MUG.imageAttempts.map((entry) => {
        if (entry.startsWith('/')) return entry;
        if (entry.startsWith('http://') || entry.startsWith('https://')) return entry;
        return `${base}/${entry}`;
    });
    const placeholderUrl = `${base}/placeholder.png`;
    if (urls[urls.length - 1] !== placeholderUrl) {
        urls.push(placeholderUrl);
    }
    return urls;
}

const SubscriptionTiers = () => {
    const navigate = useNavigate();

    const monthlyCreatorEarnings = MONTHLY_UNITS_SOLD_EXAMPLE * CREATOR_PAYOUT_PER_SALE;
    const annualCreatorEarnings = monthlyCreatorEarnings * 12;

    const calculatorImageUrls = useMemo(() => buildExampleMugImageUrls(), []);
    const [calculatorImageIndex, setCalculatorImageIndex] = useState(0);
    const calculatorImageSrc = calculatorImageUrls[Math.min(calculatorImageIndex, calculatorImageUrls.length - 1)]
        || `${getImgBase()}/placeholder.png`;

    const [currentUser, setCurrentUser] = useState(null);
    const [, setUserSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isCreatorSignupModalOpen, setIsCreatorSignupModalOpen] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        const main = document.querySelector('.main-content-area');
        if (main) main.scrollTop = 0;

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

    // After loading swaps "Loading..." for the hero, keep the top of the calculator in view
    // (homepage scroll position can carry over via .main-content-area).
    useEffect(() => {
        if (loading) return;
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        const main = document.querySelector('.main-content-area');
        if (main) main.scrollTop = 0;
    }, [loading]);

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
        const apiBase = getBackendUrl() || 'https://screenmerch.fly.dev';
        setActionLoading(true);
        try {
            await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/register-pending-creator`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: (email || '').trim().toLowerCase() }),
                credentials: 'include'
            });
        } catch (_) {}
        const loginUrl = `${apiBase.replace(/\/$/, '')}/api/auth/google/login?return_url=${encodeURIComponent(creatorSignupReturnUrl)}&flow=creator_signup`;
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
                <p>
                    See how much you can earn from your content with just coffee mugs. One of dozens of products to choose from.
                </p>
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
                </div>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-value">{MONTHLY_UNITS_SOLD_EXAMPLE}</div>
                        <div className="metric-label">Monthly Products Sold</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${monthlyCreatorEarnings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        <div className="metric-label">Monthly Creator Earnings</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">${annualCreatorEarnings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        <div className="metric-label">Annual Creator Earnings</div>
                    </div>
                </div>
                <p className="metrics-footnote">
                    Example only—actual earnings depend on your sales volume. Greeting cards, stickers, and magnets use different payouts.
                </p>
            </div>

            <div className="tier-calculator-section">
                <div className="calculator-header">
                    <h4>How creators earn on ScreenMerch</h4>
                    <p>No monthly fees—fixed per-sale payouts on most items.</p>
                </div>

                <div className="tier-comparison-grid calculator-pair-grid">
                    <div className="tier-card current free-creator-plan-card calculator-pair-card">
                        <div className="tier-header calculator-pair-header">
                            <h5 className="calculator-card-title">Free Creator Plan</h5>
                            <p className="calculator-card-subtitle">Start earning from your videos.</p>
                        </div>
                        <div className="calculator-pair-body">
                        <div className="tier-icon-container">
                            <img
                                src="/passive-icon.png"
                                alt=""
                                className="tier-icon-image"
                            />
                        </div>
                        <ul className="free-plan-benefits">
                            <li>No inventory to manage</li>
                            <li>No shipping to handle</li>
                        </ul>
                        <div className="tier-savings earnings-bottom calculator-pair-earnings-bar">
                            <span className="savings-amount">${annualCreatorEarnings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className="savings-label">Annual Creator Earnings 🔥</span>
                        </div>
                        </div>
                        <div className="tier-content-centered">
                            <button
                                type="button"
                                className="apply-creator-btn"
                                onClick={() => handleGetStarted()}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Processing...' : 'Apply as Creator'}
                            </button>
                        </div>
                    </div>

                    <div
                        className="tier-card breakdown-card calculator-pair-card"
                        data-calculator-product-id={EXAMPLE_MUG.productId}
                    >
                        <div className="tier-header breakdown-header-aligned calculator-pair-header">
                            <h5 className="calculator-card-title">What You Earn Per Sale</h5>
                            <p className="calculator-card-subtitle">White Glossy Mug Example</p>
                        </div>
                        <div className="item-breakdown-container-vertical calculator-pair-body">
                            <div className="product-visual-centered">
                                <img
                                    key={calculatorImageIndex}
                                    src={calculatorImageSrc}
                                    alt={EXAMPLE_MUG.productName}
                                    className="product-image-centered"
                                    onError={() => {
                                        setCalculatorImageIndex((i) => {
                                            if (i + 1 < calculatorImageUrls.length) return i + 1;
                                            return i;
                                        });
                                    }}
                                />
                            </div>
                            <ul className="earnings-right-benefits" aria-label="Plan highlights">
                                <li>No monthly subscription cost</li>
                                <li>We handle fulfillment</li>
                            </ul>
                            <div className="creator-earnings-hero calculator-pair-earnings-bar">
                                <div className="creator-earnings-hero-label">Creator Earnings</div>
                                <div className="creator-earnings-hero-value">
                                    ${CREATOR_PAYOUT_PER_SALE.toFixed(2)} <span className="creator-earnings-per">per sale</span>
                                </div>
                            </div>
                        </div>
                        <p className="calculator-trust-disclaimer">
                            Fixed payout on most catalog items. Greeting cards, stickers, and magnets may differ.
                        </p>
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
                apiBase={getBackendUrl() || 'https://screenmerch.fly.dev'}
                isOpen={isCreatorSignupModalOpen}
                onClose={handleCloseCreatorSignupModal}
                onSignup={handleCreatorSignup}
            />
        </div>
    );
};

export default SubscriptionTiers;
