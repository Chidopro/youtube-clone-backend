import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService } from '../../utils/adminService';
import { getBackendUrl } from '../../config/apiConfig';
import { claimSessionTokenIfNeeded } from '../../utils/userService';
import {
  fetchPlatformStorefrontDashboard,
  savePlatformStorefrontDashboard,
} from '../../utils/platformStorefrontDashboardApi';
import {
  fetchStorefrontBibleVerses,
  mergeBibleVersePresets,
  saveStorefrontBibleVerse,
} from '../../utils/bibleVersesApi';
import {
  applyBibleVerseTemplateSettings,
  BIBLE_VERSE_TEMPLATES,
  KJV_PROVERB_PRESETS,
} from '../../data/bibleVerseMerch';
import './BibleVerseMerchDashboard.css';

const EMPTY_ANALYTICS = {
  total_sales: 0,
  total_revenue: 0,
  avg_order_value: 0,
  week_sales_count: 0,
  products_sold: [],
  recent_sales: [],
};

const DEFAULT_SETTINGS = {
  display_name: 'Bible Verse Merch',
  primary_color: '#ffffff',
  secondary_color: '#ffffff',
  header_opacity: 100,
  custom_logo_url: '/bibleverse-merch-logo.png',
  hidden_template_ids: [],
  template_overrides: {},
  checkout_enabled: true,
  co_creators: [],
  payout_note: 'Platform-owned storefront; no separate creator payout.',
};

