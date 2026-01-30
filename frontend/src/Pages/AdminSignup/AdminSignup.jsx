import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService } from '../../utils/adminService';
import './AdminSignup.css';

const AdminSignup = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    // Validate email
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      setLoading(false);
      return;
    }

    try {
      const result = await AdminService.submitAdminSignupRequest(email);
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: 'Your admin signup request has been submitted successfully! The master admin will review your request and set up your account. You will receive an email once your account is approved.' 
        });
        setEmail('');
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to submit signup request. Please try again.' 
        });
      }
    } catch (error) {
      console.error('Error submitting signup request:', error);
      setMessage({ 
        type: 'error', 
        text: 'An error occurred. Please try again later.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-signup-container">
      <div className="admin-signup-card">
        <div className="admin-signup-header">
          <h1>Admin Portal Signup</h1>
          <p>Request access to the ScreenMerch Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-signup-form">
          <div className="form-group">
            <label htmlFor="email">Google Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@gmail.com"
              required
              disabled={loading}
            />
            <small>Enter the Google email address you'll use to access the admin portal</small>
          </div>

          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit" 
            className="submit-button"
            disabled={loading || !email}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div className="admin-signup-info">
          <h3>What happens next?</h3>
          <ol>
            <li>Submit your Google email address using the form above</li>
            <li>The master admin will review your request</li>
            <li>Once approved, the master admin will set up your account in Supabase</li>
            <li>You'll receive login credentials via email</li>
            <li>You can then access the admin portal to process orders</li>
          </ol>
        </div>

        <div className="admin-signup-footer">
          <button 
            onClick={() => navigate('/')} 
            className="back-button"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSignup;

