import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PaymentPortal.css';
import { supabase } from '../../supabaseClient';
import { PaymentService } from '../../utils/paymentService';
import PaymentSetup from '../../Components/PaymentSetup/PaymentSetup';

const PaymentPortal = () => {
    const [user, setUser] = useState(null);
    const [paymentData, setPaymentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentSetup, setShowPaymentSetup] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Get authenticated user from Supabase
                const { data: { user }, error } = await supabase.auth.getUser();
                
                if (!user) {
                    navigate('/');
                    return;
                }

                setUser(user);
                await fetchPaymentData();
            } catch (error) {
                console.error('Error fetching user data:', error);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    const fetchPaymentData = async () => {
        try {
            console.log('💰 Starting payment data fetch...');
            const response = await PaymentService.getCreatorEarnings();
            if (response.success) {
                console.log('💰 Payment data received:', response.data);
                setPaymentData(response.data);
            } else {
                console.error('❌ Failed to fetch payment data:', response.error);
            }
        } catch (error) {
            console.error('❌ Error fetching payment data:', error);
        }
    };

    if (loading) {
        return (
            <div className="payment-portal-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading payment portal...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="payment-portal-container">
                <div className="error-container">
                    <p>Please log in to access the payment portal.</p>
                    <button onClick={() => navigate('/')}>Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-portal-container">
            <div className="payment-portal-header">
                <button className="back-button" onClick={() => navigate(-1)}>
                    ← Back
                </button>
                <h1>💰 Payment Portal</h1>
                <p>Manage your payment settings and track your earnings</p>
            </div>

            {/* Payment Status Overview */}
            <div className="payment-status-section">
                <div className="payment-status-cards">
                    <div className="status-card">
                        <h4>📋 Payment Setup</h4>
                        <div className="status-indicator">
                            {paymentData?.user?.payout_enabled ? (
                                <span className="status-success">✅ Complete</span>
                            ) : (
                                <span className="status-warning">⚠️ Not Set Up</span>
                            )}
                        </div>
                        {paymentData?.user?.paypal_email && (
                            <p className="status-detail">PayPal: {paymentData.user.paypal_email}</p>
                        )}
                    </div>
                    
                    <div className="status-card">
                        <h4>💰 Total Earnings</h4>
                        <div className="earnings-amount">
                            ${paymentData?.user?.total_earnings?.toFixed(2) || '0.00'}
                        </div>
                        <p className="status-detail">Lifetime earnings</p>
                    </div>
                    
                    <div className="status-card">
                        <h4>💸 Pending Payout</h4>
                        <div className="pending-amount">
                            ${paymentData?.user?.pending_payout?.toFixed(2) || '0.00'}
                        </div>
                        <p className="status-detail">
                            {paymentData?.user?.pending_payout >= 50 ? 'Ready for payout' : 'Min $50 required'}
                        </p>
                    </div>
                    
                    <div className="status-card">
                        <h4>📅 Next Payout</h4>
                        <div className="payout-date">
                            {paymentData?.user?.last_payout_date ? 
                                new Date(paymentData.user.last_payout_date).toLocaleDateString() :
                                'Not scheduled'
                            }
                        </div>
                        <p className="status-detail">Monthly on the 1st</p>
                    </div>
                </div>
            </div>

            {/* Payment Setup Section */}
            <div className="payment-setup-section">
                <div className="section-header">
                    <h3>🔧 Payment Setup</h3>
                    {!paymentData?.user?.payout_enabled && (
                        <button 
                            className="setup-payment-btn"
                            onClick={() => setShowPaymentSetup(true)}
                        >
                            Set Up Payments
                        </button>
                    )}
                </div>
                
                {showPaymentSetup ? (
                    <div className="payment-setup-modal">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h4>Set Up Payment Information</h4>
                                <button 
                                    className="close-btn"
                                    onClick={() => setShowPaymentSetup(false)}
                                >
                                    ×
                                </button>
                            </div>
                            <PaymentSetup 
                                onComplete={() => {
                                    setShowPaymentSetup(false);
                                    fetchPaymentData();
                                }}
                                onSkip={() => setShowPaymentSetup(false)}
                                onClose={() => setShowPaymentSetup(false)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="setup-info">
                        {paymentData?.user?.payout_enabled ? (
                            <div className="setup-complete">
                                <p>✅ Your payment information is set up and ready to receive payouts.</p>
                                <button 
                                    className="edit-payment-btn"
                                    onClick={() => setShowPaymentSetup(true)}
                                >
                                    Edit Payment Info
                                </button>
                            </div>
                        ) : (
                            <div className="setup-required">
                                <p>⚠️ You need to set up your payment information to receive earnings from your content.</p>
                                <ul>
                                    <li>Add your PayPal Business email</li>
                                    <li>Provide tax information for 1099-K reporting</li>
                                    <li>Set up automatic monthly payouts</li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recent Earnings */}
            {paymentData?.recentEarnings && paymentData.recentEarnings.length > 0 && (
                <div className="recent-earnings-section">
                    <h3>📈 Recent Earnings</h3>
                    <div className="earnings-list">
                        {paymentData.recentEarnings.map((earning, index) => (
                            <div key={index} className="earning-item">
                                <div className="earning-info">
                                    <span className="earning-amount">${earning.amount?.toFixed(2)}</span>
                                    <span className="earning-date">
                                        {new Date(earning.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="earning-source">
                                    {earning.source || 'Product Sale'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Payouts */}
            {paymentData?.recentPayouts && paymentData.recentPayouts.length > 0 && (
                <div className="recent-payouts-section">
                    <h3>💸 Recent Payouts</h3>
                    <div className="payouts-list">
                        {paymentData.recentPayouts.map((payout, index) => (
                            <div key={index} className="payout-item">
                                <div className="payout-info">
                                    <span className="payout-amount">${payout.amount?.toFixed(2)}</span>
                                    <span className="payout-date">
                                        {new Date(payout.payout_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="payout-status">
                                    <span className={`status-badge ${payout.status}`}>
                                        {payout.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment Information */}
            <div className="payment-info-section">
                <h3>ℹ️ Payment Information</h3>
                <div className="info-grid">
                    <div className="info-card">
                        <h4>💰 How You Earn</h4>
                        <p>You earn 70% of all sales from your merchandise. The remaining 30% covers platform fees and processing costs.</p>
                    </div>
                    <div className="info-card">
                        <h4>📅 Payout Schedule</h4>
                        <p>Payouts are processed monthly on the 1st of each month for earnings above $50.00.</p>
                    </div>
                    <div className="info-card">
                        <h4>📊 Tax Reporting</h4>
                        <p>You'll receive a 1099-K form for tax reporting if you earn more than $600 in a year.</p>
                    </div>
                    <div className="info-card">
                        <h4>🔒 Security</h4>
                        <p>All payment information is securely stored and encrypted. We never store your full payment details.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentPortal;
