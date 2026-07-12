import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './FAQ.css';

const FAQ_SECTIONS = [
  {
    id: 'solo',
    title: 'Solo storefront setup',
    items: [
      {
        q: 'How do I get a free ScreenMerch storefront?',
        a: 'From the homepage, reserve a soft-launch spot or go to creator signup. Complete the application (Google or email), agree to the Terms and Privacy Policy, then wait for admin approval. After approval, your subdomain (yourname.screenmerch.com) may take up to 24 hours to activate.',
      },
      {
        q: 'What do I set up first after approval?',
        a: 'Personalize your branding (logo, colors, favicon), set your subdomain, upload short videos, and connect payout details (PayPal email). On desktop, FrameSnag helps capture moments from YouTube into your storefront workflow.',
      },
      {
        q: 'How much do I earn per sale?',
        a: 'Creators earn $6 per sale on most products. Greeting cards, stickers, and magnets may use different rates. ScreenMerch pays storefront owners when pending earnings reach the $50 minimum.',
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
        a: 'You do. ScreenMerch pays you for sales on your direct storefront pages. Sales attributed to an umbrella collaborator page are your responsibility to pay that collaborator — typically when their owed balance reaches $50. Recording a payment in the dashboard is bookkeeping; money moves off-platform (for example PayPal).',
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
        q: 'How do I join someone’s storefront?',
        a: 'Accept an invite by username (Channel invites) or open the join link from an email invite and sign in with the invited email. Once approved, you get a page on the owner’s subdomain.',
      },
      {
        q: 'Does ScreenMerch pay me directly?',
        a: 'Not for umbrella-attributed sales. The storefront owner pays you based on attributed earnings shown in their dashboard. Keep your contact and payout details current with the owner.',
      },
    ],
  },
  {
    id: 'fans',
    title: 'Fans & shopping',
    items: [
      {
        q: 'How does merch from a video work?',
        a: 'On a creator storefront, open a video, capture a screenshot of a moment you like, place it on a product, and check out. Fulfillment partners (such as Printful) produce and ship the order.',
      },
      {
        q: 'Can I return custom merch?',
        a: 'Because products are custom-made, returns are generally not accepted except for manufacturing defects or production errors. Defect claims should be submitted within 30 days of delivery.',
      },
    ],
  },
  {
    id: 'soft-launch',
    title: 'Soft launch & access',
    items: [
      {
        q: 'Why are storefront spots limited?',
        a: 'This soft launch offers a limited number of free creator storefronts so we can support early creators closely. When spots are claimed, new applications may wait for the next wave.',
      },
      {
        q: 'Where can I watch a full walkthrough?',
        a: 'Open How it works from the homepage introduction card for the ScreenMerch intro video and a written explanation — without entering the live screenshot-and-merch tool.',
      },
    ],
  },
];

const FAQ = () => {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState('solo-0');

  const toggle = (key) => {
    setOpenKey((prev) => (prev === key ? '' : key));
  };

  return (
    <div className="faq-page">
      <div className="faq-inner">
        <p className="faq-eyebrow">Help center</p>
        <h1 className="faq-title">FAQ</h1>
        <p className="faq-lede">
          Setup scenarios for solo creators, umbrella owners, collaborators, and shoppers during
          ScreenMerch&apos;s limited soft launch.
        </p>

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
