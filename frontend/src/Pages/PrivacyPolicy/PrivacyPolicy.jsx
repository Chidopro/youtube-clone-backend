import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './PrivacyPolicy.css';
import screenMerchLogo from '../../assets/screenmerch_logo.png.png';

const PrivacyPolicy = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('.main-content-area');
    if (main) main.scrollTop = 0;
  }, [location.key, location.pathname]);

  return (
    <div className="privacy-policy-container">
      <div className="privacy-policy-content">
        <div className="logo">
          <img src={screenMerchLogo} alt="ScreenMerch Logo" className="logo-img" />
        </div>

        <header className="legal-header">
          <h1>Privacy Policy</h1>
          <p className="legal-subtitle">For visitors, customers, creators, and umbrella participants</p>
          <div className="legal-meta">
            <span className="legal-version">Version 2.0</span>
            <span className="legal-date">Effective August 5, 2026</span>
            <span className="legal-date">Last updated August 5, 2026</span>
          </div>
        </header>

        <section>
          <h2>1. Scope and Operator</h2>
          <p>This Privacy Policy explains how ScreenMerch collects, uses, discloses, retains, and protects personal information when a person visits screenmerch.com or a ScreenMerch creator subdomain; creates or uses a customer, creator, or umbrella account; creates merchandise; places or receives an order; communicates with us; or otherwise uses the ScreenMerch platform and related services (collectively, the &quot;Services&quot;). ScreenMerch is currently operated by Alan Armstrong, an individual doing business as ScreenMerch (&quot;ScreenMerch,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). ScreenMerch is the business responsible for the personal information described in this Policy. This operator identification will be updated if the business is reorganized as a limited liability company or another legal entity. This Policy applies to all ScreenMerch roles. Some provisions apply only when a person uses a particular feature, such as creator tools, umbrella collaboration, purchasing, fulfillment, payouts, Google sign-in, or SMS notifications.</p>
        </section>

        <section>
          <h2>2. Personal Information We Collect</h2>
          <h3>Information You Provide</h3>

          <ul>
            <li>Account and identity information, including name, email address, username, account role, profile image, location, preferences, and customization settings</li>
            <li>Authentication information, including login identifiers and authentication tokens. Passwords are stored in hashed form by our authentication provider and are not stored by ScreenMerch in readable form</li>
            <li>Contact and order information, including recipient name, telephone number, shipping address, billing address, order selections, product customizations, and customer-service communications</li>
            <li>Creator and storefront information, including subdomain, branding, channel information, uploaded videos, screenshots, thumbnails, images, favorites, merchandise designs, creator applications, approval status, and payout information</li>
            <li>Umbrella-program information, including invite email addresses or usernames, membership and invitation status, collaborator page names, sales attribution, agreed allocations when recorded, and payout records entered by storefront owners, including amount, date, and optional notes</li>
            <li>Communications and submissions, including support messages, feedback, legal or privacy requests, reports, and other information sent to ScreenMerch</li>
          </ul>

          <h3>Payment Information</h3>

          <ul>
            <li>Payment-card information is collected and processed by Stripe or another disclosed payment processor. ScreenMerch may receive limited transaction information, such as payment status, billing name and address, payment type, and the last four digits of a payment card, but does not receive or store complete payment-card numbers. Creator payout details, such as a PayPal address or other supported payout identifier, are used to make ScreenMerch-to-creator payments</li>
          </ul>

          <h3>Information Collected Automatically</h3>

          <ul>
            <li>Device and network information, such as IP address, browser type, device type, operating system, language, approximate location derived from IP address, and identifiers associated with cookies or local storage</li>
            <li>Usage information, such as pages and storefronts visited, navigation paths, feature interactions, timestamps, referral information, cart activity, and diagnostic or error information</li>
            <li>Transaction and security information, such as order status, fraud indicators, login activity, session information, audit records, and actions taken within an account</li>
          </ul>

          <h3>Information From Other Sources</h3>

          <ul>
            <li>We may receive information from a customer or creator who invites or interacts with you; Google or another sign-in provider you choose; payment, fraud-prevention, fulfillment, shipping, communication, and infrastructure providers; and publicly available sources when reasonably necessary to verify, secure, support, or operate the Services</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Personal Information</h2>
          <ul>
            <li>Create, authenticate, administer, and secure customer, creator, and umbrella accounts</li>
            <li>Display and operate creator storefronts, subdomains, profiles, videos, images, favorites, product previews, and merchandise tools</li>
            <li>Create print-ready files; process payments; manufacture, fulfill, ship, track, support, refund, or otherwise administer merchandise orders</li>
            <li>Calculate creator earnings; administer ScreenMerch payouts; attribute umbrella sales; and display balances and payout histories</li>
            <li>Send transactional email or SMS notifications, security alerts, account notices, and responses to support requests</li>
            <li>Operate, maintain, troubleshoot, analyze, test, and improve the Services and user experience</li>
            <li>Detect, investigate, prevent, and respond to fraud, abuse, unauthorized access, intellectual-property concerns, prohibited content, and other security or legal issues</li>
            <li>Maintain records, enforce our Terms of Service, resolve disputes, protect legal rights, and comply with tax, accounting, regulatory, and other legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>4. Public and Participant-Visible Information</h2>
          <p>Creator storefront information may be public. Depending on creator settings and platform features, a creator&apos;s display name, username, subdomain, profile image, branding, videos, thumbnails, screenshots, images, merchandise designs, and other published content may be visible to visitors and may be indexed or copied outside ScreenMerch. Within an umbrella relationship, storefront owners may see connected collaborators, invite status, attributed sales summaries, balances, and payout history recorded for their storefront. Umbrella creators may see their own attribution, analytics, and relationship status. ScreenMerch does not publicly display collaborator email addresses merely because a person participates in an umbrella storefront.</p>
        </section>

        <section>
          <h2>5. When We Disclose Personal Information</h2>
          <p>We disclose personal information only as reasonably necessary for the purposes described in this Policy, including to the following categories of recipients:</p>

          <ul>
            <li>Payment processors, including Stripe, to process payments, refunds, disputes, and fraud checks</li>
            <li>Manufacturing, fulfillment, and shipping providers, including Printful, to produce and deliver merchandise. Information may include recipient name, shipping address, telephone number, email address, order details, and design or print files</li>
            <li>Authentication, database, storage, hosting, and infrastructure providers, including Supabase, Netlify, and Fly.io, to operate and secure the Services</li>
            <li>Communication providers, including Resend and any SMS provider used by ScreenMerch, to deliver account, order, support, and security messages</li>
            <li>Sign-in providers, including Google, when you choose third-party authentication</li>
            <li>Analytics, security, fraud-prevention, customer-support, accounting, tax, legal, insurance, and other professional or operational service providers</li>
            <li>Other users when you direct a disclosure, publish information, join an umbrella relationship, or use a feature designed to share information with them</li>
            <li>Government authorities, courts, law-enforcement agencies, or other parties when required by law or reasonably necessary to protect rights, safety, security, users, or the public</li>
            <li>A successor or prospective successor in connection with a merger, financing, reorganization, sale, transfer, insolvency, or similar business transaction, subject to appropriate confidentiality protections where practicable</li>
          </ul>

          <p>Service providers may process information under their own privacy terms where they act independently. For fulfillment-related processing, users may review Printful&apos;s Privacy Policy and applicable data-processing terms. Payment processing is also subject to Stripe&apos;s privacy practices.</p>
        </section>

        <section>
          <h2>6. No Sale or Behavioral-Advertising Sharing</h2>
          <p>ScreenMerch does not sell personal information for money. ScreenMerch does not use or disclose personal information for cross-context behavioral advertising. We do not knowingly permit third parties to collect personal information through the Services over time and across unrelated websites for targeted advertising. If these practices change, we will update this Policy and provide any choices required by applicable law.</p>
        </section>

        <section>
          <h2>7. Cookies, Local Storage, and Similar Technologies</h2>
          <p>ScreenMerch and its service providers use cookies, local storage, session storage, and similar technologies that are reasonably necessary to authenticate users, maintain sessions, preserve carts and preferences, route creator subdomains, protect accounts, prevent fraud, remember settings, diagnose problems, and understand basic use of the Services. Most browsers permit users to delete or block cookies. Blocking technologies needed for authentication, cart operation, or security may prevent parts of ScreenMerch from functioning correctly. Browser &quot;Do Not Track&quot; signals are not governed by a uniform industry standard, and ScreenMerch does not respond to them separately. Because ScreenMerch does not currently sell personal information or share it for cross-context behavioral advertising, a Global Privacy Control signal does not change our necessary operational processing. We will honor legally required opt-out preference signals if our practices become subject to such requirements.</p>
        </section>

        <section className="security-box">
          <h2>8. Content Processing</h2>
          <p>Uploaded videos and images may be processed to generate thumbnails, capture screenshots, create previews, optimize or prepare files for printing, operate creator storefronts, provide support, prevent misuse, and fulfill merchandise orders. Print-ready content may be transmitted to fulfillment and infrastructure providers as necessary to produce and deliver merchandise. Creators retain their ownership rights subject to the licenses and permissions described in the ScreenMerch Terms of Service. ScreenMerch does not use creator content for unrelated advertising or license it to competing merchandise platforms. No system can guarantee that public content will never be copied or misused by an unauthorized third party.</p>
        </section>

        <section>
          <h2>9. Umbrella Collaboration and Payout Information</h2>
          <p>ScreenMerch uses umbrella information to operate invitations, collaborator pages, sales attribution, dashboard balances, and payout histories. ScreenMerch pays the applicable storefront owner as described in the Terms of Service. The storefront owner is responsible for paying umbrella collaborators off-platform and may record the amount, date, and optional payment note in ScreenMerch. ScreenMerch does not process owner-to-collaborator payments. Payment details exchanged off-platform are not collected unless a participant voluntarily enters them in an account field, payment note, or support communication. Storefront owners and collaborators should avoid placing sensitive financial information in optional notes.</p>
        </section>

        <section className="sms-section">
          <h2>10. SMS and Other Communications</h2>
          <p>When ScreenMerch offers SMS notifications, a user who provides a telephone number and affirmatively opts in may receive order-status, shipping, customer-service, account-security, or other important service messages. Consent to receive SMS messages is not a condition of purchasing goods or services.</p>

          <ul>
            <li>Program: ScreenMerch Notifications.</li>
            <li>Expected frequency: generally one to three messages per order, plus occasional support, security, or critical service messages.</li>
            <li>Opt out: reply STOP to unsubscribe from optional SMS messages.</li>
            <li>Help: reply HELP or contact <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>.</li>
            <li>Carrier message and data rates may apply.</li>
          </ul>

          <p>Opting out of optional SMS does not prevent ScreenMerch from sending legally permitted non-SMS communications or responding to a user-initiated support request.</p>
        </section>

        <section>
          <h2>11. Data Retention</h2>
          <p>We retain personal information for as long as reasonably necessary to provide the Services, maintain an account, fulfill transactions, administer payouts, secure the platform, resolve disputes, enforce agreements, and comply with legal, tax, accounting, and reporting obligations.</p>

          <ul>
            <li>Active account and storefront information is generally retained while the account remains active</li>
            <li>Order, payment, payout, tax, and related business records may be retained for up to seven years or longer when legally required</li>
            <li>When an account-deletion request is completed, we generally delete or deidentify account information from active systems within 30 days, except information that must or may reasonably be retained for transactions, security, fraud prevention, disputes, legal obligations, or enforcement</li>
            <li>Residual copies may remain temporarily in backups, logs, and disaster-recovery systems until overwritten under ordinary retention cycles</li>
            <li>Published or shared information copied by other users or third parties may remain outside ScreenMerch&apos;s control</li>
          </ul>
        </section>

        <section className="security-box">
          <h2>12. Security</h2>
          <p>ScreenMerch uses administrative, technical, and organizational safeguards designed to protect personal information, including HTTPS/TLS transmission, authentication controls, role-based access, restricted administrative access, logging, and encrypted storage where supported and appropriate. Service providers also maintain their own safeguards. No method of transmission, storage, or processing is completely secure. ScreenMerch cannot guarantee absolute security. Users are responsible for protecting their login credentials and notifying ScreenMerch promptly of suspected unauthorized account access.</p>
        </section>

        <section>
          <h2>13. Privacy Choices and Requests</h2>
          <p>Depending on where you live and subject to applicable law, you may have rights to request access to personal information, correction, deletion, portability, restriction, objection, or withdrawal of consent. You may also update certain account information directly and opt out of optional SMS communications by replying STOP. To submit a privacy request, email <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> with &quot;Privacy Request&quot; in the subject line. Describe the request and identify the account email address involved. We may take reasonable steps to verify identity and authority before acting. We will use verification information only for the request and will respond within the period required by applicable law. Some requests may be limited by transaction, security, fraud-prevention, recordkeeping, free-expression, legal, or other permitted exceptions. ScreenMerch will not unlawfully discriminate against a person for exercising an applicable privacy right. An authorized agent may submit a request where permitted by law, but ScreenMerch may require proof of authorization and identity verification.</p>
        </section>

        <section>
          <h2>14. California Privacy Information</h2>
          <p>California residents may request information about the categories and specific pieces of personal information ScreenMerch holds about them; request correction or deletion; and receive information about categories of sources, purposes, and recipients, to the extent those rights apply under California law. ScreenMerch does not sell personal information or share it for cross-context behavioral advertising. ScreenMerch collects the categories described in Section 2 from users, their devices, other participants, sign-in providers, payment and fulfillment providers, and operational service providers. It uses and discloses those categories for the purposes and recipients described in Sections 3 through 10. Requests may be submitted to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>. If ScreenMerch becomes legally required to provide additional California notices or request methods, this Policy and the Services will be updated accordingly.</p>
        </section>

        <section>
          <h2>15. International Users and Transfers</h2>
          <p>ScreenMerch is operated from the United States. Personal information may be transferred to, stored in, and processed in the United States and other countries where ScreenMerch&apos;s service providers operate. Those countries may have privacy laws different from the laws where a user lives. Where applicable, ScreenMerch uses legally recognized transfer mechanisms and contractual protections. For users in the European Economic Area or United Kingdom, processing may be based on performance of a contract, compliance with legal obligations, ScreenMerch&apos;s legitimate interests in operating and securing the Services, or consent where required. Subject to applicable law, those users may request access, correction, deletion, restriction, portability, or objection; withdraw consent; and lodge a complaint with their local data-protection authority.</p>
        </section>

        <section>
          <h2>16. Children and Age Requirements</h2>
          <p>ScreenMerch account creation, purchasing, creator, and umbrella services are intended only for individuals who are at least 18 years old or the age of legal majority where they live. ScreenMerch does not knowingly permit children to create accounts or knowingly collect personal information from children through account registration. Visitors who are minors may browse only under the supervision of a parent or legal guardian, consistent with the Terms of Service. A parent or guardian who believes a child provided personal information may contact <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> to request review and deletion.</p>
        </section>

        <section>
          <h2>17. Changes to This Policy</h2>
          <p>ScreenMerch may update this Privacy Policy periodically. We will post the revised Policy with a new &quot;Last Updated&quot; date and provide additional notice when required by law or when changes are material. Where applicable, ScreenMerch may request renewed acknowledgment of a materially updated Policy.</p>
        </section>

        <section>
          <p>Privacy questions, concerns, or requests may be sent to <a href="mailto:support@screenmerch.com">support@screenmerch.com</a> or mailed to: ScreenMerch, Attn: Privacy Officer, 1311 Park Street, Unit #543, Alameda, California 94501.</p>
        </section>

        <div className="navigation-links">
          <Link to="/" className="nav-link">&larr; Back to ScreenMerch</Link> |{' '}
          <Link to="/terms-of-service" className="nav-link">Terms of Service &rarr;</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
