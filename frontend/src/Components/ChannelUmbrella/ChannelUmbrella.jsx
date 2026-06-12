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
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [salesByList, setSalesByList] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState('');

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
        if (ep.length > 0 && ep[0].invite_url) {
          setLastInviteUrl((prev) => prev || ep[0].invite_url);
        }
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
    let cancelled = false;
    (async () => {
      setSalesLoading(true);
      setSalesError('');
      try {
        const { ok, data } = await favoriteListsJson('/api/favorite-lists/sales-summary');
        if (cancelled) return;
        if (!ok) {
          setSalesError(data?.error || 'Could not load sales by favorite page');
          setSalesByList([]);
        } else {
          setSalesByList(data?.by_list || []);
        }
      } catch (e) {
        if (!cancelled) setSalesError(e.message || 'Network error');
      } finally {
        if (!cancelled) setSalesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (data.invite_url) {
        setLastInviteUrl(data.invite_url);
      } else {
        setLastInviteUrl('');
      }
      setMsg({
        type: 'ok',
        text: data.message || (data.email_invite
          ? 'Email invite created. Copy the link below and send it to your collaborator.'
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
      {lastInviteUrl ? (
        <div className="channel-umbrella-invite-url">
          <p className="hint">Share this join link with your collaborator:</p>
          <input type="text" readOnly value={lastInviteUrl} aria-label="Invite link" />
          <button type="button" onClick={() => copyInviteUrl(lastInviteUrl)}>Copy link</button>
        </div>
      ) : null}

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
          Sales by favorite page
        </h2>
        <p className="hint">
          Orders are attributed to the public favorite page the buyer had open when they checked out (owner page first, then collaborator pages below).
        </p>
        {salesLoading ? <p>Loading…</p> : null}
        {salesError ? <p className="channel-umbrella-msg error">{salesError}</p> : null}
        {!salesLoading && !salesError && salesByList.length === 0 ? (
          <p className="hint">No orders yet, or order data has no list attribution.</p>
        ) : null}
        {!salesLoading && !salesError && salesByList.length > 0 ? (
          <table className="channel-umbrella-sales-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Slug</th>
                <th>Orders</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {salesByList.map((row) => (
                <tr key={String(row.favorite_list_id ?? row.slug ?? row.display_name)}>
                  <td>{row.display_name || '—'}</td>
                  <td>{row.slug || '—'}</td>
                  <td>{row.order_count}</td>
                  <td>${Number(row.total_amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
};

export default ChannelUmbrella;
