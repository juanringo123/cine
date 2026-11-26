-- ============================================================
-- CINÉ — Row Level Security, Storage, Realtime
-- Migration 0003
-- Prasyarat: 0001_init.sql dan 0002_functions_triggers.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Aktifkan RLS di semua tabel public
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'genres', 'movies', 'movie_genres', 'movie_cast',
    'cinemas', 'studios', 'seats',
    'showtimes', 'showtime_seats',
    'profiles', 'promos',
    'bookings', 'booking_seats',
    'fnb_categories', 'fnb_items', 'fnb_variants',
    'fnb_orders', 'fnb_order_items',
    'payments', 'promo_redemptions',
    'notifications', 'faqs', 'app_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. Katalog publik: baca untuk semua, tulis hanya admin
--    (genres, movies, movie_genres, movie_cast, cinemas, studios,
--     seats, fnb_categories, fnb_items, fnb_variants, faqs,
--     app_settings)
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'genres', 'movies', 'movie_genres', 'movie_cast',
    'cinemas', 'studios', 'seats',
    'fnb_categories', 'fnb_items', 'fnb_variants',
    'faqs', 'app_settings'
  ]
  loop
    execute format('drop policy if exists "%1$s_select_public" on public.%1$I', t);
    execute format(
      'create policy "%1$s_select_public" on public.%1$I
         for select to anon, authenticated using (true)',
      t
    );

    execute format('drop policy if exists "%1$s_admin_all" on public.%1$I', t);
    execute format(
      'create policy "%1$s_admin_all" on public.%1$I
         for all to authenticated
         using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. Showtimes & showtime_seats
--    Inventaris kursi dibaca publik (dibutuhkan realtime seat map).
--    Perubahan status kursi HANYA lewat function security definer.
-- ------------------------------------------------------------
drop policy if exists "showtimes_select_public" on public.showtimes;
create policy "showtimes_select_public" on public.showtimes
  for select to anon, authenticated
  using (is_active = true or public.is_staff());

drop policy if exists "showtimes_admin_all" on public.showtimes;
create policy "showtimes_admin_all" on public.showtimes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "showtime_seats_select_public" on public.showtime_seats;
create policy "showtime_seats_select_public" on public.showtime_seats
  for select to anon, authenticated using (true);

drop policy if exists "showtime_seats_admin_all" on public.showtime_seats;
create policy "showtime_seats_admin_all" on public.showtime_seats
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 4. Profiles
-- ------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Insert profil dilakukan trigger handle_new_user (security definer),
-- jadi tidak ada policy insert untuk user biasa.

-- ------------------------------------------------------------
-- 5. Promos: user hanya melihat promo aktif & berlaku
-- ------------------------------------------------------------
drop policy if exists "promos_select_active" on public.promos;
create policy "promos_select_active" on public.promos
  for select to anon, authenticated
  using (
    (is_active = true and now() between valid_from and valid_until)
    or public.is_staff()
  );

drop policy if exists "promos_admin_all" on public.promos;
create policy "promos_admin_all" on public.promos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. Bookings & booking_seats
--    Insert/update oleh function security definer
--    (create_booking, cancel_booking, confirm_payment, dst).
-- ------------------------------------------------------------
drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "bookings_staff_update" on public.bookings;
create policy "bookings_staff_update" on public.bookings
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "bookings_admin_all" on public.bookings;
create policy "bookings_admin_all" on public.bookings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "booking_seats_select_own" on public.booking_seats;
create policy "booking_seats_select_own" on public.booking_seats
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_seats.booking_id
        and b.user_id = auth.uid()
    )
  );

drop policy if exists "booking_seats_admin_all" on public.booking_seats;
create policy "booking_seats_admin_all" on public.booking_seats
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 7. F&B orders
-- ------------------------------------------------------------
drop policy if exists "fnb_orders_select_own" on public.fnb_orders;
create policy "fnb_orders_select_own" on public.fnb_orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "fnb_orders_staff_update" on public.fnb_orders;
create policy "fnb_orders_staff_update" on public.fnb_orders
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "fnb_orders_admin_all" on public.fnb_orders;
create policy "fnb_orders_admin_all" on public.fnb_orders
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "fnb_order_items_select_own" on public.fnb_order_items;
create policy "fnb_order_items_select_own" on public.fnb_order_items
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.fnb_orders o
      where o.id = fnb_order_items.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "fnb_order_items_admin_all" on public.fnb_order_items;
create policy "fnb_order_items_admin_all" on public.fnb_order_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 8. Payments & promo redemptions (read-only untuk user)
-- ------------------------------------------------------------
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = auth.uid()
    )
    or exists (
      select 1 from public.fnb_orders o
      where o.id = payments.fnb_order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "promo_redemptions_select_own" on public.promo_redemptions;
create policy "promo_redemptions_select_own" on public.promo_redemptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "promo_redemptions_admin_all" on public.promo_redemptions;
create policy "promo_redemptions_admin_all" on public.promo_redemptions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 9. Notifications
--    User boleh baca, tandai dibaca, dan hapus miliknya sendiri.
--    Insert dilakukan trigger notify_* (security definer).
-- ------------------------------------------------------------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all" on public.notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Batasi kolom yang boleh di-update user: hanya read_at.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ------------------------------------------------------------
-- 10. Hardening hak tabel
--     Customer tidak punya policy insert/update/delete di tabel
--     transaksi (semua lewat function security definer), jadi RLS
--     sudah menolaknya. Anon dicabut total dari data privat sebagai
--     lapisan kedua.
-- ------------------------------------------------------------
revoke all on
  public.bookings, public.booking_seats,
  public.fnb_orders, public.fnb_order_items,
  public.payments, public.promo_redemptions,
  public.profiles, public.notifications
from anon;

-- ------------------------------------------------------------
-- 11. Storage buckets
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('movies',  'movies',  true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('cinemas', 'cinemas', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('fnb',     'fnb',     true, 3145728,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Baca publik
drop policy if exists "ciné public read" on storage.objects;
create policy "ciné public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('movies', 'cinemas', 'fnb', 'avatars'));

-- Admin kelola bucket katalog
drop policy if exists "ciné admin write catalog" on storage.objects;
create policy "ciné admin write catalog" on storage.objects
  for all to authenticated
  using (bucket_id in ('movies', 'cinemas', 'fnb') and public.is_admin())
  with check (bucket_id in ('movies', 'cinemas', 'fnb') and public.is_admin());

-- Avatar: user hanya boleh mengelola folder miliknya ({user_id}/file.ext)
drop policy if exists "ciné avatar insert own" on storage.objects;
create policy "ciné avatar insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ciné avatar update own" on storage.objects;
create policy "ciné avatar update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ciné avatar delete own" on storage.objects;
create policy "ciné avatar delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 12. Realtime
--     showtime_seats : peta kursi live
--     bookings/fnb_orders/payments/notifications : status live
--     (realtime tetap mengikuti RLS di atas)
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'showtime_seats', 'bookings', 'fnb_orders', 'payments', 'notifications'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kirim data lama juga pada UPDATE/DELETE agar client bisa membandingkan.
alter table public.showtime_seats replica identity full;
alter table public.bookings replica identity full;
alter table public.fnb_orders replica identity full;
alter table public.payments replica identity full;
alter table public.notifications replica identity full;
