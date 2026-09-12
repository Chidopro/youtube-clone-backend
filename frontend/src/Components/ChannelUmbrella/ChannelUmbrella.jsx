import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { channelFriendsJson } from '../../utils/channelFriendsApi';
import { favoriteListsJson } from '../../utils/favoriteListsApi';
import { collaboratorPayoutHeading } from '../../utils/favoriteListLabels';
import { fetchMyProfileFromBackend } from '../../utils/userService';
import { getBackendUrl } from '../../config/apiConfig';
import './ChannelUmbrella.css';

const labelFor = (u) => {
  if (!u) return null;
  const email = (u.email || '').trim();
  if (email) return email;
  const name = (u.display_name || u.username || '').trim();
  return name || null;
};

const pendingAccountLabel = (row) => {
  const fromUser = labelFor(row?.user);
  if (fromUser) return fromUser;
  if (row?.friend_id) return `Invited user (${String(row.friend_id).slice(0, 8)}…)`;
  return 'Unknown invitee';
};

const formatPaidDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (_) {
    return String(iso);
  }
};

const ChannelUmbrella = ({ previewMode = false }) => {
  const [inviteInput, setInviteInput] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [pending, setPending] = useState([]);
  const [emailPending, setEmailPending] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ownerSubdomain, setOwnerSubdomain] = useState('');
  const [busyCancel, setBusyCancel] = useState(null);
  const [busyMember, setBusyMember] = useState(null);
  const [salesByList, setSalesByList] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState('');
  const [collaboratorOwedTotal, setCollaboratorOwedTotal] = useState(0);
  const [payoutNote, setPayoutNote] = useState('');
  const [expandedHistory, setExpandedHistory] = useState({});

  const loadSalesSummary = useCallback(async () => {
    setSalesLoading(true);
    setSalesError('');
    try {
      let ok;
      let data;
      if (previewMode) {
        const res = await fetch(`${getBackendUrl()}/api/demo/sales-summary`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        data = await res.json().catch(() => ({}));
        ok = res.ok && data?.success !== false;
      } else {
        const result = await favoriteListsJson('/api/favorite-lists/sales-summary');
        ok = result.ok;
        data = result.data;
      }
      if (!ok) {
        setSalesError(data?.error || 'Could not load attributed earnings');
        setSalesByList([]);
        setCollaboratorOwedTotal(0);
      } else {
        setSalesByList(data?.by_list || []);
        setCollaboratorOwedTotal(Number(data?.collaborator_owed_total || 0));
        setPayoutNote(
          String(data?.payout_note || '').replace(
            /paying umbrella collaborators monthly/gi,
            'paying umbrella collaborators bi-monthly'
          )
        );
      }
    } catch (e) {
      setSalesError(e.message || 'Network error');
    } finally {
      setSalesLoading(false);
    }
  }, [previewMode]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (previewMode) {
        const res = await fetch(`${getBackendUrl()}/api/demo/umbrella`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          setMsg({ type: 'error', text: data?.error || 'Could not load umbrella members' });
        } else {
          setPending(data.pending || []);
          setEmailPending(data.email_pending || []);
          setMembers(data.members || []);
          setOwnerSubdomain((data.subdomain || '').trim().toLowerCase());
        }
        return;
      }
      const [outRes, memRes] = await Promise.all([
        channelFriendsJson('/api/channel-friends/outgoing', { method: 'GET' }),
        channelFriendsJson('/api/channel-friends/members', { method: 'GET' }),
      ]);
      if (!outRes.ok) {
        setMsg({ type: 'error', text: outRes.data?.error || 'Could not load pending invites' });
      } else {
        const ep = outRes.data.email_pending || [];
        setPending(outRes.data.pending || []);
        setEmailPending(ep);
      }
      if (!memRes.ok) {
        setMsg({ type: 'error', text: memRes.data?.error || 'Could not load members' });
      } else {
        setMembers(memRes.data.members || []);
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setLoading(false);
    }
  }, [previewMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (previewMode) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem('user');
        const userId = raw ? JSON.parse(raw)?.id : null;
        if (!userId) return;
        const profile = await fetchMyProfileFromBackend(userId);
        if (!cancelled) setOwnerSubdomain((profile?.subdomain || '').trim().toLowerCase());
      } catch (_) {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadSalesSummary();
  }, [loadSalesSummary]);

  const copyInviteUrl = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMsg({ type: 'ok', text: 'Invite link copied to clipboard.' });
    } catch (_) {
      setMsg({ type: 'ok', text: url });
    }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    const ident = inviteInput.trim();
    setMsg({ type: '', text: '' });
    setSubmitting(true);
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/invite', {
        method: 'POST',
        body: JSON.stringify({ username_or_email: ident }),
      });
      if (!ok) {
        const detail = data?.error || 'Invite failed';
        const hint = detail === 'Forbidden'
          ? `Session mismatch on this subdomain — sign out, then sign in again at ${ownerSubdomain ? `${ownerSubdomain}.screenmerch.com` : 'your subdomain'}.`
          : detail;
        setMsg({ type: 'error', text: hint });
        return;
      }
      setMsg({
        type: 'ok',
        text: data.message || (data.email_invite
          ? (data.email_sent
            ? 'Invite email sent. A join link is also listed under Pending invites.'
            : 'Invite created, but email could not be sent — copy the join link below.')
          : data.existing_user
            ? 'Invite sent to an existing account. They accept under Channel invites (no join link).'
            : 'Invite sent.'),
      });
      setInviteInput('');
      await refresh();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelInvite = async (friendId) => {
    setBusyCancel(friendId);
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/cancel', {
        method: 'POST',
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Could not cancel' });
        return;
      }
      await refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setBusyCancel(null);
    }
  };

  const cancelEmailInvite = async (inviteId) => {
    setBusyCancel(inviteId);
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/cancel-email-invite', {
        method: 'POST',
        body: JSON.stringify({ invite_id: inviteId }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Could not cancel email invite' });
        return;
      }
      await refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setBusyCancel(null);
    }
  };

  const removeMember = async (friendId, label) => {
    const name = label || 'this member';
    if (
      !window.confirm(
        `Remove ${name} from your umbrella?\n\nTheir page will leave this storefront. Past sales attribution stays in your payout history.`
      )
    ) {
      return;
    }
    setBusyMember(`remove:${friendId}`);
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/remove-member', {
        method: 'POST',
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Could not remove member' });
        return;
      }
      setMsg({ type: 'ok', text: `${name} was removed from your umbrella.` });
      await refresh();
      await loadSalesSummary();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setBusyMember(null);
    }
  };

  const pauseMember = async (friendId, label) => {
    setBusyMember(`pause:${friendId}`);
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/pause-member', {
        method: 'POST',
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Could not pause member' });
        return;
      }
      setMsg({ type: 'ok', text: `${label || 'Member'} paused — their page is hidden from the storefront.` });
      await refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setBusyMember(null);
    }
  };

  const resumeMember = async (friendId, label) => {
    setBusyMember(`resume:${friendId}`);
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/resume-member', {
        method: 'POST',
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Could not resume member' });
        return;
      }
      setMsg({ type: 'ok', text: `${label || 'Member'} resumed — their page is public again.` });
      await refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setBusyMember(null);
    }
  };

  return (
    <div className="channel-umbrella">
      <section className="channel-umbrella-section" aria-labelledby="umbrella-collab-heading">
        <h2 id="umbrella-collab-heading" className="channel-umbrella-section-title">
          My Friends
        </h2>
        <p className="hint">
          Invite by <strong>email</strong> and ScreenMerch emails them a join link automatically
          (you can still copy the link under Pending invites). Invite by <strong>username</strong> only if they
          already use ScreenMerch — they accept under{' '}
          <Link to="/channel-invites">Channel invites</Link> (profile menu → Channel invites).
          FrameSnag on YouTube stays with you as the storefront owner.
        </p>
        {!ownerSubdomain ? (
          <p className="channel-umbrella-msg error">
            Set your subdomain in the <strong>Personalization</strong> tab before sending email invites. Join links require a subdomain (e.g. filialsons.screenmerch.com).
          </p>
        ) : (
          <p className="channel-umbrella-msg ok">
            Storefront subdomain: <strong>{ownerSubdomain}.screenmerch.com</strong>
          </p>
        )}

      <h3 className="channel-umbrella-subheading">Invite by username or email</h3>
      <form className="channel-umbrella-form" onSubmit={sendInvite}>
        <input
          type="text"
          placeholder="Username or email"
          value={inviteInput}
          onChange={(ev) => setInviteInput(ev.target.value)}
          autoComplete="off"
          disabled={previewMode}
        />
        <button type="submit" disabled={previewMode || !inviteInput.trim() || submitting}>
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </form>
      {msg.text ? <p className={`channel-umbrella-msg ${msg.type}`} role="alert">{msg.text}</p> : null}

      <h2>Pending invites</h2>
      {loading ? <p>Loading…</p> : null}
      {!loading && pending.length === 0 && emailPending.length === 0 ? (
        <p className="hint">No pending invites.</p>
      ) : null}
      {emailPending.map((row) => (
        <div key={row.id} className="channel-umbrella-row">
          <div className="channel-umbrella-row-main">
            <span className="channel-umbrella-row-label">{row.invited_email}</span>
            <span className="channel-umbrella-row-meta">Share join link — they sign in with this email to accept</span>
            {row.invite_url ? (
              <div className="channel-umbrella-row-link">
                <input type="text" readOnly value={row.invite_url} aria-label={`Join link for ${row.invited_email}`} />
              </div>
            ) : null}
          </div>
          <div className="channel-umbrella-row-actions">
            {row.invite_url ? (
              <button
                type="button"
                className="btn-copy-invite"
                onClick={() => copyInviteUrl(row.invite_url)}
              >
                Copy link
              </button>
            ) : null}
            <button
              type="button"
              className="btn-delete-invite"
              disabled={busyCancel === row.id}
              onClick={() => cancelEmailInvite(row.id)}
            >
              {busyCancel === row.id ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
      {pending.map((row) => (
        <div key={row.id} className="channel-umbrella-row">
          <div className="channel-umbrella-row-main">
            <span className="channel-umbrella-row-label">{pendingAccountLabel(row)}</span>
            <span className="channel-umbrella-row-meta">
              Username invite — they accept at{' '}
              <Link to="/channel-invites">Channel invites</Link> while signed in
            </span>
          </div>
          <div className="channel-umbrella-row-actions">
            <button
              type="button"
              className="btn-delete-invite"
              disabled={busyCancel === row.friend_id}
              onClick={() => cancelInvite(row.friend_id)}
            >
              {busyCancel === row.friend_id ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      ))}

      <h2>Approved members</h2>
      <p className="hint">
        Pause hides their public page without removing them. Delete removes them from your umbrella network (does not delete their ScreenMerch login).
      </p>
      {!loading && members.length === 0 ? <p className="hint">No approved umbrella members yet.</p> : null}
      {members.map((row) => {
        const label = pendingAccountLabel(row) || 'Member';
        const pageName = (row.page_name || '').trim() || 'Friend';
        const isPaused = row.status === 'paused';
        const friendId = row.friend_id;
        const busy = busyMember && String(busyMember).endsWith(`:${friendId}`);
        return (
          <div
            key={row.id}
            className={`channel-umbrella-row channel-umbrella-row--member${isPaused ? ' is-paused' : ''}`}
          >
            <div className="channel-umbrella-row-main">
              <span className="channel-umbrella-row-label">{label}</span>
              {isPaused ? (
                <span className="channel-umbrella-row-meta channel-umbrella-paused-badge">
                  Page name: {pageName} · Paused — page hidden
                </span>
              ) : (
                <span className="channel-umbrella-row-meta">Page name: {pageName}</span>
              )}
            </div>
            <div className="channel-umbrella-row-actions">
              {isPaused ? (
                <button
                  type="button"
                  className="btn-resume-member"
                  disabled={previewMode || !!busy}
                  onClick={() => resumeMember(friendId, label)}
                >
                  {busyMember === `resume:${friendId}` ? '…' : 'Resume'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-pause-member"
                  disabled={previewMode || !!busy}
                  onClick={() => pauseMember(friendId, label)}
                >
                  {busyMember === `pause:${friendId}` ? '…' : 'Pause account'}
                </button>
              )}
              <button
                type="button"
                className="btn-delete-invite"
                disabled={previewMode || !!busy}
                onClick={() => removeMember(friendId, label)}
              >
                {busyMember === `remove:${friendId}` ? '…' : 'Delete account'}
              </button>
            </div>
          </div>
        );
      })}
      </section>

      <section className="channel-umbrella-section" aria-labelledby="umbrella-sales-heading">
        <h2 id="umbrella-sales-heading" className="channel-umbrella-section-title">
          Umbrella collaborators (you pay bi-monthly)
        </h2>
        {payoutNote ? <p className="hint umbrella-payout-note">{payoutNote}</p> : null}
        {collaboratorOwedTotal > 0 ? (
          <p className="channel-umbrella-msg ok umbrella-owed-banner">
            Unpaid balance to collaborators: <strong>${collaboratorOwedTotal.toFixed(2)}</strong>
          </p>
        ) : null}
        {salesLoading ? <p>Loading…</p> : null}
        {salesError ? <p className="channel-umbrella-msg error">{salesError}</p> : null}
        {!salesLoading && !salesError && salesByList.length === 0 ? (
          <p className="hint">No umbrella collaborator sales yet.</p>
        ) : null}
        {!salesLoading && !salesError && salesByList.length > 0 ? (
          <>
            <p className="hint">
              These balances are what you owe collaborators. ScreenMerch does not pay them.
              Pay them off-platform (PayPal, Zelle, etc.), then use Record payment on Analytics to log it.
              Collaborators confirm they received it on their own analytics page.
            </p>
          <div className="umbrella-earnings-table-wrap">
          <div className="channel-umbrella-earnings-table" role="table">
            <div className="umbrella-earnings-head" role="row">
              <span className="col-page" role="columnheader">Page</span>
              <span className="col-num" role="columnheader">Items</span>
              <span className="col-num" role="columnheader">Gross</span>
              <span className="col-num" role="columnheader">Merch cost</span>
              <span className="col-num" role="columnheader" title="Pay collaborator">Collab</span>
              <span className="col-num" role="columnheader" title="Storefront fee kept from collaborator share">Fee</span>
              <span className="col-num" role="columnheader" title="Balance owed">Balance</span>
            </div>
            {salesByList.map((row) => {
                const balance = Number(row.balance_owed ?? 0);
                const gross = Number(row.gross_amount ?? row.total_amount ?? 0);
                const merchCost = Number(row.merch_cost_amount ?? row.net_amount ?? 0);
                const payCollab = Number(row.pay_collaborator_amount ?? 0);
                const lastPaid = row.last_payout;
                const history = row.recent_payouts || [];
                const listKey = String(row.favorite_list_id ?? row.display_name);
                const isPaidUp = row.is_paid_up ?? (payCollab > 0 && balance <= 0);
                return (
                  <div key={listKey} className="umbrella-earnings-group" role="rowgroup">
                  <div className="umbrella-earnings-row umbrella-row-collaborator" role="row">
                    <span className="col-page" role="cell" data-label="Page">{collaboratorPayoutHeading(row)}</span>
                    <span className="col-num" role="cell" data-label="Items">{row.order_count}</span>
                    <span className="col-num" role="cell" data-label="Gross">${gross.toFixed(2)}</span>
                    <span className="col-num" role="cell" data-label="Merch cost">${merchCost.toFixed(2)}</span>
                    <span className="col-num col-pay" role="cell" data-label="Pay collaborator">${payCollab.toFixed(2)}</span>
                    <span className="col-num" role="cell" data-label="Storefront fee">${Number(row.owner_fee_amount ?? 0).toFixed(2)}</span>
                    <span className="col-num" role="cell" data-label="Balance owed">
                      {payCollab <= 0 ? (
                        <span className="umbrella-amount-zero">$0.00</span>
                      ) : isPaidUp ? (
                        <span className="umbrella-balance-paid">Paid up ✓</span>
                      ) : balance > 0 ? (
                        <span className="umbrella-balance-owed">${balance.toFixed(2)}</span>
                      ) : (
                        <span className="umbrella-amount-zero">$0.00</span>
                      )}
                    </span>
                  </div>
                  {(lastPaid || history.length > 0) ? (
                    <div className="umbrella-row-payout-meta">
                        <div className="umbrella-last-paid-row">
                          {lastPaid ? (
                            <span className="umbrella-last-paid">
                              Last paid ${Number(lastPaid.amount || 0).toFixed(2)} on {formatPaidDate(lastPaid.paid_at)}
                              {lastPaid.note ? ` · ${lastPaid.note}` : ''}
                              {history.length > 0 ? '\u00a0' : ''}
                            </span>
                          ) : null}
                          {history.length > 0 ? (
                            <button
                              type="button"
                              className="btn-payout-history"
                              onClick={() => setExpandedHistory((prev) => ({
                                ...prev,
                                [listKey]: !prev[listKey],
                              }))}
                            >
                              {expandedHistory[listKey] ? 'Hide' : 'Show'} payment history
                            </button>
                          ) : null}
                        </div>
                        {expandedHistory[listKey] && history.length > 0 ? (
                          <ul className="umbrella-payout-history">
                            {history.map((p) => (
                              <li key={p.id || `${p.paid_at}-${p.amount}`}>
                                ${Number(p.amount || 0).toFixed(2)} on {formatPaidDate(p.paid_at)}
                                {p.note ? ` — ${p.note}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                    </div>
                  ) : null}
                  </div>
                );
              })}
          </div>
          </div>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default ChannelUmbrella;
