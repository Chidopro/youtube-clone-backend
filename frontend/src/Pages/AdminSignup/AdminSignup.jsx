import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminService } from '../../utils/adminService';
import './AdminSignup.css';

const AdminSignup = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [inviteState, setInviteState] = useState('checking'); // 'checking' | 'valid' | 'invalid' | 'none'
  const [invitedEmail, setInvitedEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!inviteToken) {
      setInviteState('none');
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await AdminService.validateAdminInvite(inviteToken);
      if (cancelled) return;
      if (result.success && result.valid) {
        setInviteState('valid');
        if (result.invited_email) {
          setInvitedEmail(result.invited_email);
          setEmail(result.invited_email);
        }
      } else {
        setInviteState('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [inviteToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      setLoading(false);
      return;
    }

    try {
      const result = await AdminService.submitAdminSignupFromInvite(inviteToken, email);

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Your signup request has been submitted. The master admin will add you to the system and send you login details by email.'
        });
        setEmail('');
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to submit. Please use the link from your invite email.'
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

  // No invite link: invite-only message
  if (inviteState === 'none') {
    return (
      <div className="admin-signup-container">
        <div className="admin-signup-card">
          <div className="admin-signup-header">
            <h1>Admin Portal Signup</h1>
            <p>Invite only</p>
          </div>
          <div className="admin-signup-invite-only">
            <p>This page is for invited users only. Use the link from your invite email to submit your signup request.</p>
            <p>If you were invited but lost the email, ask the master admin to send a new invite.</p>
          </div>
          <div className="admin-signup-footer">
            <button onClick={() => navigate('/')} className="back-button">Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // Checking invite
  if (inviteState === 'checking') {
    return (
      <div className="admin-signup-container">
        <div className="admin-signup-card">
          <div className="admin-signup-header">
            <h1>Admin Portal Signup</h1>
            <p>Checking your invite…</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid or expired invite
  if (inviteState === 'invalid') {
    return (
      <div className="admin-signup-container">
        <div className="admin-signup-card">
          <div className="admin-signup-header">
            <h1>Admin Portal Signup</h1>
            <p>Invalid or expired invite</p>
          </div>
          <div className="admin-signup-invite-only">
            <p>This invite link is invalid or has expired. Ask the master admin to send you a new invite.</p>
          </div>
          <div className="admin-signup-footer">
            <button onClick={() => navigate('/')} className="back-button">Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // Valid invite: show form
  return (
    <div className="admin-signup-container">
      <div className="admin-signup-card">
        <div className="admin-signup-header">
          <h1>Admin Portal Signup</h1>
          <p>You’re invited — submit your email to request access</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-signup-form">
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              disabled={loading}
            />
            <small>Use the email address this invite was sent to. The master admin will add you and send login details.</small>
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
            <li>Submit your email above</li>
            <li>The master admin will add you to the system and set up your account</li>
            <li>You’ll receive login details (e.g. by email)</li>
            <li>Sign in at the admin portal to process orders</li>
          </ol>
        </div>

        <div className="admin-signup-footer">
          <button onClick={() => navigate('/')} className="back-button">Back to Home</button>
        </div>
      </div>
    </div>
  );
};

export default AdminSignup;
