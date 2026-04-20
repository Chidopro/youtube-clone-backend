import React, { useState, useEffect, useCallback } from 'react';
import { channelFriendsJson } from '../../utils/channelFriendsApi';
import { favoriteListsJson } from '../../utils/favoriteListsApi';
import './ChannelUmbrella.css';

const labelFor = (u) => u?.display_name || u?.username || 'User';

const ChannelUmbrella = () => {
  const [inviteInput, setInviteInput] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [pending, setPending] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyCancel, setBusyCancel] = useState(null);
  const [salesByList, setSalesByList] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const [outRes, memRes] = await Promise.all([
        channelFriendsJson('/api/channel-friends/outgoing', { method: 'GET' }),
        channelFriendsJson('/api/channel-friends/members', { method: 'GET' }),
      ]);
      if (!outRes.ok) {
        setMsg({ type: 'error', text: outRes.data?.error || 'Could not load pending invites' });
      } else {
        setPending(outRes.data.pending || []);
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

  const sendInvite = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/invite', {
        method: 'POST',
        body: JSON.stringify({ username_or_email: inviteInput.trim() }),
      });
      if (!ok) {
        setMsg({ type: 'error', text: data?.error || 'Invite failed' });
        return;
      }
      setMsg({ type: 'ok', text: data.message || 'Invite sent.' });
      setInviteInput('');
      await refresh();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Network error' });
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

  return (
    <div className="channel-umbrella">
      <section className="channel-umbrella-section" aria-labelledby="umbrella-collab-heading">
        <h2 id="umbrella-collab-heading" className="channel-umbrella-section-title">
          Collaborators
        </h2>
        <p className="hint">
          Invite collaborators to your umbrella network by username or email. They must accept before the link is active.
          To remove someone after they are approved, contact ScreenMerch support. Payouts to friends are handled by you off-platform.
        </p>

      <h3 className="channel-umbrella-subheading">Invite by username or email</h3>
      <form className="channel-umbrella-form" onSubmit={sendInvite}>
        <input
          type="text"
          placeholder="Username or email"
          value={inviteInput}
          onChange={(ev) => setInviteInput(ev.target.value)}
          autoComplete="off"
        />
        <button type="submit" disabled={!inviteInput.trim()}>
          Send invite
        </button>
      </form>
      {msg.text ? <p className={`channel-umbrella-msg ${msg.type}`}>{msg.text}</p> : null}

      <h2>Pending invites</h2>
      {loading ? <p>Loading…</p> : null}
      {!loading && pending.length === 0 ? <p className="hint">No pending invites.</p> : null}
      {pending.map((row) => (
        <div key={row.id} className="channel-umbrella-row">
          <span>{labelFor(row.user)}</span>
          <button
            type="button"
            className="btn-cancel-invite"
            disabled={busyCancel === row.friend_id}
            onClick={() => cancelInvite(row.friend_id)}
          >
            {busyCancel === row.friend_id ? '…' : 'Cancel invite'}
          </button>
        </div>
      ))}

      <h2>Approved members</h2>
      {!loading && members.length === 0 ? <p className="hint">No approved umbrella members yet.</p> : null}
      {members.map((row) => (
        <div key={row.id} className="channel-umbrella-row">
          <span>{labelFor(row.user)}</span>
        </div>
      ))}
      </section>

      <section className="channel-umbrella-section" aria-labelledby="umbrella-sales-heading">
        <h2 id="umbrella-sales-heading" className="channel-umbrella-section-title">
          Sales by favorite page
        </h2>
        <p className="hint">
          Orders are attributed to the public favorite page the buyer had open when they checked out (main page or an extra page you created in Dashboard → Favorites).
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
