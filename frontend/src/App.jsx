import React, { useState, useEffect } from "react";
import Navbar from "./Components/Navbar/Navbar";
import Footer from "./Components/Footer/Footer";
import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./Pages/Home/Home";
import Video from "./Pages/Video/Video";
import Upload from "./Pages/Upload/Upload";
import Profile from "./Pages/Profile/Profile";
import ApproveSubscription from "./Pages/ApproveSubscription/ApproveSubscription";
import Dashboard from "./Pages/Dashboard/Dashboard";
import SubscriptionTiers from "./Pages/SubscriptionTiers/SubscriptionTiers";
import SubscriptionSuccess from "./Pages/SubscriptionSuccess/SubscriptionSuccess";
import Sidebar from "./Components/Sidebar/Sidebar";
import ComingSoon from "./Pages/ComingSoon/ComingSoon";
import ChannelFriend from "./Pages/ChannelFriend/ChannelFriend";
import Admin from "./Pages/Admin/Admin";
import AuthForm from "./Components/AuthForm";
import PrivacyPolicy from "./Pages/PrivacyPolicy/PrivacyPolicy";
import TermsOfService from "./Pages/TermsOfService/TermsOfService";
import { API_CONFIG } from "./config/apiConfig";

const App = () => {
  const [sidebar, setSidebar] = useState(true);
  const [category, setCategory] = useState(0);
  const [currentProfileTier, setCurrentProfileTier] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const resetCategory = () => setSelectedCategory('All');
  const location = useLocation();
  
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
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar setSidebar={setSidebar} resetCategory={resetCategory} />
      <div style={{ display: 'flex', flex: 1 }}>
        {shouldShowSidebar && (
        <Sidebar sidebar={sidebar} category={category} setCategory={setCategory} />
        )}
        <div className="main-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home sidebar={sidebar} category={category} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />} />
              <Route path="/video/:categoryId/:videoId" element={<Video />} />
              <Route path="/upload" element={<Upload sidebar={sidebar} />} />
              <Route path="/profile/:username" element={<Profile sidebar={sidebar} />} />
              <Route path="/approve-subscription" element={<ApproveSubscription />} />
              <Route path="/dashboard" element={<Dashboard sidebar={sidebar} />} />
              <Route path="/subscription-tiers" element={<SubscriptionTiers />} />
              <Route path="/subscription-success" element={<SubscriptionSuccess />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/channel-friend" element={<ChannelFriend />} />
              <Route path="/channel-friend/:channelUsername" element={<ChannelFriend />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/auth" element={<AuthForm />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default App;
