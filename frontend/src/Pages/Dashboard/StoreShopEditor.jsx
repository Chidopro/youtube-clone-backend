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
  orderedShopProducts,
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
  ownCatalog = false,
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
  const [editOpen, setEditOpen] = useState(false);
  const [draggingId, setDraggingId] = useState('');
  const fileRefs = useRef({});
  const dragFrom = useRef(-1);

  const catalogTiles = useMemo(
    () => applyShopCatalogOverrides(DELUZION_SHOP_PRODUCTS, overrides),
    [overrides]
  );
  const products = useMemo(
    () => orderedShopProducts(catalogTiles, { collaborator: ownCatalog }),
    [catalogTiles, ownCatalog]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (ownCatalog) {
          const auth = await getAuthHeaders();
          if (auth?.error || cancelled) return;
          const data = await fetchShopCatalog({ headers: auth.headers });
          if (!cancelled) setOverrides(data.products || {});
          return;
        }
        const data = await fetchShopCatalog({ subdomain: 'deluzion' });
        if (!cancelled) setOverrides(data.products || {});
      } catch (_) {}
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, ownCatalog]);

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

  const selectedUploadTile = catalogTiles.find((tile) => tile.id === uploadSku) || null;
  const savedUploadPreview = String(overrides[uploadSku]?.preview || '').trim();
  const modalPreview = uploadPreview
    || (savedUploadPreview && !savedUploadPreview.startsWith('/shop/') ? shopCategoryThumbUrl(savedUploadPreview) : '')
    || (!ownCatalog && selectedUploadTile?.preview ? shopCategoryThumbUrl(selectedUploadTile.preview) : '');
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
    setEditOpen(false);
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
    setEditOpen(false);
    setUploadSku('');
    setUploadFile(null);
    setUploadPreview('');
    setUploadColor('');
    setUploadSize('');
    setUploadBusy(false);
    setUploadError('');
    return undefined;
  }, [uploadOpen]);

  useEffect(() => {
    if (!uploadOpen && !editOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !uploadBusy) resetUploadModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploadOpen, editOpen, uploadBusy]);

  const handleUploadSkuChange = (sku) => {
    setUploadSku(sku);
    const tile = catalogTiles.find((item) => item.id === sku);
    setUploadColor(tile?.color || '');
    setUploadSize(tile?.size || '');
    setUploadError('');
  };

  const openEdit = (tile) => {
    setEditOpen(true);
    setUploadSku(tile.id);
    setUploadFile(null);
    setUploadPreview('');
    setUploadColor(tile.color || '');
    setUploadSize(tile.size || '');
    setUploadBusy(false);
    setUploadError('');
  };

  const handleDelete = async (tile) => {
    if (disabled || !tile?.id) return;
    const ok = window.confirm(`Delete ${tile.name} from your shop?`);
    if (!ok) return;
    setBusySku(tile.id);
    setStatus(tile.id, 'Deleting…');
    try {
      await savePatch(tile.id, ownCatalog ? { remove: true } : { hidden: true });
      setStatus(tile.id, '');
    } catch (err) {
      setStatus(tile.id, err.message || 'Could not delete');
    } finally {
      setBusySku('');
    }
  };

  const commitOrder = async (fromIndex, toIndex) => {
    if (disabled || fromIndex < 0 || fromIndex === toIndex) return;
    const next = [...products];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    const patch = {};
    const optimistic = { ...overrides };
    next.forEach((tile, index) => {
      patch[tile.id] = { order: index };
      optimistic[tile.id] = { ...(optimistic[tile.id] || {}), order: index };
    });
    setOverrides(optimistic);
    try {
      const auth = await withAuth();
      const saved = await patchShopCatalog({
        headers: auth.headers,
        userId: auth.userId,
        email: auth.accountEmail,
        sessionToken: auth.sessionToken,
        products: patch,
      });
      setOverrides(saved);
    } catch (err) {
      setStatus(moved.id, err.message || 'Could not reorder');
    }
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
    if (!uploadFile && !editOpen) {
      setUploadError('Choose an image.');
      return;
    }
    setUploadBusy(true);
    setUploadError('');
    try {
      const auth = await withAuth();
      let next = overrides;
      if (uploadFile) {
        const data = await uploadShopCatalogImage({
          headers: auth.headers,
          userId: auth.userId,
          email: auth.accountEmail,
          sessionToken: auth.sessionToken,
          sku: uploadSku,
          file: uploadFile,
        });
        next = data.products || {};
      }
      const patch = { hidden: false };
      if (!products.some((item) => item.id === uploadSku)) patch.order = products.length;
      if (uploadColor) patch.color = uploadColor;
      if (uploadSize) patch.size = uploadSize;
      next = await patchShopCatalog({
        headers: auth.headers,
        userId: auth.userId,
        email: auth.accountEmail,
        sessionToken: auth.sessionToken,
        products: { [uploadSku]: patch },
      });
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
        <h3>{ownCatalog ? 'Shop images' : 'Store images'}</h3>
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
        {ownCatalog
          ? 'Upload your own merchandise. Drag a product to change the order shoppers see, or use edit and delete on each one. Shoppers can buy these from your page.'
          : 'These photos appear on Shop. Drag a product to change the order, or edit and delete each one. Replace a photo, set the default color and size shoppers see first, or assign an image from this page.'}
      </p>
      {ownCatalog && !products.length ? (
        <p className="store-shop-empty">No shop products yet. Use Shop Upload to add your own merchandise.</p>
      ) : null}
      <div className="store-shop-grid">
        {products.map((tile, index) => {
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
          const savedPreview = String(overrides[tile.id]?.preview || '').trim();
          const thumbSrc = ownCatalog
            ? shopCategoryThumbUrl(savedPreview)
            : shopCategoryThumbUrl(tile.preview);
          return (
            <article
              key={tile.id}
              className={`store-shop-card${draggingId === tile.id ? ' store-shop-card--dragging' : ''}`}
              onDragOver={(event) => {
                if (disabled || busy) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragFrom.current;
                dragFrom.current = -1;
                setDraggingId('');
                commitOrder(from, index);
              }}
            >
              <span className="store-shop-thumb">
                {thumbSrc ? <img src={thumbSrc} alt="" /> : <span className="store-shop-thumb-empty">No photo</span>}
                <button
                  type="button"
                  className="store-shop-drag"
                  draggable={!disabled && !busy}
                  title="Drag to reorder"
                  onDragStart={(event) => {
                    dragFrom.current = index;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', tile.id);
                    setDraggingId(tile.id);
                  }}
                  onDragEnd={() => {
                    dragFrom.current = -1;
                    setDraggingId('');
                  }}
                >
                  Drag
                </button>
                <button
                  type="button"
                  className="edit-video-btn"
                  title={`Edit ${tile.name}`}
                  disabled={disabled || busy}
                  onClick={() => openEdit(tile)}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="delete-video-btn"
                  title={`Delete ${tile.name}`}
                  disabled={disabled || busy}
                  onClick={() => handleDelete(tile)}
                >
                  🗑️
                </button>
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
      {(uploadOpen || editOpen) && createPortal(
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
            <h2>{editOpen ? `Edit ${selectedUploadTile?.name || 'product'}` : 'Upload Shop Product'}</h2>
            <div className="upload-form">
              <p className="edit-video-tip">
                {editOpen
                  ? 'Change the photo, color, or size shoppers see for this product.'
                  : 'Choose a shop product, then upload the photo shoppers will see. You can also set the default color and size.'}
              </p>
              <div className="form-group">
                <label htmlFor="shop-upload-product">Product *</label>
                <select
                  id="shop-upload-product"
                  value={uploadSku}
                  disabled={uploadBusy || editOpen}
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
                {modalPreview ? (
                  <img
                    src={modalPreview}
                    alt=""
                    className="favorite-upload-preview shop-upload-preview"
                  />
                ) : null}
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
                  disabled={uploadBusy || !uploadSku || (!editOpen && !uploadFile)}
                  onClick={handleModalUpload}
                >
                  {uploadBusy ? 'Saving...' : (editOpen ? 'Save' : 'Upload Shop Product')}
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
