import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import { ChevronLeft } from '../../Components/Chevrons/Chevrons';
import {
  SHOP_CATEGORIES,
  browseShopCategoryPath,
  shopCategoryThumbUrl,
} from '../../utils/shopCategories';
import './Shop.css';

function ShopTileThumb({ preview, emoji, thumbFit }) {
  const [failed, setFailed] = useState(false);
  const src = shopCategoryThumbUrl(preview);
  const isModel = thumbFit === 'model';

  if (!src || failed) {
    return (
      <span className="shop-tile-emoji" aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return (
    <img
      className={`shop-tile-img${isModel ? ' shop-tile-img--model' : ''}`}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
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
            <ChevronLeft />
          </button>
          <div className="shop-toolbar-text">
            <h1 className="shop-page-title">Shop by Category</h1>
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
                <span className={`shop-tile-thumb${cat.thumbFit === 'model' ? ' shop-tile-thumb--model' : ''}`}>
                  <ShopTileThumb preview={cat.preview} emoji={cat.emoji} thumbFit={cat.thumbFit} />
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
