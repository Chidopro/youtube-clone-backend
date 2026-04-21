import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import { getBackendUrl } from '../../config/apiConfig';
import CreatorSignupModal from '../../Components/CreatorSignupModal/CreatorSignupModal';

/** Fixed illustration volume for headline metrics (same for all product types). */
const MONTHLY_UNITS_SOLD_EXAMPLE = 217;

const IMG_BASE_FALLBACK = 'https://screenmerch.fly.dev/static/images';

const getImgBase = () => {
    const base = getBackendUrl();
    if (!base || typeof base !== 'string') return IMG_BASE_FALLBACK;
    return `${base.replace(/\/$/, '')}/static/images`;
};

/**
 * Build absolute image URLs for the calculator. Each entry in imageAttempts is either
 * a filename under /static/images/ on the API host, or a same-origin path (e.g. /mug.png on Netlify).
 */
function buildCalculatorImageUrls(product) {
    const base = getImgBase();
    const attempts = product.imageAttempts?.length
        ? product.imageAttempts
        : ['placeholder.png'];
    const urls = attempts.map((entry) => {
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

/**
 * Representative products for the earnings preview (edit prices anytime).
 * productId: stable id for editors / future wiring (matches products.js keys where noted).
 * imageAttempts: filenames must match backend/static (see app.py product catalog main_image / preview_image).
 */
const CALCULATOR_PRODUCTS = [
    {
        key: 'hoodies',
        label: 'Hoodies',
        productName: 'Unisex Hoodie',
        category: "Men's",
        productId: 'unisexhoodie',
        imageAttempts: ['tested.png', 'mensunisexhoodiepreview.png'],
        sellingPrice: 44.99,
        baseCost: 28.5,
        creatorEarnings: 12.0,
    },
    {
        key: 'shirts',
        label: 'Shirts',
        productName: "Women's Shirt",
        category: "Women's",
        productId: "women'sshirt",
        imageAttempts: ['womenshirtpreview.png', 'womensshirtpreview.png', 'womensshirt.png'],
        sellingPrice: 36.99,
        baseCost: 22.0,
        creatorEarnings: 10.5,
    },
    {
        key: 'hats',
        label: 'Hats',
        productName: 'Closed Back Cap',
        category: 'Hats',
        productId: 'closedbackcap',
        imageAttempts: ['closedbackcap.png', 'hatsclosedbackcappreview.png'],
        sellingPrice: 27.99,
        baseCost: 15.0,
        creatorEarnings: 8.0,
    },
    {
        key: 'bags',
        label: 'Bags',
        productName: 'All Over Print Tote Pocket',
        category: 'Bags',
        productId: 'all_over_print_tote_pocket',
        imageAttempts: ['largecanvasbag.png', 'bagsalloverprinttotepocketpreview.png'],
        sellingPrice: 39.99,
        baseCost: 24.0,
        creatorEarnings: 11.0,
    },
    {
        key: 'mugs',
        label: 'Mugs',
        productName: 'White Glossy Mug',
        category: 'Mugs',
        productId: 'white_glossy_mug_printful_tbd',
        imageAttempts: ['mug1.png', 'mug1preview.png', '/mug.png'],
        sellingPrice: 23.99,
        baseCost: 12.44,
        creatorEarnings: 6.0,
    },
];

const DEFAULT_PRODUCT_KEY = 'hoodies';

const SubscriptionTiers = () => {
    const navigate = useNavigate();

    const [selectedProductKey, setSelectedProductKey] = useState(DEFAULT_PRODUCT_KEY);
    const selectedProduct = useMemo(
        () => CALCULATOR_PRODUCTS.find((p) => p.key === selectedProductKey) || CALCULATOR_PRODUCTS[0],
        [selectedProductKey]
    );

    const monthlyCreatorEarnings = MONTHLY_UNITS_SOLD_EXAMPLE * selectedProduct.creatorEarnings;
    const annualCreatorEarnings = monthlyCreatorEarnings * 12;

    const calculatorImageUrls = useMemo(
        () => buildCalculatorImageUrls(selectedProduct),
        [selectedProduct]
    );

    const [calculatorImageIndex, setCalculatorImageIndex] = useState(0);

    useEffect(() => {
        setCalculatorImageIndex(0);
    }, [selectedProductKey]);

    const calculatorImageSrc = calculatorImageUrls[Math.min(calculatorImageIndex, calculatorImageUrls.length - 1)]
        || `${getImgBase()}/placeholder.png`;

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
                    <p>
                        Illustration using {MONTHLY_UNITS_SOLD_EXAMPLE} monthly sales and the creator payout for your selected product type.
                    </p>
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
                    Example based on estimated monthly product sales and the payout shown for <strong>{selectedProduct.label}</strong>.
                </p>
            </div>

            <div className="tier-calculator-section">
                <div className="calculator-header">
                    <h4>How creators earn on ScreenMerch</h4>
                    <p>No monthly fees—preview a representative product and your per-sale payout.</p>
                </div>

                <div className="tier-comparison-grid calculator-pair-grid">
                    <div className="tier-card current free-creator-plan-card calculator-pair-card">
                        <div className="tier-header">
                            <h5>Free Creator Plan</h5>
                            <p className="free-plan-subtitle">Start earning from your videos with no monthly fees.</p>
                        </div>
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
                        <div className="tier-savings earnings-bottom">
                            <span className="savings-amount">${annualCreatorEarnings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className="savings-label">Annual Creator Earnings 🔥</span>
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
                        data-calculator-product-id={selectedProduct.productId}
                        data-calculator-product-key={selectedProduct.key}
                    >
                        <div className="tier-header breakdown-header-aligned earn-per-sale-header">
                            <h2 className="earn-per-sale-title">What You Earn Per Sale</h2>
                            <p className="earn-per-sale-product-line">
                                <span className="earn-per-sale-name">{selectedProduct.productName}</span>
                                <span className="earn-per-sale-meta"> · {selectedProduct.category}</span>
                            </p>
                            <label className="calculator-select-label" htmlFor="calculator-product-type">
                                Product type
                            </label>
                            <select
                                id="calculator-product-type"
                                className="calculator-product-select"
                                value={selectedProductKey}
                                onChange={(e) => setSelectedProductKey(e.target.value)}
                                aria-label="Product type for earnings example"
                            >
                                {CALCULATOR_PRODUCTS.map((p) => (
                                    <option key={p.key} value={p.key}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="item-breakdown-container-vertical">
                            <div className="product-visual-centered">
                                <img
                                    key={`${selectedProductKey}-${calculatorImageIndex}`}
                                    src={calculatorImageSrc}
                                    alt={selectedProduct.productName}
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
                                <li>Clear per-sale creator payouts</li>
                            </ul>
                            <div className="creator-earnings-hero">
                                <div className="creator-earnings-hero-label">Creator Earnings</div>
                                <div className="creator-earnings-hero-value">
                                    ${selectedProduct.creatorEarnings.toFixed(2)} <span className="creator-earnings-per">per sale</span>
                                </div>
                            </div>
                            <div className="item-breakdown-vertical">
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Selling price</span>
                                    <span className="breakdown-value">${selectedProduct.sellingPrice.toFixed(2)}</span>
                                </div>
                                <div className="breakdown-row">
                                    <span className="breakdown-label">Base cost (fulfillment)</span>
                                    <span className="breakdown-value cost">-${selectedProduct.baseCost.toFixed(2)}</span>
                                </div>
                            </div>
                            <p className="calculator-trust-disclaimer">
                                Example payouts vary by product type, shipping region, and final pricing.
                            </p>
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
                apiBase={getBackendUrl() || 'https://screenmerch.fly.dev'}
                isOpen={isCreatorSignupModalOpen}
                onClose={handleCloseCreatorSignupModal}
                onSignup={handleCreatorSignup}
            />
        </div>
    );
};

export default SubscriptionTiers;
