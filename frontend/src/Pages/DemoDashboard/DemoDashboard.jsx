import React from 'react';
import { Navigate } from 'react-router-dom';
import Dashboard from '../Dashboard/Dashboard';
import { isRealStorefrontUser, readStoredUser } from '../../utils/demoStorefront';
import './DemoDashboard.css';

const DemoDashboard = ({ sidebar }) => {
  if (isRealStorefrontUser(readStoredUser())) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Dashboard sidebar={sidebar} demoPreview />;
};

export default DemoDashboard;
