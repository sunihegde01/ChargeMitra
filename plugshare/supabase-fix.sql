alter table public.bookings
  add column if not exists payment_method text,
  add column if not exists estimated_total_snapshot numeric(12, 2),
  add column if not exists calculation_method text,
  add column if not exists provider_method_approved_at timestamptz;

alter table public.chargers
  add column if not exists site_power_limit_kw numeric(8, 2);
notify pgrst, 'reload schema';

alter table public.charging_sessions
  add column if not exists provider_approved_at timestamptz,
  add column if not exists compatible_power_kw numeric(10, 4),
  add column if not exists average_power_factor numeric(5, 4) not null default 0.85,
  add column if not exists estimated_average_power_kw numeric(10, 4),
  add column if not exists final_amount numeric(12, 2),
  add column if not exists active_duration_seconds numeric(12, 2),
  add column if not exists paused_at timestamptz;

create table if not exists public.charging_session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.charging_sessions(id) on delete cascade,
  event_type text not null check (event_type in ('CHARGING', 'PAUSED', 'RESUMED', 'STOPPED')),
  recorded_at timestamptz not null default now()
);

create index if not exists charging_session_events_session_time_idx
  on public.charging_session_events (session_id, recorded_at);

alter table public.charging_session_events enable row level security;
revoke all on public.charging_session_events from public, anon, authenticated;

drop policy if exists "Session participants read charging events" on public.charging_session_events;
create policy "Session participants read charging events"
  on public.charging_session_events
  for select
  using (
    exists (
      select 1
      from public.charging_sessions s
      join public.bookings b on b.id = s.booking_id
      where s.id = session_id
        and (
          b.owner_id = auth.uid()
          or exists (
            select 1 from public.providers p
            where p.id = b.provider_id and p.profile_id = auth.uid()
          )
        )
    )
  );
grant select on public.charging_session_events to authenticated;
revoke update on public.charging_sessions from authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_payment_method_check'
  ) then
    alter table public.bookings
      add constraint bookings_payment_method_check
      check (payment_method is null or payment_method = 'PAY_AT_STATION');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_estimated_total_nonnegative'
  ) then
    alter table public.bookings
      add constraint bookings_estimated_total_nonnegative
      check (estimated_total_snapshot is null or estimated_total_snapshot >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_calculation_method_check'
  ) then
    alter table public.bookings
      add constraint bookings_calculation_method_check
      check (calculation_method is null or calculation_method in ('METER_BASED', 'TIME_BASED'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.chargers'::regclass
      and conname = 'chargers_site_power_limit_positive'
  ) then
    alter table public.chargers
      add constraint chargers_site_power_limit_positive
      check (site_power_limit_kw is null or site_power_limit_kw > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.charging_sessions'::regclass
      and conname = 'sessions_power_factor_valid'
  ) then
    alter table public.charging_sessions
      add constraint sessions_power_factor_valid
      check (average_power_factor > 0 and average_power_factor <= 1);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.charging_sessions'::regclass
      and conname = 'sessions_final_amount_nonnegative'
  ) then
    alter table public.charging_sessions
      add constraint sessions_final_amount_nonnegative
      check (final_amount is null or final_amount >= 0);
  end if;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := new.raw_user_meta_data ->> 'role';
  if v_role is null or v_role not in ('EV_OWNER', 'PROVIDER', 'BOTH') then
    v_role := 'EV_OWNER';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists chargemitra_create_profile_on_signup on auth.users;
create trigger chargemitra_create_profile_on_signup
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, phone, role)
select
  id,
  nullif(raw_user_meta_data ->> 'full_name', ''),
  nullif(raw_user_meta_data ->> 'phone', ''),
  case
    when raw_user_meta_data ->> 'role' in ('EV_OWNER', 'PROVIDER', 'BOTH')
      then raw_user_meta_data ->> 'role'
    else 'EV_OWNER'
  end
from auth.users
on conflict (id) do nothing;

drop policy if exists "Providers update own charger availability" on public.chargers;
create policy "Providers update own charger availability"
  on public.chargers
  for update
  using (
    exists (
      select 1
      from public.providers p
      where p.id = provider_id and p.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.providers p
      where p.id = provider_id and p.profile_id = auth.uid()
    )
  );

revoke update on public.chargers from authenticated;
grant update (is_active) on public.chargers to authenticated;

alter table public.bookings
  drop constraint if exists no_overlap;

alter table public.bookings
  add constraint no_overlap
  exclude using gist (
    charger_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  )
  where (status in ('PENDING', 'ACCEPTED'));

