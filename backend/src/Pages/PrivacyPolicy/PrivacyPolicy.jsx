import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPolicy.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-policy-container">
      <div className="privacy-policy-content">
        <div className="logo">
          <img src={screenMerchLogo} alt="ScreenMerch Logo" className="logo-img" />
        </div>
        
        <h1>Privacy Policy</h1>
        <div className="last-updated">Last Updated: February 2025</div>

        <section>
          <h2>Company Information</h2>
          <p><strong>ScreenMerch</strong> is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, protect, and handle your information when you use our custom merchandise platform and services.</p>
          
          <div className="highlight-box">
            <strong>Contact Information:</strong><br />
            Company: ScreenMerch<br />
            Website: screenmerch.com<br />
            Email: support@screenmerch.com<br />
            Privacy Officer: support@screenmerch.com
          </div>
        </section>

        <section>
          <h2>Information We Collect</h2>
          <h3>Personal Information</h3>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, username, password (encrypted)</li>
            <li><strong>Contact Details:</strong> Phone number (for order notifications), mailing address</li>
            <li><strong>Billing Information:</strong> Shipping and billing addresses, payment method details (processed securely through Stripe)</li>
            <li><strong>Profile Data:</strong> Profile pictures, preferences, customization settings</li>
          </ul>

          <h3>Content and Usage Information</h3>
          <ul>
            <li><strong>Video Content:</strong> Video files, screenshots, thumbnails, and images you upload</li>
            <li><strong>Custom Designs:</strong> Product customizations, text overlays, design modifications</li>
            <li><strong>Order History:</strong> Products ordered, preferences, purchase patterns</li>
            <li><strong>Platform Usage:</strong> Navigation patterns, feature usage, time spent on platform</li>
            <li><strong>Technical Data:</strong> IP address, browser type, device information, operating system</li>
          </ul>
        </section>

        <section className="security-box">
          <h2>Content Processing and Protection</h2>
          
          <h3>How We Process Your Content</h3>
          <p>Uploaded videos and images are processed securely to:</p>
          <ul>
            <li>Generate thumbnails</li>
            <li>Capture screenshots</li>
            <li>Optimize files for high-resolution (300 DPI) printing</li>
          </ul>
          <p>Final print-ready files are generated server-side and are not exposed publicly.</p>

          <h3>Content Rights and Usage</h3>
          <ul>
            <li><strong>Your Content Ownership:</strong> You retain ownership of your original content</li>
            <li><strong>Platform License:</strong> You grant us limited rights to process content for merchandise creation</li>
            <li><strong>Exclusivity Protection:</strong> We ensure your processed content remains exclusive to ScreenMerch</li>
            <li><strong>No Unauthorized Sharing:</strong> Your content is never provided to competing platforms</li>
          </ul>

          <h3>Data Retention</h3>
          <ul>
            <li>Active account data is retained while accounts remain active.</li>
            <li>Order records may be retained for up to 7 years for tax and legal compliance (U.S. requirements).</li>
            <li>Deleted accounts are removed within 30 days, subject to legal retention requirements.</li>
          </ul>
        </section>

        <section className="sms-section">
          <h2>SMS Messaging and Communications</h2>
          
          <h3>SMS Consent and Usage</h3>
          <p>By providing your phone number and checking the SMS consent box during checkout, you explicitly consent to receive SMS text messages from ScreenMerch for the following purposes:</p>
          
          <ul>
            <li><strong>Order Notifications:</strong> Updates about your order status, processing, and shipping</li>
            <li><strong>Customer Service:</strong> Support communications and order assistance</li>
            <li><strong>Account Security:</strong> Two-factor authentication and security alerts</li>
            <li><strong>Important Updates:</strong> Critical account or service notifications</li>
          </ul>

          <div className="highlight-box">
            <strong>Program Name:</strong> ScreenMerch Notifications<br />
            <strong>Provider:</strong> ScreenMerch<br />
            <strong>Purpose:</strong> Order notifications and customer service communications<br />
            <strong>Frequency:</strong> 1-3 messages per order, occasional service messages<br />
            <strong>Opt-Out:</strong> Reply STOP to any SMS to unsubscribe immediately<br />
            <strong>Help:</strong> Reply HELP to any SMS for assistance or contact support@screenmerch.com<br />
            <strong>Cost:</strong> Message and data rates may apply based on your mobile carrier plan
          </div>
        </section>

        <section>
          <h2>How We Use Your Information</h2>
          <h3>Primary Uses</h3>
          <ul>
            <li><strong>Service Delivery:</strong> Process and fulfill your custom merchandise orders</li>
            <li><strong>Content Processing:</strong> Transform your video content into printable merchandise designs</li>
            <li><strong>Communication:</strong> Send order notifications via SMS and email (with consent)</li>
            <li><strong>Customer Support:</strong> Provide assistance and resolve issues</li>
            <li><strong>Platform Improvement:</strong> Enhance our services and user experience</li>
            <li><strong>Security:</strong> Protect against fraud and unauthorized access</li>
            <li><strong>Legal Compliance:</strong> Meet regulatory and legal obligations</li>
          </ul>

          <h3>Platform Exclusivity Protection</h3>
          <ul>
            <li>We ensure your content remains exclusive to ScreenMerch platform</li>
            <li>We monitor and prevent unauthorized use of your processed content</li>
            <li>We maintain audit trails for content usage and access</li>
          </ul>
        </section>

        <section>
          <h2>Infrastructure &amp; Security</h2>
          <p>ScreenMerch is hosted on reputable cloud infrastructure providers that maintain industry-standard security certifications.</p>
          <p>We implement:</p>
          <ul>
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Role-based access controls</li>
            <li>Secure authentication systems</li>
            <li>Encrypted storage where applicable</li>
          </ul>
        </section>

        <section>
          <h2>Your Privacy Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal information</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your information (subject to legal requirements)</li>
            <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
            <li><strong>Opt-Out:</strong> Withdraw consent for SMS communications</li>
            <li><strong>Restriction:</strong> Request limitations on how we process your data</li>
          </ul>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>For privacy-related questions, concerns, or requests, please contact us:</p>
          <div className="highlight-box">
            <strong>Privacy Officer:</strong> support@screenmerch.com<br />
            <strong>General Support:</strong> support@screenmerch.com<br />
            <strong>Website:</strong> screenmerch.com<br />
            <strong>SMS Opt-Out:</strong> Reply STOP to any message<br />
            <strong>Data Requests:</strong> support@screenmerch.com
          </div>
        </section>

        <div className="navigation-links">
          <Link to="/" className="nav-link">← Back to ScreenMerch</Link> | 
          <Link to="/terms-of-service" className="nav-link">Terms of Service →</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
