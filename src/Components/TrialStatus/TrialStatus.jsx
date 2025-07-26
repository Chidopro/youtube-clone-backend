import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import './TrialStatus.css';

const TrialStatus = () => {
  const { subscription, isInTrialPeriod, getTrialDaysRemaining } = useSubscription();
  const [trialDays, setTrialDays] = useState(0);
  const [isTrial, setIsTrial] = useState(false);

  useEffect(() => {
    const checkTrialStatus = async () => {
      if (subscription?.tier === 'pro') {
        const trialActive = await isInTrialPeriod();
        setIsTrial(trialActive);
        
        if (trialActive) {
          const daysRemaining = await getTrialDaysRemaining();
          setTrialDays(daysRemaining);
        }
      }
    };

    checkTrialStatus();
  }, [subscription, isInTrialPeriod, getTrialDaysRemaining]);

  if (!subscription || subscription.tier !== 'pro' || !isTrial) {
    return null;
  }

  return (
    <div className="trial-status">
      <div className="trial-banner">
        <div className="trial-icon">🎉</div>
        <div className="trial-content">
          <h3>Free Trial Active</h3>
          <p>You have {trialDays} day{trialDays !== 1 ? 's' : ''} remaining in your free trial</p>
          <small>Your card will be charged $9.99/month after the trial ends</small>
        </div>
      </div>
    </div>
  );
};

export default TrialStatus; 