drop policy if exists "Providers update pending booking status" on public.bookings;
create policy "Providers update pending booking status"
  on public.bookings
  for update
  using (
    status = 'PENDING'
    and exists (
      select 1
      from public.providers p
      where p.id = provider_id and p.profile_id = auth.uid()
    )
  )
  with check (
    status in ('ACCEPTED', 'DECLINED')
    and (status <> 'ACCEPTED' or calculation_method in ('METER_BASED', 'TIME_BASED'))
    and exists (
      select 1
      from public.providers p
      where p.id = provider_id and p.profile_id = auth.uid()
    )
  );

revoke update on public.bookings from authenticated;
grant update (status, calculation_method) on public.bookings to authenticated;

create or replace function public.approve_booking_calculation_method()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_dedicated_meter boolean;
begin
  if old.status = 'PENDING' and new.status = 'ACCEPTED' then
    if new.calculation_method is null then
      raise exception 'Select a charging calculation method before accepting the booking';
    end if;

    select c.has_dedicated_meter into v_has_dedicated_meter
    from public.chargers c
    where c.id = new.charger_id;

    if new.calculation_method = 'METER_BASED' and not coalesce(v_has_dedicated_meter, false) then
      raise exception 'Meter-based calculation requires a dedicated EV charger meter';
    end if;

    new.provider_method_approved_at := now();
  elsif old.status in ('ACCEPTED', 'DECLINED') and (
    new.calculation_method is distinct from old.calculation_method
    or new.price_per_kwh_snapshot is distinct from old.price_per_kwh_snapshot
  ) then
    raise exception 'The approved calculation method and price cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists chargemitra_approve_booking_method on public.bookings;
create trigger chargemitra_approve_booking_method
  before update on public.bookings
  for each row execute function public.approve_booking_calculation_method();

