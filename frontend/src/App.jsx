import React, { useState, useEffect } from "react";
import Navbar from "./Components/Navbar/Navbar";
import Footer from "./Components/Footer/Footer";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Home from "./Pages/Home/Home";
import Video from "./Pages/Video/Video";
import Upload from "./Pages/Upload/Upload";
import Profile from "./Pages/Profile/Profile";
import ApproveSubscription from "./Pages/ApproveSubscription/ApproveSubscription";
import Dashboard from "./Pages/Dashboard/Dashboard";
import SubscriptionTiers from "./Pages/SubscriptionTiers/SubscriptionTiers";
import SubscriptionSuccess from "./Pages/SubscriptionSuccess/SubscriptionSuccess";
import OrderSuccess from "./Pages/OrderSuccess/OrderSuccess";
import Sidebar from "./Components/Sidebar/Sidebar";
import ComingSoon from "./Pages/ComingSoon/ComingSoon";
import Admin from "./Pages/Admin/Admin";
import AuthForm from "./Components/AuthForm";
import Login from "./Pages/Login/Login";
import PrivacyPolicy from "./Pages/PrivacyPolicy/PrivacyPolicy";
import TermsOfService from "./Pages/TermsOfService/TermsOfService";
import Search from "./Pages/Search/Search";
import MerchandiseCategories from "./Pages/MerchandiseCategories/MerchandiseCategories";
import ProductPage from "./Pages/ProductPage/ProductPage";
// import ScreenshotSelection from "./Pages/ScreenshotSelection/ScreenshotSelection";
import TestCropTool from "./Pages/TestCropTool/TestCropTool";
import PaymentPortal from "./Pages/PaymentPortal/PaymentPortal";
import Checkout from "./Pages/Checkout/Checkout";
import PaymentSetup from "./Pages/PaymentSetup/PaymentSetup";
import { API_CONFIG } from "./config/apiConfig";

const App = () => {
  // Sidebar starts closed by default for cleaner look
  const [sidebar, setSidebar] = useState(false);
  const [category, setCategory] = useState(0);
  const [currentProfileTier, setCurrentProfileTier] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isMobile, setIsMobile] = useState(false);
  const resetCategory = () => setSelectedCategory('All');
  const location = useLocation();
  const navigate = useNavigate();
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle Google OAuth redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const loginStatus = urlParams.get('login');
    const userData = urlParams.get('user');
    
    if (loginStatus === 'success' && userData) {
      try {
        const user = JSON.parse(decodeURIComponent(userData));
        console.log('🎉 Google OAuth successful! User:', user);
        
        // Set a flag to indicate OAuth confirmation is pending
        localStorage.setItem('oauth_confirmation_pending', 'true');
        
        // Auto-sign in without confirmation dialog for better UX
        console.log('🔔 Auto-signing in user:', user.display_name);
        
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('isAuthenticated', 'true');
        console.log('✅ User auto-signed in via OAuth');

        // Clear the pending flag
        localStorage.removeItem('oauth_confirmation_pending');

        // Dispatch custom event to notify Navbar of OAuth success
        window.dispatchEvent(new CustomEvent('oauthSuccess', { detail: user }));
        console.log('📡 Dispatched oauthSuccess event to Navbar');

        // Clean up URL parameters but stay on current page
        const currentPath = location.pathname;
        navigate(currentPath, { replace: true });
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('oauth_confirmation_pending');
        alert('Login successful but there was an error processing your data. Please try again.');
        navigate('/', { replace: true });
      }
    }
    
    // Add a way to clear login for testing (remove this in production)
    if (urlParams.get('clear') === 'true') {
      // Clear all authentication data
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('oauth_confirmation_pending');
      localStorage.removeItem('customer_authenticated');
      localStorage.removeItem('customer_user');
      localStorage.removeItem('user_authenticated');
      localStorage.removeItem('user_email');
      
      // Clear any Supabase session
      if (window.supabase) {
        window.supabase.auth.signOut();
      }
      
      console.log('🧹 Cleared all login data for testing');
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);
  
  // Check if current route is a profile page and fetch subscription data
  useEffect(() => {
    const checkProfileTier = async () => {
      const profileMatch = location.pathname.match(/^\/profile\/(.+)$/);
      if (profileMatch) {
        const username = profileMatch[1];
        try {
          const response = await fetch(`${API_CONFIG.ENDPOINTS.USER_SUBSCRIPTION}/${username}/subscription`);
          if (response.ok) {
            const data = await response.json();
            setCurrentProfileTier(data);
          } else {
            setCurrentProfileTier({ isThirdTier: false });
          }
        } catch (error) {
          console.error('Error fetching subscription data:', error);
          setCurrentProfileTier({ isThirdTier: false });
        }
      } else {
        setCurrentProfileTier(null);
      }
    };
    
    checkProfileTier();
  }, [location.pathname]);
  
  // Hide main sidebar for third tier profile pages
  const shouldShowSidebar = sidebar && !(currentProfileTier?.isThirdTier);
  
  console.log('🚀 App.jsx rendering - current path:', location.pathname);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar setSidebar={setSidebar} resetCategory={resetCategory} />
      <div style={{ display: 'flex', flex: 1 }}>
        {shouldShowSidebar && (
        <Sidebar sidebar={sidebar} category={category} setCategory={setCategory} />
        )}
        {/* Mobile backdrop for sidebar */}
        {sidebar && isMobile && (
          <div 
            className="mobile-sidebar-backdrop"
            onClick={() => setSidebar(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              display: 'block'
            }}
          />
        )}
        <div className="main-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home sidebar={sidebar} category={category} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />} />
              <Route path="/video/:categoryId/:videoId" element={<Video sidebar={sidebar} />} />
              <Route path="/upload" element={<Upload sidebar={sidebar} />} />
              <Route path="/profile/:username" element={<Profile sidebar={sidebar} />} />
              <Route path="/approve-subscription" element={<ApproveSubscription />} />
              <Route path="/dashboard" element={<Dashboard sidebar={sidebar} />} />
              <Route path="/subscription-tiers" element={<SubscriptionTiers />} />
              <Route path="/subscription-success" element={<SubscriptionSuccess />} />
              <Route path="/success" element={<OrderSuccess />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/auth" element={<AuthForm />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Login />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/search" element={<Search />} />
              <Route path="/merchandise" element={<MerchandiseCategories sidebar={sidebar} />} />
              <Route path="/product/:productId" element={<ProductPage sidebar={sidebar} />} />
              <Route path="/test-crop-tool" element={<TestCropTool />} />
              <Route path="/payment-portal" element={<PaymentPortal />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/payment-setup" element={<PaymentSetup />} />
              {/* <Route path="/screenshot-selection" element={<ScreenshotSelection />} /> */}
            </Routes>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default App;
