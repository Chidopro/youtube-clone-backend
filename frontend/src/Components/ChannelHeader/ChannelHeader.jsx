import React from 'react';
import './ChannelHeader.css';
import './ChannelHeaderShared.css';

const ChannelHeader = ({
  coverImageUrl,
  avatarUrl,
  displayName,
  username,
  bio,
  canEdit = false,
  onEditCover,
  onEditAvatar
}) => (
  <div className="channel-header">
    <div className="channel-cover-container">
      <img className="channel-cover-photo" src={coverImageUrl} alt="Channel Cover" />
      {canEdit && (
        <button className="corner-edit-icon cover-edit" onClick={onEditCover} title="Edit cover image">✏️</button>
      )}
      <div className="channel-info-overlay">
        <div className="channel-avatar-container">
          <img className="channel-avatar" src={avatarUrl} alt="Channel Avatar" />
          {canEdit && (
            <button className="corner-edit-icon avatar-edit" onClick={onEditAvatar} title="Edit avatar">✏️</button>
          )}
        </div>
        <div className="channel-details">
          <h1 className="channel-name">{displayName}</h1>
          <p className="channel-username">@{username}</p>
          {bio && <p className="channel-bio">{bio}</p>}

        </div>
      </div>
    </div>
  </div>
);

export default ChannelHeader; 