-- PASO 20 — Notificaciones editoriales internas
-- Las notificaciones son privadas por destinatario. Los eventos de trabajo/revisión
-- generan avisos mediante triggers; no habilitan aprobación ni publicación automática.

create table if not exists public.editorial_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  editorial_unit_id uuid not null references public.editorial_units(id) on delete restrict,
  event_type text not null check (event_type in (
    'work_assigned', 'work_reassigned', 'review_requested',
    'changes_requested', 'review_approved', 'due_soon', 'overdue'
  )),
  title text not null check (char_length(title) between 1 and 180),
  body text not null check (char_length(body) between 1 and 1200),
  source_event_id uuid,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  constraint editorial_notifications_dedupe_unique unique (recipient_id, dedupe_key)
);

create index if not exists editorial_notifications_recipient_created_idx
  on public.editorial_notifications (recipient_id, created_at desc);
create index if not exists editorial_notifications_unread_idx
  on public.editorial_notifications (recipient_id, created_at desc)
  where read_at is null;
create index if not exists editorial_notifications_unit_idx
  on public.editorial_notifications (editorial_unit_id);

alter table public.editorial_notifications enable row level security;
revoke all on public.editorial_notifications from anon;
revoke all on public.editorial_notifications from authenticated;
grant select, insert, update on public.editorial_notifications to authenticated;

drop policy if exists editorial_notifications_select_own on public.editorial_notifications;
create policy editorial_notifications_select_own
  on public.editorial_notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists editorial_notifications_insert_own_reminder on public.editorial_notifications;
create policy editorial_notifications_insert_own_reminder
  on public.editorial_notifications for insert to authenticated
  with check (
    recipient_id = (select auth.uid())
    and event_type in ('due_soon', 'overdue')
    and source_event_id is null
  );

drop policy if exists editorial_notifications_update_own on public.editorial_notifications;
create policy editorial_notifications_update_own
  on public.editorial_notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- El usuario solo puede marcar como leída una notificación propia.
create or replace function public.guard_editorial_notification_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.recipient_id is distinct from old.recipient_id
     or new.editorial_unit_id is distinct from old.editorial_unit_id
     or new.event_type is distinct from old.event_type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.source_event_id is distinct from old.source_event_id
     or new.dedupe_key is distinct from old.dedupe_key
     or new.metadata is distinct from old.metadata
     or new.created_at is distinct from old.created_at then
    raise exception 'Solo se permite modificar read_at en una notificación';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Una notificación leída no puede volver a estado no leído';
  end if;
  return new;
end;
$$;

drop trigger if exists editorial_notifications_guard_update on public.editorial_notifications;
create trigger editorial_notifications_guard_update
before update on public.editorial_notifications
for each row execute function public.guard_editorial_notification_update();

