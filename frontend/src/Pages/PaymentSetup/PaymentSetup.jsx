import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import PaymentSetupComponent from '../../Components/PaymentSetup/PaymentSetup';
import './PaymentSetup.css';

const PaymentSetup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                
                // Check if this is a new user flow (allow unauthenticated access)
                const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
                
                if (!user && !isNewUserFlow) {
                    // Only redirect to signup if not in new user flow
                    navigate('/signup', { 
                        state: { 
                            from: location.pathname,
                            message: 'Please sign up to set up your payment information and start earning.' 
                        } 
                    });
                    return;
                }

                setUser(user);
            } catch (error) {
                console.error('Error checking authentication:', error);
                // Don't redirect on error for new user flow
                const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
                if (!isNewUserFlow) {
                    navigate('/signup');
                }
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate, location]);

    const handleComplete = () => {
        // Check if this is a new user flow
        const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
        
        if (isNewUserFlow) {
            // For new users, redirect to account creation after PayPal setup
            navigate('/signup', { 
                state: { 
                    message: 'Great! Your PayPal is set up. Now create your account to start earning!' 
                } 
            });
        } else {
            // For existing users, navigate to dashboard
            navigate('/dashboard', { 
                state: { 
                    message: 'Payment information set up successfully! You can now start earning with ScreenMerch - completely free!' 
                } 
            });
        }
    };

    const handleSkip = () => {
        // Check if this is a new user flow
        const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
        
        if (isNewUserFlow) {
            // For new users, redirect to account creation even if they skip PayPal
            navigate('/signup', { 
                state: { 
                    message: 'No problem! You can set up PayPal later. Let\'s create your account!' 
                } 
            });
        } else {
            // For existing users, navigate to dashboard
            navigate('/dashboard', { 
                state: { 
                    message: 'Welcome to ScreenMerch! You can set up payment information later in your dashboard to start earning.' 
                } 
            });
        }
    };

    if (loading) {
        return (
            <div className="payment-setup-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-setup-page">
            <div className="payment-setup-header">
                <h1>💰 Welcome to ScreenMerch!</h1>
                <p>Set up your payment information to start earning from your merchandise sales - It's completely free!</p>
            </div>
            
            <PaymentSetupComponent 
                onComplete={handleComplete}
                onSkip={handleSkip}
            />
        </div>
    );
};

export default PaymentSetup;
