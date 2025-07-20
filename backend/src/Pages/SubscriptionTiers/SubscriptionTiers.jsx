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
            id: 'basic',
            name: 'Basic Tier',
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
            id: 'premium',
            name: 'Premium Tier',
            price: '$9.99/month',
            features: [
                'Everything in Basic',
                'Advanced analytics',
                'Priority support',
                'Custom branding',
                'Enhanced upload limits'
            ],
            color: '#007bff',
            popular: false
        },
        {
            id: 'creator_network',
            name: 'Creator Network Tier',
            price: '$29.99/month',
            features: [
                'Everything in Premium',
                'Invite friends to create content',
                'Friends list sidebar',
                'Revenue sharing (15%)',
                'Advanced creator tools',
                'Network analytics',
                'Up to 50 friends'
            ],
            color: '#28a745',
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

    const handleBasicTierSignup = async () => {
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
        setMessage('Setting up your Basic tier subscription...');

        try {
            const result = await SubscriptionService.subscribeToBasicTier();
            
            if (result.success) {
                setUserSubscription(result.subscription);
                setMessage('Welcome to ScreenMerch! Your Basic tier subscription is now active.');
                
                // Redirect to dashboard after a moment
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            } else {
                setMessage(result.error || 'Failed to activate subscription. Please try again.');
            }
        } catch (error) {
            console.error('Error subscribing to basic tier:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePremiumTier = async () => {
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
        setMessage('Redirecting to secure payment...');

        try {
            const result = await SubscriptionService.subscribeToPremiumTier();
            
            if (result.success) {
                if (result.redirecting) {
                    setMessage('Redirecting to Stripe checkout...');
                } else {
                    setUserSubscription(result.subscription);
                    setMessage('Welcome to Premium! Your subscription is now active.');
                    
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 2000);
                }
            } else {
                setMessage(result.error || 'Failed to start subscription process. Please try again.');
            }
        } catch (error) {
            console.error('Error subscribing to premium tier:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreatorNetworkTier = async () => {
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
        setMessage('Redirecting to secure payment...');

        try {
            const result = await SubscriptionService.subscribeToCreatorNetworkTier();
            
            if (result.success) {
                if (result.redirecting) {
                    setMessage('Redirecting to Stripe checkout...');
                } else {
                    setUserSubscription(result.subscription);
                    setMessage('Welcome to Creator Network! Your subscription is now active.');
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 2000);
                }
            } else {
                setMessage(result.error || 'Failed to start subscription process. Please try again.');
            }
        } catch (error) {
            console.error('Error subscribing to creator network tier:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTierAction = (tierId) => {
        switch (tierId) {
            case 'basic':
                handleBasicTierSignup();
                break;
            case 'premium':
                handlePremiumTier();
                break;
            case 'creator_network':
                handleCreatorNetworkTier();
                break;
            default:
                setMessage('Invalid tier selection.');
        }
    };

    const getButtonText = (tier) => {
        if (actionLoading) return 'Processing...';
        
        if (userSubscription?.tier === tier.id) {
            return 'Current Plan';
        }
        
        if (tier.id === 'basic') {
            return currentUser ? 'Get Started' : 'Sign Up & Get Started';
        }
        
        return 'Subscribe Now';
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
                <h1>Choose Your Subscription Tier</h1>
                <p>Unlock your potential with our three-tier subscription system</p>
                {currentUser && userSubscription && (
                    <p className="current-tier-info">
                        Current plan: <strong>{SubscriptionService.getTierConfig(userSubscription.tier).name}</strong>
                    </p>
                )}
                {!currentUser && (
                    <p className="auth-notice" style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
                        Sign in with Google to manage your subscription
                    </p>
                )}
            </div>
            
            {message && (
                <div className={`message ${message.includes('Welcome') || message.includes('active') ? 'success' : 'info'}`}>
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
                                className="subscribe-btn"
                                style={{ 
                                    backgroundColor: isButtonDisabled(tier) ? '#ccc' : tier.color,
                                    cursor: isButtonDisabled(tier) ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => handleTierAction(tier.id)}
                                disabled={isButtonDisabled(tier)}
                            >
                                {getButtonText(tier)}
                            </button>
                        </div>
                        
                        {tier.name === 'Creator Network Tier' && (
                            <div className="network-highlight" id="be-a-friend-breakdown">
                                <h4>🎯 Creator Network Benefits</h4>
                                <p>Invite friends to create content and earn 15% of their sales!</p>
                                <div className="network-features">
                                    <div className="network-feature">
                                        <span className="icon">👥</span>
                                        <span>Friends List Sidebar</span>
                                    </div>
                                    <div className="network-feature">
                                        <span className="icon">💰</span>
                                        <span>Revenue Sharing</span>
                                    </div>
                                    <div className="network-feature">
                                        <span className="icon">📊</span>
                                        <span>Network Analytics</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="tiers-footer">
                <div style={{ marginTop: 32 }}>
                    <Link to="/" className="back-home-btn">
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionTiers; 