const TABS = [
  ['content', 'Pages & Media'],
  ['analytics', 'Analytics'],
  ['personalization', 'Personalization'],
  ['churches', 'Co-Creators'],
  ['store', 'Store & Payouts'],
];

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
  const [activeTab, setActiveTab] = useState('content');
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [verses, setVerses] = useState(KJV_PROVERB_PRESETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [verseEditor, setVerseEditor] = useState(null);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [availableTemplateIds, setAvailableTemplateIds] = useState([]);
  const [churchDraft, setChurchDraft] = useState({ name: '', email: '' });

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
        const analyticsRequest = fetch(
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
        ).then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Could not load storefront analytics.');
          return data;
        });
        const [analyticsData, dashboardResult, verseResult] = await Promise.all([
          analyticsRequest,
          fetchPlatformStorefrontDashboard(),
          fetchStorefrontBibleVerses('bibleversemerch'),
        ]);
        if (!dashboardResult.ok) {
          throw new Error(dashboardResult.data?.error || 'Could not load storefront settings.');
        }
        if (!cancelled) {
          setAnalytics({ ...EMPTY_ANALYTICS, ...analyticsData });
          setSettings({ ...DEFAULT_SETTINGS, ...(dashboardResult.data?.settings || {}) });
          if (verseResult.ok) {
            setVerses(mergeBibleVersePresets(KJV_PROVERB_PRESETS, verseResult.data?.verses));
          }
        }
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
  const configuredTemplates = useMemo(
    () => applyBibleVerseTemplateSettings(BIBLE_VERSE_TEMPLATES, settings),
    [settings]
  );
  const availableTemplates = useMemo(
    () => configuredTemplates.filter((template) => availableTemplateIds.includes(template.id)),
    [availableTemplateIds, configuredTemplates]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(configuredTemplates.map((template) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(template.id);
      image.onerror = () => resolve('');
      image.src = template.imageUrl;
    }))).then((ids) => {
      if (!cancelled) setAvailableTemplateIds(ids.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [configuredTemplates]);

  const saveSettings = async (nextSettings, message) => {
    setSaving(true);
    setStatus('');
    const result = await savePlatformStorefrontDashboard(nextSettings);
    setSaving(false);
    if (!result.ok) {
      setStatus(result.data?.error || 'Could not save dashboard settings.');
      return false;
    }
    setSettings({ ...DEFAULT_SETTINGS, ...(result.data?.settings || nextSettings) });
    setStatus(message || 'Settings saved.');
    return true;
  };

  const saveVerse = async () => {
    const reference = String(verseEditor?.reference || '').trim();
    const text = String(verseEditor?.text || '').trim();
    const highlight = String(verseEditor?.highlight || '').trim();
    if (!reference || !text) {
      setStatus('Reference and complete verse are required.');
      return;
    }
    if (highlight && !text.toLowerCase().includes(highlight.toLowerCase())) {
      setStatus('The highlighted phrase must appear in the complete verse.');
      return;
    }
    setSaving(true);
    setStatus('');
    const result = await saveStorefrontBibleVerse('bibleversemerch', {
      id: verseEditor.id || undefined,
      reference,
      text,
      highlight,
    });
    setSaving(false);
    if (!result.ok) {
      setStatus(result.data?.error || 'Could not save this verse.');
      return;
    }
    setVerses((current) => mergeBibleVersePresets(current, [result.data.verse]));
    setVerseEditor(null);
    setStatus(`${reference} saved.`);
  };

  const addChurch = () => {
    const email = churchDraft.email.trim().toLowerCase();
    const name = churchDraft.name.trim();
    if (!email || !email.includes('@')) {
      setStatus('Enter a valid church contact email.');
      return;
    }
    if ((settings.co_creators || []).some((entry) => entry.email === email)) {
      setStatus('That email is already on the church access list.');
      return;
    }
    setSettings((current) => ({
      ...current,
      co_creators: [
        ...(current.co_creators || []),
        { id: `church-${Date.now()}`, name: name || email.split('@')[0], email, status: 'whitelisted' },
      ],
    }));
    setChurchDraft({ name: '', email: '' });
    setStatus('Church added locally. Save the access list to keep it.');
  };

  const saveTemplateEdit = async () => {
    if (!templateEditor) return;
    const title = templateEditor.title.trim();
    const imageUrl = templateEditor.imageUrl.trim();
    if (!title || !imageUrl) {
      setStatus('Image title and source URL are required.');
      return;
    }
    const next = {
      ...settings,
      template_overrides: {
        ...(settings.template_overrides || {}),
        [templateEditor.id]: {
          title,
          imageUrl,
          recommendedTextPosition: templateEditor.recommendedTextPosition,
        },
      },
    };
    if (await saveSettings(next, `${title} updated.`)) setTemplateEditor(null);
  };

  const hideTemplate = async (template) => {
    if (!window.confirm(`Remove ${template.title} from BibleVerseMerch?`)) return;
    const next = {
      ...settings,
      hidden_template_ids: [...new Set([
        ...(settings.hidden_template_ids || []),
        template.id,
      ])],
    };
    await saveSettings(next, `${template.title} removed from BibleVerseMerch.`);
  };

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
        <h1>Store Dashboard</h1>
        <span>Manage BibleVerseMerch without sharing data with another ScreenMerch storefront.</span>
      </header>

      <nav className="bvm-dashboard-tabs" aria-label="Bible Verse Merch dashboard sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'is-active' : ''}
            onClick={() => {
              setActiveTab(id);
              setStatus('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {status ? <p className="bvm-dashboard-status" role="status">{status}</p> : null}

      {activeTab === 'content' ? (
        <>
          <section className="bvm-dashboard-panel">
            <div className="bvm-dashboard-panel-heading">
              <div>
                <h2>Image templates</h2>
                <p>{availableTemplates.length} available BibleVerseMerch artwork templates.</p>
              </div>
              <button type="button" onClick={() => navigate('/tools')}>Open Tools</button>
            </div>
            <div className="bvm-dashboard-template-grid">
              {availableTemplates.map((template) => (
                <article key={template.id}>
                  <img src={template.imageUrl} alt="" />
                  <strong>{template.title}</strong>
                  <span>{template.recommendedTextPosition} text placement</span>
                  <div>
                    <button type="button" onClick={() => setTemplateEditor({
                      id: template.id,
                      title: template.title,
                      imageUrl: template.imageUrl,
                      recommendedTextPosition: template.recommendedTextPosition,
                    })}>
                      Edit
                    </button>
                    <button type="button" className="secondary" onClick={() => hideTemplate(template)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {templateEditor ? (
              <div className="bvm-dashboard-editor">
                <h3>Edit image</h3>
                <label>
                  Image title
                  <input
                    value={templateEditor.title}
                    onChange={(event) => setTemplateEditor({ ...templateEditor, title: event.target.value })}
                  />
                </label>
                <label>
                  Image source URL
                  <input
                    value={templateEditor.imageUrl}
                    onChange={(event) => setTemplateEditor({ ...templateEditor, imageUrl: event.target.value })}
                  />
                </label>
                <label>
                  Recommended text placement
                  <select
                    value={templateEditor.recommendedTextPosition}
                    onChange={(event) => setTemplateEditor({
                      ...templateEditor,
                      recommendedTextPosition: event.target.value,
                    })}
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </label>
                <div>
                  <button type="button" disabled={saving} onClick={saveTemplateEdit}>Save Image</button>
                  <button type="button" className="secondary" onClick={() => setTemplateEditor(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="bvm-dashboard-panel">
            <div className="bvm-dashboard-panel-heading">
              <div>
                <h2>Verse library</h2>
                <p>Edit built-in verses or add new entries for the storefront and Tools.</p>
              </div>
              <button
                type="button"
                onClick={() => setVerseEditor({ id: '', reference: '', text: '', highlight: '' })}
              >
                Add Verse
              </button>
            </div>
            <div className="bvm-dashboard-list">
              {verses.map((verse) => (
                <div key={verse.id} className="bvm-dashboard-row">
                  <span>
                    <strong>{verse.reference}</strong>
                    <small>{verse.text}</small>
                  </span>
                  <button type="button" onClick={() => setVerseEditor({
                    id: verse.id,
                    reference: verse.reference || '',
                    text: verse.text || '',
                    highlight: verse.highlight || '',
                  })}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
            {verseEditor ? (
              <div className="bvm-dashboard-editor">
                <h3>{verseEditor.id ? 'Edit verse' : 'Add verse'}</h3>
                <label>
                  Reference
                  <input
                    value={verseEditor.reference}
                    maxLength={120}
                    onChange={(event) => setVerseEditor({ ...verseEditor, reference: event.target.value })}
                  />
                </label>
                <label>
                  Complete verse
                  <textarea
                    rows={5}
                    value={verseEditor.text}
                    maxLength={1200}
                    onChange={(event) => setVerseEditor({ ...verseEditor, text: event.target.value })}
                  />
                </label>
                <label>
                  Highlighted phrase
                  <input
                    value={verseEditor.highlight}
                    maxLength={300}
                    onChange={(event) => setVerseEditor({ ...verseEditor, highlight: event.target.value })}
                  />
                </label>
                <div>
                  <button type="button" disabled={saving} onClick={saveVerse}>Save Verse</button>
                  <button type="button" className="secondary" onClick={() => setVerseEditor(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {activeTab === 'analytics' ? (
        <>
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
        </>
      ) : null}

      {activeTab === 'personalization' ? (
        <section className="bvm-dashboard-panel">
          <h2>Storefront personalization</h2>
          <p className="bvm-dashboard-empty">These settings apply only to BibleVerseMerch.</p>
          <div className="bvm-dashboard-editor">
            <label>
              Store name
              <input
                value={settings.display_name}
                maxLength={120}
                onChange={(event) => setSettings({ ...settings, display_name: event.target.value })}
              />
            </label>
            <label>
              Logo URL
              <input
                value={settings.custom_logo_url}
                onChange={(event) => setSettings({ ...settings, custom_logo_url: event.target.value })}
              />
            </label>
            <div className="bvm-dashboard-color-row">
              <label>
                Header color one
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(event) => setSettings({ ...settings, primary_color: event.target.value })}
                />
              </label>
              <label>
                Header color two
                <input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(event) => setSettings({ ...settings, secondary_color: event.target.value })}
                />
              </label>
            </div>
            <label>
              Header opacity: {settings.header_opacity}%
              <input
                type="range"
                min="0"
                max="100"
                value={settings.header_opacity}
                onChange={(event) => setSettings({ ...settings, header_opacity: Number(event.target.value) })}
              />
            </label>
            <button type="button" disabled={saving} onClick={() => saveSettings(settings, 'Personalization saved. Refresh the storefront to see it.')}>
              {saving ? 'Saving…' : 'Save Personalization'}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'churches' ? (
        <section className="bvm-dashboard-panel">
          <h2>Church co-creators</h2>
          <p className="bvm-dashboard-empty">
            Maintain the church access list here. Storefront publishing access remains administrator-controlled.
          </p>
          <div className="bvm-dashboard-inline-form">
            <input
              value={churchDraft.name}
              onChange={(event) => setChurchDraft({ ...churchDraft, name: event.target.value })}
              placeholder="Church or ministry name"
            />
            <input
              type="email"
              value={churchDraft.email}
              onChange={(event) => setChurchDraft({ ...churchDraft, email: event.target.value })}
              placeholder="Contact email"
            />
            <button type="button" onClick={addChurch}>Add</button>
          </div>
          <div className="bvm-dashboard-list">
            {(settings.co_creators || []).map((church) => (
              <div key={church.id || church.email} className="bvm-dashboard-row">
                <span>
                  <strong>{church.name}</strong>
                  <small>{church.email} · Whitelisted</small>
                </span>
                <button type="button" onClick={() => setSettings((current) => ({
                  ...current,
                  co_creators: current.co_creators.filter((entry) => entry.email !== church.email),
                }))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="bvm-dashboard-save-list"
            disabled={saving}
            onClick={() => saveSettings(settings, 'Church access list saved.')}
          >
            {saving ? 'Saving…' : 'Save Access List'}
          </button>
        </section>
      ) : null}

      {activeTab === 'store' ? (
        <section className="bvm-dashboard-panel">
          <h2>Store and payouts</h2>
          <div className="bvm-dashboard-store-setting">
            <div>
              <strong>Customer purchases</strong>
              <span>Allow shoppers to complete Stripe checkout on this storefront.</span>
            </div>
            <label className="bvm-dashboard-switch">
              <input
                type="checkbox"
                checked={Boolean(settings.checkout_enabled)}
                onChange={(event) => setSettings({ ...settings, checkout_enabled: event.target.checked })}
              />
              {settings.checkout_enabled ? 'Active' : 'Paused'}
            </label>
          </div>
          <div className="bvm-dashboard-store-setting">
            <div>
              <strong>Payout handling</strong>
              <span>{settings.payout_note}</span>
            </div>
            <span className="bvm-dashboard-badge">Platform owned</span>
          </div>
          <button type="button" disabled={saving} onClick={() => saveSettings(settings, 'Store settings saved.')}>
            {saving ? 'Saving…' : 'Save Store Settings'}
          </button>
        </section>
      ) : null}
    </main>
  );
}
