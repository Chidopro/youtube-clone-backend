import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import './ProductPage.css';

const ProductPage = ({ sidebar }) => {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const category = searchParams.get('category') || 'all';
  const authenticated = searchParams.get('authenticated') === 'true';
  const email = searchParams.get('email') || '';

  // Categories for selection
  const categories = [
    { name: "All Products", emoji: "🛍️", category: "all" },
    { name: "Women's", emoji: "👩", category: "womens" },
    { name: "Men's", emoji: "👨", category: "mens" },
    { name: "Kids", emoji: "👶", category: "kids" },
    { name: "Mugs", emoji: "☕", category: "mugs" },
    { name: "Hats", emoji: "🧢", category: "hats" },
    { name: "Bags", emoji: "👜", category: "bags" },
    { name: "Pets", emoji: "🐕", category: "pets" },
    { name: "Misc", emoji: "📦", category: "misc" },
    { name: "Thumbnails", emoji: "🖼️", category: "thumbnails" }
  ];

  const handleCategoryClick = (newCategory) => {
    // Update URL with new category
    const newUrl = `/product/${productId}?category=${newCategory}&authenticated=${authenticated}&email=${email}`;
    navigate(newUrl);
  };

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

      {/* Category Selection Section */}
      <div className="merchandise-categories">
        <div className="categories-container">
          <h1 className="categories-title">Choose a Product Category</h1>
          <p className="categories-subtitle">Select a category to browse products for your custom merchandise</p>
          
          <div className="categories-grid">
            {categories.map((cat, index) => (
              <div
                key={index}
                className={`category-box ${cat.category === category ? 'active' : ''}`}
                onClick={() => handleCategoryClick(cat.category)}
                style={{ cursor: 'pointer' }}
              >
                <div className="category-emoji">{cat.emoji}</div>
                <div className="category-name">{cat.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="product-page-container">
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
            {/* Cart Buttons Above Products */}
            <div className="cart-section">
              <button className="view-cart-btn">View Cart</button>
              <button className="checkout-btn">Checkout</button>
            </div>

            <div className="products-grid">
              {productData.products && productData.products.map((product, index) => (
                <div key={index} className="product-card">
                  {/* Product Image */}
                  {product.preview_image && (
                    <div className="product-image">
                      <img 
                        src={`https://screenmerch.fly.dev/static/images/${product.preview_image}`}
                        alt={product.name}
                        onError={(e) => {
                          // Fallback to main_image if preview fails
                          e.target.src = `https://screenmerch.fly.dev/static/images/${product.main_image}`;
                        }}
                      />
                    </div>
                  )}
                  
                  <h3>{product.name}</h3>
                  <p className="product-price">${product.price.toFixed(2)}</p>
                  
                  <div className="product-options">
                    {/* Color Options */}
                    {product.options && product.options.color && product.options.color.length > 0 && (
                      <div className="option-group">
                        <label>Color:</label>
                        <select className="color-select">
                          {product.options.color.map((color, colorIndex) => (
                            <option key={colorIndex} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Size Options */}
                    {product.options && product.options.size && product.options.size.length > 0 && (
                      <div className="option-group">
                        <label>Size:</label>
                        <select className="size-select">
                          {product.options.size.map((size, sizeIndex) => (
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
      </div>
    </div>
  );
};

export default ProductPage;