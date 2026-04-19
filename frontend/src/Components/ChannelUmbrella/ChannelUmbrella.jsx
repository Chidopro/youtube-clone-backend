import React, { useState, useEffect, useCallback } from 'react';
import { channelFriendsJson } from '../../utils/channelFriendsApi';
import './ChannelUmbrella.css';

const labelFor = (u) => u?.display_name || u?.username || 'User';

const ChannelUmbrella = () => {
  const [inviteInput, setInviteInput] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [pending, setPending] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyCancel, setBusyCancel] = useState(null);

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
      <p className="hint">
        Invite collaborators to your umbrella network by username or email. They must accept before the link is active.
        To remove someone after they are approved, contact ScreenMerch support. Payouts to friends are handled by you off-platform.
      </p>

      <h2>Invite by username or email</h2>
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
    </div>
  );
};

export default ChannelUmbrella;
