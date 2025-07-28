// Test script to check product page functionality
console.log("🧪 Testing Product Page");

// Check if products are loaded
function checkProducts() {
  const productCards = document.querySelectorAll('.product-card');
  console.log(`Found ${productCards.length} product cards`);
  
  if (productCards.length > 0) {
    console.log("✅ Products are loaded!");
    productCards.forEach((card, index) => {
      const title = card.querySelector('.product-title');
      const price = card.querySelector('.product-price');
      console.log(`Product ${index + 1}: ${title?.textContent} - ${price?.textContent}`);
    });
  } else {
    console.log("❌ No products found");
  }
}

// Check authentication status
function checkAuth() {
  const savedEmail = localStorage.getItem('cartEmail');
  const isAuthenticated = sessionStorage.getItem('authenticated');
  const authOverlay = document.getElementById('email-auth-overlay');
  const authContent = document.getElementById('authenticated-content');
  
  console.log(`Email in localStorage: ${savedEmail}`);
  console.log(`Authenticated in sessionStorage: ${isAuthenticated}`);
  console.log(`Auth overlay display: ${authOverlay?.style.display}`);
  console.log(`Auth content display: ${authContent?.style.display}`);
}

// Run checks
setTimeout(() => {
  checkAuth();
  checkProducts();
}, 2000);

console.log("🔍 Product page test script loaded"); 