import React, { useState, useEffect } from 'react';
import { PaymentService } from '../../utils/paymentService';
import PaymentSetup from '../PaymentSetup/PaymentSetup';
import './EarningsDashboard.css';

const EarningsDashboard = () => {
    const [earningsData, setEarningsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPaymentSetup, setShowPaymentSetup] = useState(false);

    useEffect(() => {
        loadEarningsData();
    }, []);

    const loadEarningsData = async () => {
        try {
            setLoading(true);
            const result = await PaymentService.getEarningsSummary();
            
            if (result.success) {
                setEarningsData(result.data);
            } else {
                setError(result.error);
            }
        } catch (error) {
            setError('Failed to load earnings data');
            console.error('Error loading earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSetupComplete = () => {
        setShowPaymentSetup(false);
        loadEarningsData(); // Reload data after setup
    };

    const handlePaymentSetupSkip = () => {
        setShowPaymentSetup(false);
    };

    if (showPaymentSetup) {
        return (
            <PaymentSetup 
                onComplete={handlePaymentSetupComplete}
                onSkip={handlePaymentSetupSkip}
                onClose={handlePaymentSetupSkip}
            />
        );
    }

    if (loading) {
        return (
            <div className="earnings-dashboard">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading your earnings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="earnings-dashboard">
                <div className="error-container">
                    <h3>❌ Error Loading Earnings</h3>
                    <p>{error}</p>
                    <button onClick={loadEarningsData} className="retry-btn">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!earningsData) {
        return (
            <div className="earnings-dashboard">
                <div className="no-data-container">
                    <h3>No earnings data available</h3>
                    <p>Start selling merch to see your earnings here!</p>
                </div>
            </div>
        );
    }

    const {
        monthlyEarnings,
        totalEarnings,
        pendingPayout,
        payoutEnabled,
        nextPayoutDate,
        isEligible
    } = earningsData;

    return (
        <div className="earnings-dashboard">
            <div className="earnings-header">
                <h2>💰 Earnings Dashboard</h2>
                <p>Track your merch sales and payouts</p>
            </div>

            <div className="earnings-grid">
                {/* Monthly Earnings */}
                <div className="earnings-card primary">
                    <div className="card-icon">📊</div>
                    <h3>This Month</h3>
                    <div className="amount">{PaymentService.formatCurrency(monthlyEarnings)}</div>
                    <p>Earnings from merch sales</p>
                </div>

                {/* Total Earnings */}
                <div className="earnings-card secondary">
                    <div className="card-icon">💵</div>
                    <h3>Total Earnings</h3>
                    <div className="amount">{PaymentService.formatCurrency(totalEarnings)}</div>
                    <p>All-time earnings</p>
                </div>

                {/* Pending Payout */}
                <div className="earnings-card warning">
                    <div className="card-icon">⏳</div>
                    <h3>Pending Payout</h3>
                    <div className="amount">{PaymentService.formatCurrency(pendingPayout)}</div>
                    <p>Ready for payment</p>
                </div>

                {/* Next Payout */}
                <div className="earnings-card info">
                    <div className="card-icon">📅</div>
                    <h3>Next Payout</h3>
                    <div className="date">
                        {nextPayoutDate.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </div>
                    <p>Monthly payout date</p>
                </div>
            </div>

            {/* Payment Setup Section */}
            {!payoutEnabled && (
                <div className="payment-setup-section">
                    <div className="setup-card">
                        <h3>💳 Set Up Payments</h3>
                        <p>Get paid for your merch sales by setting up your PayPal Business account.</p>
                        <div className="setup-benefits">
                            <ul>
                                <li>✅ Monthly payouts on the 1st</li>
                                <li>✅ $50 minimum payout threshold</li>
                                <li>✅ Fast, secure PayPal payments</li>
                                <li>✅ Professional business transactions</li>
                            </ul>
                        </div>
                        <button 
                            onClick={() => setShowPaymentSetup(true)}
                            className="setup-btn"
                        >
                            Set Up Payments
                        </button>
                    </div>
                </div>
            )}

            {/* Payout Status */}
            {payoutEnabled && (
                <div className="payout-status-section">
                    <div className="status-card">
                        <h3>🎯 Payout Status</h3>
                        {isEligible ? (
                            <div className="status eligible">
                                <span className="status-icon">✅</span>
                                <div className="status-text">
                                    <strong>Eligible for payout</strong>
                                    <p>You'll receive {PaymentService.formatCurrency(pendingPayout)} on {nextPayoutDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="status pending">
                                <span className="status-icon">⏳</span>
                                <div className="status-text">
                                    <strong>Building towards payout</strong>
                                    <p>You need {PaymentService.formatCurrency(50 - pendingPayout)} more to reach the $50 minimum</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                    <button 
                        onClick={() => setShowPaymentSetup(true)}
                        className="action-btn primary"
                    >
                        💰 Update Payment Info
                    </button>
                    <button 
                        onClick={() => window.open('https://screenmerch.com', '_blank')}
                        className="action-btn secondary"
                    >
                        🛍️ View Your Store
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EarningsDashboard;
