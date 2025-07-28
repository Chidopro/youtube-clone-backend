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
            name: 'Creator Pro Plan',
            price: '$9.99',
            trialText: '7-day free trial',
            features: [
                'Everything in Free',
                'Priority support',
                'Custom branding',
                'Enhanced upload limits (2GB, 60 minutes)',
                'Ad-free experience',
                'Early access to new features',
                'Monetization tools',
                'Revenue tracking',
                'Custom channel colors',
                'Branded merchandise'
            ],
            color: '#007bff',
            popular: false
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

    const handleProTier = async () => {
        setActionLoading(true);
        setMessage('');

        try {
            if (!currentUser) {
                // Redirect to signup if not logged in
                navigate('/signup', { 
                    state: { 
                        from: location.pathname,
                        message: 'Sign up to start your Pro trial!' 
                    } 
                });
                return;
            }

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

    const getButtonText = (tier) => {
        if (actionLoading) return 'Processing...';
        
        if (userSubscription?.tier === tier.id) {
            return 'Current Plan';
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
                <p>Unlock your full potential as a content creator with ScreenMerch</p>
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
                        className={`tier-card ${userSubscription?.tier === tier.id ? 'current' : ''}`}
                        style={{ borderColor: tier.color }}
                    >
                        {userSubscription?.tier === tier.id && (
                            <div className="current-badge">
                                Current Plan
                            </div>
                        )}
                        
                        <div className="tier-header">
                            <h2>{tier.name}</h2>
                            <div className="tier-price">
                                <span className="price">{tier.price}</span>
                                <span className="period">/month</span>
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
                                className="tier-button"
                                onClick={() => handleProTier()}
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
                    <strong>Always free for fans:</strong> Viewers can grab screenshots, preview merch, and make purchases without any subscription required.
                </p>
                <p>
                    <strong>Creator Pro Plan:</strong> Perfect for content creators who want to monetize their audience, customize their branding, and access advanced features.
                </p>
                <p className="trial-info">
                    <strong>7-Day Free Trial:</strong> Start your Pro trial today. No charges during the trial period. Cancel anytime before the trial ends.
                </p>
            </div>
        </div>
    );
};

export default SubscriptionTiers; 