import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import StorefrontFlowBanner from '../../Components/StorefrontFlowBanner/StorefrontFlowBanner';
import { ChevronLeft } from '../../Components/Chevrons/Chevrons';
import { getBackendUrl, apiJoin } from '../../config/apiConfig';
import { getSubdomain } from '../../utils/subdomainService';
import { resolvePrintfulVariantId } from '../../utils/printfulVariants';
import { readCartItems, writeCartItems } from '../../utils/merchSession';
import { readShipToCountry, SHIP_TO_UPDATED_EVENT } from '../../utils/shipToCountry';
import {
  catalogStockPending,
  comboAvailableForCountry,
  getAvailableColorsForCountry,
  getAvailableSizesForCountry,
  getColorsForCountry,
  productShipsToCountry,
  shipToCountryName,
  unitPriceForCountry,
} from '../../utils/regionalAvailability';
import {
  DELUZION_SHOP_PRODUCTS,
  SHOP_CATEGORIES,
  applyShopCatalogOverrides,
  orderedShopProducts,
  browseShopCategoryPath,
  deluzionShopArtworkUrl,
  isPremadeShopfront,
  shopCategoryThumbUrl,
  shopperSizeLabel,
} from '../../utils/shopCategories';
import { fetchShopCatalog } from '../../utils/shopCatalogApi';
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

function matchCatalogProduct(products, catalogName) {
  const want = String(catalogName || '').trim().toLowerCase();
  if (!want) return null;
  return (products || []).find((p) => String(p?.name || '').trim().toLowerCase() === want) || null;
}

function shopColorList(product, size, country) {
  const handleColors = product?.options?.handle_color || [];
  const apiColors = product?.options?.color || [];
  if (handleColors.length && !apiColors.length) return handleColors;
  if (!product || catalogStockPending(product)) return [];
  if (size) {
    const forSize = getAvailableColorsForCountry(product, size, country);
    if (forSize.length) return forSize;
  }
  return getColorsForCountry(product, country);
}

function defaultShopColor(tile, colors) {
  const wanted = String(tile.color || '').trim();
  if (wanted && colors.includes(wanted)) return wanted;
  return colors[0] || wanted;
}

function defaultShopSize(sizes, tile) {
  const list = Array.isArray(sizes) ? sizes : [];
  const wanted = String(tile?.size || '').trim();
  if (wanted && list.includes(wanted)) return wanted;
  if (list.includes('M')) return 'M';
  if (list.includes('11 oz')) return '11 oz';
  return list[0] || '';
}

function sizesForShopProduct(product, color, country) {
  if (catalogStockPending(product)) return [];
  const fromStock = getAvailableSizesForCountry(product, color, country);
  if (fromStock.length) return fromStock;
  if (!(product?.options?.color || []).length) {
    const listed = product?.options?.size || [];
    if (listed.length && productShipsToCountry(product, country)) return listed;
  }
  return fromStock;
}

