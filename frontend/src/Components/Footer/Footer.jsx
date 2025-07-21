import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Company Info */}
          <div className="footer-section">
            <img src={screenMerchLogo} alt="ScreenMerch" className="footer-logo" />
            <p className="footer-description">
              Create custom merchandise from your favorite video moments
            </p>
          </div>

          {/* Legal Links */}
          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li>
                <Link to="/privacy-policy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li>
                <a href="mailto:support@screenmerch.com">
                  support@screenmerch.com
                </a>
              </li>
              <li>
                <Link to="/subscription-tiers">
                  Subscription Plans
                </Link>
              </li>
            </ul>
          </div>


        </div>

        <div className="footer-bottom">
          <p>&copy; 2025 ScreenMerch. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 