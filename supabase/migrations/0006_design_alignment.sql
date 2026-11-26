-- ============================================================
-- CINÉ — Supabase Database Schema
-- Migration 0006: design alignment + koreksi korelasi data
-- Prasyarat: 0001 - 0005
-- Target: PostgreSQL 15+ (Supabase)
--
-- Isi:
--   1. Enum gender & card_brand
--   2. profiles: nickname, gender  (+ handle_new_user)
--   3. addresses  (halaman Daftar Alamat / Tambah Alamat)
--   4. saved_cards (halaman Add Card / Metode Pembayaran)
--   5. payments.saved_card_id + overload create_payment()
--   6. View v_my_bookings (tab Aktif / Riwayat)
--   7. Koreksi konsistensi: total, format jadwal, durasi film,
--      total kursi studio, status kursi, pemakaian promo
-- ============================================================

-- ------------------------------------------------------------
-- Helper migration: tambah CHECK tanpa menggagalkan migrations
-- bila ada data lama yang melanggar (dibiarkan NOT VALID).
-- ------------------------------------------------------------
create or replace function public._migration_add_check(
  p_table text,
  p_name text,
  p_expr text
)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = p_name
      and conrelid = to_regclass(format('public.%I', p_table))
  ) then
    return;
  end if;

  execute format(
    'alter table public.%I add constraint %I check (%s) not valid',
    p_table, p_name, p_expr
  );

  begin
    execute format('alter table public.%I validate constraint %I', p_table, p_name);
  exception when others then
    raise notice 'CHECK % pada public.% dibiarkan NOT VALID: %',
      p_name, p_table, sqlerrm;
  end;
end $$;

-- ------------------------------------------------------------
-- 1. Enum baru
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'gender'
  ) then
    execute 'create type public.gender as enum (''male'', ''female'')';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'card_brand'
  ) then
    execute 'create type public.card_brand as enum (''visa'', ''mastercard'', ''amex'', ''other'')';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Profil: Nama Panggilan & Jenis Kelamin
--    (field Register dan Akun Saya di desain)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists gender public.gender;

select public._migration_add_check(
  'profiles',
  'profiles_nickname_check',
  'nickname is null or length(btrim(nickname)) between 1 and 50'
);

-- handle_new_user diperbarui supaya data Register tidak hilang.
-- Metadata gender menerima beberapa alias UI (male/pria/L, female/wanita/P).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
  v_nickname text;
  v_phone text;
  v_terms_version text;
  v_terms_accepted boolean;
  v_gender public.gender;
