import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { channelFriendsJson } from '../../utils/channelFriendsApi';
import { favoriteListsJson } from '../../utils/favoriteListsApi';
import { fetchMyProfileFromBackend } from '../../utils/userService';
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

const todayInputDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ChannelUmbrella = () => {
  const [inviteInput, setInviteInput] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [pending, setPending] = useState([]);
  const [emailPending, setEmailPending] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ownerSubdomain, setOwnerSubdomain] = useState('');
  const [busyCancel, setBusyCancel] = useState(null);
  const [salesByList, setSalesByList] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState('');
  const [collaboratorOwedTotal, setCollaboratorOwedTotal] = useState(0);
  const [ownerSummary, setOwnerSummary] = useState(null);
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutModal, setPayoutModal] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(todayInputDate());
  const [payoutNoteInput, setPayoutNoteInput] = useState('');
  const [recordingPayout, setRecordingPayout] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({});

  const loadSalesSummary = useCallback(async () => {
    setSalesLoading(true);
    setSalesError('');
    try {
      const { ok, data } = await favoriteListsJson('/api/favorite-lists/sales-summary');
      if (!ok) {
        setSalesError(data?.error || 'Could not load attributed earnings');
        setSalesByList([]);
        setCollaboratorOwedTotal(0);
        setOwnerSummary(null);
      } else {
        setSalesByList(data?.by_list || []);
        setCollaboratorOwedTotal(Number(data?.collaborator_owed_total || 0));
        setOwnerSummary(data?.storefront_owner_summary || null);
        setPayoutNote(data?.payout_note || '');
      }
    } catch (e) {
      setSalesError(e.message || 'Network error');
    } finally {
      setSalesLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
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
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
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

  const openPayoutModal = (row) => {
    const balance = Number(row.balance_owed ?? 0);
    setPayoutModal(row);
    setPayoutAmount(balance > 0 ? balance.toFixed(2) : '');
    setPayoutDate(todayInputDate());
    setPayoutNoteInput('');
  };

  const closePayoutModal = () => {
    if (recordingPayout) return;
    setPayoutModal(null);
  };

  const submitPayout = async (e) => {
    e.preventDefault();
    if (!payoutModal?.favorite_list_id) return;
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) {
      setMsg({ type: 'error', text: 'Enter a payment amount greater than zero.' });
      return;
    }
    if (amount < 50) {
      setMsg({ type: 'error', text: 'Minimum collaborator payout is $50.' });
      return;
    }
    setRecordingPayout(true);
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await favoriteListsJson('/api/favorite-lists/record-collaborator-payout', {
        method: 'POST',
        body: JSON.stringify({
          favorite_list_id: payoutModal.favorite_list_id,
          amount,
          paid_at: payoutDate,
          note: payoutNoteInput.trim() || undefined,
        }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Could not record payment' });
        return;
      }
      setMsg({
        type: 'ok',
        text: `Recorded $${amount.toFixed(2)} paid to ${payoutModal.display_name || 'collaborator'} on ${formatPaidDate(payoutDate)}.`,
      });
      setPayoutModal(null);
      await loadSalesSummary();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setRecordingPayout(false);
    }
  };

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
          ? 'Email invite created. Copy the join link from Pending invites below and send it to your collaborator.'
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

  return (
    <div className="channel-umbrella">
      <section className="channel-umbrella-section" aria-labelledby="umbrella-collab-heading">
        <h2 id="umbrella-collab-heading" className="channel-umbrella-section-title">
          Collaborators
        </h2>
        <p className="hint">
          Invite by <strong>email</strong> to get a join link you copy and send (works for new and existing accounts).
          Invite by <strong>username</strong> only if they already use ScreenMerch — they accept under{' '}
          <Link to="/channel-invites">Channel invites</Link> (profile menu → Channel invites).
          We do not email the link automatically. FrameSnag on YouTube stays with you as the storefront owner.
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
        />
        <button type="submit" disabled={!inviteInput.trim() || submitting}>
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
      {!loading && members.length === 0 ? <p className="hint">No approved umbrella members yet.</p> : null}
      {members.map((row) => (
        <div key={row.id} className="channel-umbrella-row">
          <div className="channel-umbrella-row-main">
            <span className="channel-umbrella-row-label">{pendingAccountLabel(row) || 'Member'}</span>
          </div>
        </div>
      ))}
      </section>

      <section className="channel-umbrella-section" aria-labelledby="umbrella-sales-heading">
        <h2 id="umbrella-sales-heading" className="channel-umbrella-section-title">
          Payout summary
        </h2>
        {payoutNote ? <p className="hint umbrella-payout-note">{payoutNote}</p> : null}
        {ownerSummary && Number(ownerSummary.net_amount || 0) > 0 ? (
          <div className="umbrella-owner-payout-card">
            <h3 className="channel-umbrella-subheading">Your storefront (paid by ScreenMerch)</h3>
            <p className="hint">
              Net earnings from sales on your storefront (not attributed to an umbrella page):{' '}
              <strong>${Number(ownerSummary.net_amount || 0).toFixed(2)}</strong>
            </p>
          </div>
        ) : null}
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
            <h3 className="channel-umbrella-subheading">Umbrella collaborators (you pay monthly)</h3>
          <div className="umbrella-earnings-table-wrap">
          <table className="channel-umbrella-earnings-table">
            <thead>
              <tr>
                <th className="col-page">Page</th>
                <th className="col-num">Items</th>
                <th className="col-num">Gross</th>
                <th className="col-num">Platform fee</th>
                <th className="col-num">Merch cost</th>
                <th className="col-num">Pay collaborator</th>
                <th className="col-num">Balance owed</th>
                <th className="col-action">Confirm payment</th>
              </tr>
            </thead>
            <tbody>
              {salesByList.map((row) => {
                const balance = Number(row.balance_owed ?? 0);
                const gross = Number(row.gross_amount ?? row.total_amount ?? 0);
                const fee = Number(row.platform_fee_amount ?? 0);
                const merchCost = Number(row.merch_cost_amount ?? row.net_amount ?? 0);
                const payCollab = Number(row.pay_collaborator_amount ?? 0);
                const lastPaid = row.last_payout;
                const history = row.recent_payouts || [];
                const listKey = String(row.favorite_list_id ?? row.display_name);
                const canRecord = row.can_record_payout ?? (payCollab > 0 && balance >= 50);
                const isPaidUp = row.is_paid_up ?? (payCollab > 0 && balance <= 0);
                return (
                  <React.Fragment key={listKey}>
                  <tr className="umbrella-row-collaborator">
                    <td className="col-page">{row.display_name || '—'}</td>
                    <td className="col-num">{row.order_count}</td>
                    <td className="col-num">${gross.toFixed(2)}</td>
                    <td className="col-num">${fee.toFixed(2)}</td>
                    <td className="col-num">${merchCost.toFixed(2)}</td>
                    <td className="col-num col-pay">${payCollab.toFixed(2)}</td>
                    <td className="col-num">
                      {payCollab <= 0 ? (
                        <span className="umbrella-amount-zero">$0.00</span>
                      ) : isPaidUp ? (
                        <span className="umbrella-balance-paid">Paid up ✓</span>
                      ) : balance > 0 ? (
                        <span className="umbrella-balance-owed">${balance.toFixed(2)}</span>
                      ) : (
                        <span className="umbrella-amount-zero">$0.00</span>
                      )}
                    </td>
                    <td className="col-action">
                      {canRecord ? (
                        <button
                          type="button"
                          className="btn-record-payout"
                          onClick={() => openPayoutModal(row)}
                        >
                          Confirm payment + date
                        </button>
                      ) : (
                        <span className="hint-inline">—</span>
                      )}
                    </td>
                  </tr>
                  {(lastPaid || history.length > 0) ? (
                    <tr className="umbrella-row-payout-meta">
                      <td colSpan={8}>
                        {lastPaid ? (
                          <span className="umbrella-last-paid">
                            Last paid ${Number(lastPaid.amount || 0).toFixed(2)} on {formatPaidDate(lastPaid.paid_at)}
                            {lastPaid.note ? ` · ${lastPaid.note}` : ''}
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
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
          </>
        ) : null}
      </section>

      {payoutModal ? (
        <div className="umbrella-payout-modal-backdrop" onClick={closePayoutModal} role="presentation">
          <div
            className="umbrella-payout-modal"
            role="dialog"
            aria-labelledby="record-payout-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 id="record-payout-title">Confirm payment + date</h3>
            <p className="hint">
              Confirm you paid <strong>{payoutModal.display_name || 'collaborator'}</strong> off-platform.
            </p>
            <form onSubmit={submitPayout}>
              <label>
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(ev) => setPayoutAmount(ev.target.value)}
                  required
                />
              </label>
              <label>
                Date paid
                <input
                  type="date"
                  value={payoutDate}
                  onChange={(ev) => setPayoutDate(ev.target.value)}
                  required
                />
              </label>
              <label>
                Note (optional)
                <input
                  type="text"
                  placeholder="PayPal, Zelle, cash…"
                  value={payoutNoteInput}
                  onChange={(ev) => setPayoutNoteInput(ev.target.value)}
                />
              </label>
              <div className="umbrella-payout-modal-actions">
                <button type="button" onClick={closePayoutModal} disabled={recordingPayout}>
                  Cancel
                </button>
                <button type="submit" disabled={recordingPayout}>
                  {recordingPayout ? 'Saving…' : 'Confirm payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ChannelUmbrella;
