-- ============================================================
-- CINÉ — Supabase Database Schema
-- Migration 0007: service-role RPC helpers untuk Go API
-- Prasyarat: 0001 - 0006
--
-- Semua function di sini SENGKAJA hanya untuk service_role:
-- dipakai oleh cine-api (webhook pembayaran, lookup WhatsApp,
-- QR tiket/F&B, verifikasi tiket). Tidak diekspos ke browser.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Normalisasi nomor telepon (62 / 0 / +62)
-- ------------------------------------------------------------
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  with digits as (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
  )
  select case
    when d = '' then null
    when left(d, 2) = '62' then d
    when left(d, 1) = '0' then '62' || substring(d from 2)
    else d
  end
  from digits;
$$;

revoke all on function public.normalize_phone(text) from public;
grant execute on function public.normalize_phone(text) to service_role;

-- ------------------------------------------------------------
-- 2. Cari email/user dari nomor WhatsApp (login via WhatsApp)
--    Go API memanggil ini dengan service role, lalu hasil email
--    dipakai untuk Supabase Auth OTP / magic link.
-- ------------------------------------------------------------
create or replace function public.find_user_by_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_rec record;
  v_found boolean := false;
begin
  if v_phone is null then
    return jsonb_build_object(
      'found', false,
      'message', 'Nomor telepon tidak valid.'
    );
  end if;

  select p.id, p.email, p.full_name, p.nickname, p.phone
  into v_rec
  from public.profiles p
  where public.normalize_phone(p.phone) = v_phone
  limit 1;
  v_found := found;

  if not v_found then
    begin
      select u.id, u.email,
             coalesce(
               u.raw_user_meta_data ->> 'full_name',
               u.raw_user_meta_data ->> 'name'
             ) as full_name,
             null::text as nickname,
             u.phone
      into v_rec
      from auth.users u
      where public.normalize_phone(u.phone) = v_phone
      limit 1;
      v_found := found;
    exception when others then
      v_found := false;
    end;
  end if;

  if not v_found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'user_id', v_rec.id,
    'email', v_rec.email,
    'full_name', v_rec.full_name,
    'nickname', v_rec.nickname,
    'phone', v_rec.phone
  );
end $$;

revoke all on function public.find_user_by_phone(text) from public;
grant execute on function public.find_user_by_phone(text) to service_role;

-- ------------------------------------------------------------
-- 3. Cari pembayaran dari external_id (webhook gateway)
-- ------------------------------------------------------------
create or replace function public.find_payment_by_external_id(p_external_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec record;
begin
  select id, status, amount, booking_id, fnb_order_id, method, expires_at
  into v_rec
  from public.payments
  where external_id = btrim(p_external_id)
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'payment_id', v_rec.id,
    'status', v_rec.status,
    'amount', v_rec.amount,
    'booking_id', v_rec.booking_id,
    'fnb_order_id', v_rec.fnb_order_id,
    'method', v_rec.method,
    'expires_at', v_rec.expires_at
  );
end $$;

revoke all on function public.find_payment_by_external_id(text) from public;
grant execute on function public.find_payment_by_external_id(text) to service_role;

-- ------------------------------------------------------------
-- 4. Data tiket untuk endpoint QR /tickets/{code}/qr.png
-- ------------------------------------------------------------
create or replace function public.get_ticket_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_result jsonb;
begin
  select * into v_booking
  from public.bookings
  where booking_code = upper(btrim(p_code));

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
    'found', true,
    'kind', 'ticket',
    'booking_id', v_booking.id,
    'code', v_booking.booking_code,
    'status', v_booking.status,
    'qr_token', v_booking.qr_token,
    'paid_at', v_booking.paid_at,
    'expires_at', v_booking.expires_at,
    'total', v_booking.total,
    'show_date', st.show_date,
    'start_time', st.start_time,
    'end_time', st.end_time,
    'format', st.format,
    'language', st.language,
    'movie', jsonb_build_object(
      'title', m.title,
      'poster_url', m.poster_url,
      'age_rating', m.age_rating,
      'duration_minutes', m.duration_minutes
    ),
    'cinema', jsonb_build_object(
      'name', c.name,
      'address', c.address,
      'city', c.city
    ),
    'studio', jsonb_build_object('name', s.name, 'screen_type', s.screen_type),
    'seats', coalesce(
      (
        select jsonb_agg(bs.seat_label_snapshot order by bs.seat_label_snapshot)
        from public.booking_seats bs
        where bs.booking_id = v_booking.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.showtimes st
  join public.movies m on m.id = st.movie_id
  join public.studios s on s.id = st.studio_id
  join public.cinemas c on c.id = s.cinema_id
  where st.id = v_booking.showtime_id;

  return coalesce(v_result, jsonb_build_object('found', false));
end $$;

revoke all on function public.get_ticket_by_code(text) from public;
grant execute on function public.get_ticket_by_code(text) to service_role;

-- ------------------------------------------------------------
-- 5. Data pesanan F&B untuk endpoint QR /orders/{code}/qr.png
-- ------------------------------------------------------------
create or replace function public.get_order_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.fnb_orders%rowtype;
  v_result jsonb;
begin
  select * into v_order
  from public.fnb_orders
  where order_code = upper(btrim(p_code));

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
    'found', true,
    'kind', 'fnb',
    'order_id', v_order.id,
    'code', v_order.order_code,
    'status', v_order.status,
    'qr_token', v_order.qr_token,
    'paid_at', v_order.paid_at,
    'pickup_date', v_order.pickup_date,
    'pickup_time', v_order.pickup_time,
    'total', v_order.total,
    'notes', v_order.notes,
    'cinema', jsonb_build_object(
      'name', c.name,
      'address', c.address,
      'city', c.city
    ),
    'items', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'name', oi.item_name_snapshot,
          'variant', oi.variant_name_snapshot,
          'quantity', oi.quantity,
          'notes', oi.notes,
          'line_total', oi.line_total
        ) order by oi.id)
        from public.fnb_order_items oi
        where oi.order_id = v_order.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.cinemas c
  where c.id = v_order.cinema_id;

  return coalesce(v_result, jsonb_build_object('found', false));
