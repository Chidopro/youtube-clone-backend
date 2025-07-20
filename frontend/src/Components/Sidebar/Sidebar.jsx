import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const Sidebar = ({sidebar, category, setCategory}) => {
  const location = useLocation();

  // Simplified sidebar - removed complex subscriber/friend functionality

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className={`side-link ${category === 0 ? "active" : ""}`} onClick={() => setCategory(0)}>
          <img src={home} alt="" /><p>Home</p>
        </Link>
        <hr />
      </div>
      {/* Simplified sidebar - removed subscriber/friend lists */}
    </div>
  )
}

export default Sidebar
