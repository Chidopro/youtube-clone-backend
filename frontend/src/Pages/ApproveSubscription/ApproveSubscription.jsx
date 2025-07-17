import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import './ApproveSubscription.css';

const ApproveSubscription = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
    const [email, setEmail] = useState('');

    useEffect(() => {
        const emailParam = searchParams.get('email');
        const token = searchParams.get('token');

        if (!emailParam || !token) {
            setStatus('error');
            return;
        }

        setEmail(emailParam);
        
        // Simulate approval process (you can add real validation here)
        setTimeout(() => {
            // Here you could add real subscription logic
            // For now, we'll just mark it as successful
            setStatus('success');
            
            // You could also store the subscription in your database
            // Example: saveSubscription(emailParam, token);
        }, 2000);
    }, [searchParams]);

    const renderContent = () => {
        switch (status) {
            case 'verifying':
                return (
                    <div className="approval-content">
                        <div className="loading-spinner"></div>
                        <h2>Verifying your subscription...</h2>
                        <p>Please wait while we process your request.</p>
                    </div>
                );
            
            case 'success':
                return (
                    <div className="approval-content success">
                        <div className="success-icon">✓</div>
                        <h2>Subscription Approved!</h2>
                        <p>Welcome to ScreenMerch, <strong>{email}</strong>!</p>
                        <p>Your subscription has been successfully activated. You can now enjoy all our premium features.</p>
                        <Link to="/" className="home-btn">Go to Home</Link>
                    </div>
                );
            
            case 'error':
                return (
                    <div className="approval-content error">
                        <div className="error-icon">✗</div>
                        <h2>Invalid Link</h2>
                        <p>This approval link is invalid or has expired.</p>
                        <p>Please try subscribing again or contact support if you continue to have issues.</p>
                        <Link to="/" className="home-btn">Go to Home</Link>
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="approval-page">
            <div className="approval-container">
                <div className="logo-section">
                    <h1>ScreenMerch</h1>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default ApproveSubscription; 