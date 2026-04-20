-- Replace ON DELETE CASCADE with SET NULL on creator_favorites.list_id.
-- Run in Supabase SQL Editor (plain statements — no DO block).
-- If step 1 does not drop anything, your FK may use another name: run the SELECT at the bottom,
-- then DROP CONSTRAINT that name manually before step 2.

ALTER TABLE public.creator_favorites
  DROP CONSTRAINT IF EXISTS creator_favorites_list_id_fkey;

ALTER TABLE public.creator_favorites
  ADD CONSTRAINT creator_favorites_list_id_fkey
  FOREIGN KEY (list_id)
  REFERENCES public.creator_favorite_lists (id)
  ON DELETE SET NULL;

-- If ADD CONSTRAINT fails with "already exists", the FK is already correct — you can stop.
-- If DROP did nothing and ADD fails "relation already exists" with wrong ON DELETE, find the name:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.creator_favorites'::regclass AND contype = 'f';
