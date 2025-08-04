import React, { useState, useEffect } from 'react'
import './Sidebar.css'
import home from '../../assets/home.png'
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const Sidebar = ({sidebar, category, setCategory}) => {
  const location = useLocation();

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className={`side-link ${category === 0 ? "active" : ""}`} onClick={() => setCategory(0)}>
          <img src={home} alt="" /><p>Home</p>
        </Link>
        <hr />
      </div>
    </div>
  )
}

export default Sidebar
