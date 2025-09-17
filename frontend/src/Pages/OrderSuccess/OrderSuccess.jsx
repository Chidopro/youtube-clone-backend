import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    // Get order data from localStorage if available
    const trackingData = localStorage.getItem('order_tracking');
    if (trackingData) {
      try {
        const tracking = JSON.parse(trackingData);
        setOrderData(tracking);
        // Clear the tracking data from localStorage
        localStorage.removeItem('order_tracking');
      } catch (error) {
        console.error('Error parsing tracking data:', error);
      }
    }

    // Clear cart after successful order
    localStorage.removeItem('cart');
    localStorage.removeItem('cart_items');
    localStorage.removeItem('screenshots');
    localStorage.removeItem('screenshot_timestamps');
    
    // Clear any pending merch data
    localStorage.removeItem('pending_merch_data');

    // Add animation
    const container = document.querySelector('.order-success-container');
    if (container) {
      container.style.opacity = '0';
      container.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        container.style.transition = 'all 0.5s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
      }, 100);
    }
  }, []);

  return (
    <div className="order-success-page">
      <div className="order-success-container">
        <div className="success-icon">✅</div>
        <h1 className="success-title">Order Successful!</h1>
        
        <div className="thank-you-message">
          <p>Thank you for your order! Your custom merchandise is being created.</p>
        </div>
        
        <div className="next-steps">
          <h3>What happens next:</h3>
          <ul>
            <li>✅ Your order is being processed automatically</li>
            <li>✅ Products will be created and fulfilled by Printful</li>
            <li>✅ You'll receive email updates with tracking information</li>
            <li>✅ Your order will ship within 3-5 business days</li>
          </ul>
        </div>

        {orderData && (
          <div className="order-details">
            <h3>📦 Order Details</h3>
            <div className="order-info">
              <p><strong>Order ID:</strong> {orderData.order_id}</p>
              {orderData.tracking_url && (
                <p>
                  <strong>Track your order:</strong>{' '}
                  <a href={orderData.tracking_url} target="_blank" rel="noopener noreferrer">
                    View Order Status →
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        <div className="support-info">
          <p>
            <strong>Need help?</strong> Contact us at{' '}
            <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>
          </p>
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={() => navigate('/')} 
            className="home-button"
          >
            Return to Home
          </button>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="dashboard-button"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess; 