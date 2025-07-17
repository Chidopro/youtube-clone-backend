import React from 'react';
import { Link } from 'react-router-dom';
import './TermsOfService.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const TermsOfService = () => {
  return (
    <div className="terms-container">
      <div className="terms-content">
        <div className="logo">
          <img src={screenMerchLogo} alt="ScreenMerch Logo" className="logo-img" />
        </div>
        
        <h1>Terms of Service</h1>
        <div className="last-updated">Last Updated: January 2025</div>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing and using ScreenMerch ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. These Terms of Service ("Terms") govern your use of the ScreenMerch website and services. If you do not agree to these terms, you must not use the Service.</p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>ScreenMerch is a platform that allows users to create custom merchandise from video content, including screenshots and thumbnails. We facilitate the creation and ordering of custom products through third-party providers. Our platform is designed exclusively for creating merchandise through ScreenMerch services.</p>
        </section>

        <section className="critical-box">
          <h2>3. CRITICAL: Intellectual Property Protection & Platform Exclusivity</h2>
          
          <h3>3.1 Reverse Engineering Prohibition</h3>
          <p><strong>YOU EXPRESSLY AGREE AND ACKNOWLEDGE THAT:</strong></p>
          <ul>
            <li>You will NOT reverse engineer, decompile, disassemble, or attempt to derive the source code of ScreenMerch platform</li>
            <li>You will NOT attempt to discover underlying algorithms, methods, or processes used by ScreenMerch</li>
            <li>You will NOT use any automated tools, bots, or scrapers to extract data or functionality from ScreenMerch</li>
            <li>You will NOT create competing services based on ScreenMerch's functionality or design</li>
            <li>You will NOT copy, reproduce, or replicate ScreenMerch's user interface, workflows, or business processes</li>
          </ul>

          <h3>3.2 Platform Exclusivity Agreement</h3>
          <p><strong>EXCLUSIVE USE COMMITMENT:</strong></p>
          <ul>
            <li><strong>You agree that any video images, screenshots, thumbnails, or content processed through ScreenMerch may ONLY be used to create products through ScreenMerch platform</strong></li>
            <li>You will NOT use video content processed on ScreenMerch to create merchandise on any other platform (including but not limited to Printful, Teespring, Redbubble, Etsy, Amazon Merch, etc.)</li>
            <li>You will NOT download, export, or transfer video images from ScreenMerch to create products elsewhere</li>
            <li>You will NOT share, distribute, or provide ScreenMerch-processed content to third parties for merchandise creation</li>
            <li>Any custom designs, layouts, or modifications created through ScreenMerch remain exclusive to ScreenMerch platform</li>
          </ul>

          <h3>3.3 Enforcement and Penalties</h3>
          <p>Violation of these exclusivity and protection terms will result in:</p>
          <ul>
            <li>Immediate account termination without refund</li>
            <li>Legal action for breach of contract and intellectual property infringement</li>
            <li>Monetary damages including lost profits and legal fees</li>
            <li>Permanent ban from all ScreenMerch services</li>
          </ul>
        </section>

        <section>
          <h2>4. User Accounts</h2>
          <h3>Account Creation</h3>
          <ul>
            <li>You may be required to create an account to access certain features</li>
            <li>You are responsible for maintaining the confidentiality of your account</li>
            <li>You are responsible for all activities that occur under your account</li>
            <li>You must provide accurate and complete information when creating an account</li>
            <li>Each user may only maintain one active account</li>
          </ul>
        </section>

        <section>
          <h2>5. Content and Intellectual Property Rights</h2>
          <h3>5.1 User Content Ownership</h3>
          <ul>
            <li>You retain ownership of original content you upload to ScreenMerch</li>
            <li>You grant ScreenMerch a limited, non-exclusive license to process your content for merchandise creation</li>
            <li>You are responsible for ensuring you have rights to any content you upload</li>
            <li>You must not upload copyrighted content without proper authorization</li>
          </ul>

          <h3>5.2 ScreenMerch Intellectual Property</h3>
          <ul>
            <li>ScreenMerch platform, technology, algorithms, and processes are proprietary and protected</li>
            <li>All ScreenMerch branding, logos, and design elements are owned by ScreenMerch</li>
            <li>Product templates, layouts, and customization tools are ScreenMerch intellectual property</li>
            <li>You may not use ScreenMerch IP for any purpose outside the intended service</li>
          </ul>
        </section>

        <section>
          <h2>6. Platform Usage Restrictions</h2>
          <h3>6.1 Prohibited Content</h3>
          <p>You may not upload or create products containing:</p>
          <ul>
            <li>Copyrighted material without authorization</li>
            <li>Illegal, harmful, threatening, or offensive content</li>
            <li>Content that violates privacy or publicity rights</li>
            <li>Trademarked material without permission</li>
            <li>Adult or explicit content</li>
            <li>Content promoting violence, hate, or discrimination</li>
          </ul>
        </section>

        <section>
          <h2>7. Orders and Payment</h2>
          <h3>7.1 Product Orders</h3>
          <ul>
            <li>All orders are subject to acceptance and product availability</li>
            <li>Prices are displayed in USD and may change without notice</li>
            <li>Payment is processed securely through Stripe</li>
            <li>You agree to provide accurate billing information</li>
            <li>Orders cannot be transferred to other platforms</li>
          </ul>

          <h3>7.2 Refunds and Returns</h3>
          <ul>
            <li>Custom merchandise is typically non-refundable due to personalized nature</li>
            <li>Defective or damaged products may be eligible for replacement</li>
            <li>Refund requests must be submitted within 30 days of delivery</li>
            <li>No refunds for violation of exclusivity terms</li>
          </ul>
        </section>

        <section>
          <h2>8. Prohibited Uses</h2>
          <p>You may not use ScreenMerch to:</p>
          <ul>
            <li>Upload illegal, harmful, or offensive content</li>
            <li>Infringe on intellectual property rights</li>
            <li>Engage in fraudulent or deceptive practices</li>
            <li>Attempt to circumvent security measures</li>
            <li>Use automated systems to access the service</li>
            <li>Reverse engineer or replicate our platform</li>
            <li>Export content for use on competing platforms</li>
            <li>Violate platform exclusivity agreements</li>
          </ul>
        </section>

        <section>
          <h2>9. Termination</h2>
          <h3>9.1 Termination by ScreenMerch</h3>
          <ul>
            <li>We may terminate accounts for violation of these terms</li>
            <li>Immediate termination for reverse engineering or exclusivity violations</li>
            <li>We reserve the right to refuse service to anyone</li>
          </ul>

          <h3>9.2 Effect of Termination</h3>
          <ul>
            <li>All licenses granted to you terminate immediately</li>
            <li>You must cease all use of ScreenMerch services</li>
            <li>Outstanding orders may be cancelled</li>
            <li>Exclusivity obligations survive termination</li>
          </ul>
        </section>

        <section>
          <h2>10. Contact Information</h2>
          <div className="highlight-box">
            <strong>ScreenMerch Support</strong><br />
            Email: support@screenmerch.com<br />
            Website: screenmerch.com<br />
            Legal Issues: support@screenmerch.com
          </div>
        </section>

        <section>
          <h2>11. Entire Agreement</h2>
          <p>These Terms of Service, together with our Privacy Policy, constitute the entire agreement between you and ScreenMerch regarding the use of our services.</p>
        </section>

        <div className="navigation-links">
          <Link to="/" className="nav-link">← Back to ScreenMerch</Link> | 
          <Link to="/privacy-policy" className="nav-link">← Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService; 