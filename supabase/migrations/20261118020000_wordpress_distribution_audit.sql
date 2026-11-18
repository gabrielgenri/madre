create table if not exists public.editorial_distribution_events (
  id uuid primary key default gen_random_uuid(),
  editorial_unit_id uuid not null references public.editorial_units(id) on delete restrict,
  source_version_id uuid not null references public.editorial_versions(id) on delete restrict,
  channel text not null check (channel = 'wordpress'),
  external_id text not null,
  external_url text not null,
  status text not null check (status = 'draft_created'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint editorial_distribution_events_unit_version_channel_key
    unique (editorial_unit_id, source_version_id, channel)
);

create index if not exists editorial_distribution_events_unit_created_idx
  on public.editorial_distribution_events (editorial_unit_id, created_at desc);
create index if not exists editorial_distribution_events_source_version_idx
  on public.editorial_distribution_events (source_version_id);

alter table public.editorial_distribution_events enable row level security;

revoke all on public.editorial_distribution_events from anon;
revoke all on public.editorial_distribution_events from authenticated;
grant select, insert on public.editorial_distribution_events to authenticated;

drop policy if exists editorial_distribution_events_select_editors on public.editorial_distribution_events;
create policy editorial_distribution_events_select_editors
  on public.editorial_distribution_events for select to authenticated
  using (public.has_role('editor') or public.has_role('admin'));

drop policy if exists editorial_distribution_events_insert_editors on public.editorial_distribution_events;
create policy editorial_distribution_events_insert_editors
  on public.editorial_distribution_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (public.has_role('editor') or public.has_role('admin'))
  );
