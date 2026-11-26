-- ============================================================
-- CINÉ — Weekend Ticket Pricing (Migration 0014)
-- Prasyarat: 0001 - 0013
--
-- Aturan tarif:
--   Weekday (Senin–Jumat) : regular_2d 40.000 | 3d 50.000 | imax 75.000 | premiere 95.000
--   Weekend (Sabtu–Minggu): regular_2d 55.000 | 3d 65.000 | imax 90.000 | premiere 115.000
-- ============================================================

insert into public.app_settings (key, value) values
  ('weekend_surcharge', '15000'::jsonb),
  ('premiere_weekend_surcharge', '20000'::jsonb)
on conflict (key) do update set value = excluded.value;

update public.showtimes
set price = case format::text
  when 'regular_2d' then
    case when extract(isodow from show_date) in (6, 7) then 55000 else 40000 end
  when '3d' then
    case when extract(isodow from show_date) in (6, 7) then 65000 else 50000 end
  when 'imax' then
    case when extract(isodow from show_date) in (6, 7) then 90000 else 75000 end
  when 'premiere' then
    case when extract(isodow from show_date) in (6, 7) then 115000 else 95000 end
  else price
end
where is_active = true
  and show_date >= (now() at time zone 'Asia/Jakarta')::date;
