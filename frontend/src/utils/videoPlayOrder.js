/** Creator play order: display_order first (0 = plays first), then newest. */

export function sortVideosForPlay(list) {
  const rows = Array.isArray(list) ? [...list] : [];
  const hasOrder = rows.some((v) => v && v.display_order != null && v.display_order !== '');
  if (!hasOrder) {
    return rows.sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));
  }
  return rows.sort((a, b) => {
    const aMissing = a?.display_order == null || a.display_order === '';
    const bMissing = b?.display_order == null || b.display_order === '';
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (!aMissing && Number(a.display_order) !== Number(b.display_order)) {
      return Number(a.display_order) - Number(b.display_order);
    }
    return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
  });
}

export function moveItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list)) return [];
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  if (fromIndex >= list.length || toIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
