import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBackendUrl, apiJoin } from '../../config/apiConfig';
import './UmbrellaJoin.css';

const UmbrellaJoin = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('This invite link is invalid.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiJoin('/api/umbrella-invites/validate')}?token=${encodeURIComponent(token)}`,
          { credentials: 'include' }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || 'This invite is no longer valid.');
          return;
        }
        setInvite(data);
      } catch (_) {
        if (!cancelled) setError('Could not load invite. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const finishLogin = (data) => {
    if (data?.token) localStorage.setItem('auth_token', data.token);
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isAuthenticated', 'true');
    }
    const dest = data?.redirect_url || `${window.location.origin}/dashboard?tab=favorites`;
    window.location.href = dest;
  };

  const acceptWithGoogle = () => {
    const returnUrl = window.location.origin;
    const host = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase();
    const onMain = host === 'screenmerch.com' || host === 'www.screenmerch.com';
    const apiBase = onMain ? getBackendUrl().replace(/\/$/, '') : 'https://screenmerch.fly.dev';
    const loginUrl = `${apiBase}/api/auth/google/login?return_url=${encodeURIComponent(returnUrl)}&flow=umbrella_invite&invite_token=${encodeURIComponent(token)}`;
    window.location.href = loginUrl;
  };

  const acceptWithPassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!password.trim()) {
      setMessage({ type: 'error', text: 'Enter your password.' });
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(apiJoin('/api/umbrella-invites/login-accept'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ invite_token: token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Could not sign in.' });
        return;
      }
      finishLogin(data);
    } catch (_) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const createAccountWithEmail = async () => {
    setMessage(null);
    setAuthLoading(true);
    try {
      const res = await fetch(apiJoin('/api/umbrella-invites/signup-email'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ invite_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Could not send verification email.' });
        return;
      }
      setMessage({
        type: 'success',
        text: data.message || 'Check your email to set a password and accept the invite.',
      });
    } catch (_) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="umbrella-join-page">
      <div className="umbrella-join-card">
        {loading ? (
          <p className="umbrella-join-loading">Loading invite…</p>
        ) : error ? (
          <p className="umbrella-join-error">{error}</p>
        ) : (
          <>
            <h1>Join {invite?.owner_name}&apos;s network</h1>
            <p>
              You&apos;ve been invited to upload favorites on this creator&apos;s storefront.
              Use the email below — Proton, Yahoo, and other non-Google addresses can create
              an account with email and password.
            </p>
            <p className="umbrella-join-email">{invite?.invited_email}</p>

            {message && (
              <p className={`umbrella-join-message umbrella-join-message-${message.type}`}>
                {message.text}
              </p>
            )}

            <button
              type="button"
              className="umbrella-join-btn umbrella-join-btn-google"
              onClick={acceptWithGoogle}
              disabled={authLoading}
            >
              Sign in with Google
            </button>
            <p className="umbrella-join-hint">Only if this invite email is your Google account</p>

            <div className="umbrella-join-divider">
              <span>or use email &amp; password</span>
            </div>

            <form className="umbrella-join-form" onSubmit={acceptWithPassword}>
              <label className="umbrella-join-label" htmlFor="umbrella-password">
                Password
              </label>
              <input
                id="umbrella-password"
                type="password"
                className="umbrella-join-input"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="Your account password"
                autoComplete="current-password"
                disabled={authLoading}
              />
              <button
                type="submit"
                className="umbrella-join-btn umbrella-join-btn-secondary"
                disabled={authLoading}
              >
                {authLoading ? 'Signing in…' : 'Sign in and accept'}
              </button>
            </form>

            <button
              type="button"
              className="umbrella-join-link-btn"
              onClick={createAccountWithEmail}
              disabled={authLoading}
            >
              New here? Create account with this email
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UmbrellaJoin;
