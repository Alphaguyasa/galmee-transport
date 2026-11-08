-- Galmee Transport schema: routes, vehicles, drivers, departures, tickets, parcels, cash handovers.
-- Departures, tickets, parcels and handovers are written only through RPCs (see tr_rpcs migration).

create table public.tr_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  origin text not null check (char_length(btrim(origin)) between 2 and 80),
  destination text not null check (char_length(btrim(destination)) between 2 and 80),
  fare numeric(12,2) not null check (fare > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, origin, destination),
  unique (tenant_id, id)
);

create table public.tr_vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  plate text not null check (char_length(btrim(plate)) between 2 and 20),
  name text check (char_length(name) <= 60),
  seats int not null check (seats between 4 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, plate),
  unique (tenant_id, id)
);

create table public.tr_drivers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone text check (char_length(phone) <= 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table public.tr_departures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  route_id uuid not null,
  vehicle_id uuid not null,
  driver_id uuid,
  departs_at timestamptz not null,
  departs_day date generated always as ((departs_at at time zone 'Africa/Addis_Ababa')::date) stored,
  fare numeric(12,2) not null check (fare > 0),
  seats int not null check (seats between 4 and 80),
  status text not null default 'scheduled' check (status in ('scheduled','boarding','departed','arrived','cancelled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  departed_at timestamptz,
  arrived_at timestamptz,
  unique (tenant_id, vehicle_id, departs_at),
  unique (tenant_id, id),
  foreign key (tenant_id, route_id) references public.tr_routes(tenant_id, id),
  foreign key (tenant_id, vehicle_id) references public.tr_vehicles(tenant_id, id),
  foreign key (tenant_id, driver_id) references public.tr_drivers(tenant_id, id)
);
create index tr_departures_board_idx on public.tr_departures (tenant_id, departs_at);
create index tr_departures_day_idx on public.tr_departures (tenant_id, departs_day);
create index tr_departures_route_idx on public.tr_departures (tenant_id, route_id);
create index tr_departures_driver_idx on public.tr_departures (tenant_id, driver_id);

create table public.tr_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  departure_id uuid not null,
  seat int not null check (seat > 0),
  fare numeric(12,2) not null check (fare > 0),
  passenger_name text check (char_length(passenger_name) <= 120),
  passenger_phone text check (char_length(passenger_phone) <= 20),
  method public.pay_method not null default 'cash',
  channel text not null default 'office' check (channel in ('office','onboard')),
  sold_by uuid not null default auth.uid() references public.profiles(user_id),
  sold_at timestamptz not null default now(),
  sold_day date generated always as ((sold_at at time zone 'Africa/Addis_Ababa')::date) stored,
  client_ref uuid,
  voided_at timestamptz,
  voided_by uuid references public.profiles(user_id),
  void_reason text check (char_length(void_reason) <= 300),
  unique (tenant_id, client_ref),
  unique (tenant_id, id),
  foreign key (tenant_id, departure_id) references public.tr_departures(tenant_id, id),
  check ((voided_at is null) = (void_reason is null))
);
-- A seat cannot be sold twice; a voided ticket frees its seat.
create unique index tr_tickets_seat_uq on public.tr_tickets (departure_id, seat) where voided_at is null;
create index tr_tickets_day_idx on public.tr_tickets (tenant_id, sold_day);
create index tr_tickets_departure_idx on public.tr_tickets (tenant_id, departure_id);
create index tr_tickets_sold_by_idx on public.tr_tickets (sold_by);
create index tr_tickets_voided_by_idx on public.tr_tickets (voided_by);

create table public.tr_parcels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  waybill_no int not null check (waybill_no > 0),
  route_id uuid not null,
  departure_id uuid,
  sender_name text not null check (char_length(btrim(sender_name)) between 2 and 120),
  sender_phone text check (char_length(sender_phone) <= 20),
  receiver_name text not null check (char_length(btrim(receiver_name)) between 2 and 120),
  receiver_phone text not null check (char_length(receiver_phone) <= 20),
  description text not null check (char_length(btrim(description)) between 2 and 300),
  weight_kg numeric(8,2) check (weight_kg > 0),
  fee numeric(12,2) not null check (fee >= 0),
  method public.pay_method not null default 'cash',
  status text not null default 'received' check (status in ('received','loaded','arrived','collected','cancelled')),
  received_by uuid not null default auth.uid() references public.profiles(user_id),
  sold_at timestamptz not null default now(),
  sold_day date generated always as ((sold_at at time zone 'Africa/Addis_Ababa')::date) stored,
  client_ref uuid,
  loaded_at timestamptz,
  arrived_at timestamptz,
  collected_at timestamptz,
  cancelled_at timestamptz,
  unique (tenant_id, waybill_no),
  unique (tenant_id, client_ref),
  unique (tenant_id, id),
  foreign key (tenant_id, route_id) references public.tr_routes(tenant_id, id),
  foreign key (tenant_id, departure_id) references public.tr_departures(tenant_id, id)
);
create index tr_parcels_status_idx on public.tr_parcels (tenant_id, status);
create index tr_parcels_day_idx on public.tr_parcels (tenant_id, sold_day);
create index tr_parcels_route_idx on public.tr_parcels (tenant_id, route_id);
create index tr_parcels_departure_idx on public.tr_parcels (tenant_id, departure_id);
create index tr_parcels_received_by_idx on public.tr_parcels (received_by);

