-- Community scan log: one row for every member post that Zoe's scan (Community Connection) or
-- Matthew's scan (Accelerator Circle) has read. Each scan reads only posts that have no row here,
-- and skips any member who already appears on an earlier card (found = true).
create table if not exists community_scan_log (
  id            uuid primary key default gen_random_uuid(),
  community     text not null check (community in ('cc', 'acc')),
  post_id       uuid not null unique,
  member_id     text not null,
  found         boolean not null default false,
  opportunities jsonb not null default '[]'::jsonb,
  scanned_at    timestamptz not null default now()
);
create index if not exists community_scan_log_member_idx on community_scan_log (community, member_id) where found;
alter table community_scan_log enable row level security;
