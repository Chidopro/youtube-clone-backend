import React from 'react';
import { Link } from 'react-router-dom';
import './Release.css';

const Release = () => {
  return (
    <div className="release-page">
      <article className="release-article">
        <p className="release-for-immediate">FOR IMMEDIATE RELEASE</p>
        <p className="release-date">February 28, 2026</p>
        <h1 className="release-title">The Creator Revolution Has a Storefront: ScreenMerch Officially Launches</h1>
        <p className="release-dateline">Alameda, California — February 28, 2026</p>

        <p>Today marks the official public launch of ScreenMerch, a creator-focused platform designed to transform video moments into merchandise — and give creators full ownership of their storefronts.</p>

        <p>ScreenMerch was built on a simple but powerful idea:</p>
        <ul>
          <li>Creators should not rely solely on ads, sponsorships, or unpredictable algorithms to earn income.</li>
          <li>They should be able to turn the moments their audiences love into something tangible.</li>
        </ul>

        <p>With ScreenMerch, creators upload their videos.<br />Fans pick a moment.<br />Capture a screenshot.<br />Place it on products.<br />And check out — all inside the creator&apos;s own branded store.</p>

        <p><strong>No inventory.<br />No fulfillment headaches.<br />No shipping logistics.</strong></p>
        <p>Just content becoming commerce — instantly.</p>

        <h2>A Store That Belongs to the Creator</h2>
        <p>Every approved creator receives:</p>
        <ul>
          <li>A personalized subdomain (yourname.screenmerch.com)</li>
          <li>Full branding control — logo, colors, favicon, and metadata</li>
          <li>A dashboard to manage videos, analytics, and payouts</li>
          <li>$7 per sale on most products</li>
          <li>Secure payment processing and global fulfillment handled behind the scenes</li>
        </ul>
        <p>Fans don&apos;t leave the creator&apos;s world.<br />They stay inside the creator&apos;s brand.</p>

        <h2>Built for the Creator Economy — Not Around It</h2>
        <p>The creator economy has grown rapidly, but monetization tools remain fragmented. ScreenMerch was designed to unify:</p>
        <p>Video<br />Merchandise<br />Storefront<br />Fulfillment<br />Payout</p>
        <p>Into one streamlined ecosystem.</p>
        <p>Each image is processed for professional 300 DPI print quality.<br />Production and shipping are managed through trusted fulfillment partners.<br />Creators focus on creating.</p>

        <h2>A Movement, Not Just a Platform</h2>
        <p>ScreenMerch launches today as more than a tool.</p>
        <p>It launches as an invitation.</p>
        <p>An invitation for creators to own their storefronts.<br />An invitation for fans to participate in the moments they love.<br />An invitation to build revenue around creativity — not dependency.</p>
        <p>February 28, 2026 marks the first official day ScreenMerch is offered publicly for creator use.</p>
        <p><strong>The storefront revolution begins now.</strong></p>

        <p>For more information or to apply as a creator, visit:<br /><a href="https://screenmerch.com" className="release-link">https://screenmerch.com</a></p>

        <p className="release-contact"><strong>Media Contact:</strong><br />ScreenMerch<br />support@screenmerch.com</p>

        <p className="release-tagline"><strong>Your brand. Your videos. Your earnings.</strong></p>
      </article>
      <Link to="/" className="release-back">Back to Home</Link>
    </div>
  );
};

export default Release;
