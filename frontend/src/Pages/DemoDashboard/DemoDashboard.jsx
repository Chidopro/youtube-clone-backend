import React from 'react';
import Dashboard from '../Dashboard/Dashboard';
import './DemoDashboard.css';

const DemoDashboard = ({ sidebar }) => {
  return <Dashboard sidebar={sidebar} demoPreview />;
};

export default DemoDashboard;
