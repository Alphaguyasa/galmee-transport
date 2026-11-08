-- Cross-tenant RLS and workflow test for Galmee Transport. Run with Supabase `execute_sql`.
-- Everything rolls back: the final RAISE carries the result line. Compare each value with its "expect".
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  ta uuid; tb uuid; ra uuid; rb uuid; va uuid; vb uuid; da uuid; db uuid; t1 uuid; t2 uuid; pa uuid; h uuid; n int; r text := ''; ok boolean; err text; v numeric; rec record;
  d date := (now() at time zone 'Africa/Addis_Ababa')::date;
begin
  insert into auth.users(id, aud, role, email) values
    (ua,'authenticated','authenticated','tr-a@test.invalid'),(ub,'authenticated','authenticated','tr-b@test.invalid'),(uc,'authenticated','authenticated','tr-c@test.invalid');
  insert into public.tenants(name, vertical) values ('TR A','transport') returning id into ta;
  insert into public.tenants(name, vertical) values ('TR B','transport') returning id into tb;
  insert into public.profiles(user_id, tenant_id, full_name, role) values (ua, ta, 'A owner','owner'), (ub, tb, 'B owner','owner'), (uc, ta, 'A seller','staff');

  r := 'eth date=' || private.tr_eth_date(date '2026-11-08') || ' (expect 29/2/2019); ';

  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  insert into public.tr_routes(origin,destination,fare) values ('Shashamane','Dodola',200) returning id into rb;
  insert into public.tr_vehicles(plate,seats) values ('3-BB 1',20) returning id into vb;
  db := public.tr_schedule_departure(rb, vb, now() + interval '2 hours');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  insert into public.tr_routes(origin,destination,fare) values ('Shashamane','Hawassa',100) returning id into ra;
  insert into public.tr_vehicles(plate,seats,name) values ('3-AA 1',12,'Bus 1') returning id into va;
  da := public.tr_schedule_departure(ra, va, now() + interval '1 hour');
  begin perform public.tr_schedule_departure(ra, va, (select departs_at from public.tr_departures where id=da)); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'same bus same time=' || ok || ' err=' || err || ' (expect false, vehicle_busy); ';
  begin perform public.tr_schedule_departure(rb, va, now() + interval '3 hours'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'A schedules B route=' || ok || ' err=' || err || ' (expect false, route_not_found); ';

  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role','authenticated')::text, true);
  begin perform public.tr_schedule_departure(ra, va, now() + interval '4 hours'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'staff schedules=' || ok || ' err=' || err || ' (expect false, not_allowed); ';
  begin insert into public.tr_routes(origin,destination,fare) values ('Xx','Yy',10); ok := true; exception when others then ok := false; end;
  r := r || 'staff adds route=' || ok || ' (expect false); ';

  t1 := public.tr_sell_ticket(da, 5, '0911000001', 'Pax', 'cash', 'office', '44444444-4444-4444-4444-444444444444');
  r := r || 'idempotent=' || (public.tr_sell_ticket(da, 5, '0911000001', 'Pax', 'cash', 'office', '44444444-4444-4444-4444-444444444444') = t1) || ' (expect true); ';
  select count(*) into n from public.tr_tickets where departure_id = da; r := r || 'tickets after retry=' || n || ' (expect 1); ';
  begin perform public.tr_sell_ticket(da, 5); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'seat twice=' || ok || ' err=' || err || ' (expect false, seat_taken); ';
  begin perform public.tr_sell_ticket(da, 13); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'seat 13 of 12=' || ok || ' err=' || err || ' (expect false, bad_seat); ';
  begin perform public.tr_sell_ticket(da, 6, '12345'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'bad phone=' || ok || ' err=' || err || ' (expect false, bad_phone); ';
  begin perform public.tr_sell_ticket(db, 1); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'A sells on B departure=' || ok || ' err=' || err || ' (expect false, departure_not_found); ';
  select count(*) into n from public.notifications where to_addr='0911000001' and body like '%ወንበር 5%'; r := r || 'sms queued=' || n || ' (expect 1); ';
  begin insert into public.tr_tickets(departure_id,seat,fare) values (da,7,1); ok := true; exception when others then ok := false; end;
  r := r || 'staff direct ticket insert=' || ok || ' (expect false); ';
  begin update public.tr_tickets set fare=1 where id=t1; get diagnostics n = row_count; exception when others then n := -1; end; r := r || 'staff direct ticket update rows=' || n || ' (expect 0 or -1); ';
  begin perform public.tr_void_ticket(t1,'mistake'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'staff voids=' || ok || ' err=' || err || ' (expect false, not_allowed); ';
  begin select count(*) into n from public.tr_cash_handovers; exception when others then n := -1; end; r := r || 'staff sees handovers=' || n || ' (expect 0); ';
  begin perform * from public.tr_reconcile(d); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'staff reconciles=' || ok || ' err=' || err || ' (expect false, not_allowed); ';

  t2 := public.tr_sell_ticket(da, 6, null, null, 'telebirr');
  perform public.tr_sell_ticket(da, 7, null, null, 'cash', 'onboard');
  pa := public.tr_register_parcel(ra,'Sender','Receiver','0911000009','Box of coffee', 50);
  select waybill_no into n from public.tr_parcels where id=pa; r := r || 'waybill=' || n || ' (expect 1); ';

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  select expected into v from public.tr_reconcile(d) where seller_id = uc; r := r || 'seller expected=' || v || ' (expect 150: office cash 100 + parcel 50, telebirr excluded); ';
  select expected into v from public.tr_reconcile(d) where vehicle_id = va; r := r || 'bus expected=' || v || ' (expect 100: onboard cash); ';
  h := public.tr_record_handover(d,'seller',120,uc,null,'part','55555555-5555-5555-5555-555555555555');
  perform public.tr_record_handover(d,'seller',120,uc,null,'part','55555555-5555-5555-5555-555555555555');
  select handed, short into rec from public.tr_reconcile(d) where seller_id = uc; r := r || 'handed=' || rec.handed || ' short=' || rec.short || ' (expect 120, 30, retry not double); ';
  begin perform public.tr_record_handover(d,'seller',10,ub); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'handover for B user=' || ok || ' err=' || err || ' (expect false, seller_not_found); ';
  begin perform public.tr_record_handover(d,'vehicle',10,null,vb); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'handover for B bus=' || ok || ' err=' || err || ' (expect false, vehicle_not_found); ';
  perform public.tr_reverse_handover(h);
  select handed into v from public.tr_reconcile(d) where seller_id = uc; r := r || 'handed after reversal=' || v || ' (expect 0); ';
  perform public.tr_void_ticket(t1,'Passenger cancelled');
  select expected into v from public.tr_reconcile(d) where seller_id = uc; r := r || 'expected after void=' || v || ' (expect 50); ';
  perform public.tr_sell_ticket(da, 5);
  r := r || 'seat resold after void ok; ';
  select tickets, ticket_total, seats, departures, parcels, parcel_total into rec from public.tr_route_report(d) where route_id=ra;
  r := r || 'route report tickets=' || rec.tickets || ' total=' || rec.ticket_total || ' seats=' || rec.seats || ' deps=' || rec.departures || ' parcels=' || rec.parcels || ' fee=' || rec.parcel_total || ' (expect 3,300,12,1,1,50); ';

  begin perform public.tr_set_parcel_status(pa,'loaded',db); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'load on B departure=' || ok || ' err=' || err || ' (expect false, departure_not_found); ';
  perform public.tr_set_parcel_status(pa,'loaded',da);
  begin perform public.tr_set_departure_status(da,'cancelled'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'cancel with tickets=' || ok || ' err=' || err || ' (expect false, departure_has_tickets); ';
  perform public.tr_set_departure_status(da,'departed');
  begin perform public.tr_sell_ticket(da, 8); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'office sale after departure=' || ok || ' err=' || err || ' (expect false, departure_closed); ';
  perform public.tr_set_departure_status(da,'arrived');
  select status into err from public.tr_parcels where id=pa; r := r || 'parcel after arrival=' || err || ' (expect arrived); ';
  select count(*) into n from public.notifications where to_addr='0911000009' and body like '%ደርሷል%'; r := r || 'parcel sms=' || n || ' (expect 1); ';
  perform public.tr_set_parcel_status(pa,'collected');
  begin perform public.tr_set_parcel_status(pa,'loaded',da); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'collected then loaded=' || ok || ' err=' || err || ' (expect false, bad_status); ';

  select count(*) into n from public.tr_departures where id=db; r := r || 'A sees B departure=' || n || ' (expect 0); ';
  select count(*) into n from public.tr_routes where id=rb; r := r || 'A sees B route=' || n || ' (expect 0); ';
  select count(*) into n from public.tr_vehicles where id=vb; r := r || 'A sees B bus=' || n || ' (expect 0); ';
  begin update public.tr_routes set fare=1 where id=rb; get diagnostics n = row_count; exception when others then n := -1; end; r := r || 'A updates B route rows=' || n || ' (expect 0 or -1); ';
  begin insert into public.tr_routes(tenant_id,origin,destination,fare) values (tb,'Aa','Bb',1); ok := true; exception when others then ok := false; end;
  r := r || 'A inserts into B=' || ok || ' (expect false); ';

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  select count(*) into n from public.tr_tickets; r := r || 'B sees tickets=' || n || ' (expect 0); ';
  select count(*) into n from public.tr_parcels; r := r || 'B sees parcels=' || n || ' (expect 0); ';
  select count(*) into n from public.tr_cash_handovers; r := r || 'B sees handovers=' || n || ' (expect 0); ';
  select count(*) into n from public.tr_reconcile(d); r := r || 'B reconcile rows=' || n || ' (expect 0); ';

  perform set_config('role','anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin select count(*) into n from public.tr_tickets; exception when others then n := -1; end; r := r || 'anon tickets=' || n || ' (expect 0 or -1); ';
  begin select count(*) into n from public.tr_routes; exception when others then n := -1; end; r := r || 'anon routes=' || n || ' (expect 0 or -1); ';
  begin perform public.tr_sell_ticket(da,9); ok := true; exception when others then ok := false; end; r := r || 'anon sells=' || ok || ' (expect false); ';
  begin perform * from public.tr_reconcile(d); ok := true; exception when others then ok := false; end; r := r || 'anon reconcile=' || ok || ' (expect false); ';

  raise exception 'RESULT: %', r;
end $$;
