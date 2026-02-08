import React, { useState, useEffect, useRef } from "react";
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
import Channel from "./Pages/Channel/Channel";
import MerchandiseCategories from "./Pages/MerchandiseCategories/MerchandiseCategories";
import ProductPage from "./Pages/ProductPage/ProductPage";
// import ScreenshotSelection from "./Pages/ScreenshotSelection/ScreenshotSelection";
import TestCropTool from "./Pages/TestCropTool/TestCropTool";
import PaymentPortal from "./Pages/PaymentPortal/PaymentPortal";
import Checkout from "./Pages/Checkout/Checkout";
import PaymentSetup from "./Pages/PaymentSetup/PaymentSetup";
import ToolsPage from "./Pages/ToolsPage/ToolsPage";
import VerifyEmail from "./Pages/VerifyEmail/VerifyEmail";
import RequestSetPassword from "./Pages/RequestSetPassword/RequestSetPassword";
import CreatorThankYou from "./Pages/CreatorThankYou/CreatorThankYou";
import { API_CONFIG } from "./config/apiConfig";
import { CreatorProvider } from "./contexts/CreatorContext";

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
  const oauthSuccessProcessedRef = useRef(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle Google OAuth redirect (only process success once per load so we don't clear auth on effect re-run)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const loginStatus = urlParams.get('login');
    const userData = urlParams.get('user');
    const errorMessage = urlParams.get('message');

    console.log('[THANKYOU] OAuth effect run', { pathname: location.pathname, search: location.search?.slice(0, 80), loginStatus, hasUserData: !!userData, alreadyProcessed: oauthSuccessProcessedRef.current });

    if (loginStatus === 'success') {
      if (oauthSuccessProcessedRef.current) {
        console.log('[THANKYOU] Already processed — checking if we need to send back to thank-you');
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            const isCreatorSignup = user?.role === 'creator' && (user?.status === 'pending' || user?.status === undefined);
            if (isCreatorSignup && location.pathname !== '/creator-thank-you') {
              console.log('[THANKYOU] Redirecting to /creator-thank-you (already-processed path)');
              navigate('/creator-thank-you', { replace: true });
            }
          } catch (_) {}
        }
        return;
      }

      // SECURITY: Always clear previous auth before applying OAuth result — never show a different user than the one just authenticated
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('oauth_confirmation_pending');
      localStorage.removeItem('customer_authenticated');
      localStorage.removeItem('customer_user');
      localStorage.removeItem('user_authenticated');
      localStorage.removeItem('user_email');

      if (!userData) {
        console.error('OAuth success but no user data in URL');
        alert('Login successful but session data was missing. Please sign in again.');
        navigate('/', { replace: true });
        return;
      }
      try {
        const user = JSON.parse(decodeURIComponent(userData));
        if (!user || !user.email) {
          console.error('OAuth user data invalid:', user);
          alert('Login successful but your data was invalid. Please sign in again.');
          navigate('/', { replace: true });
          return;
        }
        console.log('🎉 Google OAuth successful! User:', user.email, user.display_name);

        oauthSuccessProcessedRef.current = true;
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('isAuthenticated', 'true');
        console.log('✅ User auto-signed in via OAuth');

        window.dispatchEvent(new CustomEvent('oauthSuccess', { detail: user }));

        // Creator signup: show Thank You page (pending, or role=creator with no status so we don't land on home)
        const isCreatorSignup = user.role === 'creator' && (user.status === 'pending' || user.status === undefined);
        const alreadyOnThankYou = location.pathname === '/creator-thank-you';
        const goTo = isCreatorSignup && !alreadyOnThankYou
          ? '/creator-thank-you'
          : (location.pathname || '/');
        navigate(goTo, { replace: true });
      } catch (error) {
        console.error('[THANKYOU] Error parsing user data -> navigate(/)', error);
        alert('Login successful but there was an error processing your data. Please sign in again.');
        navigate('/', { replace: true });
      }
    } else if (loginStatus === 'error') {
      console.error('[THANKYOU] OAuth error -> navigate(/)', errorMessage);
      localStorage.removeItem('oauth_confirmation_pending');
      alert(`Login failed: ${errorMessage || 'An unknown error occurred. Please try again.'}`);
      navigate('/', { replace: true });
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
      
      console.log('[THANKYOU] clear=true -> navigate(/)');
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);

  // Keep creator signups on thank-you: if we're on home but have a pending/creator user in storage, send back to thank-you (safety net for any redirect to /)
  useEffect(() => {
    if (location.pathname !== '/') return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('creator_thank_you_go_home')) {
      sessionStorage.removeItem('creator_thank_you_go_home');
      // User explicitly chose "Go to Homepage" from thank-you: do not keep them signed in as creator
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('oauth_confirmation_pending');
      oauthSuccessProcessedRef.current = false;
      window.dispatchEvent(new CustomEvent('creatorThankYouSignOut'));
      return;
    }
    // After set-password flow: keep user on home, do not redirect to creator-thank-you or elsewhere
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('from_password_set')) {
      sessionStorage.removeItem('from_password_set');
      return;
    }
    const raw = localStorage.getItem('user');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    console.log('[THANKYOU] On path / — safety net check', { hasUser: !!raw, isAuth });
    if (!isAuth || !raw) return;
    try {
      const user = JSON.parse(raw);
      const isCreatorSignup = user?.role === 'creator' && (user?.status === 'pending' || user?.status === undefined);
      if (isCreatorSignup) {
        console.log('[THANKYOU] Safety net: redirecting / -> /creator-thank-you');
        navigate('/creator-thank-you', { replace: true });
      }
    } catch (_) {}
  }, [location.pathname, navigate]);
  
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
    <CreatorProvider>
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
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="/coming-soon" element={<ComingSoon />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/auth" element={<AuthForm />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Login />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/search" element={<Search />} />
                <Route path="/channel/:channelName" element={<Channel />} />
                <Route path="/merchandise" element={<MerchandiseCategories sidebar={sidebar} />} />
                <Route path="/product/browse" element={<ProductPage sidebar={sidebar} />} />
                <Route path="/product/:productId" element={<ProductPage sidebar={sidebar} />} />
                <Route path="/test-crop-tool" element={<TestCropTool />} />
                <Route path="/payment-portal" element={<PaymentPortal />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/payment-setup" element={<PaymentSetup />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/set-password" element={<RequestSetPassword />} />
                <Route path="/creator-thank-you" element={<CreatorThankYou />} />
                {/* <Route path="/screenshot-selection" element={<ScreenshotSelection />} /> */}
              </Routes>
            </div>
            <Footer />
          </div>
        </div>
      </div>
    </CreatorProvider>
  );
};

export default App;
