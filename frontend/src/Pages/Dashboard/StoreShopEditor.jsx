import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBackendUrl } from '../../config/apiConfig';
import {
  catalogStockPending,
  getAvailableColorsForCountry,
  getAvailableSizesForCountry,
  getColorsForCountry,
  productShipsToCountry,
} from '../../utils/regionalAvailability';
import {
  DELUZION_SHOP_PRODUCTS,
  applyShopCatalogOverrides,
  shopCategoryThumbUrl,
  shopperSizeLabel,
} from '../../utils/shopCategories';
import { fetchShopCatalog, patchShopCatalog, uploadShopCatalogImage } from '../../utils/shopCatalogApi';

const EDITOR_COUNTRY = 'US';

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
  const apiBase = getBackendUrl().replace(/\/$/, '');
  const url = `${apiBase}/api/product/browse?category=${encodeURIComponent(category)}&authenticated=false&email=`;
  const delays = [0, 800, 1600];
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
    if (products.length && !products.some((p) => catalogStockPending(p))) return products;
  }
  return lastProducts;
}

function favoriteImageUrl(favorite) {
  return String(favorite?.image_url || favorite?.thumbnail_url || '').trim();
}

const StoreShopEditor = ({
  getAuthHeaders,
  pageImages,
  disabled,
  reloadToken,
  onCatalogChange,
  uploadOpen,
  onUploadOpen,
  onUploadClose,
}) => {
  const [overrides, setOverrides] = useState({});
  const [catalogByCategory, setCatalogByCategory] = useState({});
  const [statusBySku, setStatusBySku] = useState({});
  const [busySku, setBusySku] = useState('');
  const [uploadSku, setUploadSku] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadColor, setUploadColor] = useState('');
  const [uploadSize, setUploadSize] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRefs = useRef({});

  const products = useMemo(
    () => applyShopCatalogOverrides(DELUZION_SHOP_PRODUCTS, overrides),
    [overrides]
  );

  useEffect(() => {
    let cancelled = false;
    fetchShopCatalog({ subdomain: 'deluzion' })
      .then((data) => {
        if (!cancelled) setOverrides(data.products || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    onCatalogChange?.(overrides);
  }, [overrides, onCatalogChange]);

  useEffect(() => {
    let cancelled = false;
    const categories = [...new Set(DELUZION_SHOP_PRODUCTS.map((p) => p.category))];
    Promise.all(categories.map(async (category) => {
      try {
        const list = await fetchCategoryCatalog(category);
        return [category, list];
      } catch {
        return [category, []];
      }
    })).then((entries) => {
      if (!cancelled) setCatalogByCategory(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setStatus = (sku, message) => {
    setStatusBySku((prev) => ({ ...prev, [sku]: message }));
  };

  const withAuth = async () => {
    const auth = await getAuthHeaders();
    if (auth?.error) throw new Error(auth.error);
    return auth;
  };

  const savePatch = async (sku, patch) => {
    const auth = await withAuth();
    const next = await patchShopCatalog({
      headers: auth.headers,
      userId: auth.userId,
      email: auth.accountEmail,
      sessionToken: auth.sessionToken,
      products: { [sku]: patch },
    });
    setOverrides(next);
    return next;
  };

  const handleAssignImage = async (sku, preview) => {
    if (disabled || !sku) return;
    setBusySku(sku);
    setStatus(sku, 'Saving…');
    try {
      await savePatch(sku, { preview });
      setStatus(sku, 'Saved');
    } catch (err) {
      setStatus(sku, err.message || 'Could not save');
    } finally {
      setBusySku('');
    }
  };

  const handleReplacePhoto = async (sku, file) => {
    if (disabled || !file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus(sku, 'Image must be under 5MB');
      return;
    }
    setBusySku(sku);
    setStatus(sku, 'Uploading…');
    try {
      const auth = await withAuth();
      const data = await uploadShopCatalogImage({
        headers: auth.headers,
        userId: auth.userId,
        email: auth.accountEmail,
        sessionToken: auth.sessionToken,
        sku,
        file,
      });
      setOverrides(data.products || {});
      setStatus(sku, 'Saved');
    } catch (err) {
      setStatus(sku, err.message || 'Upload failed');
    } finally {
      setBusySku('');
    }
  };

  const handleDefaultChange = async (sku, field, value) => {
    if (disabled) return;
    setBusySku(sku);
    setStatus(sku, 'Saving…');
    try {
      await savePatch(sku, { [field]: value });
      setStatus(sku, 'Saved');
    } catch (err) {
      setStatus(sku, err.message || 'Could not save');
    } finally {
      setBusySku('');
    }
  };

  const selectedUploadTile = products.find((tile) => tile.id === uploadSku) || null;
  const uploadProduct = selectedUploadTile
    ? matchCatalogProduct(catalogByCategory[selectedUploadTile.category] || [], selectedUploadTile.catalogName)
    : null;
  const uploadStockPending = !uploadProduct || catalogStockPending(uploadProduct);
  const uploadColors = uploadProduct ? shopColorList(uploadProduct, uploadSize, EDITOR_COUNTRY) : [];
  const uploadSizes = uploadProduct ? sizesForShopProduct(uploadProduct, uploadColor, EDITOR_COUNTRY) : [];
  const uploadColorOptions = (uploadColor && !uploadColors.includes(uploadColor))
    ? [uploadColor, ...uploadColors]
    : uploadColors;
  const uploadSizeOptions = (uploadSize && !uploadSizes.includes(uploadSize))
    ? [uploadSize, ...uploadSizes]
    : uploadSizes;

  const resetUploadModal = () => {
    setUploadSku('');
    setUploadFile(null);
    setUploadPreview('');
    setUploadColor('');
    setUploadSize('');
    setUploadBusy(false);
    setUploadError('');
    onUploadClose?.();
  };

  useEffect(() => {
    if (!uploadOpen) return undefined;
    setUploadSku('');
    setUploadFile(null);
    setUploadPreview('');
    setUploadColor('');
    setUploadSize('');
    setUploadBusy(false);
    setUploadError('');
    const onKey = (event) => {
      if (event.key === 'Escape' && !uploadBusy) resetUploadModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploadOpen]);

  const handleUploadSkuChange = (sku) => {
    setUploadSku(sku);
    const tile = products.find((item) => item.id === sku);
    setUploadColor(tile?.color || '');
    setUploadSize(tile?.size || '');
    setUploadError('');
  };

  const handleUploadFileChange = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB');
      return;
    }
    setUploadFile(file);
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (event) => setUploadPreview(event.target?.result || '');
    reader.readAsDataURL(file);
  };

  const handleModalUpload = async () => {
    if (disabled || uploadBusy) return;
    if (!uploadSku) {
      setUploadError('Choose a shop product.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Choose an image.');
      return;
    }
    setUploadBusy(true);
    setUploadError('');
    try {
      const auth = await withAuth();
      const data = await uploadShopCatalogImage({
        headers: auth.headers,
        userId: auth.userId,
        email: auth.accountEmail,
        sessionToken: auth.sessionToken,
        sku: uploadSku,
        file: uploadFile,
      });
      let next = data.products || {};
      const patch = {};
      if (uploadColor) patch.color = uploadColor;
      if (uploadSize) patch.size = uploadSize;
      if (Object.keys(patch).length) {
        next = await patchShopCatalog({
          headers: auth.headers,
          userId: auth.userId,
          email: auth.accountEmail,
          sessionToken: auth.sessionToken,
          products: { [uploadSku]: patch },
        });
      }
      setOverrides(next);
      setStatus(uploadSku, 'Saved');
      resetUploadModal();
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
      setUploadBusy(false);
    }
  };

  return (
    <section className="page-media-section store-shop-section" aria-label="Store images">
      <div className="store-shop-heading">
        <h3>Store images</h3>
        <button
          type="button"
          className="add-favorite-btn favorites-upload-btn"
          disabled={disabled}
          onClick={() => onUploadOpen?.()}
        >
          Shop Upload
        </button>
      </div>
      <p className="store-shop-help">
        These photos appear on Shop. Replace a photo, set the default color and size shoppers see first,
        or assign an image from this page.
      </p>
      <div className="store-shop-grid">
        {products.map((tile) => {
          const product = matchCatalogProduct(catalogByCategory[tile.category] || [], tile.catalogName);
          const stockPending = !product || catalogStockPending(product);
          const colors = product ? shopColorList(product, tile.size, EDITOR_COUNTRY) : [];
          const sizes = product ? sizesForShopProduct(product, tile.color, EDITOR_COUNTRY) : [];
          const colorOptions = (tile.color && !colors.includes(tile.color)) ? [tile.color, ...colors] : colors;
          const sizeOptions = (tile.size && !sizes.includes(tile.size)) ? [tile.size, ...sizes] : sizes;
          const colorValue = colorOptions.includes(tile.color) ? tile.color : (tile.color || '');
          const sizeValue = sizeOptions.includes(tile.size) ? tile.size : (tile.size || '');
          const assignedUrl = String(tile.preview || '');
          const busy = busySku === tile.id;
          const pageOptions = (pageImages || []).filter((fav) => favoriteImageUrl(fav));
          return (
            <article key={tile.id} className="store-shop-card">
              <span className="store-shop-thumb">
                <img src={shopCategoryThumbUrl(tile.preview)} alt="" />
              </span>
              <h4>{tile.name}</h4>
              <div className="store-shop-fields">
                <button
                  type="button"
                  className="store-shop-btn"
                  disabled={disabled || busy}
                  onClick={() => fileRefs.current[tile.id]?.click()}
                >
                  Replace photo
                </button>
                <input
                  ref={(el) => {
                    fileRefs.current[tile.id] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  disabled={disabled}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleReplacePhoto(tile.id, file);
                  }}
                />
                <label className="store-shop-field">
                  <span>Use page image</span>
                  <select
                    value={pageOptions.some((fav) => favoriteImageUrl(fav) === assignedUrl) ? assignedUrl : ''}
                    disabled={disabled || busy || !pageOptions.length}
                    onChange={(e) => {
                      const preview = e.target.value;
                      if (preview) handleAssignImage(tile.id, preview);
                    }}
                  >
                    <option value="">{pageOptions.length ? 'Choose an image' : 'No images on this page'}</option>
                    {pageOptions.map((fav) => (
                      <option key={fav.id} value={favoriteImageUrl(fav)}>
                        {fav.title || 'Untitled'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="store-shop-field">
                  <span>Default color</span>
                  <select
                    value={colorValue}
                    disabled={disabled || busy || stockPending || !colorOptions.length}
                    onChange={(e) => handleDefaultChange(tile.id, 'color', e.target.value)}
                  >
                    {!colorOptions.length ? (
                      <option value="">{stockPending ? 'Loading…' : 'Not available'}</option>
                    ) : (
                      colorOptions.map((color) => (
                        <option key={color} value={color}>{color}</option>
                      ))
                    )}
                  </select>
                </label>
                <label className="store-shop-field">
                  <span>Default size</span>
                  <select
                    value={sizeValue}
                    disabled={disabled || busy || stockPending || !sizeOptions.length}
                    onChange={(e) => handleDefaultChange(tile.id, 'size', e.target.value)}
                  >
                    {!sizeOptions.length ? (
                      <option value="">{stockPending ? 'Loading…' : 'One size'}</option>
                    ) : (
                      sizeOptions.map((size) => (
                        <option key={size} value={size}>{shopperSizeLabel(size)}</option>
                      ))
                    )}
                  </select>
                </label>
              </div>
              {statusBySku[tile.id] ? (
                <p className="store-shop-status">{statusBySku[tile.id]}</p>
              ) : null}
            </article>
          );
        })}
      </div>
      {uploadOpen && createPortal(
        <div
          className="favorite-modal-overlay"
          onClick={() => {
            if (!uploadBusy) resetUploadModal();
          }}
        >
          <div className="favorite-modal-content" onClick={(e) => e.stopPropagation()}>
            <span
              className="favorite-modal-close"
              onClick={() => {
                if (!uploadBusy) resetUploadModal();
              }}
            >
              &times;
            </span>
            <h2>Upload Shop Product</h2>
            <div className="upload-form">
              <p className="edit-video-tip">
                Choose a premade Shop product, then upload the photo shoppers will see. You can also set the default color and size.
              </p>
              <div className="form-group">
                <label htmlFor="shop-upload-product">Product *</label>
                <select
                  id="shop-upload-product"
                  value={uploadSku}
                  disabled={uploadBusy}
                  onChange={(e) => handleUploadSkuChange(e.target.value)}
                >
                  <option value="">Choose product</option>
                  {DELUZION_SHOP_PRODUCTS.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="shop-upload-file">Image *</label>
                <input
                  id="shop-upload-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadBusy}
                  onChange={(e) => handleUploadFileChange(e.target.files?.[0])}
                />
                {(uploadPreview || selectedUploadTile?.preview) && (
                  <img
                    src={uploadPreview || shopCategoryThumbUrl(selectedUploadTile.preview)}
                    alt=""
                    className="favorite-upload-preview shop-upload-preview"
                  />
                )}
              </div>
              <div className="form-group">
                <label htmlFor="shop-upload-color">Default color</label>
                <select
                  id="shop-upload-color"
                  value={uploadColorOptions.includes(uploadColor) ? uploadColor : ''}
                  disabled={uploadBusy || !uploadSku || uploadStockPending || !uploadColorOptions.length}
                  onChange={(e) => setUploadColor(e.target.value)}
                >
                  {!uploadColorOptions.length ? (
                    <option value="">{uploadSku ? (uploadStockPending ? 'Loading…' : 'Not available') : 'Choose a product first'}</option>
                  ) : (
                    uploadColorOptions.map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="shop-upload-size">Default size</label>
                <select
                  id="shop-upload-size"
                  value={uploadSizeOptions.includes(uploadSize) ? uploadSize : ''}
                  disabled={uploadBusy || !uploadSku || uploadStockPending || !uploadSizeOptions.length}
                  onChange={(e) => setUploadSize(e.target.value)}
                >
                  {!uploadSizeOptions.length ? (
                    <option value="">{uploadSku ? (uploadStockPending ? 'Loading…' : 'One size') : 'Choose a product first'}</option>
                  ) : (
                    uploadSizeOptions.map((size) => (
                      <option key={size} value={size}>{shopperSizeLabel(size)}</option>
                    ))
                  )}
                </select>
              </div>
              {uploadError ? <p className="store-shop-status">{uploadError}</p> : null}
              <div className="form-actions">
                <button
                  type="button"
                  className="save-btn"
                  disabled={uploadBusy || !uploadSku || !uploadFile}
                  onClick={handleModalUpload}
                >
                  {uploadBusy ? 'Uploading...' : 'Upload Shop Product'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  disabled={uploadBusy}
                  onClick={resetUploadModal}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default StoreShopEditor;
