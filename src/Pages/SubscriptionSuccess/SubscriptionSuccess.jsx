import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SubscriptionService } from '../../utils/subscriptionService';
import { API_CONFIG } from '../../config/apiConfig';
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
                // Verify the subscription with our backend
                const response = await fetch(`${API_CONFIG.ENDPOINTS.VERIFY_SUBSCRIPTION}/${sessionId}`);
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
                    <button 
                        onClick={() => navigate('/subscription-tiers')}
                        className="retry-btn"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-success-page">
            <div className="success-container">
                <div className="success-icon">🎉</div>
                <h2>Welcome to Premium!</h2>
                <p>Your subscription has been successfully activated.</p>
                <div className="premium-features">
                    <h3>You now have access to:</h3>
                    <ul>
                        <li>✅ Advanced analytics</li>
                        <li>✅ Priority support</li>
                        <li>✅ Custom branding</li>
                        <li>✅ Enhanced upload limits</li>
                        <li>✅ All Premium features</li>
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