import React, { useState } from 'react';
import './SubscriptionModal.css';
import { API_CONFIG } from '../../config/apiConfig';

const SubscriptionModal = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' or 'error'

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email) {
            setMessage('Please enter a valid email address');
            setMessageType('error');
            return;
        }

        setIsLoading(true);
        setMessage('');

        try {
            // Call the backend API endpoint
            const response = await fetch(API_CONFIG.ENDPOINTS.SEND_SUBSCRIPTION_EMAIL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(`Subscription email sent to ${email}! Please check your inbox for approval link.`);
                setMessageType('success');
                setEmail('');
                
                // Close modal after 3 seconds
                setTimeout(() => {
                    onClose();
                    setMessage('');
                }, 3000);
            } else {
                throw new Error(data.error || 'Failed to send email');
            }

        } catch (error) {
            console.error('Error:', error);
            if (error.message.includes('fetch')) {
                setMessage('Backend server is not running. Please start the backend server first.');
            } else {
                setMessage(`Failed to send email: ${error.message}`);
            }
            setMessageType('error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Subscribe to VidTube</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <p>Enter your email to receive a subscription approval link:</p>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="email-input-group">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email address"
                                required
                                disabled={isLoading}
                            />
                        </div>
                        
                        {message && (
                            <div className={`message ${messageType}`}>
                                {message}
                            </div>
                        )}
                        
                        <div className="modal-actions">
                            <button 
                                type="button" 
                                className="cancel-btn" 
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="subscribe-modal-btn"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Sending...' : 'Send Approval Link'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal; 