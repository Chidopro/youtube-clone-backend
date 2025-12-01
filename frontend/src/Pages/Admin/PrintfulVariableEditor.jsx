import React, { useState, useEffect } from 'react';
import { products } from '../../data/products';
import { AdminService } from '../../utils/adminService';
import './PrintfulVariableEditor.css';

const PrintfulVariableEditor = () => {
  const [selectedProductKey, setSelectedProductKey] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [availability, setAvailability] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Get all products with availability data
  const productsWithAvailability = Object.keys(products).filter(key => {
    return products[key].variables?.availability && 
           products[key].variables?.sizes && 
           products[key].variables?.colors;
  });

  useEffect(() => {
    if (selectedProductKey && products[selectedProductKey]) {
      const product = products[selectedProductKey];
      setSelectedProduct(product);
      
      // Initialize availability state from product data
      if (product.variables?.availability) {
        setAvailability(JSON.parse(JSON.stringify(product.variables.availability)));
        setUnsavedChanges(false);
      }
    }
  }, [selectedProductKey]);

  const handleToggleAvailability = (size, color) => {
    setAvailability(prev => {
      const newAvailability = JSON.parse(JSON.stringify(prev));
      if (!newAvailability[size]) {
        newAvailability[size] = {};
      }
      newAvailability[size][color] = !newAvailability[size][color];
      setUnsavedChanges(true);
      return newAvailability;
    });
  };

  const handleBulkToggle = (size, value) => {
    if (!selectedProduct?.variables?.colors) return;
    
    setAvailability(prev => {
      const newAvailability = JSON.parse(JSON.stringify(prev));
      if (!newAvailability[size]) {
        newAvailability[size] = {};
      }
      selectedProduct.variables.colors.forEach(color => {
        newAvailability[size][color] = value;
      });
      setUnsavedChanges(true);
      return newAvailability;
    });
  };

  const handleSave = async () => {
    if (!selectedProductKey || !selectedProduct) return;

    setSaving(true);
    setSaveStatus(null);

    try {
      // Get user email for authentication
      const userEmail = await AdminService.getCurrentUserEmail();
      const apiUrl = process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev';
      
      // Try to save via API first
      const headers = {
        'Content-Type': 'application/json',
      };
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      const response = await fetch(`${apiUrl}/api/admin/update-product-availability`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          productKey: selectedProductKey,
          availability: availability
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveStatus({ 
          type: 'success', 
          message: `✅ Successfully updated ${selectedProduct.name}! Changes are now live.`,
          filePath: result.filePath
        });
        setUnsavedChanges(false);
      } else {
        // Fallback to manual update method
        throw new Error(result.error || 'API update failed, showing manual instructions');
      }
    } catch (error) {
      console.error('Error saving via API:', error);
      
      // Fallback: Generate code snippet for manual update
      try {
        const availabilityString = JSON.stringify(availability, null, 8)
          .split('\n')
          .map((line, index) => {
            if (index === 0) return line;
            return '        ' + line;
          })
          .join('\n');
        
        const codeSnippet = `      "availability": ${availabilityString}`;
        
        const instructions = `⚠️ Automatic update failed. Manual update required:

1. Open: frontend/src/data/products.js
2. Find the product with key: "${selectedProductKey}"
3. Locate the "availability" property
4. Replace the entire "availability" object with:

${codeSnippet}

5. Save the file and commit your changes
6. Deploy the frontend to see the changes`;

        try {
          await navigator.clipboard.writeText(codeSnippet);
          setSaveStatus({ 
            type: 'error', 
            message: `⚠️ API update failed. Code snippet copied to clipboard!`,
            instructions: instructions,
            codeSnippet: codeSnippet
          });
        } catch (clipboardError) {
          setSaveStatus({ 
            type: 'error', 
            message: `⚠️ API update failed. Please copy the code manually.`,
            instructions: instructions,
            codeSnippet: codeSnippet
          });
        }
      } catch (fallbackError) {
        setSaveStatus({ 
          type: 'error', 
          message: `Error: ${error.message}` 
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportJSON = () => {
    if (!selectedProduct || !selectedProductKey) return;
    
    const exportData = {
      productKey: selectedProductKey,
      productName: selectedProduct.name,
      availability: availability
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProductKey}_availability.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!selectedProduct) {
    return (
      <div className="printful-variable-editor">
        <div className="editor-header">
          <h2>Printful Variable Editor</h2>
          <p>Select a product to edit color-size availability</p>
        </div>
        <div className="product-selector">
          <label>Select Product:</label>
          <select 
            value={selectedProductKey} 
            onChange={(e) => setSelectedProductKey(e.target.value)}
            className="product-select"
          >
            <option value="">-- Choose a product --</option>
            {productsWithAvailability.map(key => (
              <option key={key} value={key}>
                {products[key].name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const sizes = selectedProduct.variables?.sizes || [];
  const colors = selectedProduct.variables?.colors || [];

  return (
    <div className="printful-variable-editor">
      <div className="editor-header">
        <h2>Printful Variable Editor</h2>
        <p>Edit color-size availability for: <strong>{selectedProduct.name}</strong></p>
        {unsavedChanges && (
          <div className="unsaved-warning">⚠️ You have unsaved changes</div>
        )}
      </div>

      <div className="editor-controls">
        <div className="product-selector">
          <label>Product:</label>
          <select 
            value={selectedProductKey} 
            onChange={(e) => {
              if (unsavedChanges) {
                if (!window.confirm('You have unsaved changes. Are you sure you want to switch products?')) {
                  return;
                }
              }
              setSelectedProductKey(e.target.value);
            }}
            className="product-select"
          >
            <option value="">-- Choose a product --</option>
            {productsWithAvailability.map(key => (
              <option key={key} value={key}>
                {products[key].name}
              </option>
            ))}
          </select>
        </div>

        <div className="action-buttons">
          <button 
            onClick={handleSave} 
            disabled={saving || !unsavedChanges}
            className="save-button"
          >
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
          <button 
            onClick={handleExportJSON}
            className="export-button"
          >
            📥 Export JSON
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className={`save-status ${saveStatus.type}`}>
          <div>{saveStatus.message}</div>
          {saveStatus.filePath && (
            <div className="file-path">
              📁 Updated file: {saveStatus.filePath}
            </div>
          )}
          {saveStatus.instructions && (
            <div className="save-instructions">
              <pre>{saveStatus.instructions}</pre>
            </div>
          )}
          {saveStatus.codeSnippet && (
            <div className="code-snippet-container">
              <label>Code to copy:</label>
              <textarea 
                readOnly 
                value={saveStatus.codeSnippet}
                className="code-snippet"
                onClick={(e) => e.target.select()}
              />
            </div>
          )}
        </div>
      )}

      <div className="availability-section">
        <div className="section-header">
          <h3>📏 SIZES (Columns)</h3>
          <p>Click column headers to bulk update all colors for that size</p>
        </div>
        <div className="section-header">
          <h3>🎨 COLORS (Rows)</h3>
          <p>Click individual cells to toggle availability for specific color-size combinations</p>
        </div>
      </div>

      <div className="availability-grid-container">
        <div 
          className="availability-grid"
          style={{
            gridTemplateColumns: `220px repeat(${sizes.length}, minmax(140px, 1fr))`
          }}
        >
          {/* Header row with sizes */}
          <div className="grid-header">
            <div className="grid-cell header-cell corner-cell">
              <div className="header-label">COLOR</div>
              <div className="header-label-secondary">↓</div>
              <div className="header-label-secondary">SIZE →</div>
            </div>
            {sizes.map(size => (
              <div key={size} className="grid-cell header-cell size-header">
                <div className="size-label">{size}</div>
                <div className="bulk-actions">
                  <button 
                    onClick={() => handleBulkToggle(size, true)}
                    className="bulk-btn all-btn"
                    title={`Mark all colors available for ${size}`}
                  >
                    ✓ All
                  </button>
                  <button 
                    onClick={() => handleBulkToggle(size, false)}
                    className="bulk-btn none-btn"
                    title={`Mark all colors unavailable for ${size}`}
                  >
                    ✗ None
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Color rows */}
          {colors.map(color => (
            <div key={color} className="grid-row">
              <div className="grid-cell color-cell">
                <div className="color-label">{color}</div>
              </div>
              {sizes.map(size => {
                const isAvailable = availability[size]?.[color] === true;
                return (
                  <div 
                    key={`${size}-${color}`} 
                    className={`grid-cell availability-cell ${isAvailable ? 'available' : 'unavailable'}`}
                    onClick={() => handleToggleAvailability(size, color)}
                    title={`Click to toggle: ${color} in ${size} - Currently ${isAvailable ? 'Available' : 'Unavailable'}`}
                  >
                    <span className="cell-icon">{isAvailable ? '✓' : '✗'}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="editor-legend">
        <div className="legend-item">
          <span className="legend-box available">✓</span>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-box unavailable">✗</span>
          <span>Unavailable</span>
        </div>
        <div className="legend-note">
          Click any cell to toggle availability. Use "All" / "None" buttons to bulk update sizes.
        </div>
      </div>
    </div>
  );
};

export default PrintfulVariableEditor;

