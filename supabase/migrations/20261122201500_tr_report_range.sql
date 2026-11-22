-- Route and bus reports over a date range (an Ethiopian month in the UI).
-- Same rules as tr_route_report: managers only, own tenant only, cancelled departures and voided tickets excluded.

create function private.tr_check_range(p_from date, p_to date) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
end $$;
revoke all on function private.tr_check_range(date, date) from public, anon;
grant execute on function private.tr_check_range(date, date) to authenticated;

create function private.tr_route_report_range(p_from date, p_to date)
returns table (route_id uuid, origin text, destination text, departures bigint, seats bigint, tickets bigint, ticket_total numeric, parcels bigint, parcel_total numeric)
language plpgsql stable security definer set search_path = public, private as $$
declare v_tenant uuid := private.tr_require_tenant();
begin
  perform private.tr_require_manager();
  perform private.tr_check_range(p_from, p_to);
  return query
  with deps as (
    select d.route_id as rid, count(*) as n, sum(d.seats)::bigint as seat_total
    from tr_departures d
    where d.tenant_id = v_tenant and d.departs_day between p_from and p_to and d.status <> 'cancelled'
    group by d.route_id
  ), tix as (
    select d.route_id as rid, count(*) as n, sum(t.fare) as total
    from tr_tickets t join tr_departures d on d.id = t.departure_id
    where t.tenant_id = v_tenant and d.departs_day between p_from and p_to and d.status <> 'cancelled' and t.voided_at is null
    group by d.route_id
  ), parc as (
    select p.route_id as rid, count(*) as n, sum(p.fee) as total
    from tr_parcels p
    where p.tenant_id = v_tenant and p.sold_day between p_from and p_to and p.status <> 'cancelled'
    group by p.route_id
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

create function private.tr_bus_report_range(p_from date, p_to date)
returns table (vehicle_id uuid, plate text, name text, departures bigint, seats bigint, tickets bigint, ticket_total numeric, onboard_cash numeric)
language plpgsql stable security definer set search_path = public, private as $$
declare v_tenant uuid := private.tr_require_tenant();
begin
  perform private.tr_require_manager();
  perform private.tr_check_range(p_from, p_to);
  return query
  with deps as (
    select d.vehicle_id as vid, count(*) as n, sum(d.seats)::bigint as seat_total
    from tr_departures d
    where d.tenant_id = v_tenant and d.departs_day between p_from and p_to and d.status <> 'cancelled'
    group by d.vehicle_id
  ), tix as (
    select d.vehicle_id as vid, count(*) as n, sum(t.fare) as total,
      coalesce(sum(t.fare) filter (where t.channel = 'onboard' and t.method = 'cash'), 0) as onboard
    from tr_tickets t join tr_departures d on d.id = t.departure_id
    where t.tenant_id = v_tenant and d.departs_day between p_from and p_to and d.status <> 'cancelled' and t.voided_at is null
    group by d.vehicle_id
  )
  select v.id, v.plate, v.name, deps.n, deps.seat_total, coalesce(tix.n, 0), coalesce(tix.total, 0), coalesce(tix.onboard, 0)
  from tr_vehicles v
  join deps on deps.vid = v.id
  left join tix on tix.vid = v.id
  where v.tenant_id = v_tenant
  order by coalesce(tix.total, 0) desc, v.plate;
end $$;

create function public.tr_route_report_range(p_from date, p_to date)
returns table (route_id uuid, origin text, destination text, departures bigint, seats bigint, tickets bigint, ticket_total numeric, parcels bigint, parcel_total numeric)
language sql stable security invoker set search_path = public, private as $$ select * from private.tr_route_report_range(p_from, p_to) $$;

create function public.tr_bus_report_range(p_from date, p_to date)
returns table (vehicle_id uuid, plate text, name text, departures bigint, seats bigint, tickets bigint, ticket_total numeric, onboard_cash numeric)
language sql stable security invoker set search_path = public, private as $$ select * from private.tr_bus_report_range(p_from, p_to) $$;

revoke all on function private.tr_route_report_range(date, date) from public, anon;
grant execute on function private.tr_route_report_range(date, date) to authenticated;
revoke all on function private.tr_bus_report_range(date, date) from public, anon;
grant execute on function private.tr_bus_report_range(date, date) to authenticated;
revoke all on function public.tr_route_report_range(date, date) from public, anon;
grant execute on function public.tr_route_report_range(date, date) to authenticated;
revoke all on function public.tr_bus_report_range(date, date) from public, anon;
grant execute on function public.tr_bus_report_range(date, date) to authenticated;