begin
  v_full_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    concat_ws(
      ' ',
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name'
    )
  )), '');

  if v_full_name is null then
    v_full_name := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'pengguna'), '@', 1)
    );
  end if;

  v_nickname := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'nick_name',
    new.raw_user_meta_data ->> 'nama_panggilan'
  )), '');

  v_phone := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'whatsapp'
  )), '');

  v_terms_version := nullif(trim(new.raw_user_meta_data ->> 'terms_version'), '');

  v_terms_accepted := lower(coalesce(
    new.raw_user_meta_data ->> 'terms_accepted',
    ''
  )) in ('true', '1', 'yes', 'ya');

  v_gender := case lower(coalesce(new.raw_user_meta_data ->> 'gender', ''))
    when 'male'   then 'male'::public.gender
    when 'pria'   then 'male'::public.gender
    when 'l'      then 'male'::public.gender
    when 'female' then 'female'::public.gender
    when 'wanita' then 'female'::public.gender
    when 'p'      then 'female'::public.gender
    else null
  end;

  insert into public.profiles (
    id,
    full_name,
    nickname,
    email,
    phone,
    gender,
    terms_accepted_at,
    terms_version
  )
  values (
    new.id,
    v_full_name,
    v_nickname,
    new.email,
    v_phone,
    v_gender,
    case when v_terms_accepted then now() else null end,
    v_terms_version
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- ------------------------------------------------------------
-- 3. Daftar Alamat
-- ------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Rumah' check (btrim(label) <> ''),
  recipient_name text not null check (btrim(recipient_name) <> ''),
  phone text,
  address_line text not null check (btrim(address_line) <> ''),
  rt text,
  rw text,
  district text,
  city text,
  province text,
  postal_code text,
  courier_note text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists addresses_one_primary_per_user
  on public.addresses (user_id)
  where is_primary;

create index if not exists addresses_user_idx
  on public.addresses (user_id, created_at desc);

alter table public.addresses enable row level security;

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own" on public.addresses
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own" on public.addresses
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own" on public.addresses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own" on public.addresses
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "addresses_admin_all" on public.addresses;
create policy "addresses_admin_all" on public.addresses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.addresses from anon;

drop trigger if exists set_updated_at on public.addresses;
create trigger set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- Alamat pertama otomatis jadi alamat utama; hanya satu utama per user.
create or replace function public.ensure_primary_address()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_primary then
    update public.addresses
    set is_primary = false
    where user_id = new.user_id
      and id <> new.id
      and is_primary;
  elsif not exists (
    select 1 from public.addresses
    where user_id = new.user_id
      and is_primary
      and id <> new.id
  ) then
    new.is_primary := true;
  end if;

  return new;
end $$;

drop trigger if exists ensure_primary_address on public.addresses;
create trigger ensure_primary_address
  before insert or update of is_primary, user_id on public.addresses
  for each row execute function public.ensure_primary_address();

revoke all on function public.ensure_primary_address() from public;

-- ------------------------------------------------------------
-- 4. Kartu tersimpan (Add Card / Metode Pembayaran)
--    Nomor kartu lengkap TIDAK disimpan, hanya token gateway + 4 digit.
-- ------------------------------------------------------------
create table if not exists public.saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand public.card_brand not null default 'other',
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  expiry_month integer not null check (expiry_month between 1 and 12),
  expiry_year integer not null check (expiry_year between 2000 and 2100),
  holder_name text,
  gateway_token text not null check (btrim(gateway_token) <> ''),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_cards_one_default_per_user
  on public.saved_cards (user_id)
  where is_default;

create index if not exists saved_cards_user_idx
  on public.saved_cards (user_id, created_at desc);

alter table public.saved_cards enable row level security;

drop policy if exists "saved_cards_select_own" on public.saved_cards;
create policy "saved_cards_select_own" on public.saved_cards
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "saved_cards_insert_own" on public.saved_cards;
create policy "saved_cards_insert_own" on public.saved_cards
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "saved_cards_update_own" on public.saved_cards;
create policy "saved_cards_update_own" on public.saved_cards
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "saved_cards_delete_own" on public.saved_cards;
create policy "saved_cards_delete_own" on public.saved_cards
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "saved_cards_admin_all" on public.saved_cards;
create policy "saved_cards_admin_all" on public.saved_cards
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.saved_cards from anon;

-- Sembunyikan token gateway dari PostgREST; token hanya dipakai server.
revoke select on public.saved_cards from authenticated;
grant select (
  id, user_id, brand, last4, expiry_month, expiry_year,
  holder_name, is_default, created_at, updated_at
) on public.saved_cards to authenticated;

drop trigger if exists set_updated_at on public.saved_cards;
create trigger set_updated_at before update on public.saved_cards
  for each row execute function public.set_updated_at();

create or replace function public.ensure_default_saved_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_default then
    update public.saved_cards
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default;
  elsif not exists (
    select 1 from public.saved_cards
    where user_id = new.user_id
      and is_default
      and id <> new.id
  ) then
    new.is_default := true;
  end if;

  return new;
end $$;

drop trigger if exists ensure_default_saved_card on public.saved_cards;
create trigger ensure_default_saved_card
  before insert or update of is_default, user_id on public.saved_cards
  for each row execute function public.ensure_default_saved_card();

revoke all on function public.ensure_default_saved_card() from public;

-- ------------------------------------------------------------
-- 5. Hubungkan pembayaran ke kartu tersimpan
-- ------------------------------------------------------------
alter table public.payments
  add column if not exists saved_card_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_saved_card_fk'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_saved_card_fk
      foreign key (saved_card_id) references public.saved_cards(id)
      on delete set null;
  end if;
end $$;

create index if not exists payments_saved_card_idx
  on public.payments (saved_card_id);

select public._migration_add_check(
  'payments',
  'payments_card_method_check',
  'saved_card_id is null or method = ''card'''
);

-- Kartu yang dipakai harus milik pemesan booking/order yang sama.
create or replace function public.validate_payment_saved_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_payer uuid;
begin
  if new.saved_card_id is null then
    return new;
  end if;

  select user_id into v_owner
  from public.saved_cards
  where id = new.saved_card_id;

  if not found then
    raise exception 'Kartu tersimpan tidak ditemukan.';
  end if;

  if new.booking_id is not null then
    select user_id into v_payer
    from public.bookings
    where id = new.booking_id;
  else
    select user_id into v_payer
    from public.fnb_orders
    where id = new.fnb_order_id;
  end if;

  if v_owner is distinct from v_payer then
    raise exception 'Kartu tersimpan bukan milik pemesan transaksi ini.';
  end if;

  return new;
end $$;

drop trigger if exists validate_payment_saved_card on public.payments;
create trigger validate_payment_saved_card
  before insert or update of saved_card_id, booking_id, fnb_order_id
  on public.payments
  for each row execute function public.validate_payment_saved_card();

revoke all on function public.validate_payment_saved_card() from public;

-- Overload create_payment dengan kartu tersimpan.
-- 4 argumen tetap memanggil fungsi lama dari 0002.
create or replace function public.create_payment(
  p_booking_id uuid,
  p_fnb_order_id uuid,
  p_method public.payment_method,
  p_provider text,
  p_saved_card_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  v_res := public.create_payment(
    p_booking_id => p_booking_id,
    p_fnb_order_id => p_fnb_order_id,
    p_method => p_method,
    p_provider => p_provider
  );

  if p_saved_card_id is not null then
    update public.payments
    set method = 'card',
        saved_card_id = p_saved_card_id
    where id = (v_res ->> 'payment_id')::uuid;

    v_res := v_res || jsonb_build_object(
      'method', 'card',
      'saved_card_id', p_saved_card_id
    );
  end if;

  return v_res;
end $$;

grant execute on function public.create_payment(
  uuid, uuid, public.payment_method, text, uuid
) to authenticated;

-- ------------------------------------------------------------
-- 6. My Booking: tab Aktif / Riwayat (tiket + F&B)
--    security_invoker => RLS tabel asal tetap berlaku.
-- ------------------------------------------------------------
create or replace view public.v_my_bookings
with (security_invoker = true)
as
select
  b.id as id,
  'ticket'::text as kind,
  b.booking_code as code,
  b.user_id as user_id,
  b.status::text as status,
  case
    when b.status in ('pending_payment', 'paid', 'confirmed') then 'active'
    else 'history'
  end::text as status_group,
  st.show_date as schedule_date,
  st.start_time as schedule_time,
  m.title as title,
  m.poster_url as image_url,
  c.name as venue,
  b.total as total,
  b.qr_token as qr_token,
  b.created_at as created_at
from public.bookings b
join public.showtimes st on st.id = b.showtime_id
join public.movies m on m.id = st.movie_id
join public.studios s on s.id = st.studio_id
join public.cinemas c on c.id = s.cinema_id

union all

select
  o.id,
  'fnb'::text,
  o.order_code,
  o.user_id,
  o.status::text,
  case
    when o.status in ('pending_payment', 'paid', 'preparing', 'ready') then 'active'
    else 'history'
  end::text,
  o.pickup_date,
  o.pickup_time,
  'F&B'::text,
  (
    select i.image_url
    from public.fnb_order_items oi
    join public.fnb_items i on i.id = oi.item_id
    where oi.order_id = o.id
    order by oi.id
    limit 1
  ),
  c.name,
  o.total,
  o.qr_token,
  o.created_at
from public.fnb_orders o
join public.cinemas c on c.id = o.cinema_id;

revoke all on public.v_my_bookings from anon;
grant select on public.v_my_bookings to authenticated;

-- ------------------------------------------------------------
-- 7. Koreksi konsistensi / korelasi data
-- ------------------------------------------------------------

-- 7.1 Total harus sama dengan komponen harga (dijaga di fungsi,
--     sekarang dipaksa juga di database).
select public._migration_add_check(
  'bookings',
  'bookings_total_check',
  'total = greatest(0, subtotal + service_fee - discount)'
);

select public._migration_add_check(
  'fnb_orders',
  'fnb_orders_total_check',
  'total = greatest(0, subtotal + service_fee - discount)'
);

-- 7.2 Kursi: held/booked wajib punya booking, available/blocked tidak boleh.
select public._migration_add_check(
  'showtime_seats',
  'showtime_seats_booking_check',
  '(status in (''available'', ''blocked'') and booking_id is null) '
  || 'or (status in (''held'', ''booked'') and booking_id is not null)'
);

-- 7.3 Format jadwal harus mengikuti tipe layar studio.
create or replace function public.validate_showtime_format()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_screen public.screen_type;
begin
  select screen_type into v_screen
  from public.studios
  where id = new.studio_id;

  if not found then
    raise exception 'Studio tidak ditemukan.';
  end if;

  if new.format::text <> v_screen::text then
    raise exception
      'Format jadwal (%) harus sama dengan tipe layar studio (%).',
      new.format, v_screen;
  end if;

  return new;
end $$;

drop trigger if exists validate_showtime_format on public.showtimes;
create trigger validate_showtime_format
  before insert or update of studio_id, format on public.showtimes
  for each row execute function public.validate_showtime_format();

revoke all on function public.validate_showtime_format() from public;

-- 7.4 Waktu selesai minimal sama dengan durasi film.
create or replace function public.validate_showtime_end_time()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_duration integer;
begin
  select duration_minutes into v_duration
  from public.movies
  where id = new.movie_id;

  if not found then
    raise exception 'Film tidak ditemukan.';
  end if;

  if new.end_time < (new.start_time + make_interval(mins => v_duration))::time then
    raise exception
      'Waktu selesai jadwal harus minimal durasi film (% menit).',
      v_duration;
  end if;

  return new;
end $$;

drop trigger if exists validate_showtime_end_time on public.showtimes;
create trigger validate_showtime_end_time
  before insert or update of movie_id, start_time, end_time
  on public.showtimes
  for each row execute function public.validate_showtime_end_time();

revoke all on function public.validate_showtime_end_time() from public;

-- 7.5 total_rows / total_seats studio selalu sinkron dengan seats.
create or replace function public.sync_studio_seat_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  if tg_op = 'INSERT' then
    v_ids := array[new.studio_id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.studio_id];
  else
    v_ids := array[old.studio_id, new.studio_id];
  end if;

  update public.studios st
  set total_rows = x.rows_count,
      total_seats = x.seats_count
  from (
    select studio_id,
           count(distinct row_label) as rows_count,
           count(*) as seats_count
    from public.seats
    where studio_id = any(v_ids)
    group by studio_id
  ) x
  where st.id = x.studio_id;

  update public.studios
  set total_rows = 0,
      total_seats = 0
  where id = any(v_ids)
    and not exists (
      select 1 from public.seats s where s.studio_id = public.studios.id
    );

  return null;
end $$;

drop trigger if exists sync_studio_seat_totals on public.seats;
create trigger sync_studio_seat_totals
  after insert or delete or update of studio_id on public.seats
  for each row execute function public.sync_studio_seat_totals();

revoke all on function public.sync_studio_seat_totals() from public;

-- 7.6 Pemakaian promo dikembalikan saat transaksi batal/kedaluwarsa.
--     Sebelumnya used_count hanya naik, tidak pernah turun.
create or replace function public.release_promo_usage(
  p_booking_id uuid,
  p_fnb_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_released integer := 0;
  r record;
begin
  for r in
    select id, promo_id
    from public.promo_redemptions
    where (p_booking_id is not null and booking_id = p_booking_id)
       or (p_fnb_order_id is not null and fnb_order_id = p_fnb_order_id)
  loop
    update public.promos
    set used_count = greatest(0, used_count - 1)
    where id = r.promo_id;

    v_released := v_released + 1;
  end loop;

  delete from public.promo_redemptions
  where (p_booking_id is not null and booking_id = p_booking_id)
     or (p_fnb_order_id is not null and fnb_order_id = p_fnb_order_id);

  return v_released;
end $$;

create or replace function public.release_promo_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status
     and new.status::text in ('canceled', 'expired', 'refunded')
     and old.status::text not in ('canceled', 'expired', 'refunded') then
    if tg_table_name = 'bookings' then
      perform public.release_promo_usage(new.id, null);
    else
      perform public.release_promo_usage(null, new.id);
    end if;
  end if;

  return new;
end $$;

drop trigger if exists release_promo_on_status_change on public.bookings;
create trigger release_promo_on_status_change
  after update of status on public.bookings
  for each row execute function public.release_promo_on_status_change();

drop trigger if exists release_promo_on_status_change on public.fnb_orders;
create trigger release_promo_on_status_change
  after update of status on public.fnb_orders
  for each row execute function public.release_promo_on_status_change();

create or replace function public.release_promo_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'bookings' then
    perform public.release_promo_usage(old.id, null);
  else
    perform public.release_promo_usage(null, old.id);
  end if;

  return old;
end $$;

drop trigger if exists release_promo_on_delete on public.bookings;
create trigger release_promo_on_delete
  before delete on public.bookings
  for each row execute function public.release_promo_on_delete();

drop trigger if exists release_promo_on_delete on public.fnb_orders;
create trigger release_promo_on_delete
  before delete on public.fnb_orders
  for each row execute function public.release_promo_on_delete();

revoke all on function public.release_promo_usage(uuid, uuid) from public;
revoke all on function public.release_promo_on_status_change() from public;
revoke all on function public.release_promo_on_delete() from public;

-- Helper migration tidak diperlukan lagi.
drop function if exists public._migration_add_check(text, text, text);

-- ============================================================
-- Selesai. Urutan apply: 0001 -> 0002 -> 0003 -> 0004 -> 0005 -> 0006
-- ============================================================
