create extension if not exists postgis;

do $$
begin
  create type public.provider_business_type as enum ('HOTEL', 'PUBLIC_PARKING');
exception
  when duplicate_object then null;
end;
$$;

alter table public.providers
  add column if not exists business_type public.provider_business_type,
  add column if not exists location_geog extensions.geography(Point, 4326),
  alter column category drop not null;

alter table public.chargers
  add column if not exists bay_label text,
  add column if not exists cable_details text,
  add column if not exists photos text[] not null default '{}',
  add column if not exists location_geog extensions.geography(Point, 4326);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.providers'::regclass
      and conname = 'providers_business_type_required'
  ) then
    alter table public.providers
      add constraint providers_business_type_required
      check (business_type is not null) not valid;
  end if;
end;
$$;

create table if not exists public.hotel_details (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  hotel_name text not null,
  street_address text not null,
  city text not null,
  state text not null,
  pin_code text not null check (pin_code ~ '^[0-9]{6}$'),
  contact_person text not null,
  reception_phone text not null,
  number_of_ev_bays integer not null check (number_of_ev_bays > 0),
  access_type text not null check (access_type in ('GUESTS_ONLY', 'OPEN_TO_PUBLIC')),
  restaurant boolean not null default false,
  restroom boolean not null default false,
  wifi boolean not null default false,
  desk_24x7 boolean not null default false,
  entry_instructions text,
  gst_or_business_license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parking_details (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  operator_name text not null,
  street_address text not null,
  city text not null,
  state text not null,
  pin_code text not null check (pin_code ~ '^[0-9]{6}$'),
  parking_type text not null check (parking_type in ('MALL', 'OPEN_LOT', 'MULTI_LEVEL', 'ROADSIDE', 'OTHER')),
  covered boolean not null default false,
  total_slots integer not null check (total_slots > 0),
  number_of_ev_bays integer not null check (number_of_ev_bays > 0 and number_of_ev_bays <= total_slots),
  open_24x7 boolean not null default false,
  opening_hours text,
  parking_fee_type text not null check (parking_fee_type in ('FREE', 'HOURLY')),
  hourly_fee numeric(10, 2),
  attendant boolean not null default false,
  security boolean not null default false,
  cctv boolean not null default false,
  vehicle_height_limit_m numeric(5, 2) check (vehicle_height_limit_m is null or vehicle_height_limit_m > 0),
  operator_license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parking_details_fee_check check (
    (parking_fee_type = 'FREE' and hourly_fee is null)
    or (parking_fee_type = 'HOURLY' and hourly_fee is not null and hourly_fee >= 0)
  ),
  constraint parking_details_hours_check check (open_24x7 or nullif(trim(opening_hours), '') is not null)
);

create or replace function public.validate_provider_business_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_type public.provider_business_type;
  actual_type public.provider_business_type;
begin
  expected_type := case tg_table_name
    when 'hotel_details' then 'HOTEL'::public.provider_business_type
    when 'parking_details' then 'PUBLIC_PARKING'::public.provider_business_type
  end;

  select p.business_type
    into actual_type
    from public.providers p
    where p.id = new.provider_id;

  if actual_type is distinct from expected_type then
    raise exception 'Business details do not match the provider business type';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_provider_business_details() from public, anon, authenticated;

drop trigger if exists hotel_details_business_type_check on public.hotel_details;
create trigger hotel_details_business_type_check
  before insert or update of provider_id on public.hotel_details
  for each row execute function public.validate_provider_business_details();

drop trigger if exists parking_details_business_type_check on public.parking_details;
create trigger parking_details_business_type_check
  before insert or update of provider_id on public.parking_details
  for each row execute function public.validate_provider_business_details();

create index if not exists providers_location_geog_gix
  on public.providers using gist (location_geog);
create index if not exists chargers_location_geog_gix
  on public.chargers using gist (location_geog);

alter table public.hotel_details enable row level security;
alter table public.parking_details enable row level security;

grant select on public.hotel_details, public.parking_details to authenticated;
grant insert, update, delete on public.hotel_details, public.parking_details to authenticated;

drop policy if exists hotel_details_public_read on public.hotel_details;
drop policy if exists hotel_details_host_select on public.hotel_details;
create policy hotel_details_host_select on public.hotel_details
  for select to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = hotel_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists hotel_details_host_insert on public.hotel_details;
create policy hotel_details_host_insert on public.hotel_details
  for insert to authenticated
  with check (
    exists (
      select 1 from public.providers p
      where p.id = hotel_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists hotel_details_host_update on public.hotel_details;
create policy hotel_details_host_update on public.hotel_details
  for update to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = hotel_details.provider_id and p.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = hotel_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists hotel_details_host_delete on public.hotel_details;
create policy hotel_details_host_delete on public.hotel_details
  for delete to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = hotel_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists parking_details_public_read on public.parking_details;
drop policy if exists parking_details_host_select on public.parking_details;
create policy parking_details_host_select on public.parking_details
  for select to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = parking_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists parking_details_host_insert on public.parking_details;
create policy parking_details_host_insert on public.parking_details
  for insert to authenticated
  with check (
    exists (
      select 1 from public.providers p
      where p.id = parking_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists parking_details_host_update on public.parking_details;
create policy parking_details_host_update on public.parking_details
  for update to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = parking_details.provider_id and p.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = parking_details.provider_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists parking_details_host_delete on public.parking_details;
create policy parking_details_host_delete on public.parking_details
  for delete to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = parking_details.provider_id and p.profile_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
