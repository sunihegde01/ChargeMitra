create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'EV_OWNER'
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
  'EV_OWNER'
from auth.users
on conflict (id) do nothing;

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
    and exists (
      select 1
      from public.providers p
      where p.id = provider_id and p.profile_id = auth.uid()
    )
  );

revoke update on public.bookings from authenticated;
grant update (status) on public.bookings to authenticated;

create or replace function public.create_session_for_accepted_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ACCEPTED' and old.status is distinct from new.status then
    insert into public.charging_sessions (booking_id, status)
    values (new.id, 'AWAITING_METHOD')
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
  set calculation_method = p_method,
      method_confirmed_by_owner = true
  where s.id = p_session_id
    and s.status = 'AWAITING_METHOD'
    and exists (
      select 1 from public.bookings b
      where b.id = s.booking_id and b.owner_id = auth.uid()
    );

  if not found then
    raise exception 'Session cannot be confirmed by this user or is not awaiting a method';
  end if;
end;
$$;

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
    and exists (
      select 1 from public.bookings b
      where b.id = s.booking_id and b.owner_id = auth.uid()
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
begin
  update public.charging_sessions s
  set status = 'CHARGING',
      started_at = now()
  where s.id = p_session_id
    and s.calculation_method = 'TIME_BASED'
    and s.method_confirmed_by_owner
    and s.status = 'AWAITING_METHOD'
    and exists (
      select 1 from public.bookings b
      where b.id = s.booking_id and b.owner_id = auth.uid()
    );

  if not found then
    raise exception 'Session cannot be started by this user or method is not confirmed';
  end if;
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
begin
  if p_final_reading is null or p_final_reading < 0 then
    raise exception 'Final meter reading must be zero or greater';
  end if;

  select s.initial_meter_reading into v_initial_reading
  from public.charging_sessions s
  join public.bookings b on b.id = s.booking_id
  where s.id = p_session_id
    and s.calculation_method = 'METER_BASED'
    and s.status in ('CHARGING', 'PAUSED')
    and (
      b.owner_id = auth.uid()
      or exists (
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
  update public.charging_sessions
  set status = 'STOPPED',
      ended_at = now(),
      final_meter_reading = p_final_reading,
      actual_kwh = v_actual_kwh
  where id = p_session_id;

  return v_actual_kwh;
end;
$$;

create or replace function public.stop_time_based_session(
  p_session_id uuid,
  p_avg_power_factor numeric default 0.85
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
begin
  if p_avg_power_factor is null or p_avg_power_factor <= 0 or p_avg_power_factor > 1 then
    raise exception 'Average power factor must be greater than zero and at most one';
  end if;

  select s.*, c.rated_power_kw
  into v_session
  from public.charging_sessions s
  join public.bookings b on b.id = s.booking_id
  join public.chargers c on c.id = b.charger_id
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

  v_active_hours := greatest(
    extract(epoch from (now() - v_session.started_at)) - coalesce(v_session.paused_seconds, 0),
    0
  ) / 3600.0;
  v_estimated_kwh := (v_session.rated_power_kw * p_avg_power_factor) * v_active_hours;

  update public.charging_sessions
  set status = 'STOPPED',
      ended_at = now(),
      estimated_kwh = round(v_estimated_kwh, 2)
  where id = p_session_id;

  return round(v_estimated_kwh, 2);
end;
$$;

revoke all on function public.confirm_session_method(uuid, text) from public;
revoke all on function public.start_meter_session(uuid, numeric) from public;
revoke all on function public.start_time_based_session(uuid) from public;
revoke all on function public.stop_meter_session(uuid, numeric) from public;
revoke all on function public.stop_time_based_session(uuid, numeric) from public;
grant execute on function public.confirm_session_method(uuid, text) to authenticated;
grant execute on function public.start_meter_session(uuid, numeric) to authenticated;
grant execute on function public.start_time_based_session(uuid) to authenticated;
grant execute on function public.stop_meter_session(uuid, numeric) to authenticated;
grant execute on function public.stop_time_based_session(uuid, numeric) to authenticated;
