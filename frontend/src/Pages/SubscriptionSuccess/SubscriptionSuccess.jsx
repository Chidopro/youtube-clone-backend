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
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        const verifySubscription = async () => {
            const sessionId = searchParams.get('session_id');
            const pendingSession = localStorage.getItem('pendingSubscriptionSession');
            const justLoggedIn = localStorage.getItem('justLoggedIn');
            
            console.log('🔍 Session ID Debug:', {
                sessionIdFromURL: sessionId,
                pendingSessionFromStorage: pendingSession,
                justLoggedIn,
                searchParams: Object.fromEntries(searchParams.entries())
            });
            
            // Use session ID from URL or from localStorage
            const sessionToUse = sessionId || pendingSession;
            
            console.log('🎯 Session to use:', sessionToUse);
            
            if (!sessionToUse) {
                console.error('❌ No session ID found in URL or localStorage');
                setError('No session ID found');
                setLoading(false);
                return;
            }

            // Store session ID if it's from URL
            if (sessionId && !pendingSession) {
                localStorage.setItem('pendingSubscriptionSession', sessionId);
                console.log('💾 Stored session ID from URL:', sessionId);
            }

            // If user just logged in, wait longer for auth state to settle
            if (justLoggedIn) {
                console.log('🔄 User just logged in, waiting for auth state to settle...');
                localStorage.removeItem('justLoggedIn'); // Clear the flag
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            }

            try {
                // Check if user is authenticated with retry mechanism
                let user = null;
                let authError = null;
                let retryCount = 0;
                const maxRetries = 5; // Increased retries

                while (retryCount < maxRetries) {
                    try {
                        // Use the same auth system as login (check localStorage instead of Supabase)
                        const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
                        const userEmail = localStorage.getItem('user_email');
                        
                        if (isAuthenticated && userEmail) {
                            user = { email: userEmail };
                            authError = null;
                        } else {
                            user = null;
                            authError = 'Not authenticated';
                        }
                        
                        console.log(`🔐 Auth check attempt ${retryCount + 1}:`, { 
                            user: !!user, 
                            authError, 
                            sessionId,
                            userEmail: user?.email,
                            isAuthenticated,
                            storedEmail: userEmail
                        });
                        
                        if (user && !authError) {
                            break; // User is authenticated, proceed
                        }
                        
                        if (retryCount < maxRetries - 1) {
                            const delay = retryCount === 0 ? 2000 : 1000; // Longer delay on first retry
                            console.log(`⏳ Auth not ready, retrying in ${delay/1000} seconds... (${retryCount + 1}/${maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        
                        retryCount++;
                    } catch (err) {
                        console.error(`❌ Auth check error on attempt ${retryCount + 1}:`, err);
                        retryCount++;
                        if (retryCount < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
                
                if (authError || !user) {
                    console.log('⚠️ User not authenticated after retries, redirecting to login...');
                    // Show redirecting message
                    setRedirecting(true);
                    setLoading(false);
                    setTimeout(() => {
                        navigate('/login?returnTo=/subscription-success');
                    }, 3000);
                    return;
                }

                console.log('✅ User authenticated successfully:', user.email);

                // Clear the pending session since we're using it
                if (pendingSession) {
                    localStorage.removeItem('pendingSubscriptionSession');
                    console.log('🧹 Cleared pending session from localStorage');
                }

                // Verify the subscription with our backend
                console.log('🔍 Verifying subscription with session:', sessionToUse);
                const response = await fetch(`${API_CONFIG.ENDPOINTS.VERIFY_SUBSCRIPTION}/${sessionToUse}`);
                const data = await response.json();
                
                console.log('📡 Verification response:', data);

                if (data.success) {
                    // Activate the subscription in our system
                    const result = await SubscriptionService.activateProSubscription(
                        data.subscription_id, 
                        data.customer_id
                    );

                    if (result.success) {
                        setSuccess(true);
                        // Clear any pending session
                        localStorage.removeItem('pendingSubscriptionSession');
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
                console.error('❌ Error verifying subscription:', err);
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

    if (redirecting) {
        return (
            <div className="subscription-success-page">
                <div className="success-container">
                    <div className="loading-spinner"></div>
                    <h2>Payment Successful! 🎉</h2>
                    <p>Your payment has been processed successfully.</p>
                    <p><strong>Please sign in to complete your subscription activation.</strong></p>
                    <p>You will be redirected to the login page in a few seconds...</p>
                    <button 
                        onClick={() => navigate('/login?returnTo=/subscription-success')}
                        className="retry-btn"
                        style={{ marginTop: '20px' }}
                    >
                        Sign In Now
                    </button>
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