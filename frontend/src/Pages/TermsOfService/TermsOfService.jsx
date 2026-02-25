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
        <div className="last-updated">Last Updated: February 2025</div>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using ScreenMerch (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, you may not use the Service.</p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>ScreenMerch is a creator-focused merchandise platform that allows approved creators to:</p>
          <ul>
            <li>Upload and manage video content</li>
            <li>Enable fans to capture screenshots or thumbnails</li>
            <li>Place captured images onto merchandise</li>
            <li>Sell products through ScreenMerch&apos;s integrated checkout and fulfillment system</li>
          </ul>
          <p>ScreenMerch processes images for print optimization (including 300 DPI formatting) and coordinates production and shipping through third-party fulfillment providers.</p>
        </section>

        <section>
          <h2>3. Creator Accounts &amp; Approval</h2>
          <ul>
            <li>Creator accounts are subject to administrative review and approval.</li>
            <li>Accounts remain pending until approved by a master administrator.</li>
            <li>ScreenMerch reserves the right to approve or deny applications at its discretion.</li>
            <li>Subdomains may take up to 24 hours to be activated following approval.</li>
          </ul>
        </section>

        <section className="critical-box">
          <h2>4. Intellectual Property &amp; Platform Protection</h2>
          <h3>4.1 Your Content</h3>
          <p>You retain ownership of all original content you upload to ScreenMerch.</p>
          <p>By uploading content, you grant ScreenMerch a limited, non-exclusive, royalty-free license to:</p>
          <ul>
            <li>Process your content for merchandise creation</li>
            <li>Optimize images for print production</li>
            <li>Display content within your approved storefront</li>
          </ul>
          <p>This license exists solely to operate the ScreenMerch platform.</p>

          <h3>4.2 Platform Technology</h3>
          <p>All ScreenMerch platform elements — including but not limited to:</p>
          <ul>
            <li>Screenshot capture tools</li>
            <li>Image processing workflows</li>
            <li>Print optimization systems</li>
            <li>Product templates and layouts</li>
            <li>UI/UX design</li>
            <li>Backend systems and algorithms</li>
          </ul>
          <p>are proprietary to ScreenMerch and protected by intellectual property law.</p>

          <h3>4.3 Commercial Bypass &amp; Platform Circumvention</h3>
          <p>You agree not to:</p>
          <ul>
            <li>Extract, download, or export platform-processed, print-optimized, or formatted images for use on competing merchandise platforms</li>
            <li>Circumvent or attempt to bypass ScreenMerch&apos;s checkout, payment, or fulfillment systems</li>
            <li>Use ScreenMerch tools or workflows to generate commercial merchandise outside the ScreenMerch ecosystem</li>
            <li>Use automated tools, scraping systems, or reverse engineering techniques to access platform-generated assets</li>
          </ul>
          <p>Nothing in these Terms restricts your ownership of your original content. However, ScreenMerch-generated formatting, processing, and production outputs are provided solely for use within the ScreenMerch platform.</p>
        </section>

        <section>
          <h2>5. Prohibited Content</h2>
          <p>You may not upload content that:</p>
          <ul>
            <li>Infringes copyright, trademark, or publicity rights</li>
            <li>Contains unlawful, harmful, or discriminatory material</li>
            <li>Includes explicit or adult content</li>
            <li>Violates applicable laws or regulations</li>
            <li>Exploits or abuses children, or presents children in a sexual manner</li>
            <li>Harasses, bullies, defames, or threatens a specific individual</li>
            <li>Promotes violence or hatred based on race, ethnicity, color, national origin, religion, age, gender, sexual orientation, disability, medical condition, or veteran status</li>
            <li>Promotes or supports terrorism or terrorist organizations</li>
            <li>Promotes self-harm</li>
            <li>Promotes harmful misinformation that may lead to violence or threats to health and safety</li>
            <li>Contains personally identifiable information, sensitive personal information, or confidential information (e.g., credit card numbers, national IDs, passwords) without consent</li>
          </ul>
          <p>Our fulfillment partners (e.g., Printful) may remove or refuse content that violates their policies. You are solely responsible for ensuring you have rights to all uploaded material and that it complies with these rules.</p>
        </section>

        <section>
          <h2>6. Third-Party Fulfillment (e.g., Printful)</h2>
          <p>Merchandise production and shipping are fulfilled by third-party partners, including Printful, Inc. By using ScreenMerch&apos;s merchandise services, you agree that:</p>
          <ul>
            <li>Fulfillment is subject to the fulfillment provider&apos;s terms of service and policies (e.g., <a href="https://www.printful.com/policies/terms" target="_blank" rel="noopener noreferrer">Printful&apos;s Terms of Service</a>). We recommend reviewing them.</li>
            <li>Any legal claims related to products (e.g., defects, misrepresentation, or injury) must be brought against the seller. ScreenMerch and its fulfillment partners are not liable for such product-related claims except as set out in these Terms.</li>
            <li>Customer data shared with fulfillment partners for orders is processed in accordance with our Privacy Policy and the partner&apos;s data processing and privacy policies.</li>
            <li>Disputes with a fulfillment partner (e.g., Printful) regarding their services are subject to that partner&apos;s dispute resolution and governing law, not ScreenMerch&apos;s.</li>
          </ul>
          <p><strong>EU / EEA users:</strong> To report content that you believe is illegal under EU or national law, you may use our fulfillment partner&apos;s complaint mechanism where applicable. See Printful&apos;s <a href="https://www.printful.com/site/eu-illegal-content" target="_blank" rel="noopener noreferrer">EU illegal content notice</a> (Digital Services Act).</p>
        </section>

        <section>
          <h2>7. Orders &amp; Payment</h2>
          <ul>
            <li>Payments are processed securely through Stripe.</li>
            <li>All prices are listed in USD.</li>
            <li>ScreenMerch coordinates fulfillment through third-party providers (e.g., Printful).</li>
            <li>Because products are custom-made, returns are generally not accepted except in cases of manufacturing defects or production errors.</li>
            <li>Claims for production defects must be submitted within 30 days of delivery.</li>
          </ul>
        </section>

        <section>
          <h2>8. Creator Earnings &amp; Payouts</h2>
          <ul>
            <li>Creators earn $7 per sale on most items (excluding greeting cards, stickers, and magnets unless otherwise specified).</li>
            <li>Payout eligibility requires a minimum balance of $50.</li>
            <li>Creators must provide a valid PayPal email for payout processing.</li>
            <li>ScreenMerch reserves the right to withhold payouts in cases of fraud, abuse, or violation of these Terms.</li>
          </ul>
        </section>

        <section>
          <h2>9. Account Termination</h2>
          <p>ScreenMerch may suspend or terminate accounts for:</p>
          <ul>
            <li>Violations of these Terms</li>
            <li>Intellectual property abuse</li>
            <li>Platform circumvention</li>
            <li>Fraudulent activity</li>
          </ul>
          <p>Upon termination:</p>
          <ul>
            <li>Access to the platform is revoked</li>
            <li>Outstanding payouts may be reviewed before release</li>
          </ul>
        </section>

        <section>
          <h2>10. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law:</p>
          <ul>
            <li>ScreenMerch shall not be liable for indirect, incidental, consequential, or punitive damages, including lost profits or lost revenue.</li>
            <li>Our total liability shall not exceed the total fees paid to ScreenMerch in the twelve (12) months preceding the claim.</li>
          </ul>
        </section>

        <section>
          <h2>11. Arbitration &amp; Dispute Resolution (U.S.)</h2>
          <p>Any disputes arising from these Terms shall be resolved through binding arbitration in the United States, except where prohibited by law.</p>
          <p>You waive the right to participate in class-action lawsuits.</p>
          <p>Disputes with third-party fulfillment partners (e.g., Printful) are governed by those partners&apos; terms and their arbitration or dispute-resolution provisions, not this section.</p>
        </section>

        <section>
          <h2>12. California Consumer Rights</h2>
          <p>Under California Civil Code Section 1789.3, California users are entitled to the following: The Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs may be contacted in writing at 1625 North Market Blvd., Suite N 112, Sacramento, CA 95834, or by telephone at (916) 445-1254 or (800) 952-5210. You may contact ScreenMerch at support@screenmerch.com.</p>
        </section>

        <section>
          <h2>13. Changes to Terms</h2>
          <p>We may update these Terms periodically. Continued use of the Service constitutes acceptance of updated Terms.</p>
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