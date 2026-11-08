-- Galmee Transport server logic. Writes run as private SECURITY DEFINER functions with explicit
-- tenant and role checks; each is exposed through a SECURITY INVOKER wrapper in public.

create function private.tr_require_tenant() returns uuid
language plpgsql stable set search_path = public, private as $$
declare v uuid := private.current_tenant();
begin
  if v is null then raise exception 'not_a_member' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function private.tr_require_tenant() from public, anon;
grant execute on function private.tr_require_tenant() to authenticated;

create function private.tr_require_manager() returns void
language plpgsql stable set search_path = public, private as $$
begin
  if private.current_app_role()::text not in ('owner','manager') then raise exception 'not_allowed' using errcode = '42501'; end if;
end $$;
revoke all on function private.tr_require_manager() from public, anon;
grant execute on function private.tr_require_manager() to authenticated;

-- Ethiopian calendar date as D/M/YYYY, for SMS text built in the database.
create function private.tr_eth_date(p_day date) returns text
language plpgsql immutable set search_path = '' as $$
declare
  jdn int := to_char(p_day, 'J')::int;
  c int := jdn - 1723856;
  r int := c % 1461;
  n int := r % 365 + 365 * (r / 1460);
  y int := 4 * (c / 1461) + r / 365 - r / 1460;
begin
  return format('%s/%s/%s', n % 30 + 1, n / 30 + 1, y);
end $$;
revoke all on function private.tr_eth_date(date) from public, anon, authenticated;

create function private.tr_phone_ok(p text) returns boolean
language sql immutable set search_path = '' as $$ select p ~ '^(\+251|0)[1-9][0-9]{8}$' $$;
revoke all on function private.tr_phone_ok(text) from public, anon, authenticated;

-- Schedules a departure; fare and seats are copied so later price or bus changes leave sold tickets intact.
create function private.tr_schedule_departure(p_route uuid, p_vehicle uuid, p_driver uuid, p_departs_at timestamptz, p_fare numeric)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_route tr_routes%rowtype;
  v_seats int;
  v_id uuid;
begin
  perform private.tr_require_manager();
  select * into v_route from tr_routes where id = p_route and tenant_id = v_tenant and active;
  if not found then raise exception 'route_not_found'; end if;
  select seats into v_seats from tr_vehicles where id = p_vehicle and tenant_id = v_tenant and active;
  if not found then raise exception 'vehicle_not_found'; end if;
  if p_driver is not null and not exists (select 1 from tr_drivers where id = p_driver and tenant_id = v_tenant and active) then
    raise exception 'driver_not_found';
  end if;
  if p_departs_at is null or p_departs_at < now() - interval '1 day' then raise exception 'bad_time'; end if;
  if p_fare is not null and p_fare <= 0 then raise exception 'bad_amount'; end if;
  begin
    insert into tr_departures(tenant_id, route_id, vehicle_id, driver_id, departs_at, fare, seats, created_by)
    values (v_tenant, p_route, p_vehicle, p_driver, p_departs_at, coalesce(p_fare, v_route.fare), v_seats, auth.uid())
    returning id into v_id;
  exception when unique_violation then raise exception 'vehicle_busy';
  end;
  return v_id;
end $$;

