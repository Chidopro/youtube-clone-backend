import React from 'react';
import { Link } from 'react-router-dom';
import './Release.css';

const Release = () => {
  return (
    <div className="release-page">
      <article className="release-article">
        <h1 className="release-title">Welcome to ScreenMerch</h1>
        <p className="release-lede">Your Content. Your Storefront. Your Earnings.</p>

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
          With ScreenMerch, approved creators receive their own branded storefront where fans can
          discover images from their content, choose the moments they love, place them on merchandise,
          and purchase — all within the creator&apos;s ScreenMerch store.
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
          Creators can add photos and capture memorable images from their clips. Fans can then
          browse those images, choose their favorites, and personalize merchandise with the content that
          means something to them.
        </p>
        <p>There&apos;s no inventory for creators to purchase and no boxes to pack.</p>
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
          Each collaborator can contribute their own content while sales, analytics, and earnings remain
          attributable to the appropriate creator.
        </p>
        <p>
          For a YouTube channel, podcast, production team, business, or other group with multiple people
          creating content, this makes it possible to build around one branded storefront instead of
          sending audiences in different directions.
        </p>

        <h2>One Platform for Content and Commerce</h2>
        <p>ScreenMerch brings together the pieces creators would otherwise have to manage separately:</p>
        <p className="release-pipeline">
          Clips and photos → memorable images → merchandise → storefront → checkout → fulfillment →
          creator earnings
        </p>
        <p>
          It&apos;s a simpler connection between the content creators make and the moments their audiences
          want to remember.
        </p>
        <p>
          <strong>
            No inventory.
            <br />
            No fulfillment headaches.
            <br />
            No shipping logistics for creators.
          </strong>
        </p>
        <p>Just a new way to turn content into commerce.</p>

        <p className="release-tagline">
          <strong>Your brand. Your content. Your earnings.</strong>
        </p>
      </article>
      <Link to="/" className="release-back">Back to Home</Link>
    </div>
  );
};

export default Release;
