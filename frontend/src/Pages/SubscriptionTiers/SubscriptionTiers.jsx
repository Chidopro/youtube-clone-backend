import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './SubscriptionTiers.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';

const SubscriptionTiers = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const tiers = [
        {
            id: 'pro',
            name: 'Pro Plan for Creators',
            price: '$9.99/month',
            trialText: '7-day free trial',
            features: [
                'Upload and share your videos',
                'Create custom product pages',
                'Sell merchandise with revenue sharing',
                'Priority customer support',
                'Custom branding and channel colors',
                'Enhanced upload limits (2GB, 60 minutes)',
                'Analytics and sales tracking',
                'Creator dashboard and tools',
                'Ad-free viewing experience',
                'Early access to new features'
            ],
            color: '#007bff',
            popular: true
        }
    ];

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
                // Redirect to signup if not logged in
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
                    setMessage('Redirecting to secure payment setup...');
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

    const getButtonText = (tier) => {
        if (actionLoading) return 'Processing...';
        
        if (userSubscription?.tier === tier.id) {
            return tier.id === 'pro' ? 'Current Plan' : 'Current Plan';
        }
        
        if (tier.id === 'free') {
            return currentUser ? 'Get Started' : 'Sign Up & Get Started';
        }
        
        return 'Start Free Trial';
    };

    const isButtonDisabled = (tier) => {
        return actionLoading || (userSubscription?.tier === tier.id);
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
                <h1>Creator Pro Plan</h1>
                <p>Start monetizing your content and selling products with ScreenMerch</p>
            </div>

            {message && (
                <div className={`message ${message.includes('error') || message.includes('Failed') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <div className="tiers-container">
                {tiers.map((tier, index) => (
                    <div 
                        key={index} 
                        className={`tier-card ${tier.popular ? 'popular' : ''} ${userSubscription?.tier === tier.id ? 'current' : ''}`}
                        style={{ borderColor: tier.color }}
                    >
                        {tier.popular && (
                            <div className="popular-badge" style={{ backgroundColor: tier.color }}>
                                Most Popular
                            </div>
                        )}
                        
                        {userSubscription?.tier === tier.id && (
                            <div className="current-badge">
                                Current Plan
                            </div>
                        )}
                        
                        <div className="tier-header">
                            <h2>{tier.name}</h2>
                            <div className="tier-price">
                                <span className="price">{tier.price}</span>
                                {tier.price !== 'Free' && <span className="period">/month</span>}
                            </div>
                            {tier.trialText && (
                                <div className="trial-text">{tier.trialText}</div>
                            )}
                        </div>
                        
                        <div className="tier-features">
                            <ul>
                                {tier.features.map((feature, featureIndex) => (
                                    <li key={featureIndex}>
                                        <span className="checkmark">✓</span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="tier-action">
                            <button
                                className={`tier-button ${tier.popular ? 'popular' : ''}`}
                                onClick={() => handleTierAction(tier.id)}
                                disabled={isButtonDisabled(tier)}
                                style={{ backgroundColor: tier.color }}
                            >
                                {getButtonText(tier)}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="tiers-footer">
                <p>
                    <strong>Pro Plan for Creators:</strong> Everything you need to monetize your audience, create custom product pages, and earn from merchandise sales with our revenue sharing program.
                </p>
                <p className="trial-info">
                    <strong>7-Day Free Trial:</strong> Start your Pro trial today. No charges during the trial period. Cancel anytime before the trial ends.
                </p>
            </div>
        </div>
    );
};

export default SubscriptionTiers; 