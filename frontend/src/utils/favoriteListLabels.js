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

/** Sidebar / hamburger menu label — use saved page nickname, not email name */
export function favoriteListSidebarLabel(list, storefrontOwnerId) {
  if (!list) return 'Favorites';
  if (list.is_primary || list.slug === 'owner') return 'Main Favorites';
  const raw = list.display_name || list.slug || '';
  const nick = cleanFavoriteListNickname(raw);
  if (!nick || /@/.test(nick)) {
    return favoriteListPageHeading(list, storefrontOwnerId);
  }
  return /favorites$/i.test(nick) ? nick : `${nick} Favorites`;
}

/** Page heading below the banner */
export function favoriteListPageHeading(list, storefrontOwnerId) {
  if (!list) return 'Favorites';
  if (list.is_primary || list.slug === 'owner') return 'Main Favorites';
  if (isCollaboratorFavoriteList(list, storefrontOwnerId)) {
    const nick = cleanFavoriteListNickname(list.display_name);
    return nick ? `${nick} Favorites` : 'Favorites';
  }
  const name = cleanFavoriteListNickname(list.display_name) || list.display_name;
  return name ? `${name} Favorites` : 'Favorites';
}
