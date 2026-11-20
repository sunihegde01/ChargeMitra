create table if not exists public.home_details (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  host_name text not null,
  contact_number text not null,
  home_type text not null check (home_type in ('INDEPENDENT_HOUSE', 'VILLA', 'APARTMENT_SOCIETY')),
  parking_location text not null check (parking_location in ('OWN_GARAGE', 'DRIVEWAY', 'SOCIETY_PARKING')),
  society_name text,
  society_approval boolean not null default false,
  number_of_chargers integer not null check (number_of_chargers > 0),
  availability_hours text not null,
  id_address_proof text,
  electricity_bill text,
  host_approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_details_society_approval_check check (
    (home_type = 'APARTMENT_SOCIETY' and nullif(trim(society_name), '') is not null and society_approval)
    or (home_type <> 'APARTMENT_SOCIETY' and society_name is null and not society_approval)
  )
);

create table if not exists public.home_access_details (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  street_address text not null,
  city text not null,
  state text not null,
  pin_code text not null check (pin_code ~ '^[0-9]{6}$'),
  exact_location extensions.geography(Point, 4326) not null,
  entry_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_home_provider_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_type text;
begin
  select p.business_type::text
    into actual_type
    from public.providers p
    where p.id = new.provider_id;

  if actual_type is distinct from 'PRIVATE_HOME' then
    raise exception 'Home details require a PRIVATE_HOME provider';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_home_provider_type() from public, anon, authenticated;

drop trigger if exists home_details_business_type_check on public.home_details;
create trigger home_details_business_type_check
  before insert or update of provider_id on public.home_details
  for each row execute function public.validate_home_provider_type();

drop trigger if exists home_access_business_type_check on public.home_access_details;
create trigger home_access_business_type_check
  before insert or update of provider_id on public.home_access_details
  for each row execute function public.validate_home_provider_type();

alter table public.home_details enable row level security;
alter table public.home_access_details enable row level security;
grant select, insert, update, delete on public.home_details, public.home_access_details to authenticated;

drop policy if exists home_details_host_select on public.home_details;
create policy home_details_host_select on public.home_details
  for select to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = home_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_details_host_insert on public.home_details;
create policy home_details_host_insert on public.home_details
  for insert to authenticated
  with check (
    exists (
      select 1 from public.providers p
      where p.id = home_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_details_host_update on public.home_details;
create policy home_details_host_update on public.home_details
  for update to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = home_details.provider_id and p.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = home_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_details_host_delete on public.home_details;
create policy home_details_host_delete on public.home_details
  for delete to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = home_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_access_host_select on public.home_access_details;
create policy home_access_host_select on public.home_access_details
  for select to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = home_access_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_access_host_insert on public.home_access_details;
create policy home_access_host_insert on public.home_access_details
  for insert to authenticated
  with check (
    exists (
      select 1 from public.providers p
      where p.id = home_access_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_access_host_update on public.home_access_details;
create policy home_access_host_update on public.home_access_details
  for update to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = home_access_details.provider_id and p.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = home_access_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_access_host_delete on public.home_access_details;
create policy home_access_host_delete on public.home_access_details
  for delete to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = home_access_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists home_access_accepted_booking_owner_select on public.home_access_details;
create policy home_access_accepted_booking_owner_select on public.home_access_details
  for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.provider_id = home_access_details.provider_id
        and b.owner_id = auth.uid()
        and b.status = 'ACCEPTED'
    )
  );

notify pgrst, 'reload schema';
