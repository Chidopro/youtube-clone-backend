import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './FAQ.css';

const FAQ_SECTIONS = [
  {
    id: 'solo',
    title: 'Solo storefront setup',
    items: [
      {
        q: 'How do I get a free ScreenMerch storefront?',
        a: 'From the homepage, reserve a soft-launch spot or go to creator signup. Complete the application (Google or email), agree to the Terms and Privacy Policy, then wait for admin approval. After approval, sign in on the main site (screenmerch.com), open your dashboard, and set your branding and subdomain. Your storefront URL may take up to 24 hours to activate after you save a subdomain.',
      },
      {
        q: 'What do I set up after approval?',
        a: 'Sign in at screenmerch.com with your email and password. In the dropdown, go to Dashboard, then open the Personalization tab to set up your subdomain name (for example, example.screenmerch.com). Set your header logo (upload from your computer, ScreenMerch hosts it and fills in the URL - or paste a URL if it’s already online), page colors, and favicon, then save settings. The subdomain can take up to 24 hours to activate and load your storefront. Next, upload short videos, and on desktop use FrameSnag to capture YouTube moments into your Favorites page. Recommended sizes: header logo 200×50px (PNG or SVG, upload max 2MB); favicon 32×32px (ICO or PNG).',
      },
      {
        q: 'How do I use FrameSnag?',
        a: 'FrameSnag is a free Google Chrome extension for ScreenMerch creators (desktop). After your storefront is approved, install FrameSnag from the Chrome Web Store or from the download link in Dashboard → Favorites. Open one of your own YouTube videos (FrameSnag only works on your videos), use FrameSnag to capture high-quality frames or thumbnails, and send them to your ScreenMerch Favorites. Those images become artwork fans can put on merch. You can also paste a capture into Favorites with Ctrl+V (Cmd+V on Mac) when FrameSnag opens your dashboard.',
      },
      {
        q: 'How much do I earn per sale?',
        a: 'Creators earn $6 per sale on most products. Greeting cards, stickers, and magnets may use different rates. ScreenMerch pays storefront owners when pending earnings reach the $50 minimum.',
      },
      {
        q: 'Why are storefront spots limited?',
        a: 'This soft launch offers a limited number of free creator storefronts so we can support early creators closely. When spots are claimed, new applications may wait for the next wave.',
      },
    ],
  },
  {
    id: 'umbrella-owner',
    title: 'Umbrella storefront owner',
    items: [
      {
        q: 'What is an umbrella network?',
        a: 'Approved storefront owners can invite umbrella creators (collaborators) onto the same branded subdomain. Each collaborator gets an attributed page. Fans shop without leaving your storefront.',
      },
      {
        q: 'Who pays umbrella creators?',
        a: 'You do. ScreenMerch pays you for sales on your direct storefront pages. Sales attributed to an umbrella collaborator page are your responsibility to pay that collaborator — typically when their owed balance reaches $50.',
      },
      {
        q: 'Am I responsible for taxes on collaborator payouts?',
        a: 'Yes — taxes on amounts you earn and amounts you pay collaborators are your responsibility. ScreenMerch does not withhold tax on owner-to-collaborator payments. See the Terms of Service umbrella section and consult a tax professional.',
      },
    ],
  },
  {
    id: 'umbrella-collab',
    title: 'Umbrella collaborator',
    items: [
      {
        q: 'How does a storefront owner send an umbrella invite?',
        a: 'The storefront owner opens Dashboard → Umbrella (Collaborators), enters the invitee’s email or ScreenMerch username, and clicks Send invite. Email invites create a join link the owner copies and emails (ScreenMerch does not email the link automatically). Username invites go to people who already have a ScreenMerch account; they accept under Channel invites in the profile menu. The owner should set a subdomain in Personalization before sending email invites, since join links use that storefront address.',
      },
      {
        q: 'How do I join someone’s storefront?',
        a: 'Accept an invite by username (Channel invites) or open the join link from an email invite and sign in with the invited email. Once you accept the invite, you get a page on the owner’s subdomain.',
      },
      {
        q: 'Does ScreenMerch pay me directly?',
        a: 'Not for umbrella-attributed sales. The storefront owner pays you based on attributed earnings shown in their dashboard. You can monitor your sales in your analytics page. Keep your contact and payout details current with the owner.',
      },
    ],
  },
  {
    id: 'fans',
    title: 'Fans & shopping',
    items: [
      {
        q: 'I just want a customer account.',
        a: 'You don’t need to be a creator to shop. Create a customer account, then visit a creator’s storefront (for example theirname.screenmerch.com), pick a video moment or Favorites image, place the image on a product, and check out.',
      },
      {
        q: 'How does merch from a video work?',
        a: 'On a creator storefront, open a video or go to the Favorites page. On a video, use Select Screenshot to capture up to five moments. Choose a screenshot or favorite image, click Make Merch, pick a product category, place the image on a product, and check out.',
      },
      {
        q: 'Can I return custom merch?',
        a: 'Because products are custom-made, returns are generally not accepted except for manufacturing defects or production errors. Defect claims should be submitted within 30 days of delivery.',
      },
    ],
  },
];

const FAQ = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openKey, setOpenKey] = useState('');

  // Every visit (including from dashboard dropdown): all closed, scroll to top
  useEffect(() => {
    setOpenKey('');
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('.main-content-area');
    if (main) main.scrollTop = 0;
  }, [location.key, location.pathname, location.state]);

  const toggle = (key) => {
    setOpenKey((prev) => (prev === key ? '' : key));
  };

  return (
    <div className="faq-page">
      <header className="faq-header">
        <p className="faq-eyebrow">Help center</p>
        <h1 className="faq-title">FAQ</h1>
      </header>

      <div className="faq-inner">
        {FAQ_SECTIONS.map((section) => (
          <section key={section.id} className="faq-section" id={section.id}>
            <h2 className="faq-section-title">{section.title}</h2>
            <div className="faq-list">
              {section.items.map((item, index) => {
                const key = `${section.id}-${index}`;
                const isOpen = openKey === key;
                return (
                  <div key={key} className={`faq-item ${isOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="faq-question"
                      aria-expanded={isOpen}
                      onClick={() => toggle(key)}
                    >
                      <span>{item.q}</span>
                      <span className="faq-chevron" aria-hidden="true">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && <div className="faq-answer">{item.a}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="faq-cta-row">
          <button
            type="button"
            className="faq-cta-primary"
            onClick={() => navigate('/subscription-tiers', { state: { intent: 'creator' } })}
          >
            Unlock your free storefront
          </button>
          <Link to="/how-it-works" className="faq-cta-secondary">
            How it works
          </Link>
        </div>

        <p className="faq-contact">
          Still stuck? Email <a href="mailto:support@screenmerch.com">support@screenmerch.com</a>
        </p>

        <Link to="/" className="faq-back">
          ← Back to home
        </Link>
      </div>
    </div>
  );
};

export default FAQ;
