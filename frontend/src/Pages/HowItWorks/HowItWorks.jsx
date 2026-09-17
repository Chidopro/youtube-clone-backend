import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './HowItWorks.css';

const HowItWorks = () => {
  const navigate = useNavigate();

  return (
    <div className="how-it-works-page">
      <div className="how-it-works-inner">
        <section className="how-it-works-section how-it-works-narrative">
          <h1 className="how-it-works-title">How ScreenMerch Works</h1>

          <p>
            ScreenMerch gives creators the tools to turn moments from their clips and photos into
            merchandise — without purchasing inventory or managing production and shipping.
          </p>

          <p>From setting up a storefront to delivering a finished product to a fan, here&apos;s how it works.</p>

          <h2>1. Create Your ScreenMerch Storefront</h2>
          <p>
            Once approved, a creator receives a customizable ScreenMerch storefront with a personalized
            subdomain such as:
          </p>
          <p className="how-it-works-subdomain">yourname.screenmerch.com</p>
          <p>
            Creators can personalize their storefront with their own logo, page colors, favicon, images,
            and other branding elements.
          </p>
          <p>
            The result is a merchandise destination that feels connected to the creator&apos;s brand rather
            than a generic marketplace.
          </p>

          <h2>2. Add Clips and Photos</h2>
          <p>
            Creators build their storefront&apos;s content by adding clips and photos that contain moments
            their audience may want to turn into merchandise.
          </p>
          <p>
            Photos can be uploaded directly, while clips can be used to give fans access to memorable
            frames and images from the creator&apos;s content.
          </p>
          <p>Creators manage their content from their ScreenMerch dashboard.</p>

          <h2>3. Capture Clip Moments with FrameSnag</h2>
          <p>
            ScreenMerch creators also have access to <strong>FrameSnag</strong>, a free Google Chrome
            extension developed specifically for the ScreenMerch platform.
          </p>
          <p>
            FrameSnag makes it easy to capture images from YouTube content without the usual
            download-and-upload process.
          </p>
          <p>
            Creators can browse their YouTube videos, capture frames and thumbnail images, and save them
            directly to ScreenMerch for use on their storefront.
          </p>
          <p>This gives creators a fast way to build a collection from content they have already created.</p>

          <h2>4. Fans Choose the Content They Love</h2>
          <p>
            Fans visit the creator&apos;s branded storefront and browse the available clips, photos, and
            images.
          </p>
          <p>When they find a moment they like, they can select it and choose from available merchandise.</p>
          <p>
            Instead of the creator deciding that one image belongs on one predetermined product,
            ScreenMerch gives the fan the ability to choose the content and product combination they want.
          </p>

          <h2>5. Fans Create Their Merchandise</h2>
          <p>
            After choosing an image and product, fans can preview their selection and use ScreenMerch&apos;s
            available design tools to customize how the image appears on the merchandise.
          </p>
          <p>
            When they&apos;re satisfied with the result, they add the product to their cart and proceed through
            checkout.
          </p>
          <p>
            This turns the fan from someone simply viewing the creator&apos;s content into someone actively
            participating in creating a piece of merchandise from it.
          </p>

          <h2>6. ScreenMerch Handles the Order</h2>
          <p>
            Creators don&apos;t need to purchase inventory, print products, package orders, or arrange
            shipping.
          </p>
          <p>
            After checkout, ScreenMerch coordinates the order with its fulfillment partners for
            professional printing, production, and delivery.
          </p>
          <p>
            Secure payment processing and order fulfillment happen behind the scenes while the creator
            continues focusing on content and their audience.
          </p>

          <h2>7. Creators Track Their Store</h2>
          <p>
            The creator dashboard provides a central place to manage the storefront and monitor its
            activity.
          </p>
          <p>
            Creators can manage content, review analytics, track qualifying sales and earnings, manage
            payout information, and update storefront personalization.
          </p>
          <p>This keeps the creative side of the store and the business side of the store together in one place.</p>

          <h2>8. Grow with Umbrella Creators</h2>
          <p>A ScreenMerch storefront doesn&apos;t have to represent only one creator.</p>
          <p>
            Storefront owners can invite trusted collaborators, co-hosts, staff members, or other creators
            to join through the <strong>Umbrella Creator</strong> system.
          </p>
          <p>
            Umbrella Creators can have their own branded presence within the owner&apos;s storefront and
            manage their own content. Sales and activity can be attributed to the appropriate creator,
            with separate analytics and earnings tracking.
          </p>
          <p>
            The audience can move throughout the creator network while remaining inside one unified
            ScreenMerch storefront.
          </p>

          <h2>From Content to Commerce</h2>
          <p>A favorite moment becomes merch. We handle production, shipping, and creator payouts.</p>
          <p>
            For creators, there&apos;s no inventory to purchase and no shipping operation to manage.
          </p>
          <p>For fans, it&apos;s a way to turn a favorite moment into something tangible.</p>
          <p>
            For creator teams, it&apos;s a storefront that can grow along with the people behind the content.
          </p>
        </section>

        <p className="how-it-works-tagline">
          <strong>Your brand. Your content. Your earnings.</strong>
        </p>

        <div className="how-it-works-cta-row">
          <button
            type="button"
            className="how-it-works-cta-primary"
            onClick={() => navigate('/subscription-tiers', { state: { intent: 'creator' } })}
          >
            Unlock your free storefront
          </button>
          <Link to="/faq" className="how-it-works-cta-secondary">
            Read the FAQ
          </Link>
        </div>

        <Link to="/" className="how-it-works-back">
          ← Back to home
        </Link>
      </div>
    </div>
  );
};

export default HowItWorks;
