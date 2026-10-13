import React from 'react';
import { Link } from 'react-router-dom';
import './Release.css';

const Release = () => {
  return (
    <div className="release-page">
      <article className="release-article">
        <h1 className="release-title">Welcome to ScreenMerch</h1>

        <p>
          ScreenMerch isn&apos;t designed to replace what you&apos;re already doing. It works alongside
          your existing website, merch store, YouTube channel, or other platforms by adding something
          different: an interactive merchandise experience built around your content and your
          audience&apos;s choices.
        </p>

        <h2>Your Content. User Creativity. More Ways to Earn.</h2>
        <p>
          ScreenMerch gives your audience a new way to interact with the content they already enjoy.
        </p>
        <p>
          Instead of offering only pre-designed merchandise, you provide the clips and images, and your
          fans choose the moments that mean something to them. They can capture a favorite moment from a
          clip or select an image, choose the product they want, and use ScreenMerch&apos;s design tools to
          preview, position, crop, and personalize their creation before purchasing.
        </p>
        <p>
          You provide the content. Your fans choose the moment. They create the merch.
        </p>
        <p>
          Already have merchandise? Keep it. ScreenMerch also lets you offer your own pre-made products
          alongside the interactive experience.
        </p>
        <p>
          Two fans can discover the same piece of content and create something completely different from
          it.
        </p>
        <p>
          That&apos;s what makes ScreenMerch different from a traditional merch store.
        </p>

        <h2>A Storefront Built Around Your Brand</h2>
        <p>
          Approved creators receive their own customizable ScreenMerch storefront with a personalized
          subdomain such as:
        </p>
        <p><strong>yourname.screenmerch.com</strong></p>
        <p>
          Make it your own with your logo, page colors, favicon, images, clips, and other branding
          elements.
        </p>
        <p>
          Instead of sending your audience to a generic marketplace, your fans remain in a storefront
          built around your content and your identity.
        </p>
        <p>
          Behind the storefront, your creator dashboard gives you the tools to manage your content, view
          analytics, track sales and earnings, manage payouts, and personalize your storefront.
        </p>
        <p>
          And because ScreenMerch handles the commerce and coordinates production and fulfillment,
          there&apos;s no inventory to purchase, no products to pack, and no monthly membership fee.
        </p>
        <p>
          You concentrate on creating. ScreenMerch handles what happens after the order.
        </p>

        <h2>Bring Your People With You</h2>
        <p>
          ScreenMerch doesn&apos;t have to stop with one creator.
        </p>
        <p>
          Through <strong>Umbrella Creators</strong>, storefront owners can invite trusted collaborators,
          co-creators, co-hosts, staff members, performers, or other creators to become part of their
          storefront.
        </p>
        <p>Each collaborator can have:</p>
        <ul>
          <li>Their own page within your storefront</li>
          <li>Their own clips and images</li>
          <li>Their own merchandise shop</li>
          <li>Their own pre-made products</li>
          <li>Their own sales and earnings activity</li>
        </ul>
        <p>
          This gives the people around your brand an opportunity to contribute their own content, build
          their own presence, and earn from the sales they generate — while remaining part of your
          overall storefront.
        </p>
        <p>
          For a YouTube channel, podcast, entertainment venue, production team, business, or creator
          group, ScreenMerch can grow from one creator into an entire creator community.
        </p>

        <h2>One Storefront. Multiple Creators. Endless Moments.</h2>
        <p>ScreenMerch was built around a simple idea:</p>
        <p>
          Creators should have more ways to earn from the content they&apos;re already creating, and fans
          should have more ways to participate in the content they enjoy.
        </p>
        <p>Your existing website can still be your website.</p>
        <p>Your existing merch store can still sell your merchandise.</p>
        <p>Your social channels can still be where your audience follows you.</p>
        <p>ScreenMerch adds something new to all of it.</p>
        <p>
          A place where your content becomes interactive, your audience becomes part of the creative
          process, and the people around your brand can have opportunities of their own.
        </p>
        <p className="release-tagline">
          <strong>Your Brand. Your Content. Your Earnings.</strong>
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
