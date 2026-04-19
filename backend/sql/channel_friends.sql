-- Umbrella / channel friends: pending approvals before subscriptions row exists.
-- Apply in Supabase SQL editor or via migration tooling.

create table if not exists public.channel_friends (
  id uuid primary key default gen_random_uuid(),
  channel_owner_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  invited_by text not null default 'creator' check (invited_by in ('creator', 'friend')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_owner_id, friend_id)
);

create index if not exists channel_friends_friend_id_idx on public.channel_friends (friend_id);
create index if not exists channel_friends_owner_status_idx on public.channel_friends (channel_owner_id, status);

comment on table public.channel_friends is 'Umbrella network: pending/approved/rejected links between creator and friend; subscriptions row added on approve only.';
