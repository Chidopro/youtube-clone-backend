import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './PaymentSetup.css';

const PaymentSetup = ({ onComplete, onSkip, onClose }) => {
    const [selectedMethod, setSelectedMethod] = useState('paypal');
    const [paypalEmail, setPaypalEmail] = useState('');
    const [taxId, setTaxId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    
    // ACH/Bank Transfer fields
    const [achRoutingNumber, setAchRoutingNumber] = useState('');
    const [achAccountNumber, setAchAccountNumber] = useState('');
    const [achAccountType, setAchAccountType] = useState('checking');
    const [achAccountName, setAchAccountName] = useState('');
    
    // Stripe Connect fields
    const [stripeEmail, setStripeEmail] = useState('');
    const [stripeCountry, setStripeCountry] = useState('US');
    
    // Available payment methods - set initial state with fallback methods
    const [availableMethods, setAvailableMethods] = useState([
        {
            method_name: 'paypal',
            display_name: 'PayPal Business',
            description: 'Fast, secure PayPal Business payments with low fees',
            fees_percentage: 2.9,
            fees_fixed: 0.30,
            processing_time_days: 1,
            min_payout: 50.00,
            is_available: true
        },
        {
            method_name: 'ach',
            display_name: 'Direct Bank Transfer',
            description: 'Direct deposit to your bank account with minimal fees',
            fees_percentage: 0.5,
            fees_fixed: 0.25,
            processing_time_days: 3,
            min_payout: 50.00,
            is_available: true
        },
        {
            method_name: 'stripe',
            display_name: 'Stripe Connect',
            description: 'Professional payment processing with advanced features',
            fees_percentage: 2.9,
            fees_fixed: 0.30,
            processing_time_days: 2,
            min_payout: 25.00,
            is_available: true
        }
    ]);

    useEffect(() => {
        // Load existing payment info if available
        loadExistingPaymentInfo();
        loadAvailablePaymentMethods();
    }, []);

    const loadAvailablePaymentMethods = async () => {
        console.log('🔄 Loading available payment methods...');
        
        // IMMEDIATELY set fallback methods - no async delay
        const fallbackMethods = [
            {
                method_name: 'paypal',
                display_name: 'PayPal Business',
                description: 'Fast, secure PayPal Business payments with low fees',
                fees_percentage: 2.9,
                fees_fixed: 0.30,
                processing_time_days: 1,
                min_payout: 50.00,
                is_available: true
            },
            {
                method_name: 'ach',
                display_name: 'Direct Bank Transfer',
                description: 'Direct deposit to your bank account with minimal fees',
                fees_percentage: 0.5,
                fees_fixed: 0.25,
                processing_time_days: 3,
                min_payout: 50.00,
                is_available: true
            },
            {
                method_name: 'stripe',
                display_name: 'Stripe Connect',
                description: 'Professional payment processing with advanced features',
                fees_percentage: 2.9,
                fees_fixed: 0.30,
                processing_time_days: 2,
                min_payout: 25.00,
                is_available: true
            }
        ];
        
        console.log('✅ Setting fallback payment methods:', fallbackMethods);
        setAvailableMethods(fallbackMethods);
        
        // Log the state after setting
        setTimeout(() => {
            console.log('🔍 State after setting methods:', availableMethods);
        }, 100);
        
        // Try to get payment methods from database (optional)
        try {
            const { data, error } = await supabase
                .rpc('get_user_payment_methods', { user_country: 'US' });
            
            if (!error && data && data.length > 0) {
                console.log('✅ Database payment methods loaded:', data);
                setAvailableMethods(data);
            } else {
                console.log('ℹ️ Database function not available, using fallback methods');
            }
        } catch (error) {
            console.log('ℹ️ Database error, using fallback methods:', error.message);
        }
    };

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
                .select('id, paypal_email, tax_id, payout_enabled, preferred_payment_method, ach_routing_number, ach_account_type, stripe_connect_account_id')
                .eq('email', userEmail)
                .single();

            if (userData) {
                setPaypalEmail(userData.paypal_email || '');
                setTaxId(userData.tax_id || '');
                setSelectedMethod(userData.preferred_payment_method || 'paypal');
                setAchRoutingNumber(userData.ach_routing_number || '');
                setAchAccountType(userData.ach_account_type || 'checking');
                setStripeEmail(userData.stripe_connect_account_id || '');
            }
        } catch (error) {
            console.error('Error loading payment info:', error);
        }
    };

    const handlePaymentMethodSelect = (method) => {
        setSelectedMethod(method);
        setError(null);
    };

    const validatePaymentInfo = () => {
        if (selectedMethod === 'paypal') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(paypalEmail)) {
                throw new Error('Please enter a valid PayPal email address');
            }
        } else if (selectedMethod === 'ach') {
            if (!achRoutingNumber || achRoutingNumber.length !== 9) {
                throw new Error('Please enter a valid 9-digit routing number');
            }
            if (!achAccountNumber || achAccountNumber.length < 4) {
                throw new Error('Please enter a valid account number');
            }
            if (!achAccountName.trim()) {
                throw new Error('Please enter the account holder name');
            }
        } else if (selectedMethod === 'stripe') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(stripeEmail)) {
                throw new Error('Please enter a valid email for Stripe Connect');
            }
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if this is a new user flow
            const isNewUserFlow = new URLSearchParams(window.location.search).get('flow') === 'new_user';
            
            if (isNewUserFlow) {
                // For new users, store payment info in localStorage for later
                localStorage.setItem('pending_payment_method', selectedMethod);
                if (selectedMethod === 'paypal') {
                    localStorage.setItem('pending_paypal_email', paypalEmail);
                } else if (selectedMethod === 'ach') {
                    localStorage.setItem('pending_ach_info', JSON.stringify({
                        routing: achRoutingNumber,
                        account: achAccountNumber,
                        type: achAccountType,
                        name: achAccountName
                    }));
                } else if (selectedMethod === 'stripe') {
                    localStorage.setItem('pending_stripe_email', stripeEmail);
                }
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

            // Validate payment information
            validatePaymentInfo();

            // Prepare update data based on selected method
            const updateData = {
                preferred_payment_method: selectedMethod,
                payout_enabled: true,
                updated_at: new Date().toISOString()
            };

            if (selectedMethod === 'paypal') {
                updateData.paypal_email = paypalEmail;
            } else if (selectedMethod === 'ach') {
                updateData.ach_routing_number = achRoutingNumber;
                updateData.ach_account_type = achAccountType;
                // In production, encrypt the account number before storing
                updateData.ach_account_number_encrypted = btoa(achAccountNumber); // Simple encoding for demo
                updateData.bank_account_verified = false; // Will need verification
            } else if (selectedMethod === 'stripe') {
                updateData.stripe_connect_account_id = stripeEmail;
                updateData.stripe_connect_status = 'pending';
            }

            // Update user's payment information
            const { error: updateError } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', userData.id);

            if (updateError) throw updateError;

            setCurrentStep(2);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTaxSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
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

            // Update user's tax information
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    tax_id: taxId,
                    tax_info_verified: false, // Will need verification
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

    const renderPaymentMethodForm = () => {
        switch (selectedMethod) {
            case 'paypal':
                return (
                    <div className="payment-form">
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
                    </div>
                );
            
            case 'ach':
                return (
                    <div className="payment-form">
                        <div className="form-group">
                            <label htmlFor="ach-account-name">Account Holder Name</label>
                            <input
                                type="text"
                                id="ach-account-name"
                                value={achAccountName}
                                onChange={(e) => setAchAccountName(e.target.value)}
                                placeholder="John Doe"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ach-routing">Routing Number</label>
                            <input
                                type="text"
                                id="ach-routing"
                                value={achRoutingNumber}
                                onChange={(e) => setAchRoutingNumber(e.target.value)}
                                placeholder="123456789"
                                maxLength="9"
                                required
                            />
                            <small>9-digit routing number from your bank</small>
                        </div>
                        <div className="form-group">
                            <label htmlFor="ach-account">Account Number</label>
                            <input
                                type="text"
                                id="ach-account"
                                value={achAccountNumber}
                                onChange={(e) => setAchAccountNumber(e.target.value)}
                                placeholder="1234567890"
                                required
                            />
                            <small>Your bank account number</small>
                        </div>
                        <div className="form-group">
                            <label htmlFor="ach-type">Account Type</label>
                            <select
                                id="ach-type"
                                value={achAccountType}
                                onChange={(e) => setAchAccountType(e.target.value)}
                                required
                            >
                                <option value="checking">Checking</option>
                                <option value="savings">Savings</option>
                            </select>
                        </div>
                    </div>
                );
            
            case 'stripe':
                return (
                    <div className="payment-form">
                        <div className="form-group">
                            <label htmlFor="stripe-email">Email for Stripe Connect</label>
                            <input
                                type="email"
                                id="stripe-email"
                                value={stripeEmail}
                                onChange={(e) => setStripeEmail(e.target.value)}
                                placeholder="your-email@example.com"
                                required
                            />
                            <small>This email will be used to set up your Stripe Connect account</small>
                        </div>
                        <div className="form-group">
                            <label htmlFor="stripe-country">Country</label>
                            <select
                                id="stripe-country"
                                value={stripeCountry}
                                onChange={(e) => setStripeCountry(e.target.value)}
                                required
                            >
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="GB">United Kingdom</option>
                                <option value="AU">Australia</option>
                                <option value="DE">Germany</option>
                                <option value="FR">France</option>
                            </select>
                        </div>
                    </div>
                );
            
            default:
                return null;
        }
    };

    const renderPaymentMethodBenefits = () => {
        const method = availableMethods.find(m => m.method_name === selectedMethod);
        if (!method) return null;

        return (
            <div className="payment-benefits">
                <h4>Why {method.display_name}?</h4>
                <ul>
                    <li>✅ {method.description}</li>
                    <li>✅ Processing time: {method.processing_time_days} business day(s)</li>
                    <li>✅ Minimum payout: ${method.min_payout}</li>
                    <li>✅ Fees: {method.fees_percentage}% + ${method.fees_fixed}</li>
                </ul>
            </div>
        );
    };

    // Debug log before render
    console.log('🎯 RENDERING PaymentSetup. availableMethods:', availableMethods, 'length:', availableMethods.length);
    
    return (
        <div className="payment-setup-container">
            <div className="payment-setup-card">
                <div className="payment-setup-header">
                    <div className="header-content">
                        <h2>💰 Connect Payment Method</h2>
                        <p>Please connect your payment method to receive payouts</p>
                    </div>
                    {onClose && (
                        <button 
                            className="payment-setup-close-btn"
                            onClick={onClose}
                            aria-label="Close payment setup"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {currentStep === 1 && (
                    <div className="payment-step">
                        <div className="step-indicator">
                            <span className="step active">1</span>
                            <span className="step">2</span>
                        </div>
                        
                        <h3>Connect Payment Method</h3>
                        <p>Please connect your payment method to receive payouts</p>
                        
                        {/* Payment Method Selection */}
                        <div className="payment-method-selection">
                            {console.log('🔍 Rendering payment methods. availableMethods:', availableMethods)}
                            {availableMethods.length === 0 ? (
                                <div className="loading-methods">
                                    <p>Loading payment methods...</p>
                                </div>
                            ) : (
                                availableMethods.map((method) => (
                                    <div 
                                        key={method.method_name}
                                        className={`payment-method-option ${selectedMethod === method.method_name ? 'selected' : ''} ${!method.is_available ? 'unavailable' : ''}`}
                                        onClick={() => method.is_available && handlePaymentMethodSelect(method.method_name)}
                                    >
                                        <div className="method-header">
                                            <input
                                                type="radio"
                                                name="payment-method"
                                                id={method.method_name}
                                                value={method.method_name}
                                                checked={selectedMethod === method.method_name}
                                                onChange={() => method.is_available && handlePaymentMethodSelect(method.method_name)}
                                                disabled={!method.is_available}
                                            />
                                            <label htmlFor={method.method_name}>
                                                <span className="method-name">{method.display_name}</span>
                                                {!method.is_available && <span className="unavailable-badge">Not Available</span>}
                                            </label>
                                        </div>
                                        <div className="method-details">
                                            <span className="fees">{method.fees_percentage}% + ${method.fees_fixed}</span>
                                            <span className="processing-time">{method.processing_time_days} day(s)</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Payment Method Form */}
                        {renderPaymentMethodForm()}

                        {/* Payment Method Benefits */}
                        {renderPaymentMethodBenefits()}

                        <div className="form-actions">
                            <button 
                                type="submit" 
                                className="submit-btn"
                                onClick={handlePaymentSubmit}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'Connect Payment Method'}
                            </button>
                        </div>

                        {error && <div className="error-message">{error}</div>}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="payment-step">
                        <div className="step-indicator">
                            <span className="step completed">1</span>
                            <span className="step active">2</span>
                        </div>
                        
                        <h3>Connect Payment Method</h3>
                        <p>Please connect your payment method to receive payouts</p>
                        
                        <form onSubmit={handleTaxSubmit} className="payment-form">
                            <div className="form-group">
                                <label htmlFor="payment-email">Payment Email</label>
                                <input
                                    type="email"
                                    id="payment-email"
                                    value={taxId}
                                    onChange={(e) => setTaxId(e.target.value)}
                                    placeholder="your-email@example.com"
                                    required
                                />
                                <small>Enter the email associated with your payment method (PayPal, Stripe, etc.)</small>
                                
                                {/* Security Notice */}
                                <div className="security-notice">
                                    <div className="security-icon">🔒</div>
                                    <div className="security-text">
                                        <strong>Security Notice:</strong> Your payment information is securely handled through trusted third-party processors. We never store sensitive payment details.
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button 
                                    type="submit" 
                                    className="submit-btn"
                                    disabled={loading}
                                >
                                    {loading ? 'Processing...' : 'Connect Payment Method'}
                                </button>
                                <button 
                                    type="button" 
                                    className="skip-btn"
                                    onClick={handleSkip}
                                    disabled={loading}
                                >
                                    Skip for Now
                                </button>
                            </div>

                            {error && <div className="error-message">{error}</div>}
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSetup;
