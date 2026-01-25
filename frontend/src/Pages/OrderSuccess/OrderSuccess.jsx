import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubdomain } from '../../utils/subdomainService';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);

  // Helper function to get home URL preserving subdomain
  const getHomeUrl = () => {
    const subdomain = getSubdomain();
    if (subdomain) {
      return `https://${subdomain}.screenmerch.com/`;
    }
    return '/';
  };

  // Helper function to get dashboard URL preserving subdomain
  const getDashboardUrl = () => {
    const subdomain = getSubdomain();
    if (subdomain) {
      return `https://${subdomain}.screenmerch.com/dashboard`;
    }
    return '/dashboard';
  };

  useEffect(() => {
    // Clear cart immediately and comprehensively after successful purchase - run first!
    (function clearCartCompletely() {
      try {
        // Clear all cart-related storage
        localStorage.removeItem('cart');
        localStorage.removeItem('cart_items');
        localStorage.removeItem('cartData');
        localStorage.removeItem('persistent_cart');
        
        // Clear session storage
        sessionStorage.removeItem('cartData');
        sessionStorage.removeItem('cart');
        
        // Also clear any variations/case-insensitive matches for cart
        Object.keys(localStorage).forEach(key => {
          if (key.toLowerCase().includes('cart')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.toLowerCase().includes('cart')) {
            sessionStorage.removeItem(key);
          }
        });
        
        console.log('🛒 Cart cleared after successful purchase');
      } catch (error) {
        console.error('Error clearing cart:', error);
      }
    })();

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
          <p>Thank you for your order. Your custom merchandise is being created.</p>
        </div>
        
        <div className="next-steps">
          <h3>What happens next:</h3>
          <ul>
            <li>Your order is being processed automatically</li>
            <li>Products will be created and fulfilled by Printful</li>
            <li>You'll receive tracking information once shipped</li>
          </ul>
        </div>

        <div className="support-info">
          <p>
            <strong>Need help?</strong> Contact us at{' '}
            <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>
          </p>
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={() => {
              const homeUrl = getHomeUrl();
              if (homeUrl.startsWith('http')) {
                window.location.href = homeUrl;
              } else {
                navigate(homeUrl);
              }
            }} 
            className="home-button"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess; 