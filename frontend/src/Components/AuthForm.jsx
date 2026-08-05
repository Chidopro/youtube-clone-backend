import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiJoin } from '../config/apiConfig';
import CustomerLegalConsent from './CustomerLegalConsent/CustomerLegalConsent';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  const [acceptedCustomerLegal, setAcceptedCustomerLegal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (isLogin) {
      // Login
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Logged in! Redirecting...');
        setTimeout(() => {
          navigate(returnTo);
        }, 1000);
      }
    } else {
      if (!acceptedCustomerLegal) {
        setMessage('You must agree to the Terms of Service and acknowledge the Privacy Policy.');
        return;
      }
      const response = await fetch(apiJoin('/api/auth/signup'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          accepted_terms_and_privacy: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      setMessage(response.ok && data.success ? 'Signup successful!' : (data.error || 'Signup failed.'));
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', marginBottom: 10, padding: 8 }}
        />
        {!isLogin && (
          <CustomerLegalConsent
            checked={acceptedCustomerLegal}
            onChange={setAcceptedCustomerLegal}
            id="legacy-auth-customer-legal-consent"
          />
        )}
        <button
          type="submit"
          disabled={!isLogin && !acceptedCustomerLegal}
          style={{ width: '100%', padding: 10 }}
        >
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>
      <button
        onClick={() => { setIsLogin(!isLogin); setAcceptedCustomerLegal(false); setMessage(''); }}
        style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}
      >
        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
      </button>
      {message && <div style={{ marginTop: 15, color: 'red' }}>{message}</div>}
    </div>
  );
};

export default AuthForm;