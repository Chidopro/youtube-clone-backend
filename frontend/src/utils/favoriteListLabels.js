/** Strip internal suffixes from favorite list display names. */
export function cleanFavoriteListNickname(raw) {
  return (raw || '')
    .replace(/\s*\(owner\)\s*/gi, ' ')
    .replace(/\s*—?\s*collaborator\s*page\s*/gi, ' ')
    .replace(/\s*Favorites\s*$/i, '')
    .trim();
}

const GENERIC_FRIEND_NAMES = new Set([
  'collaborator',
  'friend',
  'member',
  'page',
  'umbrella',
  'creator',
  'co-creator',
  'co creator',
]);

export function isGenericFriendName(name) {
  const n = (name || '').trim().toLowerCase();
  return !n || GENERIC_FRIEND_NAMES.has(n);
}

export function isCollaboratorFavoriteList(list, storefrontOwnerId) {
  if (list?.is_collaborator_page) return true;
  if (!list?.owner_user_id || !storefrontOwnerId) return false;
  return String(list.owner_user_id) !== String(storefrontOwnerId);
}

/** Hamburger / Home: Creator + co-creator pages only. Extra owner pages stay on Creator. */
export function isStorefrontNavList(list, storefrontOwnerId) {
  if (!list) return false;
  if (list.is_primary || list.slug === 'owner' || list.is_collaborator_page) return true;
  return isCollaboratorFavoriteList(list, storefrontOwnerId);
}

function publicFriendNickname(list) {
  if (!list) return '';
  const candidates = [list.member_label, list.display_name, list.slug];
  for (const raw of candidates) {
    const nick = cleanFavoriteListNickname(raw);
    if (nick && !/@/.test(nick) && !isGenericFriendName(nick)) return nick;
  }
  return '';
}

/** Sidebar / hamburger menu label — page nickname */
export function favoriteListSidebarLabel(list, storefrontOwnerId) {
  if (!list) return 'Creator';
  if (list.is_primary || list.slug === 'owner') return 'Creator';
  const raw = list.display_name || list.slug || '';
  const nick = cleanFavoriteListNickname(raw);
  if (nick && !/@/.test(nick) && !isGenericFriendName(nick)) return nick;
  return friendPageLabel(list, storefrontOwnerId);
}

/** Page heading — owner: Creator; collaborator pages: nickname only */
export function favoriteListPageHeading(list, storefrontOwnerId) {
  if (!list) return 'Creator';
  if (list.is_primary || list.slug === 'owner') return 'Creator';
  if (isCollaboratorFavoriteList(list, storefrontOwnerId)) {
    return publicFriendNickname(list) || 'Co-Creator';
  }
  const name = cleanFavoriteListNickname(list.display_name) || list.display_name;
  return name || 'Page';
}

/** Public label for a friend / umbrella page (no "Favorites" suffix). */
export function friendPageLabel(list, storefrontOwnerId) {
  if (!list) return 'Co-Creator';
  if (list.is_primary || list.slug === 'owner') return 'Creator';
  return publicFriendNickname(list) || 'Co-Creator';
}

/** Owner dashboard payout heading: "Collaborator Gee". */
export function collaboratorPayoutHeading(list) {
  const nick = cleanFavoriteListNickname(
    list?.member_label || list?.display_name || list?.slug || ''
  ).replace(/^collaborator\s+/i, '');
  if (!nick || isGenericFriendName(nick)) return 'Collaborator';
  return `Collaborator ${nick}`;
}