-- Funciones internas de triggers en un esquema no expuesto por PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Inserción interna desde eventos confiables de planificación y revisión.
create or replace function private.create_editorial_notification(
  p_recipient uuid,
  p_unit_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_source_event_id uuid,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_recipient is null then
    return;
  end if;
  insert into public.editorial_notifications (
    recipient_id, editorial_unit_id, event_type, title, body,
    source_event_id, dedupe_key, metadata
  )
  values (
    p_recipient, p_unit_id, p_event_type, p_title, p_body,
    p_source_event_id, p_dedupe_key, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (recipient_id, dedupe_key) do nothing;
end;
$$;
revoke all on function private.create_editorial_notification(uuid,uuid,text,text,text,uuid,text,jsonb) from public, anon, authenticated;

create or replace function private.notify_editorial_work_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_title text;
  v_body text;
  v_recipient uuid;
begin
  if new.to_assigned_to is not null and new.to_assigned_to is distinct from new.from_assigned_to then
    select title into v_title from public.editorial_units where id = new.editorial_unit_id;
    v_body := 'Se te asignó la unidad editorial: ' || coalesce(v_title, 'Sin título') ||
      '. Prioridad: ' || coalesce(new.to_priority, 'normal') ||
      case when new.to_due_at is not null then '. Fecha límite: ' || to_char(new.to_due_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC' else '' end || '.';
    perform private.create_editorial_notification(
      new.to_assigned_to, new.editorial_unit_id, 'work_assigned',
      'Nueva asignación editorial', v_body, new.id,
      'work-assigned:' || new.id::text,
      jsonb_build_object('priority', new.to_priority, 'due_at', new.to_due_at)
    );
  elsif new.to_assigned_to is not null and new.to_due_at is distinct from new.from_due_at then
    select title into v_title from public.editorial_units where id = new.editorial_unit_id;
    perform private.create_editorial_notification(
      new.to_assigned_to, new.editorial_unit_id, 'work_assigned',
      'Cambió la planificación editorial',
      'Se actualizó la fecha límite o prioridad de: ' || coalesce(v_title, 'Unidad editorial') || '.',
      new.id, 'work-plan:' || new.id::text,
      jsonb_build_object('priority', new.to_priority, 'due_at', new.to_due_at)
    );
  end if;

  if new.from_assigned_to is not null and new.from_assigned_to is distinct from new.to_assigned_to then
    select title into v_title from public.editorial_units where id = new.editorial_unit_id;
    perform private.create_editorial_notification(
      new.from_assigned_to, new.editorial_unit_id, 'work_reassigned',
      'La asignación fue modificada',
      'La unidad «' || coalesce(v_title, 'Unidad editorial') || '» fue reasignada.',
      new.id, 'work-reassigned:' || new.id::text, '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists editorial_work_event_notify on public.editorial_work_events;
create trigger editorial_work_event_notify
after insert on public.editorial_work_events
for each row execute function private.notify_editorial_work_event();

create or replace function private.notify_editorial_review_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_title text;
  v_recipient uuid;
  v_event text;
  v_notification_title text;
  v_body text;
begin
  select title into v_title from public.editorial_units where id = new.editorial_unit_id;

  if new.event_type = 'review_requested' then
    v_event := 'review_requested';
    v_notification_title := 'Hay una producción para revisar';
    v_body := 'Se solicitó revisar «' || coalesce(v_title, 'Unidad editorial') || '».';
    for v_recipient in
      select distinct user_id from public.user_roles
      where role in ('reviewer', 'editor', 'admin') and user_id <> new.created_by
    loop
      perform private.create_editorial_notification(
        v_recipient, new.editorial_unit_id, v_event, v_notification_title,
        v_body, new.id, 'review-requested:' || new.id::text || ':' || v_recipient::text,
        jsonb_build_object('source_version_id', new.source_version_id)
      );
    end loop;
  elsif new.event_type = 'changes_requested' then
    v_event := 'changes_requested';
    v_notification_title := 'Se solicitaron correcciones';
    v_body := 'La revisión de «' || coalesce(v_title, 'Unidad editorial') || '» requiere cambios. ' || left(new.note, 500);
    for v_recipient in
      select distinct candidate from (
        select created_by as candidate from public.editorial_units where id = new.editorial_unit_id
        union
        select assigned_to as candidate from public.editorial_units where id = new.editorial_unit_id
      ) recipients
      where candidate is not null and candidate <> new.created_by
    loop
      perform private.create_editorial_notification(
        v_recipient, new.editorial_unit_id, v_event, v_notification_title,
        v_body, new.id, 'changes-requested:' || new.id::text || ':' || v_recipient::text,
        jsonb_build_object('source_version_id', new.source_version_id)
      );
    end loop;
  elsif new.event_type = 'approved' then
    v_event := 'review_approved';
    v_notification_title := 'Producción aprobada';
    v_body := 'La unidad «' || coalesce(v_title, 'Unidad editorial') || '» fue aprobada como Revisado.';
    for v_recipient in
      select distinct candidate from (
        select created_by as candidate from public.editorial_units where id = new.editorial_unit_id
        union
        select assigned_to as candidate from public.editorial_units where id = new.editorial_unit_id
      ) recipients
      where candidate is not null and candidate <> new.created_by
    loop
      perform private.create_editorial_notification(
        v_recipient, new.editorial_unit_id, v_event, v_notification_title,
        v_body, new.id, 'review-approved:' || new.id::text || ':' || v_recipient::text,
        jsonb_build_object('source_version_id', new.source_version_id)
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists editorial_review_event_notify on public.editorial_review_events;
create trigger editorial_review_event_notify
after insert on public.editorial_review_events
for each row execute function private.notify_editorial_review_event();

-- Recordatorios idempotentes al consultar la bandeja de notificaciones.
-- No requiere cron: cada usuario genera avisos únicamente para sus propias asignaciones.
create or replace function public.enqueue_my_editorial_due_notifications()
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $

declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada';
  end if;

  with due_units as (
    select id, title, due_at
    from public.editorial_units
    where assigned_to = auth.uid()
      and due_at is not null
      and status = 'draft'
      and due_at <= now() + interval '24 hours'
  ), inserted as (
    insert into public.editorial_notifications (
      recipient_id, editorial_unit_id, event_type, title, body, dedupe_key, metadata
    )
    select
      auth.uid(), id,
      case when due_at < now() then 'overdue' else 'due_soon' end,
      case when due_at < now() then 'Tarea editorial vencida' else 'Vence una tarea editorial' end,
      '«' || coalesce(title, 'Unidad editorial') || '» ' ||
        case when due_at < now() then 'superó su fecha límite.' else 'vence dentro de las próximas 24 horas.' end,
      case when due_at < now()
        then 'overdue:' || id::text || ':' || due_at::text
        else 'due-soon:' || id::text || ':' || due_at::text end,
      jsonb_build_object('due_at', due_at)
    from due_units
    on conflict (recipient_id, dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

revoke all on function public.enqueue_my_editorial_due_notifications() from public, anon;
grant execute on function public.enqueue_my_editorial_due_notifications() to authenticated;

revoke all on function public.guard_editorial_notification_update() from public, anon, authenticated;
revoke all on function private.create_editorial_notification(uuid,uuid,text,text,text,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function private.notify_editorial_work_event() from public, anon, authenticated;
revoke all on function private.notify_editorial_review_event() from public, anon, authenticated;

-- Habilitar el stream de inserciones para el centro de notificaciones.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'editorial_notifications'
  ) then
    alter publication supabase_realtime add table public.editorial_notifications;
  end if;
end;
$$;
