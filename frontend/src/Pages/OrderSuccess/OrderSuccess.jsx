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
        <div className="order-success-icon" aria-hidden>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none"/>
          </svg>
        </div>
        <h1 className="order-success-title">Order confirmed</h1>
        <p className="order-success-message">
          Thank you for your order. Your custom merchandise is being created.
        </p>

        <div className="order-success-next-steps">
          <h2 className="order-success-next-steps-title">What happens next</h2>
          <ul className="order-success-list">
            <li>Your order is being processed automatically</li>
            <li>Products will be created and fulfilled by Printful</li>
            <li>You’ll receive tracking information once shipped</li>
          </ul>
        </div>

        <p className="order-success-support">
          Need help? <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>
        </p>

        <button
          type="button"
          onClick={() => {
            const homeUrl = getHomeUrl();
            if (homeUrl.startsWith('http')) {
              window.location.href = homeUrl;
            } else {
              navigate(homeUrl);
            }}
          className="order-success-cta"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default OrderSuccess; 