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
                
                if (!user) {
                    navigate('/login', { 
                        state: { 
                            from: location.pathname,
                            message: 'Please log in to set up your payment information.' 
                        } 
                    });
                    return;
                }

                setUser(user);
            } catch (error) {
                console.error('Error checking authentication:', error);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate, location]);

    const handleComplete = () => {
        // Navigate to dashboard after payment setup is complete
        navigate('/dashboard', { 
            state: { 
                message: 'Payment information set up successfully! You can now start earning with ScreenMerch.' 
            } 
        });
    };

    const handleSkip = () => {
        // Navigate to dashboard if user skips payment setup
        navigate('/dashboard', { 
            state: { 
                message: 'You can set up payment information later in your dashboard.' 
            } 
        });
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
                <p>Set up your payment information to start earning from your merchandise sales</p>
            </div>
            
            <PaymentSetupComponent 
                onComplete={handleComplete}
                onSkip={handleSkip}
            />
        </div>
    );
};

export default PaymentSetup;