end $$;

revoke all on function public.get_order_by_code(text) from public;
grant execute on function public.get_order_by_code(text) to service_role;

-- ------------------------------------------------------------
-- 6. Verifikasi QR oleh petugas
--    Token harus cocok DAN transaksi sudah paid/confirmed/ready.
-- ------------------------------------------------------------
create or replace function public.verify_ticket_qr(
  p_code text,
  p_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_order public.fnb_orders%rowtype;
begin
  select * into v_booking
  from public.bookings
  where booking_code = upper(btrim(p_code));

  if found then
    if v_booking.qr_token is distinct from p_token then
      return jsonb_build_object('valid', false, 'message', 'Token QR tidak cocok.');
    end if;

    if v_booking.status not in ('confirmed', 'completed') then
      return jsonb_build_object(
        'valid', false,
        'message', 'Booking belum valid untuk masuk.',
        'status', v_booking.status
      );
    end if;

    return jsonb_build_object(
      'valid', true,
      'kind', 'ticket',
      'code', v_booking.booking_code,
      'status', v_booking.status,
      'booking_id', v_booking.id
    );
  end if;

  select * into v_order
  from public.fnb_orders
  where order_code = upper(btrim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Kode tidak ditemukan.');
  end if;

  if v_order.qr_token is distinct from p_token then
    return jsonb_build_object('valid', false, 'message', 'Token QR tidak cocok.');
  end if;

  if v_order.status not in ('paid', 'preparing', 'ready', 'completed') then
    return jsonb_build_object(
      'valid', false,
      'message', 'Pesanan F&B belum valid untuk diambil.',
      'status', v_order.status
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'kind', 'fnb',
    'code', v_order.order_code,
    'status', v_order.status,
    'order_id', v_order.id
  );
end $$;

revoke all on function public.verify_ticket_qr(text, uuid) from public;
grant execute on function public.verify_ticket_qr(text, uuid) to service_role;

-- ------------------------------------------------------------
-- 7. Rapian: alamat utama / kartu default otomatis saat dihapus
-- ------------------------------------------------------------
create or replace function public.promote_primary_address_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.is_primary then
    update public.addresses
    set is_primary = true
    where id = (
      select id from public.addresses
      where user_id = old.user_id
      order by created_at
      limit 1
    );
  end if;
  return old;
end $$;

drop trigger if exists promote_primary_address_on_delete on public.addresses;
create trigger promote_primary_address_on_delete
  after delete on public.addresses
  for each row execute function public.promote_primary_address_on_delete();

revoke all on function public.promote_primary_address_on_delete() from public;

create or replace function public.promote_default_card_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.is_default then
    update public.saved_cards
    set is_default = true
    where id = (
      select id from public.saved_cards
      where user_id = old.user_id
      order by created_at
      limit 1
    );
  end if;
  return old;
end $$;

drop trigger if exists promote_default_card_on_delete on public.saved_cards;
create trigger promote_default_card_on_delete
  after delete on public.saved_cards
  for each row execute function public.promote_default_card_on_delete();

revoke all on function public.promote_default_card_on_delete() from public;

-- ============================================================
-- Selesai. Urutan apply: 0001 ... 0006 -> 0007
-- ============================================================
