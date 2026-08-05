import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Contact.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const Contact = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('.main-content-area');
    if (main) main.scrollTop = 0;
  }, [location.key, location.pathname]);

  return (
    <div className="contact-container">
      <div className="contact-card">
        <div className="logo">
          <img src={screenMerchLogo} alt="ScreenMerch Logo" className="logo-img" />
        </div>

        <h1>Contact Us</h1>

        <p className="contact-intro">Inquiries may be sent to:</p>

        <a className="contact-email" href="mailto:support@screenmerch.com">
          support@screenmerch.com
        </a>

        <p className="contact-divider">or mailed to</p>

        <address className="contact-address">
          ScreenMerch
          <br />
          1311 Park Street, Unit #543
          <br />
          Alameda, California 94501
        </address>

        <div className="navigation-links">
          <Link to="/" className="nav-link">&larr; Back to ScreenMerch</Link>
        </div>
      </div>
    </div>
  );
};

export default Contact;
