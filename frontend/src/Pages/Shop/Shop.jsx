import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import {
  SHOP_CATEGORIES,
  browseShopCategoryPath,
  shopCategoryThumbUrl,
} from '../../utils/shopCategories';
import './Shop.css';

function ShopTileThumb({ preview, emoji }) {
  const [failed, setFailed] = useState(false);
  const src = shopCategoryThumbUrl(preview);

  if (!src || failed) {
    return (
      <span className="shop-tile-emoji" aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return (
    <img
      className="shop-tile-img"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

const Shop = ({ sidebar }) => {
  const navigate = useNavigate();

  return (
    <div className={`container shop-root ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="shop-page shop-page--in-container">
        <div className="shop-toolbar">
          <button
            type="button"
            className="shop-back-btn"
            onClick={() => navigate('/')}
            aria-label="Back"
          >
            ←
          </button>
          <div className="shop-toolbar-text">
            <h1 className="shop-page-title">My Shop</h1>
          </div>
        </div>

        <div className="shop-body">
          <div className="shop-category-grid">
            {SHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.category}
                type="button"
                className="shop-tile"
                aria-label={`Open ${cat.name}`}
                onClick={() => navigate(browseShopCategoryPath(cat.category))}
              >
                <span className="shop-tile-thumb">
                  <ShopTileThumb preview={cat.preview} emoji={cat.emoji} />
                </span>
                <span className="shop-tile-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;
