-- ============================================================
-- CINÉ — Scheduled jobs (pg_cron)
-- Migration 0005
-- Prasyarat: 0001-0004
-- ============================================================

-- pg_cron tersedia di Supabase. Jika error "permission denied",
-- aktifkan dulu lewat Dashboard > Database > Extensions > pg_cron.
create extension if not exists pg_cron with schema pg_catalog;

-- ------------------------------------------------------------
-- 1. Auto-expire booking, F&B order, payment & lepas kursi (tiap menit)
--    Memanggil release_expired_bookings() dari 0002.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cine_release_expired_bookings') then
    perform cron.unschedule('cine_release_expired_bookings');
  end if;
end $$;

select cron.schedule(
  'cine_release_expired_bookings',
  '* * * * *',
  $$ select public.release_expired_bookings(); $$
);

-- ------------------------------------------------------------
-- 2. Nonaktifkan showtime yang sudah lewat (tiap 15 menit)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cine_deactivate_past_showtimes') then
    perform cron.unschedule('cine_deactivate_past_showtimes');
  end if;
end $$;

select cron.schedule(
  'cine_deactivate_past_showtimes',
  '*/15 * * * *',
  $$
    update public.showtimes
    set is_active = false
    where is_active = true
      and (show_date + end_time) < (now() at time zone 'Asia/Jakarta');
  $$
);

-- ------------------------------------------------------------
-- 3. Bersih-bersih harian, 02:00 WIB = 19:00 UTC
--    - notifikasi yang sudah dibaca > 90 hari dihapus
--    - film coming_soon yang tanggal rilisnya sudah lewat -> now_showing
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cine_daily_maintenance') then
    perform cron.unschedule('cine_daily_maintenance');
  end if;
end $$;

select cron.schedule(
  'cine_daily_maintenance',
  '0 19 * * *',
  $$
    delete from public.notifications
    where read_at is not null
      and read_at < now() - interval '90 days';

    update public.movies
    set status = 'now_showing'
    where status = 'coming_soon'
      and release_date is not null
      and release_date <= (now() at time zone 'Asia/Jakarta')::date;
  $$
);

-- ------------------------------------------------------------
-- Cek job terdaftar:
--   select jobid, jobname, schedule, active from cron.job order by jobid;
-- Cek riwayat eksekusi:
--   select * from cron.job_run_details order by start_time desc limit 10;
-- ------------------------------------------------------------
