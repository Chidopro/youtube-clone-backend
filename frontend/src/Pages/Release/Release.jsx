import React from 'react';
import { Link } from 'react-router-dom';
import './Release.css';

const Release = () => {
  return (
    <div className="release-page">
      <article className="release-article">
        <h1 className="release-title">Welcome to ScreenMerch</h1>

        <p>
          ScreenMerch is a creator-focused merchandising platform that transforms memorable moments
          from clips and photos into products fans can make their own.
        </p>

        <p>
          It was built around a simple idea: creators should have more ways to earn from the content they
          already create — without depending entirely on advertising, sponsorships, or unpredictable
          algorithms.
        </p>

        <p>
          With ScreenMerch, approved creators receive their own subdomain and branded storefront.
          Where fans can browse images and capture moments from clips they love. Then choose from a
          variety of categories to print on merchandise to purchase. All within the creator&apos;s
          ScreenMerch store.
        </p>

        <h2>A Storefront That Belongs to Your Brand</h2>
        <p>
          Instead of sending your audience to a generic marketplace, ScreenMerch gives you a destination
          built around your identity.
        </p>
        <p>Your storefront can include your own:</p>
        <ul>
          <li>Personalized ScreenMerch subdomain</li>
          <li>Logo and header branding</li>
          <li>Page colors</li>
          <li>Favicon</li>
          <li>Storefront images and content</li>
          <li>Clips and photos</li>
        </ul>
        <p>
          Behind the storefront, your creator dashboard gives you the tools to manage your content,
          monitor activity and analytics, and track earnings and payouts.
        </p>
        <p>
          Your fans stay connected to your content and your brand throughout the shopping experience.
        </p>

        <h2>Turn Content Into Something Fans Can Keep</h2>
        <p>
          A great moment in a clip can last only a few seconds. ScreenMerch gives that moment another
          life.
        </p>
        <p>
          Creators add the images and clips. Fans can capture memorable screenshots from those clips,
          browse images, choose their favorites, and personalize merchandise with the content that
          means something to them. That lets fans take part in choosing what they want.
        </p>
        <p>
          There&apos;s no inventory for creators to purchase, no boxes to pack, and no monthly membership
          fee.
        </p>
        <p>
          ScreenMerch coordinates payment processing, production, fulfillment, and delivery through its
          platform and fulfillment partners, allowing creators to concentrate on what they do best —
          creating content and building their audience.
        </p>

        <h2>Built to Grow Beyond One Creator</h2>
        <p>ScreenMerch can also become a shared home for a creator network.</p>
        <p>
          Through <strong>Umbrella Creators</strong>, storefront owners can invite trusted collaborators,
          co-hosts, staff members, or other creators to establish their own presence within the owner&apos;s
          storefront.
        </p>
        <p>
          Each collaborator has a page of their own to add content and view sales analytics, product sales
          and current earnings history.
        </p>
        <p>
          For a YouTube channel, podcast, production team, business, or other group with multiple people
          creating content, this makes it possible to build around one branded storefront instead of
          sending audiences in different directions.
        </p>

        <h2>One Platform for Content and Commerce</h2>
        <p className="release-tagline">
          <strong>Your brand. Your content. Your earnings.</strong>
        </p>
      </article>
      <div className="release-cta-row">
        <Link to="/how-it-works" className="release-cta-primary">
          How it Works
        </Link>
        <Link to="/" className="release-back">Back to Home</Link>
      </div>
    </div>
  );
};

export default Release;
