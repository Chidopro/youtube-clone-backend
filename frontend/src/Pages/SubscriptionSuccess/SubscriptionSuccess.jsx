import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SubscriptionService } from '../../utils/subscriptionService';
import { API_CONFIG } from '../../config/apiConfig';
import { supabase } from '../../supabaseClient';
import './SubscriptionSuccess.css';

const SubscriptionSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verifySubscription = async () => {
            const sessionId = searchParams.get('session_id');
            
            if (!sessionId) {
                setError('No session ID found');
                setLoading(false);
                return;
            }

            try {
                // Check if user is authenticated
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                
                if (authError || !user) {
                    // Store the session ID in localStorage for after login
                    localStorage.setItem('pendingSubscriptionSession', sessionId);
                    // Redirect to login with return URL
                    navigate('/login?returnTo=/subscription-success');
                    return;
                }

                // Check if there's a pending subscription session from before login
                const pendingSession = localStorage.getItem('pendingSubscriptionSession');
                const sessionToUse = pendingSession || sessionId;
                
                if (pendingSession) {
                    // Clear the pending session
                    localStorage.removeItem('pendingSubscriptionSession');
                }

                // Verify the subscription with our backend
                const response = await fetch(`${API_CONFIG.ENDPOINTS.VERIFY_SUBSCRIPTION}/${sessionToUse}`);
                const data = await response.json();

                if (data.success) {
                    // Activate the subscription in our system
                    const result = await SubscriptionService.activateProSubscription(
                        data.subscription_id, 
                        data.customer_id
                    );

                    if (result.success) {
                        setSuccess(true);
                        // Redirect to dashboard after 3 seconds
                        setTimeout(() => {
                            navigate('/dashboard');
                        }, 3000);
                    } else {
                        setError(result.error || 'Failed to activate subscription');
                    }
                } else {
                    setError(data.message || 'Payment verification failed');
                }
            } catch (err) {
                console.error('Error verifying subscription:', err);
                setError('Failed to verify payment');
            } finally {
                setLoading(false);
            }
        };

        verifySubscription();
    }, [searchParams, navigate]);

    if (loading) {
        return (
            <div className="subscription-success-page">
                <div className="success-container">
                    <div className="loading-spinner"></div>
                    <h2>Verifying your subscription...</h2>
                    <p>Please wait while we confirm your payment.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="subscription-success-page">
                <div className="success-container error">
                    <div className="error-icon">❌</div>
                    <h2>Subscription Error</h2>
                    <p>{error}</p>
                    {error.includes('sign in') ? (
                        <button 
                            onClick={() => navigate('/login')}
                            className="retry-btn"
                        >
                            Sign In
                        </button>
                    ) : (
                        <button 
                            onClick={() => navigate('/subscription')}
                            className="retry-btn"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-success-page">
            <div className="success-container">
                <div className="success-icon">🎉</div>
                <h2>Welcome to Pro!</h2>
                <p>Your 7-day free trial has been successfully activated.</p>
                
                <div className="trial-notice">
                    <h3>🎁 7-Day Free Trial Active</h3>
                    <p><strong>You're now in your free trial period!</strong></p>
                    <ul>
                        <li>✅ No charges for the next 7 days</li>
                        <li>✅ Full access to all Pro features</li>
                        <li>✅ Cancel anytime before trial ends</li>
                        <li>✅ After 7 days, you'll be charged $9.99/month</li>
                    </ul>
                </div>
                
                <div className="premium-features">
                    <h3>You now have access to:</h3>
                    <ul>
                        <li>✅ Upload and share your videos</li>
                        <li>✅ Create custom product pages</li>
                        <li>✅ Sell merchandise with revenue sharing</li>
                        <li>✅ Priority customer support</li>
                        <li>✅ Custom branding and channel colors</li>
                        <li>✅ Enhanced upload limits (2GB, 60 minutes)</li>
                        <li>✅ Analytics and sales tracking</li>
                        <li>✅ Creator dashboard and tools</li>
                        <li>✅ Ad-free viewing experience</li>
                        <li>✅ Early access to new features</li>
                    </ul>
                </div>
                
                <p className="redirect-notice">
                    Redirecting to your dashboard in 3 seconds...
                </p>
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="dashboard-btn"
                >
                    Go to Dashboard Now
                </button>
            </div>
        </div>
    );
};

export default SubscriptionSuccess; 