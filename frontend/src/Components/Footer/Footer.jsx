import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Logo */}
          <div className="footer-logo-section">
            <img src={screenMerchLogo} alt="ScreenMerch" className="footer-logo" />
          </div>

          {/* Links */}
          <div className="footer-links-section">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
            <a href="mailto:support@screenmerch.com">Contact Us</a>
          </div>

          {/* Copyright */}
          <div className="footer-copyright">
            <p>&copy; 2026 ScreenMerch. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 