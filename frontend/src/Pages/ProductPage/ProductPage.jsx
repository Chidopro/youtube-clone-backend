import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './ProductPage.css';

const ProductPage = ({ sidebar }) => {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const category = searchParams.get('category') || 'all';
  const authenticated = searchParams.get('authenticated') === 'true';
  const email = searchParams.get('email') || '';

  useEffect(() => {
    const fetchProductData = async () => {
      try {
        setLoading(true);
        // Fetch product data from backend API
        const response = await fetch(`https://screenmerch.fly.dev/api/product/${productId}?category=${category}&authenticated=${authenticated}&email=${email}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch product data: ${response.status}`);
        }
        
        const data = await response.json();
        setProductData(data);
      } catch (err) {
        console.error('Error fetching product data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProductData();
    }
  }, [productId, category, authenticated, email]);

  if (loading) {
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          <h2>Error Loading Product</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className={`container ${sidebar ? "" : " large-container"}`}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Product Not Found</h2>
          <p>The requested product could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${sidebar ? "" : " large-container"}`}>
      {/* User Flow Section - Step 3 Only */}
      <div className="user-flow-section">
        <div className="flow-steps">
          <div className="flow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Make Merchandise</h3>
              <p>Create custom products with your screenshot</p>
            </div>
          </div>
        </div>
      </div>

      <div className="product-page-container">
        <div className="product-header">
          <h1>Customize Your Product</h1>
          <p>Select your preferred options and add to cart</p>
        </div>

        <div className="product-main">
          <div className="product-image-section">
            {productData.img_url && (
              <img 
                src={productData.img_url} 
                alt="Product Preview" 
                className="product-preview-image"
              />
            )}
          </div>

          <div className="product-options-section">
            <h2>Available Products</h2>
            <div className="products-grid">
              {productData.products && productData.products.map((product, index) => (
                <div key={index} className="product-card">
                  <h3>{product.name}</h3>
                  <p className="product-price">${product.price}</p>
                  <div className="product-options">
                    {product.colors && (
                      <div className="option-group">
                        <label>Color:</label>
                        <select className="color-select">
                          {product.colors.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {product.sizes && (
                      <div className="option-group">
                        <label>Size:</label>
                        <select className="size-select">
                          {product.sizes.map((size, sizeIndex) => (
                            <option key={sizeIndex} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <button 
                    className="add-to-cart-btn"
                    onClick={() => {
                      // Add to cart functionality
                      console.log('Adding to cart:', product);
                      alert('Added to cart!');
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cart-section">
          <button className="view-cart-btn">View Cart</button>
          <button className="checkout-btn">Checkout</button>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;