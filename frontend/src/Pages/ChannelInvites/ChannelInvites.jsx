import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChannelInvites.css';
import { channelFriendsJson } from '../../utils/channelFriendsApi';

const ChannelInvites = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creatorInvites, setCreatorInvites] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [requestIdentifier, setRequestIdentifier] = useState('');
  const [requestMsg, setRequestMsg] = useState({ type: '', text: '' });
  const [actionBusy, setActionBusy] = useState(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/inbox', { method: 'GET' });
      if (!ok) {
        if (data?.error?.includes?.('Authentication') || data?.error === 'Forbidden') {
          navigate('/login');
          return;
        }
        setRequestMsg({ type: 'error', text: data?.error || 'Could not load invites' });
        return;
      }
      setCreatorInvites(data.creator_invites || []);
      setFriendRequests(data.friend_requests || []);
    } catch (e) {
      setRequestMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) {
      navigate('/login');
      return;
    }
    loadInbox();
  }, [navigate, loadInbox]);

  const respond = async (channelOwnerId, friendId, action) => {
    const key = `${channelOwnerId}-${friendId}-${action}`;
    setActionBusy(key);
    setRequestMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/respond', {
        method: 'POST',
        body: JSON.stringify({ channel_owner_id: channelOwnerId, friend_id: friendId, action }),
      });
      if (!ok) {
        setRequestMsg({ type: 'error', text: data?.error || 'Request failed' });
        return;
      }
      await loadInbox();
    } catch (e) {
      setRequestMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setActionBusy(null);
    }
  };

  const submitJoinRequest = async (e) => {
    e.preventDefault();
    setRequestMsg({ type: '', text: '' });
    try {
      const { ok, data } = await channelFriendsJson('/api/channel-friends/request', {
        method: 'POST',
        body: JSON.stringify({ channel_username_or_email: requestIdentifier.trim() }),
      });
      if (!ok) {
        setRequestMsg({ type: 'error', text: data?.error || 'Request failed' });
        return;
      }
      setRequestMsg({ type: 'ok', text: data.message || 'Request sent.' });
      setRequestIdentifier('');
      await loadInbox();
    } catch (err) {
      setRequestMsg({ type: 'error', text: err.message || 'Network error' });
    }
  };

  const labelFor = (u) => u?.display_name || u?.username || 'User';

  return (
    <div className="channel-invites-page">
      <h1>Channel invites</h1>
      <p className="sub">
        Accept umbrella invites from creators, respond to join requests for your channel, or ask to join a creator&apos;s network.
      </p>

      {requestMsg.text ? (
        <p className={`channel-invites-msg ${requestMsg.type}`}>{requestMsg.text}</p>
      ) : null}

      <section className="channel-invites-section">
        <h2>Ask to join a creator</h2>
        <p className="sub" style={{ marginBottom: 8 }}>
          Enter the creator&apos;s ScreenMerch username or email. They must accept before you appear on their channel.
        </p>
        <form className="channel-invites-form" onSubmit={submitJoinRequest}>
          <input
            type="text"
            placeholder="Username or email"
            value={requestIdentifier}
            onChange={(ev) => setRequestIdentifier(ev.target.value)}
            autoComplete="username"
          />
          <button type="submit" disabled={!requestIdentifier.trim()}>
            Send request
          </button>
        </form>
      </section>

      <section className="channel-invites-section">
        <h2>Invites to you</h2>
        {loading ? <p>Loading…</p> : null}
        {!loading && creatorInvites.length === 0 ? <p className="sub">No pending invites.</p> : null}
        {creatorInvites.map((row) => {
          const owner = row.user;
          const busyA = actionBusy === `${row.channel_owner_id}-${row.friend_id}-accept`;
          const busyR = actionBusy === `${row.channel_owner_id}-${row.friend_id}-reject`;
          return (
            <div key={row.id} className="channel-invites-card">
              <div className="meta">
                <strong>{labelFor(owner)}</strong> invited you to their umbrella network.
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn-accept"
                  disabled={busyA || busyR}
                  onClick={() => respond(row.channel_owner_id, row.friend_id, 'accept')}
                >
                  {busyA ? '…' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  disabled={busyA || busyR}
                  onClick={() => respond(row.channel_owner_id, row.friend_id, 'reject')}
                >
                  {busyR ? '…' : 'Decline'}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="channel-invites-section">
        <h2>Join requests (your channel)</h2>
        {!loading && friendRequests.length === 0 ? <p className="sub">No pending requests.</p> : null}
        {friendRequests.map((row) => {
          const friend = row.user;
          const busyA = actionBusy === `${row.channel_owner_id}-${row.friend_id}-accept`;
          const busyR = actionBusy === `${row.channel_owner_id}-${row.friend_id}-reject`;
          return (
            <div key={row.id} className="channel-invites-card">
              <div className="meta">
                <strong>{labelFor(friend)}</strong> asked to join your umbrella network.
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn-accept"
                  disabled={busyA || busyR}
                  onClick={() => respond(row.channel_owner_id, row.friend_id, 'accept')}
                >
                  {busyA ? '…' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  disabled={busyA || busyR}
                  onClick={() => respond(row.channel_owner_id, row.friend_id, 'reject')}
                >
                  {busyR ? '…' : 'Decline'}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default ChannelInvites;
