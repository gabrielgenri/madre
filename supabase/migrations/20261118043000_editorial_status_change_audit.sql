create table if not exists public.editorial_status_events (
  id uuid primary key default gen_random_uuid(),
  editorial_unit_id uuid not null references public.editorial_units(id) on delete restrict,
  from_status text not null check (from_status in ('draft','reviewed','published')),
  to_status text not null check (to_status in ('draft','reviewed','published')),
  note text not null check (length(trim(note)) between 3 and 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint editorial_status_events_transition_check check (from_status <> to_status)
);

create index if not exists editorial_status_events_unit_created_idx
  on public.editorial_status_events (editorial_unit_id, created_at desc);

alter table public.editorial_status_events enable row level security;
revoke all on public.editorial_status_events from anon, authenticated;
grant select, insert on public.editorial_status_events to authenticated;

drop policy if exists editorial_status_events_select on public.editorial_status_events;
create policy editorial_status_events_select
  on public.editorial_status_events for select to authenticated
  using (
    exists (
      select 1 from public.editorial_units u
      where u.id = editorial_status_events.editorial_unit_id
        and (u.created_by = (select auth.uid()) or u.assigned_to = (select auth.uid())
          or public.has_role('reviewer') or public.has_role('editor') or public.has_role('admin'))
    )
  );

drop policy if exists editorial_status_events_insert on public.editorial_status_events;
create policy editorial_status_events_insert
  on public.editorial_status_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (public.has_role('editor') or public.has_role('admin'))
  );

create or replace function public.guard_editorial_status_audit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_latest_version_id uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'reviewed' then
    select id into v_latest_version_id
    from public.editorial_versions
    where editorial_unit_id = new.id
    order by version_number desc limit 1;

    if not (public.has_role('editor') or public.has_role('admin'))
      or not exists (
        select 1 from public.editorial_review_events e
        where e.editorial_unit_id = new.id
          and e.source_version_id = v_latest_version_id
          and e.event_type = 'approved'
      ) then
      raise exception 'El estado Revisado requiere una aprobación humana vigente de editor o administrador';
    end if;
  elsif new.status = 'published' then
    if not (public.has_role('editor') or public.has_role('admin'))
      or old.status <> 'reviewed'
      or not exists (
        select 1 from public.editorial_status_events e
        where e.editorial_unit_id = new.id and e.from_status = old.status
          and e.to_status = 'published' and e.created_by = (select auth.uid())
      ) then
      raise exception 'La publicación requiere estado Revisado y una decisión editorial registrada';
    end if;
  elsif new.status = 'draft' and old.status in ('reviewed','published') then
    if not (public.has_role('editor') or public.has_role('admin'))
      or (
        new.title is not distinct from old.title
        and new.summary is not distinct from old.summary
        and new.content_mother is not distinct from old.content_mother
        and not exists (
          select 1 from public.editorial_status_events e
          where e.editorial_unit_id = new.id and e.from_status = old.status
            and e.to_status = 'draft' and e.created_by = (select auth.uid())
        )
      ) then
      raise exception 'El retorno a Borrador requiere una decisión editorial registrada';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists editorial_units_status_audit_guard on public.editorial_units;
create trigger editorial_units_status_audit_guard
before update of status on public.editorial_units
for each row execute function public.guard_editorial_status_audit();

create or replace function public.change_editorial_status(
  p_unit_id uuid,
  p_status text,
  p_note text
)
returns public.editorial_status_events
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_unit public.editorial_units;
  v_event public.editorial_status_events;
  v_latest_version_id uuid;
begin
  if v_user_id is null then raise exception 'Se requiere una sesión autenticada'; end if;
  if not (public.has_role('editor') or public.has_role('admin')) then
    raise exception 'Solo editor o administrador puede cambiar el estado editorial';
  end if;
  if p_note is null or length(trim(p_note)) < 3 or length(trim(p_note)) > 1000 then
    raise exception 'El motivo debe tener entre 3 y 1000 caracteres';
  end if;
  if p_status not in ('draft','published') then
    raise exception 'El estado Revisado solo se obtiene mediante la aprobación humana';
  end if;

  select * into v_unit from public.editorial_units
  where id = p_unit_id for update;
  if not found then raise exception 'No se encontró la unidad editorial'; end if;
  if v_unit.status = p_status then raise exception 'La unidad ya tiene ese estado'; end if;

  if p_status = 'draft' and v_unit.status not in ('reviewed','published') then
    raise exception 'Solo se puede devolver a Borrador una unidad Revisada o Publicada';
  end if;

  if p_status = 'published' then
    if v_unit.status <> 'reviewed' then
      raise exception 'La unidad debe estar Revisada antes de marcarse como Publicada';
    end if;
    select id into v_latest_version_id from public.editorial_versions
    where editorial_unit_id = p_unit_id order by version_number desc limit 1;
    if v_latest_version_id is null or not exists (
      select 1 from public.editorial_review_events e
      where e.editorial_unit_id = p_unit_id
        and e.source_version_id = v_latest_version_id
        and e.event_type = 'approved'
    ) then
      raise exception 'No hay una aprobación humana vigente para la versión actual';
    end if;
  end if;

  insert into public.editorial_status_events (
    editorial_unit_id, from_status, to_status, note, created_by
  ) values (
    p_unit_id, v_unit.status, p_status, trim(p_note), v_user_id
  ) returning * into v_event;

  update public.editorial_units
  set status = p_status,
      published_at = case when p_status = 'published' then clock_timestamp() else null end
  where id = p_unit_id;

  return v_event;
end;
$function$;

revoke all on function public.change_editorial_status(uuid,text,text) from public, anon;
grant execute on function public.change_editorial_status(uuid,text,text) to authenticated;
