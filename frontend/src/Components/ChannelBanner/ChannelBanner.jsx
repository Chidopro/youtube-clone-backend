import React from 'react';
import './ChannelBanner.css';

const ChannelBanner = ({
  coverImageUrl,
  avatarUrl,
  displayName,
  username,
  bio,
  showEditIcons = false,
  onEditCover,
  onEditAvatar,
  onBeAFriend,
  isRequesting,
  friendRequestStatus
}) => (
  <div className="channel-header">
    <div className="channel-cover-container">
      <img className="channel-cover-photo" src={coverImageUrl} alt="Channel Cover" />
      {showEditIcons && (
        <button className="corner-edit-icon cover-edit" onClick={onEditCover} title="Edit cover image">✏️</button>
      )}
      <div className="channel-info-overlay">
        <div className="channel-avatar-container">
          <img className="channel-avatar" src={avatarUrl} alt="Channel Avatar" />
          {showEditIcons && (
            <button className="corner-edit-icon avatar-edit" onClick={onEditAvatar} title="Edit avatar">✏️</button>
          )}
        </div>
        <div className="channel-details">
          <h1 className="channel-name">{displayName}</h1>
          <p className="channel-username">@{username}</p>
          {bio && <p className="channel-bio">{bio}</p>}
          {onBeAFriend && (
            <button className="be-a-friend-btn" onClick={onBeAFriend} disabled={isRequesting}>
              {isRequesting ? 'Requesting...' : 'Be A FRIEND'}
            </button>
          )}
          {friendRequestStatus === 'pending' && (
            <div style={{ color: '#ffc107', marginTop: 8 }}>You have already applied. Please wait for approval.</div>
          )}
          {friendRequestStatus === 'already_friend' && (
            <div style={{ color: '#28a745', marginTop: 8 }}>You are already friends with this channel!</div>
          )}
          {friendRequestStatus === 'success' && (
            <div style={{ color: '#28a745', marginTop: 8 }}>Request sent! The channel owner will review your application.</div>
          )}
          {friendRequestStatus === 'error' && (
            <div style={{ color: '#dc3545', marginTop: 8 }}>Failed to send request. Please try again.</div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default ChannelBanner; 