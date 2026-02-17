import React from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUpChoiceModal.css';

const SignUpChoiceModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleCustomerSignUp = () => {
        onClose();
        navigate('/signup', { state: { intent: 'customer' } });
    };

    const handleCreatorSignUp = () => {
        onClose();
        navigate('/subscription-tiers', { state: { intent: 'creator' } });
    };

    return (
        <div className="signup-choice-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="signup-choice-title">
            <div className="signup-choice-modal" onClick={e => e.stopPropagation()}>
                <button 
                    type="button"
                    className="signup-choice-close" 
                    onClick={onClose} 
                    aria-label="Close sign up options"
                >
                    ×
                </button>
                <h2 id="signup-choice-title" className="signup-choice-heading">Join ScreenMerch</h2>
                <p className="signup-choice-subheading">Choose how you want to get started</p>

                <div className="signup-choice-split">
                    <button
                        type="button"
                        className="signup-choice-panel signup-choice-customer"
                        onClick={handleCustomerSignUp}
                    >
                        <div className="signup-choice-icon-wrap signup-choice-icon-customer">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="9" cy="21" r="1"/>
                                <circle cx="20" cy="21" r="1"/>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                            </svg>
                        </div>
                        <h3>Make a purchase</h3>
                        <p>Create an account to browse merch, save favorites, and order custom products from your favorite creators.</p>
                        <span className="signup-choice-cta">Sign up as customer →</span>
                    </button>

                    <div className="signup-choice-divider" aria-hidden="true">
                        <span>or</span>
                    </div>

                    <button
                        type="button"
                        className="signup-choice-panel signup-choice-creator"
                        onClick={handleCreatorSignUp}
                    >
                        <div className="signup-choice-icon-wrap signup-choice-icon-creator">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                                <path d="M2 2l7.586 7.586"/>
                                <circle cx="11" cy="11" r="2"/>
                            </svg>
                        </div>
                        <h3>Become a creator</h3>
                        <p>Start selling merch from your content. Free to join—set up your channel and earn from every sale.</p>
                        <span className="signup-choice-cta">Sign up as creator →</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignUpChoiceModal;
