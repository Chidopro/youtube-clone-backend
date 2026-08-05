import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './TermsOfService.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const TermsOfService = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('.main-content-area');
    if (main) main.scrollTop = 0;
  }, [location.key, location.pathname]);

  return (
    <div className="terms-container">
      <div className="terms-content">
        <div className="logo">
          <img src={screenMerchLogo} alt="ScreenMerch Logo" className="logo-img" />
        </div>

        <header className="legal-header">
          <h1>Terms of Service</h1>
          <p className="legal-subtitle">Unified terms for creators and customers</p>
          <div className="legal-meta">
            <span className="legal-version">Version 2.1</span>
            <span className="legal-date">Effective August 5, 2026</span>
            <span className="legal-date">Last updated August 5, 2026</span>
          </div>
        </header>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By visiting, accessing, creating an account, uploading content, joining an Umbrella Storefront, placing an order, or otherwise using the Service, you agree to these Terms and acknowledge ScreenMerch&apos;s Privacy Policy at <Link to="/privacy-policy">https://screenmerch.com/privacy-policy</Link>. New Customer and Creator account registrations may require affirmative acceptance through an unchecked checkbox or comparable electronic action. ScreenMerch may record the applicable policy versions and the date and time of acceptance. If you use the Service for an organization, you represent that you have authority to bind that organization, and &quot;you&quot; includes the organization. If you do not agree, do not use the Service.</p>

          <p>You must be at least 18 years old, or the age of legal majority where you live, to create a Creator account, operate a Storefront, act as an Umbrella Collaborator, or purchase products. A general Visitor who is below the age of majority may use publicly available portions of the Service only with a parent&apos;s or legal guardian&apos;s supervision and consent.</p>
        </section>

        <section>
          <h2>2. Definitions and User Roles</h2>
          <p>The following terms clarify the roles used throughout these Terms. A person may occupy more than one role, and the obligations for each applicable role will apply.</p>

          <ul>
            <li>&quot;Visitor&quot; means anyone who browses or otherwise accesses the Service without necessarily creating an account or buying a product.</li>
            <li>&quot;Fan&quot; means a Visitor who interacts with a Creator&apos;s content, uses an enabled capture or customization feature, or shops a Creator&apos;s Storefront. A Fan who places an order is also a Customer.</li>
            <li>&quot;Customer&quot; means an authenticated ScreenMerch account holder who places or receives an order through the Service. A Visitor may browse publicly available Storefront content, but must create or sign in to a ScreenMerch account before continuing through the Make Merch and purchasing process.</li>
            <li>&quot;Creator&quot; means a person or organization approved by ScreenMerch to upload Creator Content and use creator features. A Creator may be a Storefront Owner or an Umbrella Collaborator.</li>
            <li>&quot;Storefront Owner&quot; means the approved Creator who controls the primary ScreenMerch subdomain, branding, and settings for a Storefront, including an Umbrella Storefront.</li>
            <li>&quot;Umbrella Collaborator&quot; means an approved Creator invited to maintain an attributed page within another Creator&apos;s Umbrella Storefront. The baseline Terms called this role an &quot;umbrella creator.&quot;</li>
            <li>&quot;Storefront&quot; means a ScreenMerch-hosted creator merchandise storefront, including its pages and subdomain.</li>
            <li>&quot;Creator Content&quot; has the meaning in Section 4.1.</li>
            <li>&quot;ScreenMerch,&quot; &quot;we,&quot; &quot;us,&quot; and &quot;our&quot; mean Alan Armstrong, an individual doing business as ScreenMerch, the current operator of the Service. The contracting entity may be updated following a lawful reorganization or assignment under Section 22.</li>
          </ul>
        </section>

        <section>
          <h2>3. The Service; Creator Accounts and Approval</h2>
          <h3>3.1 Creator Merchandise Service</h3>

          <p>ScreenMerch is a creator-focused merchandise service. Approved Creators can upload and manage video and other content; enable Fans to capture screenshots or thumbnails; place captured images on available merchandise; sell products through integrated checkout and fulfillment; and, when enabled, invite approved Umbrella Collaborators to participate in a shared branded Storefront. ScreenMerch processes images for print optimization, which may include formatting at 300 DPI, and coordinates production and shipping through third-party providers. ScreenMerch is the customer-facing seller and contracts with Customers for merchandise purchases. Printful and other disclosed providers act as manufacturers, printers, packagers, carriers, or fulfillment service providers for ScreenMerch; Customers do not purchase directly from Printful through the Service. Features, product catalogs, integrations, processing methods, geographic availability, and fulfillment providers may change. ScreenMerch does not guarantee that every feature or product will remain available, that every image will be suitable for every product, or that a particular subdomain or Creator application will be approved.</p>

          <h3>3.2 Account Approval and Security</h3>

          <p>Creator accounts are subject to administrative review and approval. Accounts remain pending until approved by a ScreenMerch master administrator. ScreenMerch may approve or deny applications in its discretion, subject to applicable law. Approved subdomains may take up to 24 hours to activate. You must provide accurate, current, and complete information; maintain the security of your credentials; promptly update contact, tax, and payout details; and notify ScreenMerch of suspected unauthorized access. You are responsible for activity under your account unless applicable law provides otherwise. You may not share credentials in a way that compromises the Service, impersonate another person, or transfer an account without ScreenMerch&apos;s written permission.</p>
        </section>

        <section className="critical-box">
          <h2>4. Intellectual Property, Creator Content &amp; Platform Protection</h2>
          <h3>4.1 Creator Ownership of Content</h3>

          <p>You retain ownership of all original videos, images, artwork, thumbnails, screenshots, graphics, text, and other content that you upload to ScreenMerch (&quot;Creator Content&quot;). Nothing in these Terms transfers ownership of your original Creator Content to ScreenMerch. By uploading Creator Content, you represent and warrant that you own the content or possess all rights, licenses, permissions, and legal authority necessary to upload, display, reproduce, modify for print production, market, sell, and otherwise commercialize that content through the ScreenMerch platform.</p>

          <h3>4.2 License Granted to ScreenMerch</h3>

          <p>By uploading Creator Content, you grant ScreenMerch a limited, worldwide, non-exclusive, royalty-free license to store, process, optimize for printing, create previews, display within your storefront, transmit print-ready files to fulfillment partners, fulfill customer orders, and maintain reasonable backups solely for operating the platform. This license lasts while the Creator Content is available through the Service and for a reasonable period afterward as needed to complete pending orders, address returns or disputes, maintain legally required records and backups, and protect the Service. ScreenMerch does not acquire ownership of Creator Content through this license.</p>

          <h3>4.3 Creator Commercial Rights Certification</h3>

          <p>By uploading content, you certify that you created it, own the commercial rights, or have all necessary licenses and permissions. You further certify that your uploads do not knowingly infringe the rights of others and that any legally required permissions from identifiable individuals have been obtained.</p>

          <h3>4.4 Creator Responsibility</h3>

          <p>Creators are solely responsible for ensuring uploaded content may legally be used for commercial merchandise. ScreenMerch&apos;s review or approval does not constitute legal verification of ownership. You are also responsible for titles, descriptions, claims, instructions, and other information you submit with Creator Content, and for responding to claims concerning that material.</p>

          <h3>4.5 FrameSnag</h3>

          <p>FrameSnag is intended solely to help approved creators capture screenshots and thumbnails from content they own or are legally authorized to commercialize. It does not grant copyright ownership or permission to use third-party content. A Fan&apos;s technical ability to capture a frame does not establish that the frame may lawfully be printed or sold; the applicable Creator remains responsible for authorizing available content and commercial use.</p>

          <h3>4.6 Manual Content Review</h3>

          <p>ScreenMerch may manually review creators, content, and orders to help reduce legal and operational risk. Manual review is not legal advice or a guarantee that content is free of third-party claims. ScreenMerch has no general obligation to pre-screen all content and may approve, reject, remove, or request changes to content or products in its discretion, subject to applicable law.</p>

          <h3>4.7 Copyright Complaints</h3>

          <p>ScreenMerch may remove content, disable products, or suspend accounts upon receipt of a credible copyright complaint while investigating. A complaint should identify the copyrighted work, the allegedly infringing material and its location, the complainant&apos;s contact information, a good-faith statement that the disputed use is not authorized, a statement under penalty of perjury that the information is accurate and the complainant is authorized to act, and a physical or electronic signature. Complaints may be sent to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>. ScreenMerch may request additional information, forward a complaint to the affected user, accept a legally sufficient counter-notice, and terminate repeat infringers where appropriate.</p>

          <h3>4.8 Platform Technology</h3>

          <p>ScreenMerch&apos;s software, workflows, templates, dashboards, branding, APIs, and proprietary technology remain the exclusive property of ScreenMerch. This includes the Service&apos;s screenshot-capture tools, image-processing and print-optimization systems, product templates and layouts, user-interface and user-experience designs, backend systems, algorithms, documentation, and ScreenMerch names, logos, and marks. Except for the limited right to use the Service under these Terms, no platform intellectual-property rights are granted to you.</p>

          <h3>4.9 Platform Circumvention</h3>

          <p>Users may not export ScreenMerch-generated production assets for competing services, bypass fulfillment systems, reverse engineer the platform, or scrape proprietary assets. Without limiting that rule, you may not extract, download, or export platform-processed, print-optimized, formatted, or production-ready assets for use on another merchandise service; circumvent checkout, payment, attribution, or fulfillment; use ScreenMerch tools or workflows to manufacture commercial merchandise outside the ScreenMerch ecosystem; probe or defeat access controls; or use automated tools to access platform-generated assets except through an interface expressly authorized by ScreenMerch. Nothing in this Section 4.9 restricts your ownership of original Creator Content or any copy of original Creator Content that you independently possess. The restriction applies to ScreenMerch&apos;s proprietary technology and to outputs generated, formatted, or delivered by the Service for ScreenMerch production and fulfillment.</p>
        </section>

        <section>
          <h2>5. Acceptable Use and Prohibited Content</h2>
          <p>All users must use the Service lawfully and must not interfere with its operation or other users. You may not upload, offer, request, promote, or use content or conduct that:</p>

          <ul>
            <li>infringes or misappropriates copyright, trademark, patent, trade-secret, privacy, publicity, contractual, or other rights</li>
            <li>is unlawful, fraudulent, deceptive, defamatory, harmful, threatening, or discriminatory</li>
            <li>includes explicit or adult sexual content, exploits or abuses children, or depicts children in a sexual manner</li>
            <li>harasses, bullies, doxxes, defames, or threatens a specific individual</li>
            <li>promotes violence or hatred based on race, ethnicity, color, national origin, religion, age, sex, gender, gender identity, sexual orientation, disability, medical condition, or veteran status</li>
            <li>promotes or supports terrorism or terrorist organizations, or promotes self-harm</li>
            <li>promotes harmful misinformation reasonably likely to lead to violence or threats to health or safety</li>
            <li>contains personal, sensitive, or confidential information-such as payment-card numbers, national identifiers, passwords, or private records-without lawful authority and consent</li>
            <li>contains malware, malicious code, spam, or unauthorized advertising, or attempts to gain unauthorized access</li>
            <li>manipulates sales, attribution, reviews, traffic, payouts, or platform metrics</li>
            <li>violates applicable law, a court order, these Terms, or an applicable fulfillment provider&apos;s content policies</li>
          </ul>

          <p>ScreenMerch and its fulfillment partners, including Printful, may refuse, remove, or stop producing content or products that violate their policies or present legal, safety, reputational, or operational risk. Creators remain solely responsible for the legality and rights status of submitted material.</p>
        </section>

        <section className="critical-box">
          <h2>6. Umbrella Storefronts and Collaborators</h2>
          <h3>6.1 Program and Control</h3>

          <p>A Storefront Owner may invite approved Creators by username or email to participate as Umbrella Collaborators. An invitation must be accepted before access is granted. Each approved Umbrella Collaborator may receive a dedicated attributed page within the Owner&apos;s branded Storefront. Customers shop within the Owner&apos;s subdomain, and sales may be attributed to the Owner&apos;s page or a Collaborator&apos;s page. The Storefront Owner controls the primary subdomain, Storefront branding, and invitation list. ScreenMerch may remove a Collaborator, disable Umbrella features, or suspend access for violations of these Terms. Umbrella Collaborators upload and manage Creator Content for their attributed pages and are bound by the same content, intellectual-property, account, and acceptable-use requirements that apply to Creators generally.</p>

          <h3>6.2 Attribution and Earnings Records</h3>

          <p>A sale attributed to an Umbrella Collaborator&apos;s page entitles that Collaborator to the creator share of $6 per qualifying item sold, as shown in the Storefront Owner&apos;s dashboard analytics and payout summary. A sale not attributed to an Umbrella Collaborator page is treated as the Storefront Owner&apos;s direct earning under Section 10. Attribution is determined by ScreenMerch systems, such as the page or session active when the sale occurred. ScreenMerch&apos;s attribution records control dashboard reporting unless ScreenMerch corrects them for a clear error, refund, reversal, chargeback, fraud, or abuse.</p>

          <h3>6.3 Storefront Owner Payment Duties</h3>

          <p>The Storefront Owner-not ScreenMerch-pays Umbrella Collaborators off platform. ScreenMerch credits and pays the Storefront Owner the applicable creator earnings for qualifying sales on the Owner&apos;s Storefront, including amounts attributed to Umbrella Collaborator pages. The Owner is solely responsible for distributing each Collaborator&apos;s recorded share in accordance with this Section 6. The Storefront Owner must pay each Umbrella Collaborator with a cleared owed balance of $50 or more within 14 days after the Owner receives the corresponding ScreenMerch payout. Smaller eligible balances must be paid at least quarterly. The dashboard may allow the Owner to record off-platform payments for bookkeeping; recording a payment does not move money and is not payment processing by ScreenMerch. The Owner selects the payment method, such as PayPal, bank transfer, or another method agreed with the Collaborator. ScreenMerch is not a party to those off-platform payments. The Storefront Owner and each Collaborator are responsible for agreeing to any allocation not already established by ScreenMerch&apos;s standard $6 creator share and for maintaining records concerning payment, content rights, removal, expenses, and taxes. The Owner is responsible for applicable tax reporting or withholding associated with Owner-to-Collaborator payments. ScreenMerch does not negotiate private arrangements, guarantee the Owner&apos;s payment, or assume responsibility for an Owner&apos;s failure to pay. A credible payment dispute or repeated failure to comply with this Section may result in restriction or suspension of Umbrella features, a Storefront, or an account.</p>

          <h3>6.4 Collaborator Acknowledgments and Disputes</h3>

          <p>An Umbrella Collaborator acknowledges that ScreenMerch does not pay the Collaborator directly for sales attributed to the Collaborator&apos;s Umbrella page. Payment comes from the Storefront Owner. Collaborators must keep accurate contact and payout information with the Owner and first address Owner-to-Collaborator payment disputes directly with the Owner. Joining an Umbrella Storefront does not create an employment, partnership, joint venture, fiduciary, franchise, or agency relationship among ScreenMerch, the Storefront Owner, and the Collaborator. Disputes about private agreements, attribution, payment timing, or removal are primarily between the Owner and Collaborator. ScreenMerch may assist with technical account or attribution questions but is not liable for unpaid Collaborator balances, private revenue agreements, or tax consequences of off-platform payments, except to the extent liability cannot lawfully be limited.</p>
        </section>

        <section>
          <h2>7. Products, Production and Third-Party Fulfillment</h2>
          <p>Products are custom-made after an order is submitted. ScreenMerch is the seller contracting with the Customer and collecting the Customer&apos;s payment. Production, printing, packaging, shipping, and some fulfillment support are performed for ScreenMerch by third-party service providers, including Printful, Inc. Product appearance may vary reasonably from on-screen previews because of display settings, print placement, garment sizing, materials, production methods, and normal manufacturing variation. ScreenMerch&apos;s arrangements with fulfillment providers are subject to those providers&apos; operational terms, policies, geographic limits, and content rules. ScreenMerch may share order, recipient, shipping, and production information with fulfillment providers as described in the Privacy Policy and applicable data-processing terms. A provider may reject content, discontinue a product, use a materially comparable production facility, or experience delays outside ScreenMerch&apos;s control. These provider arrangements do not make the Customer the purchaser of Printful&apos;s services or replace ScreenMerch as the Customer&apos;s seller. Customers must direct order, cancellation, delivery, defect, refund, and product-support requests to ScreenMerch. ScreenMerch will coordinate with the applicable manufacturer, fulfillment provider, payment processor, or carrier as appropriate. Nothing in these Terms excludes the responsibility of ScreenMerch, a manufacturer, or another party to the extent responsibility is imposed by applicable law. A Customer&apos;s purchase remains governed by these Terms and ScreenMerch&apos;s Privacy Policy; operational terms between ScreenMerch and a fulfillment provider do not create a direct merchandise-sales contract between that provider and the Customer.</p>
        </section>

        <section>
          <h2>8. Orders, Prices and Payment</h2>
          <p>Customers must provide accurate billing, shipping, and contact information and confirm product, size, color, design, quantity, and delivery details before ordering. Prices are displayed in U.S. dollars unless the Service states otherwise. Taxes, shipping, duties, and other charges are shown where applicable before checkout. Prices and product availability may change before an order is accepted. Payments are processed through Stripe or another disclosed payment processor. By submitting an order, you authorize the processor to charge the displayed total and represent that you are authorized to use the payment method. ScreenMerch may reject, cancel, hold, or limit an order for suspected fraud, payment failure, content concerns, inventory issues, pricing errors, sanctions compliance, or other legitimate operational reasons. If ScreenMerch cancels a paid order before fulfillment, the amount charged for the canceled portion will be refunded.</p>
        </section>

        <section>
          <h2>9. Cancellations, Refunds, Damaged Items and Defective Products</h2>
          <h3>9.1 Custom-Made Products; Cancellations</h3>

          <p>Because products are custom-made, returns and exchanges are generally not accepted for buyer&apos;s remorse, incorrect size or color selection, or a change of mind. A Customer may request cancellation promptly after ordering. Cancellation is available only if ScreenMerch can stop the order before fulfillment begins and is not guaranteed. Once an order enters production or fulfillment, it ordinarily cannot be canceled or changed. These restrictions do not limit rights that cannot legally be waived.</p>

          <h3>9.2 Defects, Damage and Production Errors</h3>

          <p>A claim for a damaged item, manufacturing defect, misprint, incorrect item, or production error must be submitted to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> within 30 days after delivery. The claim should include the order number, a description of the problem, and clear photographs of the product and packaging. Do not return a product unless ScreenMerch instructs you to do so. ScreenMerch or its fulfillment provider may require additional evidence. For a timely, verified claim, the available remedy may be a replacement, reprint, refund, or store credit, selected as appropriate to the circumstances and subject to applicable law. Normal variation, ordinary wear, damage after delivery, failure to follow care instructions, or a Customer-submitted address or selection error is not a manufacturing defect.</p>

          <h3>9.3 Delivery Problems</h3>

          <p>Customers must provide a complete and deliverable address. A Customer may be responsible for re-shipping costs when an order is returned because of an incorrect or insufficient address, refusal, an unclaimed delivery, or failure to pay import charges. A package believed lost in transit must be reported to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> no later than 30 days after the estimated delivery date. A package shown as delivered but not received should be reported promptly so available carrier or fulfillment-provider procedures can be pursued. Nothing in this Section limits non-waivable consumer rights.</p>
        </section>

        <section>
          <h2>10. Creator Earnings and ScreenMerch Payouts</h2>
          <h3>10.1 Earning Amount and Eligibility</h3>

          <p>A qualifying Creator earns $6 per sale on each qualifying product, subject to attribution and product-specific eligibility information displayed by the Service. Earnings become cleared when the Customer&apos;s payment has been successfully collected and the order enters fulfillment. Cleared and paid earnings remain subject to later adjustment for cancellations, refunds, reversals, chargebacks, fraud, abuse, or accounting errors. ScreenMerch may deduct a valid adjustment from current or future earnings balances or otherwise recover an overpayment as permitted by law.</p>

          <h3>10.2 $50 Threshold and Payout Information</h3>

          <p>ScreenMerch processes regular Creator payouts on or about the 1st and 15th of each month. An approved Storefront Owner with a cleared payable balance of at least $50 will ordinarily be paid during the next payout cycle. Eligible balances below $50 roll forward and will be paid at least quarterly, on or after March 31, June 30, September 30, and December 31. When an account is properly closed, any remaining eligible balance will be paid during the next practicable payout cycle, subject to these Terms. The Owner must provide a valid PayPal email and any reasonably requested identity, tax, or compliance information. ScreenMerch may defer, withhold, offset, or review a payout when information is incomplete or in cases of fraud, abuse, chargebacks, sanctions concerns, legal process, or violation of these Terms. ScreenMerch payouts to a Storefront Owner may include the creator earnings associated with qualifying sales on the Owner&apos;s Storefront, including earnings attributed to Umbrella Collaborator pages that the Owner must distribute under Section 6. Earnings summaries are informational and may be corrected for cancellations, refunds, reversals, chargebacks, fraud, abuse, or clear error.</p>
        </section>

        <section>
          <h2>11. Taxes</h2>
          <p>Each user is solely responsible for taxes, duties, withholding, registrations, records, and government filings arising from use of the Service, including income earned as a Storefront Owner or Umbrella Collaborator and payments made or received under an Umbrella arrangement. Amounts ScreenMerch pays directly to a Storefront Owner may be reported to tax authorities as required by law, including on an IRS Form 1099 in the United States. Users must provide accurate tax information when requested. Owner-to-Collaborator payments occur off platform. ScreenMerch does not withhold taxes or issue tax forms for those payments unless legally required. In the United States, a Storefront Owner may have reporting obligations, including possible Form 1099-NEC obligations, when applicable thresholds and rules are met. ScreenMerch does not provide legal, tax, or accounting advice; dashboard figures are not tax documents. Consult a qualified adviser.</p>
        </section>

        <section>
          <h2>12. Privacy and Communications</h2>
          <p>ScreenMerch&apos;s collection, use, and sharing of personal information is described in its Privacy Policy at <Link to="/privacy-policy">https://screenmerch.com/privacy-policy</Link>. Information necessary to process orders may be shared with payment processors, fulfillment providers, shipping carriers, fraud-prevention services, and other service providers. Creators and Storefront Owners who independently receive personal information must use it only for authorized Service purposes, protect it appropriately, and comply with applicable privacy and marketing laws. You consent to receive transactional electronic communications relating to accounts, orders, payouts, security, support, and these Terms. Marketing communications, where offered, are subject to applicable consent and opt-out requirements. You are responsible for keeping your email and other contact details current.</p>
        </section>

        <section>
          <h2>13. Suspension, Termination and Content Removal</h2>
          <p>ScreenMerch may investigate, restrict, suspend, or terminate an account, Storefront, product, content item, order, payout, or feature for a violation of these Terms; intellectual-property abuse; platform circumvention; fraud or manipulation; payment risk; harm to users or third parties; legal or regulatory requirements; extended inactivity; or material operational or security risk. Where reasonable, ScreenMerch may give notice and an opportunity to cure, but it may act immediately when necessary. Upon suspension or termination, access may be revoked; content and products may be removed; pending orders may be completed, canceled, or refunded as appropriate; and outstanding payouts may be reviewed before release. ScreenMerch may retain records and backups as required for legal, accounting, fraud-prevention, dispute, and operational purposes. Sections that by their nature should survive-including Sections 4, 6.3-6.4, 10-11, and 15-22-survive termination.</p>
        </section>

        <section>
          <h2>14. Third-Party Services and Links</h2>
          <p>The Service may integrate with or link to third-party services, including Printful, Stripe, PayPal, carriers, and content or social platforms. Third parties control their own services and terms. ScreenMerch is not responsible for third-party availability, content, security, acts, or omissions, except to the extent applicable law imposes responsibility. ScreenMerch&apos;s use of a provider to support manufacturing, fulfillment, payment, shipping, or platform operations does not change ScreenMerch&apos;s status as the Customer&apos;s seller or make that provider the Customer&apos;s seller. If a user separately chooses to access or use a third-party service, that separate use may create a direct relationship between the user and the provider.</p>
        </section>

        <section>
          <h2>15. Disclaimers</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE, PLATFORM TOOLS, STOREFRONTS, CONTENT, PRODUCTS, DASHBOARDS, ATTRIBUTION RECORDS, AND THIRD-PARTY SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; SCREENMERCH DISCLAIMS ALL EXPRESS, IMPLIED, AND STATUTORY WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, QUIET ENJOYMENT, AND ACCURACY. SCREENMERCH DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS; THAT CONTENT OR PRODUCTS WILL BE APPROVED OR AVAILABLE; THAT A CREATOR WILL MAKE SALES OR RECEIVE ANY PARTICULAR INCOME; THAT ATTRIBUTION OR DASHBOARD INFORMATION WILL NEVER REQUIRE CORRECTION; OR THAT MANUAL REVIEW WILL IDENTIFY LEGAL OR POLICY ISSUES. SOME JURISDICTIONS DO NOT ALLOW CERTAIN DISCLAIMERS, SO THESE DISCLAIMERS APPLY ONLY TO THE EXTENT PERMITTED BY LAW.</p>
        </section>

        <section>
          <h2>16. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCREENMERCH AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES; LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY; OR THE COST OF SUBSTITUTE SERVICES, ARISING FROM OR RELATED TO THE SERVICE OR THESE TERMS, EVEN IF ADVISED OF THE POSSIBILITY. TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCREENMERCH&apos;S TOTAL AGGREGATE LIABILITY ARISING FROM OR RELATED TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE TOTAL FEES YOU PAID TO SCREENMERCH IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. THIS LIMIT DOES NOT APPLY TO LIABILITY THAT CANNOT LAWFULLY BE LIMITED OR EXCLUDED. THE LIMITATIONS APPLY REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF A REMEDY FAILS OF ITS ESSENTIAL PURPOSE.</p>
        </section>

        <section>
          <h2>17. Indemnification</h2>
          <p>To the extent permitted by law, each Creator, Storefront Owner, and Umbrella Collaborator will defend, indemnify, and hold harmless ScreenMerch and its affiliates, officers, directors, employees, agents, and service providers from third-party claims, damages, judgments, losses, liabilities, penalties, costs, and reasonable attorneys&apos; fees arising from: Creator Content or products based on it; an alleged violation of intellectual-property, privacy, publicity, consumer-protection, or other rights; breach of these Terms or applicable law; misuse of the Service; or a private agreement or payment dispute between a Storefront Owner and an Umbrella Collaborator. ScreenMerch will provide reasonable notice and may control the defense and settlement; you may not settle a claim imposing liability or obligations on ScreenMerch without its written consent. This section does not require a consumer to indemnify ScreenMerch where prohibited by law.</p>
        </section>

        <section>
          <h2>18. Informal Resolution</h2>
          <p>Before starting arbitration or litigation, the claimant must send a written notice describing the dispute, relevant account or order information, the requested relief, and contact information to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>. The parties will attempt in good faith to resolve the matter for at least 30 days after receipt. This requirement does not prevent either party from seeking urgent injunctive relief or filing an eligible small-claims action.</p>
        </section>

        <section>
          <h2>19. Arbitration, Class-Action Waiver and California Law (U.S.)</h2>
          <h3>19.1 Agreement to Arbitrate</h3>

          <p>Except for an eligible individual action in small-claims court or a claim seeking temporary or preliminary injunctive relief to protect intellectual-property or confidential rights, any dispute arising out of or relating to these Terms or the Service will be resolved by binding individual arbitration administered by the American Arbitration Association under its applicable Consumer Arbitration Rules or Commercial Arbitration Rules, as appropriate. The Federal Arbitration Act governs this arbitration agreement. The arbitrator may award the same individual remedies a court could award but may not combine claims of different persons without all parties&apos; consent.</p>

          <h3>19.2 Procedure and Location</h3>

          <p>Arbitration may be conducted by documents, telephone, videoconference, or an in-person hearing as the applicable rules permit. For a consumer, an in-person hearing will occur in the county of the consumer&apos;s residence unless the parties agree otherwise. For a non-consumer, the hearing location will be California unless the parties agree otherwise. Fees will be allocated under the applicable arbitration rules and law.</p>

          <h3>19.3 Class and Jury Waivers</h3>

          <p>YOU AND SCREENMERCH WAIVE THE RIGHT TO A JURY TRIAL. EACH PARTY MAY BRING CLAIMS ONLY IN AN INDIVIDUAL CAPACITY, NOT AS A PLAINTIFF OR CLASS MEMBER IN A CLASS, COLLECTIVE, CONSOLIDATED, COORDINATED, OR REPRESENTATIVE ACTION, TO THE EXTENT THIS WAIVER IS PERMITTED BY LAW. If a final decision holds that a particular claim or request for relief cannot lawfully be arbitrated on an individual basis, only that claim or request will proceed in a court of competent jurisdiction; the remainder will remain in arbitration.</p>

          <h3>19.4 Opt-Out</h3>

          <p>A new user may opt out of Sections 19.1-19.3 by sending an email to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> within 30 days after first accepting these Terms. The notice must state the user&apos;s name, account email, and an unambiguous request to opt out of arbitration. Opting out does not affect other Terms.</p>

          <h3>19.5 Governing Law and Courts</h3>

          <p>California law governs these Terms, without regard to conflict-of-laws principles, except that the Federal Arbitration Act governs Section 19. For a dispute not subject to arbitration, the parties consent to the exclusive jurisdiction of state and federal courts located in California, except that a consumer may retain any non-waivable right to bring a claim in another forum. Users outside the United States retain mandatory consumer protections and other rights that cannot lawfully be waived in their country or region. Nothing in these Terms excludes those non-waivable rights.</p>
        </section>

        <section>
          <h2>20. California Consumer Notice</h2>
          <p>Under California Civil Code Section 1789.3, California users may contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834, or by telephone at (916) 445-1254 or (800) 952-5210. You may contact ScreenMerch at <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>.</p>
        </section>

        <section>
          <h2>21. Changes to the Service and These Terms</h2>
          <p>ScreenMerch may modify the Service and update these Terms periodically. When changes are material, ScreenMerch will provide notice reasonably appropriate to the circumstances, such as by posting revised Terms, updating the &quot;Last Updated&quot; date, or sending an account communication. ScreenMerch may require affirmative acceptance of a materially updated version before a user creates an account, accesses Creator or Storefront features, continues through Make Merch, or places another order. Unless a later date is stated, revised Terms take effect when posted. Continued use after the effective date constitutes acceptance where permitted by law, but additional consent will be obtained where required. Changes do not retroactively alter a dispute that arose before the change&apos;s effective date.</p>
        </section>

        <section>
          <h2>22. General Terms and Contact</h2>
          <p>These Terms, together with policies and terms expressly incorporated by reference, are the entire agreement between you and ScreenMerch concerning the Service and supersede prior agreements on that subject. If a provision is unenforceable, it will be modified to the minimum extent necessary or severed, and the remainder will continue in effect. ScreenMerch&apos;s failure to enforce a provision is not a waiver. You may not assign these Terms without ScreenMerch&apos;s written consent; ScreenMerch may assign them in connection with a merger, acquisition, reorganization, sale of assets, or by operation of law. No person other than the parties has third-party beneficiary rights unless these Terms expressly state otherwise. ScreenMerch is not liable for delay or failure caused by events beyond its reasonable control, including carrier or fulfillment disruption, labor dispute, natural disaster, war, terrorism, epidemic, governmental action, utility or internet failure, cyberattack, or third-party platform outage. Section headings are for convenience only. &quot;Including&quot; means &quot;including without limitation.&quot; Electronic notices and records satisfy writing requirements to the extent permitted by law. The Service is currently operated by Alan Armstrong, an individual doing business as ScreenMerch. Questions, support requests, cancellation requests, defect claims, copyright complaints, and legal notices may be sent to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> or mailed to: ScreenMerch, Attn: Legal Notices, 1311 Park Street, Unit #543, Alameda, CA 94501. The Privacy Policy is available at <Link to="/privacy-policy">https://screenmerch.com/privacy-policy</Link>.</p>
        </section>

        <div className="navigation-links">
          <Link to="/" className="nav-link">&larr; Back to ScreenMerch</Link> |{' '}
          <Link to="/privacy-policy" className="nav-link">Privacy Policy &rarr;</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
