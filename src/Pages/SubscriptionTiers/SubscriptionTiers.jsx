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
            id: 'free',
            name: 'Free',
            price: 'Free',
            features: [
                'Upload videos',
                'Basic analytics',
                'Standard features',
                'Community access'
            ],
            color: '#6c757d',
            popular: false
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '$9.99/month',
            trialText: '7-day free trial',
            features: [
                'Everything in Free',
                'Priority support',
                'Custom branding',
                'Enhanced upload limits',
                'Ad-free experience',
                'Early access to new features',
                'Monetization tools'
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

    useEffect(() => {
        if (location.hash) {
            const el = document.getElementById(location.hash.replace('#', ''));
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [location]);

    const handleFreeTierSignup = async () => {
        if (!currentUser) {
            // Redirect to login first
            setActionLoading(true);
            setMessage('Redirecting to Google login...');
            
            const { error } = await supabase.auth.signInWithOAuth({ 
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/subscription-tiers`,
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            
            if (error) {
                setMessage('Login failed. Please try again.');
                setActionLoading(false);
                return;
            }
            return;
        }

        setActionLoading(true);
        setMessage('Setting up your free account...');

        try {
            const result = await SubscriptionService.subscribeToFreeTier();
            
            if (result.success) {
                setUserSubscription(result.subscription);
                setMessage('Welcome! Your free account is now active.');
                
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            } else {
                setMessage(result.error || 'Failed to set up free account. Please try again.');
            }
        } catch (error) {
            console.error('Error setting up free tier:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleProTier = async () => {
        if (!currentUser) {
            // Redirect to login first
            setActionLoading(true);
            setMessage('Redirecting to Google login...');
            
            const { error } = await supabase.auth.signInWithOAuth({ 
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/subscription-tiers`,
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            
            if (error) {
                setMessage('Login failed. Please try again.');
                setActionLoading(false);
                return;
            }
            return;
        }

        setActionLoading(true);
        setMessage('Starting your 7-day free trial...');

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
            <div className="subscription-tiers-page">
                <div className="tiers-header">
                    <h1>Loading...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-tiers-page">
            <div className="tiers-header">
                <h1>Choose Your Plan</h1>
                <p>Start creating and sharing your content with the perfect plan for you</p>
            </div>

            {message && (
                <div className={`message ${message.includes('error') ? 'error' : 'success'}`}>
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
                        
                        <button
                            className={`tier-button ${isButtonDisabled(tier) ? 'disabled' : ''}`}
                            onClick={() => handleTierAction(tier.id)}
                            disabled={isButtonDisabled(tier)}
                            style={{ backgroundColor: tier.color }}
                        >
                            {getButtonText(tier)}
                        </button>
                    </div>
                ))}
            </div>

            <div className="tiers-footer">
                <p>All plans include secure payment processing and 24/7 support</p>
                <p>Cancel anytime. No long-term commitments.</p>
            </div>
        </div>
    );
};

export default SubscriptionTiers; 