create table public.tr_cash_handovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant() references public.tenants(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('seller','vehicle')),
  seller_id uuid references public.profiles(user_id),
  vehicle_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  expected numeric(12,2) not null check (expected >= 0),
  note text check (char_length(note) <= 300),
  received_by uuid not null default auth.uid() references public.profiles(user_id),
  client_ref uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(user_id),
  unique (tenant_id, client_ref),
  unique (tenant_id, id),
  foreign key (tenant_id, vehicle_id) references public.tr_vehicles(tenant_id, id),
  check ((kind = 'seller' and seller_id is not null and vehicle_id is null)
      or (kind = 'vehicle' and vehicle_id is not null and seller_id is null))
);
create index tr_cash_handovers_day_idx on public.tr_cash_handovers (tenant_id, day);
create index tr_cash_handovers_vehicle_idx on public.tr_cash_handovers (tenant_id, vehicle_id);
create index tr_cash_handovers_seller_idx on public.tr_cash_handovers (seller_id);
create index tr_cash_handovers_received_by_idx on public.tr_cash_handovers (received_by);
create index tr_cash_handovers_reversed_by_idx on public.tr_cash_handovers (reversed_by);

alter table public.tr_routes enable row level security;
alter table public.tr_vehicles enable row level security;
alter table public.tr_drivers enable row level security;
alter table public.tr_departures enable row level security;
alter table public.tr_tickets enable row level security;
alter table public.tr_parcels enable row level security;
alter table public.tr_cash_handovers enable row level security;

revoke all on public.tr_routes, public.tr_vehicles, public.tr_drivers, public.tr_departures, public.tr_tickets, public.tr_parcels, public.tr_cash_handovers from anon;
revoke truncate on public.tr_routes, public.tr_vehicles, public.tr_drivers from authenticated;
revoke insert, update, delete, truncate on public.tr_departures, public.tr_tickets, public.tr_parcels, public.tr_cash_handovers from authenticated;

create policy tr_routes_sel on public.tr_routes for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy tr_routes_ins on public.tr_routes for insert to authenticated
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
create policy tr_routes_upd on public.tr_routes for update to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'))
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));

create policy tr_vehicles_sel on public.tr_vehicles for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy tr_vehicles_ins on public.tr_vehicles for insert to authenticated
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
create policy tr_vehicles_upd on public.tr_vehicles for update to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'))
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));

create policy tr_drivers_sel on public.tr_drivers for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy tr_drivers_ins on public.tr_drivers for insert to authenticated
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
create policy tr_drivers_upd on public.tr_drivers for update to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'))
  with check (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));

create policy tr_departures_sel on public.tr_departures for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy tr_tickets_sel on public.tr_tickets for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy tr_parcels_sel on public.tr_parcels for select to authenticated using (tenant_id = (select private.current_tenant()));
create policy tr_cash_handovers_sel on public.tr_cash_handovers for select to authenticated
  using (tenant_id = (select private.current_tenant()) and (select private.current_app_role()) in ('owner','manager'));
