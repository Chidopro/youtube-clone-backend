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
    const [userEmail, setUserEmail] = useState(null);

    useEffect(() => {
        // Scroll to top when page loads
        window.scrollTo(0, 0);
        
        // Clean up old processed sessions (keep only last 10)
        const cleanupOldSessions = () => {
            try {
                const processedSessions = JSON.parse(localStorage.getItem('processedSessions') || '[]');
                if (processedSessions.length > 10) {
                    const recentSessions = processedSessions.slice(-10);
                    localStorage.setItem('processedSessions', JSON.stringify(recentSessions));
                    console.log('🧹 Cleaned up old processed sessions');
                }
            } catch (error) {
                console.error('Error cleaning up sessions:', error);
            }
        };

        cleanupOldSessions();

        const verifySubscription = async () => {
            const sessionId = searchParams.get('session_id');
            const pendingSession = localStorage.getItem('pendingSubscriptionSession');
            const processedSessions = JSON.parse(localStorage.getItem('processedSessions') || '[]');
            const loginAttempts = parseInt(localStorage.getItem('loginAttempts') || '0');
            
            console.log('🔍 Session ID Debug:', {
                sessionIdFromURL: sessionId,
                pendingSessionFromStorage: pendingSession,
                processedSessions,
                loginAttempts,
                searchParams: Object.fromEntries(searchParams.entries())
            });
            
            // Use session ID from URL or from localStorage
            const sessionToUse = sessionId || pendingSession;
            
            console.log('🎯 Session to use:', sessionToUse);
            
            // If no session ID, check if user is logged in and show instructions
            if (!sessionToUse) {
                console.log('📋 No session ID - checking if user is logged in for instructions');
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    console.log('✅ User is logged in, showing instructions');
                    setUserEmail(user.email);
                    setSuccess(true);
                    setLoading(false);
                    return;
                } else {
                    console.error('❌ No session ID and user not logged in');
                    setError('Please sign in to view your instructions and personal link');
                    setLoading(false);
                    return;
                }
            }

            // Check if this session has already been processed to prevent loops
            if (processedSessions.includes(sessionToUse)) {
                console.log('⚠️ Session already processed, redirecting to dashboard');
                setSuccess(true);
                return;
            }

            // Prevent infinite login loops - if we've tried login 3 times, show error
            if (loginAttempts >= 3) {
                console.error('❌ Too many login attempts, showing error');
                setError('Unable to verify subscription. Please contact support.');
                localStorage.removeItem('loginAttempts'); // Reset for next time
                setLoading(false);
                return;
            }

            // Store session ID if it's from URL
            if (sessionId && !pendingSession) {
                localStorage.setItem('pendingSubscriptionSession', sessionId);
                console.log('💾 Stored session ID from URL:', sessionId);
            }

            // Check if user just logged in
            const justLoggedIn = localStorage.getItem('justLoggedIn');
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
                const maxRetries = 3; // Reduced retries to prevent long waits

                while (retryCount < maxRetries) {
                    try {
                        // Use localStorage authentication to match the login system
                        const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
                        const userEmail = localStorage.getItem('user_email');
                        
                        if (isAuthenticated && userEmail) {
                            // Get the actual user ID from the database using the backend API
                            try {
                                const ensureResponse = await fetch('https://copy5-backend.fly.dev/api/users/ensure-exists', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        email: userEmail,
                                        display_name: userEmail.split('@')[0]
                                    })
                                });

                                if (ensureResponse.ok) {
                                    const ensureResult = await ensureResponse.json();
                                    user = { 
                                        id: ensureResult.user.id, // Use actual UUID from database
                                        email: ensureResult.user.email 
                                    };
                                    setUserEmail(ensureResult.user.email); // Set the userEmail state
                                    authError = null;
                                    console.log('✅ User authenticated via localStorage:', userEmail);
                                    break; // User is authenticated, proceed
                                } else {
                                    console.error('Error ensuring user exists:', await ensureResponse.text());
                                    authError = 'Failed to ensure user exists in database';
                                }
                            } catch (apiError) {
                                console.error('Error calling ensure-exists API:', apiError);
                                authError = 'Failed to verify user in database';
                            }
                        } else {
                            user = null;
                            authError = 'Not authenticated in localStorage';
                            console.log(`❌ Auth attempt ${retryCount + 1} failed:`, authError);
                        }
                        
                        if (retryCount < maxRetries - 1) {
                            const delay = 1000; // Shorter delay
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
                    
                    // Increment login attempts
                    const newLoginAttempts = loginAttempts + 1;
                    localStorage.setItem('loginAttempts', newLoginAttempts.toString());
                    
                    // Show redirecting message
                    setRedirecting(true);
                    setLoading(false);
                    setTimeout(() => {
                        navigate('/login?returnTo=/subscription-success');
                    }, 3000);
                    return;
                }

                console.log('✅ User authenticated successfully:', user.email);

                // Clear login attempts since we're authenticated
                localStorage.removeItem('loginAttempts');

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
                        // Mark this session as processed to prevent loops
                        const updatedProcessedSessions = [...processedSessions, sessionToUse];
                        localStorage.setItem('processedSessions', JSON.stringify(updatedProcessedSessions));
                        
                        setSuccess(true);
                        // Clear any pending session
                        localStorage.removeItem('pendingSubscriptionSession');
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
                    <h2>Access Required</h2>
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
                            onClick={() => navigate('/subscription-tiers')}
                            className="retry-btn"
                        >
                            Get Started
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
                
                <p className="welcome-message">
                    🎉 <strong>Welcome to ScreenMerch!</strong> You're all set to start sharing amazing content and earning from your merchandise.
                    <div className="trial-notice-simple">✅ Your account is ready to start earning!</div>
                </p>
                
                <div className="next-steps">
                    <h3>🚀 Your Next Steps:</h3>
                    <ol>
                        <li><strong>Go to dashboard</strong></li>
                        <li><strong>Personalize your page and post content</strong></li>
                        <li><strong>Promote with your personal link</strong></li>
                        <li><strong>Track your sales in Analytics</strong></li>
                        <li><strong>Start earning from your merch sales!</strong></li>
                    </ol>
                    <p className="monthly-payouts">Monthly Payouts</p>
                </div>
                

                
                <div className="channel-link-section">
                    <h3>🛍️ Your ScreenMerch Channel</h3>
                    <p><strong>Share this link with your audience to sell merch:</strong></p>
                    <div className="channel-link-container">
                        <code className="channel-link">
                            {userEmail ? `https://screenmerch.com/channel/${userEmail.split('@')[0]}` : 'https://screenmerch.com/channel/your-name'}
                        </code>
                        <button 
                            onClick={() => {
                                const link = userEmail ? `https://screenmerch.com/channel/${userEmail.split('@')[0]}` : 'https://screenmerch.com/channel/your-name';
                                navigator.clipboard.writeText(link);
                                alert('Channel link copied to clipboard!');
                            }}
                            className="copy-link-btn"
                        >
                            📋 Copy Link
                        </button>
                    </div>
                    <p className="channel-tip">
                        💡 <strong>Pro Tip:</strong> Add this link to your YouTube descriptions, social media bios, and website to start selling merch to your audience!
                    </p>
                </div>
                
                <div className="action-buttons">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="dashboard-btn primary"
                    >
                        🚀 Go to Dashboard
                    </button>
                    <button 
                        onClick={() => navigate('/')}
                        className="dashboard-btn secondary"
                    >
                        🏠 Go to Homepage
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionSuccess; 