-- Sells one seat. Safe to retry with the same client_ref (offline queue).
create function private.tr_sell_ticket(p_departure uuid, p_seat int, p_phone text, p_name text, p_method pay_method, p_channel text, p_client_ref uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_dep tr_departures%rowtype;
  v_id uuid;
  v_channel text := coalesce(p_channel, 'office');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_tenant_name text;
  v_route text;
begin
  if p_client_ref is not null then
    select id into v_id from tr_tickets where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if v_channel not in ('office','onboard') then raise exception 'bad_channel'; end if;
  if v_phone is not null and not private.tr_phone_ok(v_phone) then raise exception 'bad_phone'; end if;

  select * into v_dep from tr_departures where id = p_departure and tenant_id = v_tenant for update;
  if not found then raise exception 'departure_not_found'; end if;
  if v_dep.status in ('arrived','cancelled') or (v_dep.status = 'departed' and v_channel = 'office') then
    raise exception 'departure_closed';
  end if;
  if p_seat is null or p_seat < 1 or p_seat > v_dep.seats then raise exception 'bad_seat'; end if;

  begin
    insert into tr_tickets(tenant_id, departure_id, seat, fare, passenger_name, passenger_phone, method, channel, sold_by, client_ref)
    values (v_tenant, p_departure, p_seat, v_dep.fare, nullif(btrim(coalesce(p_name, '')), ''), v_phone, coalesce(p_method, 'cash'), v_channel, auth.uid(), p_client_ref)
    returning id into v_id;
  exception when unique_violation then
    if p_client_ref is not null then
      select id into v_id from tr_tickets where tenant_id = v_tenant and client_ref = p_client_ref;
      if found then return v_id; end if;
    end if;
    raise exception 'seat_taken';
  end;

  if v_phone is not null then
    select name into v_tenant_name from tenants where id = v_tenant;
    select origin || ' - ' || destination into v_route from tr_routes where id = v_dep.route_id;
    insert into notifications(tenant_id, channel, to_addr, body)
    values (v_tenant, 'sms', v_phone,
      format('%s: ትኬት %s፣ ቀን %s %s፣ ወንበር %s፣ ብር %s', v_tenant_name, v_route,
        private.tr_eth_date(v_dep.departs_day),
        to_char(v_dep.departs_at at time zone 'Africa/Addis_Ababa', 'HH24:MI'),
        p_seat, to_char(v_dep.fare, 'FM999,999,990.00')));
  end if;
  return v_id;
end $$;

-- Staff never void money records: owner or manager only. The row stays; the seat is freed.
create function private.tr_void_ticket(p_ticket uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_ticket tr_tickets%rowtype;
begin
  perform private.tr_require_manager();
  if coalesce(char_length(btrim(p_reason)), 0) < 2 then raise exception 'reason_required'; end if;
  select * into v_ticket from tr_tickets where id = p_ticket and tenant_id = v_tenant for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if v_ticket.voided_at is not null then raise exception 'already_voided'; end if;
  update tr_tickets set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason) where id = p_ticket;
end $$;

-- Moves a departure along scheduled > boarding > departed > arrived; arrival sends parcels on it to the arrived state.
create function private.tr_set_departure_status(p_departure uuid, p_status text)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_dep tr_departures%rowtype;
  v_tenant_name text;
  v_parcel record;
begin
  select * into v_dep from tr_departures where id = p_departure and tenant_id = v_tenant for update;
  if not found then raise exception 'departure_not_found'; end if;
  if not (
    (v_dep.status = 'scheduled' and p_status in ('boarding','departed','cancelled'))
    or (v_dep.status = 'boarding' and p_status in ('departed','cancelled'))
    or (v_dep.status = 'departed' and p_status = 'arrived')
  ) then raise exception 'bad_status'; end if;
  if p_status = 'cancelled' then
    perform private.tr_require_manager();
    if exists (select 1 from tr_tickets where departure_id = p_departure and voided_at is null) then
      raise exception 'departure_has_tickets';
    end if;
  end if;

  update tr_departures set status = p_status,
    departed_at = case when p_status = 'departed' then now() else departed_at end,
    arrived_at = case when p_status = 'arrived' then now() else arrived_at end
  where id = p_departure;

  if p_status = 'arrived' then
    select name into v_tenant_name from tenants where id = v_tenant;
    for v_parcel in
      update tr_parcels set status = 'arrived', arrived_at = now()
      where departure_id = p_departure and status = 'loaded'
      returning waybill_no, receiver_phone
    loop
      insert into notifications(tenant_id, channel, to_addr, body)
      values (v_tenant, 'sms', v_parcel.receiver_phone,
        format('%s: ጭነት ቁጥር %s ደርሷል። እባክዎ ይውሰዱ።', v_tenant_name, v_parcel.waybill_no));
    end loop;
  end if;
end $$;

-- Registers a parcel and its fee; the receiving seller is accountable for the cash.
create function private.tr_register_parcel(
  p_route uuid, p_sender_name text, p_sender_phone text, p_receiver_name text, p_receiver_phone text,
  p_description text, p_weight numeric, p_fee numeric, p_method pay_method, p_client_ref uuid
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_id uuid;
  v_no int;
  v_receiver text := btrim(coalesce(p_receiver_phone, ''));
  v_sender text := nullif(btrim(coalesce(p_sender_phone, '')), '');
begin
  if p_client_ref is not null then
    select id into v_id from tr_parcels where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if not exists (select 1 from tr_routes where id = p_route and tenant_id = v_tenant) then raise exception 'route_not_found'; end if;
  if not private.tr_phone_ok(v_receiver) or (v_sender is not null and not private.tr_phone_ok(v_sender)) then raise exception 'bad_phone'; end if;
  if coalesce(char_length(btrim(p_sender_name)), 0) < 2 or coalesce(char_length(btrim(p_receiver_name)), 0) < 2 then raise exception 'name_required'; end if;
  if coalesce(char_length(btrim(p_description)), 0) < 2 then raise exception 'description_required'; end if;
  if p_fee is null or p_fee < 0 then raise exception 'bad_amount'; end if;
  if p_weight is not null and p_weight <= 0 then raise exception 'bad_weight'; end if;

  perform pg_advisory_xact_lock(hashtext('tr_parcels:' || v_tenant::text));
  select coalesce(max(waybill_no), 0) + 1 into v_no from tr_parcels where tenant_id = v_tenant;
  insert into tr_parcels(tenant_id, waybill_no, route_id, sender_name, sender_phone, receiver_name, receiver_phone, description, weight_kg, fee, method, received_by, client_ref)
  values (v_tenant, v_no, p_route, btrim(p_sender_name), v_sender, btrim(p_receiver_name), v_receiver, btrim(p_description), p_weight, p_fee, coalesce(p_method, 'cash'), auth.uid(), p_client_ref)
  returning id into v_id;
  return v_id;
end $$;

create function private.tr_set_parcel_status(p_parcel uuid, p_status text, p_departure uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_parcel tr_parcels%rowtype;
  v_dep tr_departures%rowtype;
  v_tenant_name text;
begin
  select * into v_parcel from tr_parcels where id = p_parcel and tenant_id = v_tenant for update;
  if not found then raise exception 'parcel_not_found'; end if;
  if not (
    (v_parcel.status = 'received' and p_status in ('loaded','cancelled'))
    or (v_parcel.status = 'loaded' and p_status in ('arrived','cancelled'))
    or (v_parcel.status = 'arrived' and p_status = 'collected')
  ) then raise exception 'bad_status'; end if;
  if p_status = 'cancelled' then perform private.tr_require_manager(); end if;

  if p_status = 'loaded' then
    select * into v_dep from tr_departures where id = p_departure and tenant_id = v_tenant;
    if not found then raise exception 'departure_not_found'; end if;
    if v_dep.route_id <> v_parcel.route_id then raise exception 'wrong_route'; end if;
    if v_dep.status not in ('scheduled','boarding') then raise exception 'departure_closed'; end if;
  end if;

  update tr_parcels set status = p_status,
    departure_id = case when p_status = 'loaded' then p_departure else departure_id end,
    loaded_at = case when p_status = 'loaded' then now() else loaded_at end,
    arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
    collected_at = case when p_status = 'collected' then now() else collected_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = p_parcel;

  if p_status = 'arrived' then
    select name into v_tenant_name from tenants where id = v_tenant;
    insert into notifications(tenant_id, channel, to_addr, body)
    values (v_tenant, 'sms', v_parcel.receiver_phone,
      format('%s: ጭነት ቁጥር %s ደርሷል። እባክዎ ይውሰዱ።', v_tenant_name, v_parcel.waybill_no));
  end if;
end $$;

-- Cash a seller or a bus owes for a day: office cash tickets and parcels for a seller, onboard cash tickets for a bus.
create function private.tr_expected_cash(p_tenant uuid, p_day date, p_kind text, p_seller uuid, p_vehicle uuid)
returns numeric language sql stable set search_path = public, private as $$
  select case p_kind
    when 'seller' then
      coalesce((select sum(fare) from tr_tickets t where t.tenant_id = p_tenant and t.sold_day = p_day and t.sold_by = p_seller
                and t.channel = 'office' and t.method = 'cash' and t.voided_at is null), 0)
      + coalesce((select sum(fee) from tr_parcels p where p.tenant_id = p_tenant and p.sold_day = p_day and p.received_by = p_seller
                and p.method = 'cash' and p.status <> 'cancelled'), 0)
    else
      coalesce((select sum(t.fare) from tr_tickets t join tr_departures d on d.id = t.departure_id
                where t.tenant_id = p_tenant and t.sold_day = p_day and d.vehicle_id = p_vehicle
                and t.channel = 'onboard' and t.method = 'cash' and t.voided_at is null), 0)
  end
$$;
revoke all on function private.tr_expected_cash(uuid, date, text, uuid, uuid) from public, anon, authenticated;

create function private.tr_record_handover(p_day date, p_kind text, p_seller uuid, p_vehicle uuid, p_amount numeric, p_note text, p_client_ref uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_id uuid;
  v_seller uuid := case when p_kind = 'seller' then p_seller end;
  v_vehicle uuid := case when p_kind = 'vehicle' then p_vehicle end;
begin
  perform private.tr_require_manager();
  if p_client_ref is not null then
    select id into v_id from tr_cash_handovers where tenant_id = v_tenant and client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if p_kind not in ('seller','vehicle') then raise exception 'bad_kind'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  if p_day is null or p_day > (now() at time zone 'Africa/Addis_Ababa')::date then raise exception 'bad_day'; end if;
  if p_kind = 'seller' and not exists (select 1 from profiles where user_id = v_seller and tenant_id = v_tenant) then
    raise exception 'seller_not_found';
  end if;
  if p_kind = 'vehicle' and not exists (select 1 from tr_vehicles where id = v_vehicle and tenant_id = v_tenant) then
    raise exception 'vehicle_not_found';
  end if;
  insert into tr_cash_handovers(tenant_id, day, kind, seller_id, vehicle_id, amount, expected, note, received_by, client_ref)
  values (v_tenant, p_day, p_kind, v_seller, v_vehicle, p_amount,
          private.tr_expected_cash(v_tenant, p_day, p_kind, v_seller, v_vehicle),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), p_client_ref)
  returning id into v_id;
  return v_id;
end $$;

create function private.tr_reverse_handover(p_handover uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_tenant uuid := private.tr_require_tenant();
  v_row tr_cash_handovers%rowtype;
begin
  perform private.tr_require_manager();
  select * into v_row from tr_cash_handovers where id = p_handover and tenant_id = v_tenant for update;
  if not found then raise exception 'handover_not_found'; end if;
  if v_row.reversed_at is not null then raise exception 'already_reversed'; end if;
  update tr_cash_handovers set reversed_at = now(), reversed_by = auth.uid() where id = p_handover;
end $$;

-- End-of-day reconciliation: per seller and per bus, cash that should have been handed in against cash received.
create function private.tr_reconcile(p_day date)
returns table (kind text, seller_id uuid, vehicle_id uuid, label text, tickets bigint, parcels bigint, sold numeric, expected numeric, handed numeric, short numeric)
language plpgsql stable security definer set search_path = public, private as $$
declare v_tenant uuid := private.tr_require_tenant();
begin
  perform private.tr_require_manager();
  return query
  with sellers as (
    select t.sold_by as uid from tr_tickets t where t.tenant_id = v_tenant and t.sold_day = p_day and t.channel = 'office' and t.voided_at is null
    union select p.received_by from tr_parcels p where p.tenant_id = v_tenant and p.sold_day = p_day and p.status <> 'cancelled'
    union select h.seller_id from tr_cash_handovers h where h.tenant_id = v_tenant and h.day = p_day and h.kind = 'seller' and h.reversed_at is null
  ), buses as (
    select d.vehicle_id as vid from tr_tickets t join tr_departures d on d.id = t.departure_id
      where t.tenant_id = v_tenant and t.sold_day = p_day and t.channel = 'onboard' and t.voided_at is null
    union select h.vehicle_id from tr_cash_handovers h where h.tenant_id = v_tenant and h.day = p_day and h.kind = 'vehicle' and h.reversed_at is null
  ), res as (
    select 'seller'::text as kind, s.uid as seller_id, null::uuid as vehicle_id, pr.full_name as label,
      (select count(*) from tr_tickets t where t.tenant_id = v_tenant and t.sold_day = p_day and t.sold_by = s.uid and t.channel = 'office' and t.voided_at is null) as tickets,
      (select count(*) from tr_parcels p where p.tenant_id = v_tenant and p.sold_day = p_day and p.received_by = s.uid and p.status <> 'cancelled') as parcels,
      coalesce((select sum(t.fare) from tr_tickets t where t.tenant_id = v_tenant and t.sold_day = p_day and t.sold_by = s.uid and t.channel = 'office' and t.voided_at is null), 0)
        + coalesce((select sum(p.fee) from tr_parcels p where p.tenant_id = v_tenant and p.sold_day = p_day and p.received_by = s.uid and p.status <> 'cancelled'), 0) as sold,
      private.tr_expected_cash(v_tenant, p_day, 'seller', s.uid, null) as expected,
      coalesce((select sum(h.amount) from tr_cash_handovers h where h.tenant_id = v_tenant and h.day = p_day and h.kind = 'seller' and h.seller_id = s.uid and h.reversed_at is null), 0) as handed
    from sellers s join profiles pr on pr.user_id = s.uid and pr.tenant_id = v_tenant
    union all
    select 'vehicle', null, b.vid, coalesce(v.name, v.plate),
      (select count(*) from tr_tickets t join tr_departures d on d.id = t.departure_id where t.tenant_id = v_tenant and t.sold_day = p_day and d.vehicle_id = b.vid and t.channel = 'onboard' and t.voided_at is null),
      0::bigint,
      coalesce((select sum(t.fare) from tr_tickets t join tr_departures d on d.id = t.departure_id where t.tenant_id = v_tenant and t.sold_day = p_day and d.vehicle_id = b.vid and t.channel = 'onboard' and t.voided_at is null), 0),
      private.tr_expected_cash(v_tenant, p_day, 'vehicle', null, b.vid),
      coalesce((select sum(h.amount) from tr_cash_handovers h where h.tenant_id = v_tenant and h.day = p_day and h.kind = 'vehicle' and h.vehicle_id = b.vid and h.reversed_at is null), 0)
    from buses b join tr_vehicles v on v.id = b.vid and v.tenant_id = v_tenant
  )
  select r.kind, r.seller_id, r.vehicle_id, r.label, r.tickets, r.parcels, r.sold, r.expected, r.handed, r.expected - r.handed
  from res r order by r.kind, r.label;
end $$;

-- Daily route report: departures that leave on the day, seats sold, money per route.
create function private.tr_route_report(p_day date)
returns table (route_id uuid, origin text, destination text, departures bigint, seats bigint, tickets bigint, ticket_total numeric, parcels bigint, parcel_total numeric)
language plpgsql stable security definer set search_path = public, private as $$
declare v_tenant uuid := private.tr_require_tenant();
begin
  perform private.tr_require_manager();
  return query
  with deps as (
    select d.route_id as rid, count(*) as n, sum(d.seats)::bigint as seat_total
    from tr_departures d where d.tenant_id = v_tenant and d.departs_day = p_day and d.status <> 'cancelled' group by d.route_id
  ), tix as (
    select d.route_id as rid, count(*) as n, sum(t.fare) as total
    from tr_tickets t join tr_departures d on d.id = t.departure_id
    where t.tenant_id = v_tenant and d.departs_day = p_day and d.status <> 'cancelled' and t.voided_at is null group by d.route_id
  ), parc as (
    select p.route_id as rid, count(*) as n, sum(p.fee) as total
    from tr_parcels p where p.tenant_id = v_tenant and p.sold_day = p_day and p.status <> 'cancelled' group by p.route_id
  )
  select r.id, r.origin, r.destination, coalesce(deps.n, 0), coalesce(deps.seat_total, 0),
    coalesce(tix.n, 0), coalesce(tix.total, 0), coalesce(parc.n, 0), coalesce(parc.total, 0)
  from tr_routes r
  left join deps on deps.rid = r.id
  left join tix on tix.rid = r.id
  left join parc on parc.rid = r.id
  where r.tenant_id = v_tenant and (deps.rid is not null or parc.rid is not null)
  order by r.origin, r.destination;
end $$;

create function public.tr_schedule_departure(p_route uuid, p_vehicle uuid, p_departs_at timestamptz, p_driver uuid default null, p_fare numeric default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.tr_schedule_departure(p_route, p_vehicle, p_driver, p_departs_at, p_fare) $$;
create function public.tr_sell_ticket(p_departure uuid, p_seat int, p_phone text default null, p_name text default null, p_method pay_method default 'cash', p_channel text default 'office', p_client_ref uuid default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.tr_sell_ticket(p_departure, p_seat, p_phone, p_name, p_method, p_channel, p_client_ref) $$;
create function public.tr_void_ticket(p_ticket uuid, p_reason text)
returns void language sql security invoker set search_path = public, private as $$ select private.tr_void_ticket(p_ticket, p_reason) $$;
create function public.tr_set_departure_status(p_departure uuid, p_status text)
returns void language sql security invoker set search_path = public, private as $$ select private.tr_set_departure_status(p_departure, p_status) $$;
create function public.tr_register_parcel(p_route uuid, p_sender_name text, p_receiver_name text, p_receiver_phone text, p_description text, p_fee numeric, p_sender_phone text default null, p_weight numeric default null, p_method pay_method default 'cash', p_client_ref uuid default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.tr_register_parcel(p_route, p_sender_name, p_sender_phone, p_receiver_name, p_receiver_phone, p_description, p_weight, p_fee, p_method, p_client_ref) $$;
create function public.tr_set_parcel_status(p_parcel uuid, p_status text, p_departure uuid default null)
returns void language sql security invoker set search_path = public, private as $$ select private.tr_set_parcel_status(p_parcel, p_status, p_departure) $$;
create function public.tr_record_handover(p_day date, p_kind text, p_amount numeric, p_seller uuid default null, p_vehicle uuid default null, p_note text default null, p_client_ref uuid default null)
returns uuid language sql security invoker set search_path = public, private as $$ select private.tr_record_handover(p_day, p_kind, p_seller, p_vehicle, p_amount, p_note, p_client_ref) $$;
create function public.tr_reverse_handover(p_handover uuid)
returns void language sql security invoker set search_path = public, private as $$ select private.tr_reverse_handover(p_handover) $$;
create function public.tr_reconcile(p_day date)
returns table (kind text, seller_id uuid, vehicle_id uuid, label text, tickets bigint, parcels bigint, sold numeric, expected numeric, handed numeric, short numeric)
language sql stable security invoker set search_path = public, private as $$ select * from private.tr_reconcile(p_day) $$;
create function public.tr_route_report(p_day date)
returns table (route_id uuid, origin text, destination text, departures bigint, seats bigint, tickets bigint, ticket_total numeric, parcels bigint, parcel_total numeric)
language sql stable security invoker set search_path = public, private as $$ select * from private.tr_route_report(p_day) $$;

do $$
declare f text;
begin
  foreach f in array array[
    'tr_schedule_departure(uuid,uuid,uuid,timestamptz,numeric)',
    'tr_sell_ticket(uuid,int,text,text,pay_method,text,uuid)',
    'tr_void_ticket(uuid,text)',
    'tr_set_departure_status(uuid,text)',
    'tr_register_parcel(uuid,text,text,text,text,text,numeric,numeric,pay_method,uuid)',
    'tr_set_parcel_status(uuid,text,uuid)',
    'tr_record_handover(date,text,uuid,uuid,numeric,text,uuid)',
    'tr_reverse_handover(uuid)',
    'tr_reconcile(date)',
    'tr_route_report(date)'
  ] loop
    execute format('revoke all on function private.%s from public, anon', f);
    execute format('grant execute on function private.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'tr_schedule_departure(uuid,uuid,timestamptz,uuid,numeric)',
    'tr_sell_ticket(uuid,int,text,text,pay_method,text,uuid)',
    'tr_void_ticket(uuid,text)',
    'tr_set_departure_status(uuid,text)',
    'tr_register_parcel(uuid,text,text,text,text,numeric,text,numeric,pay_method,uuid)',
    'tr_set_parcel_status(uuid,text,uuid)',
    'tr_record_handover(date,text,numeric,uuid,uuid,text,uuid)',
    'tr_reverse_handover(uuid)',
    'tr_reconcile(date)',
    'tr_route_report(date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
