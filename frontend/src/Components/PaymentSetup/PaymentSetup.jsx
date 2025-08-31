import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './PaymentSetup.css';

const PaymentSetup = ({ onComplete, onSkip }) => {
    const [paypalEmail, setPaypalEmail] = useState('');
    const [taxId, setTaxId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);

    useEffect(() => {
        // Load existing payment info if available
        loadExistingPaymentInfo();
    }, []);

    const loadExistingPaymentInfo = async () => {
        try {
            // Use localStorage authentication to match the rest of the system
            const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
            const userEmail = localStorage.getItem('user_email');
            
            if (!isAuthenticated || !userEmail) {
                console.log('❌ User not authenticated in localStorage');
                return;
            }

            // Get the actual user ID from the database using the email
            const { data: userData, error } = await supabase
                .from('users')
                .select('id, paypal_email, tax_id, payout_enabled')
                .eq('email', userEmail)
                .single();

            if (userData) {
                setPaypalEmail(userData.paypal_email || '');
                setTaxId(userData.tax_id || '');
            }
        } catch (error) {
            console.error('Error loading payment info:', error);
        }
    };

    const handlePaypalSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if this is a new user flow
            const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
            
            if (isNewUserFlow) {
                // For new users, just store PayPal email in localStorage for later
                localStorage.setItem('pending_paypal_email', paypalEmail);
                setCurrentStep(2);
                return;
            }
            
            // Use localStorage authentication to match the rest of the system
            const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
            const userEmail = localStorage.getItem('user_email');
            
            if (!isAuthenticated || !userEmail) {
                throw new Error('User not authenticated');
            }

            // Get the actual user ID from the database using the email
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail)
                .single();

            if (userError || !userData) {
                throw new Error('User not found in database');
            }

            // Validate PayPal email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(paypalEmail)) {
                throw new Error('Please enter a valid PayPal email address');
            }

            // Update user's PayPal email
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    paypal_email: paypalEmail,
                    payout_enabled: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userData.id);

            if (updateError) throw updateError;

            setCurrentStep(2);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTaxInfoSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if this is a new user flow
            const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
            
            if (isNewUserFlow) {
                // For new users, store tax info in localStorage for later
                localStorage.setItem('pending_tax_id', taxId);
                
                // Complete payment setup
                if (onComplete) {
                    onComplete();
                }
                return;
            }
            
            // Use localStorage authentication to match the rest of the system
            const isAuthenticated = localStorage.getItem('user_authenticated') === 'true';
            const userEmail = localStorage.getItem('user_email');
            
            if (!isAuthenticated || !userEmail) {
                throw new Error('User not authenticated');
            }

            // Get the actual user ID from the database using the email
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail)
                .single();

            if (userError || !userData) {
                throw new Error('User not found in database');
            }

            // Update tax information
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    tax_id: taxId,
                    tax_info_verified: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userData.id);

            if (updateError) throw updateError;

            // Complete payment setup
            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        }
    };

    return (
        <div className="payment-setup-container">
            <div className="payment-setup-card">
                <div className="payment-setup-header">
                    <h2>💰 Set Up Your Payouts</h2>
                    <p>Get paid for your merch sales with PayPal Business - No monthly fees!</p>
                </div>

                {currentStep === 1 && (
                    <div className="payment-step">
                        <div className="step-indicator">
                            <span className="step active">1</span>
                            <span className="step">2</span>
                        </div>
                        
                        <h3>PayPal Business Account</h3>
                        <p>Enter your PayPal Business email to receive payments</p>
                        
                        <form onSubmit={handlePaypalSubmit} className="payment-form">
                            <div className="form-group">
                                <label htmlFor="paypal-email">PayPal Business Email</label>
                                <input
                                    type="email"
                                    id="paypal-email"
                                    value={paypalEmail}
                                    onChange={(e) => setPaypalEmail(e.target.value)}
                                    placeholder="your-business@paypal.com"
                                    required
                                />
                                <small>Make sure this is a PayPal Business account</small>
                            </div>

                            <div className="payment-benefits">
                                <h4>Why PayPal Business?</h4>
                                <ul>
                                    <li>✅ Fast, secure payments</li>
                                    <li>✅ Professional for business transactions</li>
                                    <li>✅ Low fees (2.9% + $0.30)</li>
                                    <li>✅ Monthly payouts on the 1st</li>
                                    <li>✅ $50 minimum payout threshold</li>
                                </ul>
                            </div>

                            {error && <div className="error-message">{error}</div>}

                            <div className="form-actions">
                                <button 
                                    type="submit" 
                                    className="btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Setting up...' : 'Continue'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-secondary"
                                    onClick={handleSkip}
                                >
                                    Set up later
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="payment-step">
                        <div className="step-indicator">
                            <span className="step completed">1</span>
                            <span className="step active">2</span>
                        </div>
                        
                        <h3>Tax Information</h3>
                        <p>Required for payouts over $600/year (US tax law)</p>
                        
                        <form onSubmit={handleTaxInfoSubmit} className="payment-form">
                            <div className="form-group">
                                <label htmlFor="tax-id">Tax ID or SSN</label>
                                <input
                                    type="text"
                                    id="tax-id"
                                    value={taxId}
                                    onChange={(e) => setTaxId(e.target.value)}
                                    placeholder="123-45-6789 or 12-3456789"
                                />
                                <small>We'll securely store this for tax reporting</small>
                            </div>

                            <div className="tax-info">
                                <h4>Tax Information</h4>
                                <p>This information is required by US law for payments over $600/year. We'll provide you with a 1099-K form for tax purposes.</p>
                            </div>

                            {error && <div className="error-message">{error}</div>}

                            <div className="form-actions">
                                <button 
                                    type="submit" 
                                    className="btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Complete Setup'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-secondary"
                                    onClick={() => setCurrentStep(1)}
                                >
                                    Back
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSetup;
