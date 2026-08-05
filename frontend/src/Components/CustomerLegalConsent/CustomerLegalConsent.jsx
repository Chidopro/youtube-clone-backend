import React from 'react';
import { Link } from 'react-router-dom';
import './CustomerLegalConsent.css';

const CustomerLegalConsent = ({ checked, onChange, id = 'customer-legal-consent' }) => (
  <label className="customer-legal-consent" htmlFor={id}>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      required
    />
    <span>
      I agree to the ScreenMerch{' '}
      <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer">
        Terms of Service
      </Link>{' '}
      and acknowledge the{' '}
      <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </Link>.
    </span>
  </label>
);

export default CustomerLegalConsent;