async function fetchCategoryCatalog(category) {
  const cacheKey = `sm_browse_v8_${String(category || '').trim().toLowerCase()}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.products?.length && !parsed.products.some((p) => catalogStockPending(p))) {
        return parsed.products;
      }
    }
  } catch {
    /* ignore */
  }

  const apiBase = getBackendUrl().replace(/\/$/, '');
  const url = `${apiBase}/api/product/browse?category=${encodeURIComponent(category)}&authenticated=false&email=`;
  const delays = [0, 800, 1600, 2800, 4500];
  let lastProducts = [];
  for (let i = 0; i < delays.length; i += 1) {
    if (delays[i]) await new Promise((resolve) => setTimeout(resolve, delays[i]));
    const response = await fetch(i > 0 ? `${url}&stockRetry=${i}` : url, {
      method: 'GET',
      cache: i > 0 ? 'no-store' : 'default',
    });
    if (!response.ok) continue;
    const data = await response.json();
    const products = Array.isArray(data?.products) ? data.products : [];
    lastProducts = products;
    if (products.length && !products.some((p) => catalogStockPending(p))) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        /* ignore */
      }
      return products;
    }
  }
  return lastProducts;
}

const ShopToolbar = ({ title, onBack }) => (
  <div className="shop-toolbar">
    <button
      type="button"
      className="shop-back-btn"
      onClick={onBack}
      aria-label="Back"
    >
      <ChevronLeft />
    </button>
    <div className="shop-toolbar-text">
      <h1 className="shop-page-title">{title}</h1>
    </div>
  </div>
);

function ShopTileSelect({ label, ariaLabel, value, options, disabled, pending, onChange, formatOption }) {
  const format = formatOption || ((option) => option);
  return (
    <label className="shop-tile-option">
      <span className="shop-tile-option-label">{label}</span>
      <select
        className="shop-tile-option-select"
        value={options.includes(value) ? value : ''}
        disabled={disabled || !options.length}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.length ? options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        )) : (
          <option value="">{pending ? 'Loading…' : 'Not available'}</option>
        )}
      </select>
    </label>
  );
}

const PremadeShop = ({
  sidebar,
  catalogUserId = '',
  favoriteListId = '',
  embedded = false,
  onAvailability,
}) => {
  const navigate = useNavigate();
  const addingLockRef = useRef(new Set());
  const [shipToCountry, setShipToCountry] = useState(readShipToCountry);
  const [shopProducts, setShopProducts] = useState(DELUZION_SHOP_PRODUCTS);
  const [catalogByCategory, setCatalogByCategory] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [selectedColors, setSelectedColors] = useState({});
  const [addingId, setAddingId] = useState(null);
  const [addedConfirm, setAddedConfirm] = useState(null);
  const [tileError, setTileError] = useState({});

  useEffect(() => {
    let cancelled = false;
    const sub = getSubdomain() || 'deluzion';
    const req = catalogUserId
      ? fetchShopCatalog({ subdomain: sub, collaboratorId: catalogUserId })
      : fetchShopCatalog({ subdomain: sub });
    req
      .then((data) => {
        if (cancelled) return;
        setShopProducts(applyShopCatalogOverrides(DELUZION_SHOP_PRODUCTS, data.products));
        setSelectedColors({});
        setSelectedSizes({});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [catalogUserId]);

  const tiles = orderedShopProducts(shopProducts, { collaborator: Boolean(catalogUserId) });

  useEffect(() => {
    if (!embedded || !onAvailability) return;
    onAvailability(tiles.length > 0);
  }, [embedded, onAvailability, tiles.length]);

  useEffect(() => {
    const sync = () => setShipToCountry(readShipToCountry());
    window.addEventListener(SHIP_TO_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SHIP_TO_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const categories = [...new Set(shopProducts.map((p) => p.category))];
    Promise.all(categories.map(async (category) => {
      try {
        const products = await fetchCategoryCatalog(category);
        return [category, products];
      } catch {
        return [category, []];
      }
    })).then((entries) => {
      if (cancelled) return;
      setCatalogByCategory(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const productForTile = useCallback((tile) => {
    return matchCatalogProduct(catalogByCategory[tile.category] || [], tile.catalogName);
  }, [catalogByCategory]);

  useEffect(() => {
    setSelectedColors((prevColors) => {
      const nextColors = { ...prevColors };
      let colorsChanged = false;
      setSelectedSizes((prevSizes) => {
        const nextSizes = { ...prevSizes };
        let sizesChanged = false;
        shopProducts.forEach((tile) => {
          const product = productForTile(tile);
          if (!product || catalogStockPending(product)) return;
          const colorHint = nextColors[tile.id] || tile.color;
          const sizes = sizesForShopProduct(product, colorHint, shipToCountry);
          let size = nextSizes[tile.id];
          if (sizes.length && (!size || !sizes.includes(size))) {
            size = defaultShopSize(sizes, tile);
            nextSizes[tile.id] = size;
            sizesChanged = true;
          }
          const colors = shopColorList(product, size || sizes[0], shipToCountry);
          if (colors.length && (!nextColors[tile.id] || !colors.includes(nextColors[tile.id]))) {
            nextColors[tile.id] = defaultShopColor(tile, colors);
            colorsChanged = true;
          }
        });
        return sizesChanged ? nextSizes : prevSizes;
      });
      return colorsChanged ? nextColors : prevColors;
    });
  }, [productForTile, shipToCountry, shopProducts]);

  useEffect(() => {
    if (!addedConfirm) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setAddedConfirm(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addedConfirm]);

  const addPremadeToCart = async (tile) => {
    if (addingLockRef.current.has(tile.id)) return;
    const product = productForTile(tile);
    if (!product || catalogStockPending(product)) return;
    const color = selectedColors[tile.id] || defaultShopColor(tile, shopColorList(product, selectedSizes[tile.id], shipToCountry));
    const sizes = sizesForShopProduct(product, color, shipToCountry);
    const size = selectedSizes[tile.id] || defaultShopSize(sizes, tile);
    if (product?.options?.size?.length && !size) {
      setTileError((prev) => ({
        ...prev,
        [tile.id]: `Choose a size for shipping to ${shipToCountryName(shipToCountry)}.`,
      }));
      return;
    }
    const hasColorOptions = (product?.options?.color || []).length > 0;
    if (hasColorOptions && comboAvailableForCountry(product, color, size, shipToCountry) === false) {
      setTileError((prev) => ({
        ...prev,
        [tile.id]: `${shopperSizeLabel(size)} is out of stock for shipping to ${shipToCountryName(shipToCountry)}.`,
      }));
      return;
    }
    if (hasColorOptions && !productShipsToCountry(product, shipToCountry)) {
      setTileError((prev) => ({
        ...prev,
        [tile.id]: `This item is not available to ship to ${shipToCountryName(shipToCountry)}.`,
      }));
      return;
    }

    addingLockRef.current.add(tile.id);
    setAddingId(tile.id);
    setTileError((prev) => {
      if (!prev[tile.id]) return prev;
      const next = { ...prev };
      delete next[tile.id];
      return next;
    });
    try {
      const printful_variant_id = resolvePrintfulVariantId(product, color, size);
      const listedCombo = hasColorOptions
        ? comboAvailableForCountry(product, color, size, shipToCountry)
        : (size && sizes.includes(size) ? true : null);
      try {
        const res = await fetch(apiJoin('/api/check-variant-availability'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: product?.name || '',
            color,
            size,
            variant_id: printful_variant_id,
            country_code: shipToCountry,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!data?.success || data?.available !== true) {
            setTileError((prev) => ({
              ...prev,
              [tile.id]: data?.error || `${shopperSizeLabel(size)} is out of stock for shipping to ${shipToCountryName(shipToCountry)}.`,
            }));
            return;
          }
        } else if (listedCombo !== true && listedCombo !== null) {
          setTileError((prev) => ({
            ...prev,
            [tile.id]: `${shopperSizeLabel(size)} could not be confirmed in stock. Choose a different size.`,
          }));
          return;
        }
      } catch {
        if (listedCombo !== true && listedCombo !== null) {
          setTileError((prev) => ({
            ...prev,
            [tile.id]: `${shopperSizeLabel(size)} could not be confirmed in stock. Choose a different size.`,
          }));
          return;
        }
      }

      const artwork = deluzionShopArtworkUrl(tile.preview);
      const item = {
        name: product?.name || tile.name,
        price: unitPriceForCountry(product, size, shipToCountry),
        image: artwork,
        color,
        size,
        screenshot: artwork,
        selected_screenshot: artwork,
        displayScreenshot: artwork,
        qty: 1,
        category: tile.category,
        printful_catalog_product_id: product?.printful_catalog_product_id ?? null,
        printful_variant_id: printful_variant_id != null ? printful_variant_id : undefined,
        regional_base_prices: product?.regional_base_prices || undefined,
        size_pricing: product?.size_pricing || undefined,
        premade: true,
        premadeId: catalogUserId ? `${catalogUserId}:${tile.id}` : tile.id,
        favorite_list_id: favoriteListId || undefined,
      };
      const next = [...(readCartItems() || [])];
      const existing = next.findIndex((it) => (
        it?.premadeId === tile.id
        && String(it.size || '') === String(size || '')
        && String(it.color || '') === String(color || '')
      ));
      if (existing >= 0) {
        const qty = (next[existing].qty || 1) + 1;
        next[existing] = { ...next[existing], ...item, qty };
      } else {
        next.push(item);
      }
      writeCartItems(next);
      setAddedConfirm({
        name: tile.name,
        color,
        size: shopperSizeLabel(size),
      });
    } finally {
      addingLockRef.current.delete(tile.id);
      setAddingId((current) => (current === tile.id ? null : current));
    }
  };

  if (embedded && !tiles.length) return null;

  const grid = (
          <div className="shop-category-grid shop-category-grid--premade">
            {tiles.map((tile) => {
              const product = productForTile(tile);
              const stockPending = !product || catalogStockPending(product);
              const sizeHint = selectedSizes[tile.id];
              const colors = product ? shopColorList(product, sizeHint, shipToCountry) : [];
              const color = selectedColors[tile.id] && colors.includes(selectedColors[tile.id])
                ? selectedColors[tile.id]
                : defaultShopColor(tile, colors);
              const sizes = product ? sizesForShopProduct(product, color, shipToCountry) : [];
              const size = selectedSizes[tile.id] && sizes.includes(selectedSizes[tile.id])
                ? selectedSizes[tile.id]
                : defaultShopSize(sizes, tile);
              const price = product && size
                ? unitPriceForCountry(product, size, shipToCountry)
                : (product ? Number(product.price) || 0 : 0);
              const isAdding = addingId === tile.id;
              const error = tileError[tile.id];
              const selectable = Boolean(product) && !stockPending && Boolean(size) && Boolean(color);
              const clearError = () => {
                setTileError((prev) => {
                  if (!prev[tile.id]) return prev;
                  const next = { ...prev };
                  delete next[tile.id];
                  return next;
                });
              };
              return (
                <div key={tile.id} className="shop-tile shop-tile--premade">
                  <span className="shop-tile-thumb">
                    <ShopTileThumb preview={tile.preview} emoji={tile.emoji} />
                  </span>
                  <span className="shop-tile-name">{tile.name}</span>
                  <span className="shop-tile-price">
                    {product && !stockPending && price > 0 ? `$${price.toFixed(2)}` : (stockPending ? '…' : '')}
                  </span>
                  <div className="shop-tile-options">
                    <ShopTileSelect
                      label="Color"
                      ariaLabel={`${tile.name} color`}
                      value={color}
                      options={colors}
                      disabled={stockPending}
                      pending={stockPending}
                      onChange={(nextColor) => {
                        setSelectedColors((prev) => ({ ...prev, [tile.id]: nextColor }));
                        const nextSizes = product ? sizesForShopProduct(product, nextColor, shipToCountry) : [];
                        setSelectedSizes((prev) => {
                          const current = prev[tile.id];
                          if (current && nextSizes.includes(current)) return prev;
                          return { ...prev, [tile.id]: defaultShopSize(nextSizes, tile) };
                        });
                        clearError();
                      }}
                    />
                    <ShopTileSelect
                      label="Size"
                      ariaLabel={`${tile.name} size`}
                      value={size}
                      options={sizes}
                      disabled={stockPending}
                      pending={stockPending}
                      formatOption={shopperSizeLabel}
                      onChange={(nextSize) => {
                        setSelectedSizes((prev) => ({ ...prev, [tile.id]: nextSize }));
                        const nextColors = product ? shopColorList(product, nextSize, shipToCountry) : [];
                        setSelectedColors((prev) => {
                          const current = prev[tile.id];
                          if (current && nextColors.includes(current)) return prev;
                          return { ...prev, [tile.id]: defaultShopColor(tile, nextColors) };
                        });
                        clearError();
                      }}
                    />
                  </div>
                  {error ? <div className="shop-tile-error">{error}</div> : null}
                  <button
                    type="button"
                    className={`shop-tile-cart-btn${isAdding ? ' is-busy' : ''}`}
                    disabled={isAdding || !selectable}
                    onClick={() => addPremadeToCart(tile)}
                  >
                    {isAdding ? 'Adding…' : 'Add to Cart'}
                  </button>
                </div>
              );
            })}
          </div>
  );

  const addedModal = addedConfirm && createPortal(
        <div
          className="shop-added-overlay"
          onClick={() => setAddedConfirm(null)}
          role="presentation"
        >
          <div
            className="shop-added-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-added-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="shop-added-close"
              onClick={() => setAddedConfirm(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="shop-added-icon" aria-hidden="true">✓</div>
            <h2 id="shop-added-title" className="shop-added-title">Added to Cart</h2>
            <p className="shop-added-item">
              {addedConfirm.name}
              {addedConfirm.color || addedConfirm.size ? (
                <span className="shop-added-meta">
                  {[addedConfirm.color, addedConfirm.size].filter(Boolean).join(' • ')}
                </span>
              ) : null}
            </p>
            <div className="shop-added-actions">
              <button
                type="button"
                className="shop-added-checkout"
                onClick={() => {
                  setAddedConfirm(null);
                  navigate('/checkout');
                }}
              >
                Checkout
              </button>
              <button
                type="button"
                className="shop-added-continue"
                onClick={() => setAddedConfirm(null)}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>,
        document.body
      );

  if (embedded) {
    return (
      <section className="collaborator-shop" aria-label="Shop">
        <h2 className="collaborator-shop-title">Shop</h2>
        {grid}
        {addedModal}
      </section>
    );
  }

  return (
    <div className={`container shop-root ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="shop-page shop-page--in-container">
        <ShopToolbar title="Shop" onBack={() => navigate('/')} />

        <div className="shop-body">
          {grid}
        </div>
      </div>
      {addedModal}
    </div>
  );
};

export function CollaboratorShop({ userId, listId, onAvailability }) {
  if (!userId) return null;
  return (
    <PremadeShop
      embedded
      catalogUserId={userId}
      favoriteListId={listId || ''}
      onAvailability={onAvailability}
    />
  );
}

const Shop = ({ sidebar }) => {
  const navigate = useNavigate();
  const premadeShop = isPremadeShopfront(getSubdomain());
  if (premadeShop) return <PremadeShop sidebar={sidebar} />;

  return (
    <div className={`container shop-root ${sidebar ? '' : ' large-container'}`}>
      <StorefrontFlowBanner />

      <div className="shop-page shop-page--in-container">
        <ShopToolbar title="Choose Category" onBack={() => navigate('/')} />

        <div className="shop-body">
          <div className="shop-category-grid">
            {SHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.preview || cat.name}
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
