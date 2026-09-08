import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';
import { isCreatorStorefrontHostname } from '../../utils/subdomainService';

const Footer = () => {
  const isStorefront = isCreatorStorefrontHostname();

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
            <Link to="/contact">Contact Us</Link>
          </div>

          {isStorefront ? (
            <p className="footer-store-note">
              Printed to order. Questions: <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>
            </p>
          ) : null}

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