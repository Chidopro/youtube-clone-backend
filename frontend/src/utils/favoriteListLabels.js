/** Strip internal suffixes from favorite list display names. */
export function cleanFavoriteListNickname(raw) {
  return (raw || '')
    .replace(/\s*\(owner\)\s*/gi, ' ')
    .replace(/\s*—?\s*collaborator\s*page\s*/gi, ' ')
    .replace(/\s*Favorites\s*$/i, '')
    .trim();
}

export function isCollaboratorFavoriteList(list, storefrontOwnerId) {
  if (!list?.owner_user_id || !storefrontOwnerId) return false;
  return String(list.owner_user_id) !== String(storefrontOwnerId);
}

/** Sidebar / hamburger menu label — page nickname */
export function favoriteListSidebarLabel(list, storefrontOwnerId) {
  if (!list) return 'My Page';
  if (list.is_primary || list.slug === 'owner') return 'My Page';
  const raw = list.display_name || list.slug || '';
  const nick = cleanFavoriteListNickname(raw);
  if (nick && !/@/.test(nick)) return nick;
  return friendPageLabel(list, storefrontOwnerId);
}

/** Page heading — owner: My Page; collaborator pages: nickname only */
export function favoriteListPageHeading(list, storefrontOwnerId) {
  if (!list) return 'My Page';
  if (list.is_primary || list.slug === 'owner') return 'My Page';
  if (isCollaboratorFavoriteList(list, storefrontOwnerId)) {
    const nick = cleanFavoriteListNickname(list.display_name);
    return nick || 'Page';
  }
  const name = cleanFavoriteListNickname(list.display_name) || list.display_name;
  return name || 'Page';
}

/** Public label for a friend / umbrella page (no "Favorites" suffix). */
export function friendPageLabel(list, storefrontOwnerId) {
  if (!list) return 'Friend';
  if (list.is_primary || list.slug === 'owner') return 'My Page';
  const nick = cleanFavoriteListNickname(list.display_name || list.slug || '');
  if (nick && !/@/.test(nick)) return nick;
  return 'Friend';
}