create or replace function public.create_session_for_accepted_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ACCEPTED' and old.status is distinct from new.status then
    insert into public.charging_sessions (
      booking_id,
      status,
      calculation_method,
      provider_approved_at
    )
    values (
      new.id,
      'AWAITING_METHOD',
      new.calculation_method,
      new.provider_method_approved_at
    )
    on conflict (booking_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists chargemitra_on_booking_accepted_create_session on public.bookings;
create trigger chargemitra_on_booking_accepted_create_session
  after update of status on public.bookings
  for each row execute function public.create_session_for_accepted_booking();

insert into public.charging_sessions (booking_id, status)
select id, 'AWAITING_METHOD'
from public.bookings
where status = 'ACCEPTED'
on conflict (booking_id) do nothing;

update public.charging_sessions s
set calculation_method = b.calculation_method,
    provider_approved_at = b.provider_method_approved_at
from public.bookings b
where b.id = s.booking_id
  and b.status = 'ACCEPTED'
  and s.status = 'AWAITING_METHOD'
  and not s.method_confirmed_by_owner
  and b.calculation_method is not null;

create or replace function public.confirm_session_method(
  p_session_id uuid,
  p_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_method is null or p_method not in ('METER_BASED', 'TIME_BASED') then
    raise exception 'Unsupported calculation method';
  end if;

  update public.charging_sessions s
  set method_confirmed_by_owner = true
  from public.bookings b
  where s.id = p_session_id
    and s.status = 'AWAITING_METHOD'
    and b.id = s.booking_id
    and b.owner_id = auth.uid()
    and b.calculation_method = p_method
    and s.calculation_method = p_method
    and b.provider_method_approved_at is not null
    and s.provider_approved_at is not null;

  if not found then
    raise exception 'The provider has not approved this method, it differs from the agreed method, or this session cannot be confirmed';
  end if;
end;
$$;

create or replace function public.guard_session_calculation_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.calculation_method is distinct from old.calculation_method then
    raise exception 'The provider-approved calculation method cannot be changed';
  end if;
  if old.method_confirmed_by_owner and not new.method_confirmed_by_owner then
    raise exception 'Owner confirmation cannot be removed';
  end if;
  if new.method_confirmed_by_owner and not old.method_confirmed_by_owner and not exists (
    select 1 from public.bookings b
    where b.id = new.booking_id
      and b.owner_id = auth.uid()
      and b.calculation_method = new.calculation_method
      and b.provider_method_approved_at is not null
      and new.status = 'AWAITING_METHOD'
  ) then
    raise exception 'Only the booking owner can confirm the provider-approved method';
  end if;
  if old.started_at is not null and (
    new.calculation_method is distinct from old.calculation_method
    or new.compatible_power_kw is distinct from old.compatible_power_kw
    or new.average_power_factor is distinct from old.average_power_factor
    or new.estimated_average_power_kw is distinct from old.estimated_average_power_kw
  ) then
    raise exception 'The calculation settings cannot be changed after the session starts';
  end if;
  return new;
end;
$$;

drop trigger if exists chargemitra_guard_session_calculation_method on public.charging_sessions;
create trigger chargemitra_guard_session_calculation_method
  before update on public.charging_sessions
  for each row execute function public.guard_session_calculation_method();

create or replace function public.record_charging_session_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('CHARGING', 'PAUSED', 'STOPPED') then
      insert into public.charging_session_events (session_id, event_type, recorded_at)
      values (
        new.id,
        case
          when new.status = 'CHARGING' and old.status = 'PAUSED' then 'RESUMED'
          else new.status
        end,
        clock_timestamp()
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists chargemitra_record_session_event on public.charging_sessions;
create trigger chargemitra_record_session_event
  after update of status on public.charging_sessions
  for each row execute function public.record_charging_session_event();

create or replace function public.start_meter_session(
  p_session_id uuid,
  p_initial_reading numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_initial_reading is null or p_initial_reading < 0 then
    raise exception 'Initial meter reading must be zero or greater';
  end if;

  update public.charging_sessions s
  set initial_meter_reading = p_initial_reading,
      status = 'CHARGING',
      started_at = now()
  where s.id = p_session_id
    and s.calculation_method = 'METER_BASED'
    and s.method_confirmed_by_owner
    and s.status = 'AWAITING_METHOD'
    and s.provider_approved_at is not null
    and exists (
      select 1
      from public.bookings b
      join public.providers p on p.id = b.provider_id
      where b.id = s.booking_id
        and p.profile_id = auth.uid()
    );

  if not found then
    raise exception 'Session cannot be started by this user or method is not confirmed';
  end if;
end;
$$;

create or replace function public.start_time_based_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_vehicle_power numeric;
  v_compatible_power numeric;
begin
  select s.id, s.booking_id, s.calculation_method, s.method_confirmed_by_owner,
         s.provider_approved_at, s.status, c.rated_power_kw, c.site_power_limit_kw, c.charger_type,
         v.max_ac_kw, v.max_dc_kw
  into v_session
  from public.charging_sessions s
  join public.bookings b on b.id = s.booking_id
  join public.chargers c on c.id = b.charger_id
  join public.vehicles v on v.id = b.vehicle_id
  where s.id = p_session_id
    and b.owner_id = auth.uid()
  for update of s;

  if not found or v_session.status <> 'AWAITING_METHOD'
    or v_session.calculation_method <> 'TIME_BASED'
    or not v_session.method_confirmed_by_owner
    or v_session.provider_approved_at is null then
    raise exception 'Session cannot be started until the approved time-based method is confirmed';
  end if;

  v_vehicle_power := case
    when upper(v_session.charger_type) = 'DC' then v_session.max_dc_kw
    else v_session.max_ac_kw
  end;
  v_compatible_power := least(
    v_session.rated_power_kw,
    coalesce(v_vehicle_power, v_session.rated_power_kw),
    coalesce(v_session.site_power_limit_kw, v_session.rated_power_kw)
  );
  if v_compatible_power <= 0 then
    raise exception 'Could not determine a valid compatible charging power';
  end if;

  update public.charging_sessions s
  set status = 'CHARGING',
      started_at = now(),
      compatible_power_kw = v_compatible_power,
      average_power_factor = 0.85,
      estimated_average_power_kw = v_compatible_power * 0.85
  where s.id = p_session_id
    and s.status = 'AWAITING_METHOD';
end;
$$;

create or replace function public.pause_charging_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.charging_sessions s
  set status = 'PAUSED',
      paused_at = now()
  where s.id = p_session_id
    and s.status = 'CHARGING'
    and exists (
      select 1 from public.bookings b
      where b.id = s.booking_id
        and (
          b.owner_id = auth.uid()
          or exists (
            select 1 from public.providers p
            where p.id = b.provider_id and p.profile_id = auth.uid()
          )
        )
    );
  if not found then raise exception 'Session cannot be paused by this user'; end if;
end;
$$;

create or replace function public.resume_charging_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.charging_sessions s
  set status = 'CHARGING',
      paused_seconds = coalesce(s.paused_seconds, 0)
        + greatest(extract(epoch from (now() - s.paused_at)), 0),
      paused_at = null
  where s.id = p_session_id
    and s.status = 'PAUSED'
    and s.paused_at is not null
    and exists (
      select 1 from public.bookings b
      where b.id = s.booking_id
        and (
          b.owner_id = auth.uid()
          or exists (
            select 1 from public.providers p
            where p.id = b.provider_id and p.profile_id = auth.uid()
          )
        )
    );
  if not found then raise exception 'Session cannot be resumed by this user'; end if;
end;
$$;

create or replace function public.stop_meter_session(
  p_session_id uuid,
  p_final_reading numeric
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_initial_reading numeric;
  v_actual_kwh numeric;
  v_price_per_kwh numeric;
  v_final_amount numeric;
begin
  if p_final_reading is null or p_final_reading < 0 then
    raise exception 'Final meter reading must be zero or greater';
  end if;

  select s.initial_meter_reading, b.price_per_kwh_snapshot
  into v_initial_reading, v_price_per_kwh
  from public.charging_sessions s
  join public.bookings b on b.id = s.booking_id
  join public.chargers c on c.id = b.charger_id
  where s.id = p_session_id
    and s.calculation_method = 'METER_BASED'
    and s.status in ('CHARGING', 'PAUSED')
    and c.has_dedicated_meter
    and (
      exists (
        select 1 from public.providers p
        where p.id = b.provider_id and p.profile_id = auth.uid()
      )
    )
  for update of s;

  if not found or v_initial_reading is null then
    raise exception 'Session is not active or cannot be stopped by this user';
  end if;
  if p_final_reading < v_initial_reading then
    raise exception 'Final meter reading cannot be less than the initial reading';
  end if;

  v_actual_kwh := round(p_final_reading - v_initial_reading, 2);
  v_final_amount := round(v_actual_kwh * v_price_per_kwh, 2);
  update public.charging_sessions
  set status = 'STOPPED',
      ended_at = now(),
      paused_seconds = coalesce(paused_seconds, 0)
        + case when status = 'PAUSED' and paused_at is not null
          then greatest(extract(epoch from (now() - paused_at)), 0)
          else 0
        end,
      paused_at = null,
      final_meter_reading = p_final_reading,
      actual_kwh = v_actual_kwh,
      active_duration_seconds = greatest(
        extract(epoch from (now() - started_at))
          - coalesce(paused_seconds, 0)
          - case when status = 'PAUSED' and paused_at is not null
            then extract(epoch from (now() - paused_at))
            else 0
          end,
        0
      ),
      final_amount = v_final_amount
  where id = p_session_id;

  return v_actual_kwh;
end;
$$;

create or replace function public.stop_time_based_session(
  p_session_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_active_hours numeric;
  v_estimated_kwh numeric;
  v_final_amount numeric;
begin
  select s.*, b.price_per_kwh_snapshot
  into v_session
  from public.charging_sessions s
  join public.bookings b on b.id = s.booking_id
  where s.id = p_session_id
    and (
      b.owner_id = auth.uid()
      or exists (
        select 1 from public.providers p
        where p.id = b.provider_id and p.profile_id = auth.uid()
      )
    )
  for update of s;

  if not found or v_session.status not in ('CHARGING', 'PAUSED') then
    raise exception 'Session is not active or cannot be stopped by this user';
  end if;
  if v_session.calculation_method <> 'TIME_BASED' or v_session.started_at is null then
    raise exception 'Session is not an active time-based session';
  end if;
  if v_session.estimated_average_power_kw is null or v_session.estimated_average_power_kw <= 0 then
    raise exception 'The session has no valid server-calculated input power';
  end if;

  v_active_hours := greatest(
    extract(epoch from (now() - v_session.started_at))
      - coalesce(v_session.paused_seconds, 0)
      - case when v_session.status = 'PAUSED' and v_session.paused_at is not null
        then extract(epoch from (now() - v_session.paused_at))
        else 0
      end,
    0
  ) / 3600.0;
  v_estimated_kwh := round(v_session.estimated_average_power_kw * v_active_hours, 2);
  v_final_amount := round(v_estimated_kwh * v_session.price_per_kwh_snapshot, 2);

  update public.charging_sessions
  set status = 'STOPPED',
      ended_at = now(),
      paused_seconds = coalesce(paused_seconds, 0)
        + case when status = 'PAUSED' and paused_at is not null
          then greatest(extract(epoch from (now() - paused_at)), 0)
          else 0
        end,
      paused_at = null,
      estimated_kwh = v_estimated_kwh,
      active_duration_seconds = round(v_active_hours * 3600, 2),
      final_amount = v_final_amount
  where id = p_session_id;

  return round(v_estimated_kwh, 2);
end;
$$;

drop function if exists public.stop_time_based_session(uuid, numeric);

revoke all on function public.confirm_session_method(uuid, text) from public;
revoke all on function public.start_meter_session(uuid, numeric) from public;
revoke all on function public.start_time_based_session(uuid) from public;
revoke all on function public.stop_meter_session(uuid, numeric) from public;
revoke all on function public.pause_charging_session(uuid) from public;
revoke all on function public.resume_charging_session(uuid) from public;
revoke all on function public.stop_time_based_session(uuid) from public;
grant execute on function public.confirm_session_method(uuid, text) to authenticated;
grant execute on function public.start_meter_session(uuid, numeric) to authenticated;
grant execute on function public.start_time_based_session(uuid) to authenticated;
grant execute on function public.stop_meter_session(uuid, numeric) to authenticated;
grant execute on function public.pause_charging_session(uuid) to authenticated;
grant execute on function public.resume_charging_session(uuid) to authenticated;
grant execute on function public.stop_time_based_session(uuid) to authenticated;

notify pgrst, 'reload schema';
