import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService } from '../../utils/adminService';
import { getBackendUrl } from '../../config/apiConfig';
import { claimSessionTokenIfNeeded } from '../../utils/userService';
import './BibleVerseMerchDashboard.css';

const EMPTY_ANALYTICS = {
  total_sales: 0,
  total_revenue: 0,
  avg_order_value: 0,
  week_sales_count: 0,
  products_sold: [],
  recent_sales: [],
};

function money(value) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function readSignedInUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_) {
    return null;
  }
}

export default function BibleVerseMerchDashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = readSignedInUser();
      if (!user?.id || !user?.email) {
        navigate('/login', { replace: true });
        return;
      }
      try {
        const adminStatus = await AdminService.checkAdminStatus();
        if (!adminStatus?.isMasterAdmin) {
          throw new Error('Master administrator access is required.');
        }
        const token = await claimSessionTokenIfNeeded(user.id);
        const response = await fetch(
          `${getBackendUrl()}/api/analytics?scope=storefront&subdomain=bibleversemerch`,
          {
            cache: 'no-store',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
              'X-User-Id': user.id,
              'X-User-Email': String(user.email).trim().toLowerCase(),
              ...(token ? { 'X-Session-Token': token } : {}),
            },
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load storefront analytics.');
        if (!cancelled) setAnalytics({ ...EMPTY_ANALYTICS, ...data });
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Could not load storefront analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const itemsSold = useMemo(
    () => (analytics.products_sold || []).reduce(
      (total, product) => total + Number(product.quantity || 0),
      0
    ),
    [analytics.products_sold]
  );

  if (loading) {
    return <main className="bvm-dashboard-state">Loading Bible Verse Merch analytics…</main>;
  }

  if (error) {
    return <main className="bvm-dashboard-state bvm-dashboard-state--error">{error}</main>;
  }

  return (
    <main className="bvm-dashboard">
      <header className="bvm-dashboard-heading">
        <p>Bible Verse Merch</p>
        <h1>Sales Analytics</h1>
        <span>Only completed purchases from bibleversemerch.screenmerch.com appear here.</span>
      </header>

      <section className="bvm-dashboard-summary" aria-label="Storefront sales summary">
        <article>
          <span>Completed orders</span>
          <strong>{Number(analytics.total_sales || 0)}</strong>
        </article>
        <article>
          <span>This week</span>
          <strong>{Number(analytics.week_sales_count || 0)}</strong>
        </article>
        <article>
          <span>Items sold</span>
          <strong>{itemsSold}</strong>
        </article>
        <article>
          <span>Paid order revenue</span>
          <strong>{money(analytics.total_revenue)}</strong>
        </article>
        <article>
          <span>Average order</span>
          <strong>{money(analytics.avg_order_value)}</strong>
        </article>
      </section>

      <section className="bvm-dashboard-panel">
        <h2>Products sold</h2>
        {(analytics.products_sold || []).length ? (
          <div className="bvm-dashboard-list">
            {analytics.products_sold.map((product) => (
              <div key={product.product} className="bvm-dashboard-row">
                <span>{product.product || 'Product'}</span>
                <strong>{Number(product.quantity || 0)} sold</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="bvm-dashboard-empty">No completed Bible Verse Merch purchases yet.</p>
        )}
      </section>

      <section className="bvm-dashboard-panel">
        <h2>Recent sales</h2>
        {(analytics.recent_sales || []).length ? (
          <div className="bvm-dashboard-list">
            {analytics.recent_sales.map((sale, index) => (
              <div key={`${sale.order_id || 'sale'}-${index}`} className="bvm-dashboard-row">
                <span>
                  {sale.product || 'Product'}
                  <small>
                    {sale.created_at && sale.created_at !== 'N/A'
                      ? new Date(sale.created_at).toLocaleDateString()
                      : ''}
                  </small>
                </span>
                <strong>{money(sale.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="bvm-dashboard-empty">Sales will appear after a customer completes checkout.</p>
        )}
      </section>
    </main>
  );
}
