-- ============================================================
-- CINÉ — Bugfixes (Migration 0013)
-- Prasyarat: 0001 - 0012
--
-- Isi:
--   1. Trigger lepas kursi & expire payment pending saat booking
--      diubah ke canceled / expired / refunded
--   2. Perbarui handle_new_user() agar birth_date, city, dan
--      preferred_cinema_id dari metadata Register ikut tersimpan
--   3. Perbarui create_payment() agar saat reuse payment pending,
--      perubahan method/amount ikut tersimpan
--   4. RPC apply_promo_to_booking() & apply_promo_to_fnb_order()
--      agar kode promo di halaman Order Summary benar-benar memotong total
-- ============================================================

-- ------------------------------------------------------------
-- 1. Trigger lepas kursi saat status booking berubah
-- ------------------------------------------------------------
create or replace function public.release_seats_on_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status
     and new.status::text in ('canceled', 'expired', 'refunded') then
    update public.showtime_seats
    set status = 'available',
        booking_id = null,
        held_until = null
    where booking_id = new.id;

    update public.payments
    set status = 'expired',
        updated_at = now()
    where booking_id = new.id
      and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists release_seats_on_booking_status_change on public.bookings;
create trigger release_seats_on_booking_status_change
  after update of status on public.bookings
  for each row execute function public.release_seats_on_booking_status_change();

revoke all on function public.release_seats_on_booking_status_change() from public;

-- ------------------------------------------------------------
-- 2. handle_new_user(): simpan birth_date, city, preferred_cinema_id
-- ------------------------------------------------------------
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
  v_birth_date date;
  v_city text;
  v_preferred_cinema_id uuid;
  v_cinema_raw text;
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

  v_city := nullif(trim(new.raw_user_meta_data ->> 'city'), '');

  begin
    v_birth_date := nullif(trim(new.raw_user_meta_data ->> 'birth_date'), '')::date;
  exception when others then
    v_birth_date := null;
  end;

  v_cinema_raw := nullif(trim(new.raw_user_meta_data ->> 'preferred_cinema_id'), '');
  if v_cinema_raw is not null then
    begin
      v_preferred_cinema_id := v_cinema_raw::uuid;
      if not exists (select 1 from public.cinemas where id = v_preferred_cinema_id) then
        v_preferred_cinema_id := null;
      end if;
    exception when others then
      v_preferred_cinema_id := null;
    end;
  end if;

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
    birth_date,
    city,
    preferred_cinema_id,
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
    v_birth_date,
    v_city,
    v_preferred_cinema_id,
    v_gender,
    case when v_terms_accepted then now() else null end,
    v_terms_version
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. create_payment() sinkron method & amount saat reuse
-- ------------------------------------------------------------
create or replace function public.create_payment(
  p_booking_id uuid default null,
  p_fnb_order_id uuid default null,
  p_method public.payment_method default 'qris',
  p_provider text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric(12, 2);
  v_expires timestamptz;
  v_payment_id uuid;
  v_external_id text;
  v_existing record;
begin
  if v_user_id is null then
    raise exception 'Kamu harus login untuk membuat pembayaran.';
  end if;

  if num_nonnulls(p_booking_id, p_fnb_order_id) <> 1 then
    raise exception 'Pilih salah satu: booking tiket atau pesanan F&B.';
  end if;

  if p_booking_id is not null then
    select total, expires_at
    into v_amount, v_expires
    from public.bookings
    where id = p_booking_id
      and user_id = v_user_id
      and status = 'pending_payment';

    if not found then
      raise exception 'Booking tidak ditemukan atau sudah tidak menunggu pembayaran.';
    end if;
  else
    select total, expires_at
    into v_amount, v_expires
    from public.fnb_orders
    where id = p_fnb_order_id
      and user_id = v_user_id
      and status = 'pending_payment';

    if not found then
      raise exception 'Pesanan F&B tidak ditemukan atau sudah tidak menunggu pembayaran.';
    end if;
  end if;

  if v_expires is not null and v_expires < now() then
    raise exception 'Waktu pembayaran sudah habis.';
  end if;

  select id, external_id, method, amount, expires_at
  into v_existing
  from public.payments
  where status = 'pending'
    and (
      (p_booking_id is not null and booking_id = p_booking_id)
      or (p_fnb_order_id is not null and fnb_order_id = p_fnb_order_id)
    )
  order by created_at desc
  limit 1;

  if found then
    if v_existing.method is distinct from p_method
       or v_existing.amount is distinct from v_amount then
      update public.payments
      set method = p_method,
          saved_card_id = case when p_method = 'card' then saved_card_id else null end,
          amount = v_amount,
          payment_url = null,
          updated_at = now()
      where id = v_existing.id;
    end if;

    return jsonb_build_object(
      'payment_id', v_existing.id,
      'external_id', v_existing.external_id,
      'method', p_method,
      'amount', v_amount,
      'status', 'pending',
      'expires_at', v_existing.expires_at,
      'reused', true
    );
  end if;

  v_external_id := 'PAY-' || upper(
    substr(md5(random()::text || clock_timestamp()::text), 1, 12)
  );

  insert into public.payments (
    booking_id,
    fnb_order_id,
    method,
    provider,
    amount,
    status,
    external_id,
    expires_at
  )
  values (
    p_booking_id,
    p_fnb_order_id,
    p_method,
    nullif(btrim(coalesce(p_provider, '')), ''),
    v_amount,
    'pending',
    v_external_id,
    coalesce(v_expires, now() + interval '15 minutes')
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'external_id', v_external_id,
    'method', p_method,
    'amount', v_amount,
    'status', 'pending',
    'expires_at', coalesce(v_expires, now() + interval '15 minutes'),
    'reused', false
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. Terapkan kode promo pada booking / fnb_order pending_payment
-- ------------------------------------------------------------
create or replace function public.apply_promo_to_booking(
  p_booking_id uuid,
  p_promo_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_existing_code text;
  v_clean_code text := upper(btrim(coalesce(p_promo_code, '')));
  v_promo jsonb;
  v_promo_id uuid;
  v_discount numeric(12, 2);
  v_total numeric(12, 2);
  v_used_count integer;
  v_quota integer;
begin
  if v_user_id is null then
    return jsonb_build_object('valid', false, 'message', 'Kamu harus login.');
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Booking tidak ditemukan.');
  end if;

  if v_booking.user_id <> v_user_id and not public.is_admin() then
    return jsonb_build_object('valid', false, 'message', 'Kamu tidak berhak mengubah booking ini.');
  end if;

  if v_booking.status <> 'pending_payment' then
    return jsonb_build_object(
      'valid', false,
      'message', 'Promo hanya dapat diterapkan pada booking yang menunggu pembayaran.'
    );
  end if;

  if v_clean_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Kode promo wajib diisi.');
  end if;

  if v_booking.promo_id is not null then
    select code into v_existing_code from public.promos where id = v_booking.promo_id;
    if v_existing_code = v_clean_code then
      return jsonb_build_object(
        'valid', true,
        'promo_id', v_booking.promo_id,
        'code', v_existing_code,
        'discount', v_booking.discount,
        'total', v_booking.total,
        'message', 'Promo sudah diterapkan.'
      );
    end if;
  end if;

  v_promo := public.validate_promo(v_clean_code, v_booking.subtotal, v_booking.user_id);
  if not coalesce((v_promo ->> 'valid')::boolean, false) then
    return v_promo;
  end if;

  v_promo_id := (v_promo ->> 'promo_id')::uuid;
  v_discount := (v_promo ->> 'discount')::numeric;

  select used_count, quota
  into v_used_count, v_quota
  from public.promos
  where id = v_promo_id
  for update;

  if v_quota is not null and v_used_count >= v_quota then
    return jsonb_build_object('valid', false, 'message', 'Kuota promo sudah habis.');
  end if;

  if v_booking.promo_id is not null then
    perform public.release_promo_usage(p_booking_id, null);
  end if;

  v_total := greatest(0, v_booking.subtotal + v_booking.service_fee - v_discount);

  update public.bookings
  set promo_id = v_promo_id,
      discount = v_discount,
      total = v_total,
      updated_at = now()
  where id = p_booking_id;

  insert into public.promo_redemptions (
    promo_id,
    user_id,
    booking_id,
    discount_amount
  )
  values (
    v_promo_id,
    v_booking.user_id,
    p_booking_id,
    v_discount
  );

  update public.promos
  set used_count = used_count + 1
  where id = v_promo_id;

  update public.payments
  set amount = v_total,
      payment_url = null,
      updated_at = now()
  where booking_id = p_booking_id
    and status = 'pending';

  return jsonb_build_object(
    'valid', true,
    'promo_id', v_promo_id,
    'code', v_promo ->> 'code',
    'discount', v_discount,
    'total', v_total,
    'message', 'Promo berhasil diterapkan.'
  );
end;
$$;

create or replace function public.apply_promo_to_fnb_order(
  p_order_id uuid,
  p_promo_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.fnb_orders%rowtype;
  v_existing_code text;
  v_clean_code text := upper(btrim(coalesce(p_promo_code, '')));
  v_promo jsonb;
  v_promo_id uuid;
  v_discount numeric(12, 2);
  v_total numeric(12, 2);
  v_used_count integer;
  v_quota integer;
begin
  if v_user_id is null then
    return jsonb_build_object('valid', false, 'message', 'Kamu harus login.');
  end if;

  select *
  into v_order
  from public.fnb_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Pesanan F&B tidak ditemukan.');
  end if;

  if v_order.user_id <> v_user_id and not public.is_admin() then
    return jsonb_build_object('valid', false, 'message', 'Kamu tidak berhak mengubah pesanan ini.');
  end if;

  if v_order.status <> 'pending_payment' then
    return jsonb_build_object(
      'valid', false,
      'message', 'Promo hanya dapat diterapkan pada pesanan yang menunggu pembayaran.'
    );
  end if;

  if v_clean_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Kode promo wajib diisi.');
  end if;

  if v_order.promo_id is not null then
    select code into v_existing_code from public.promos where id = v_order.promo_id;
    if v_existing_code = v_clean_code then
      return jsonb_build_object(
        'valid', true,
        'promo_id', v_order.promo_id,
        'code', v_existing_code,
        'discount', v_order.discount,
        'total', v_order.total,
        'message', 'Promo sudah diterapkan.'
      );
    end if;
  end if;

  v_promo := public.validate_promo(v_clean_code, v_order.subtotal, v_order.user_id);
  if not coalesce((v_promo ->> 'valid')::boolean, false) then
    return v_promo;
  end if;

  v_promo_id := (v_promo ->> 'promo_id')::uuid;
  v_discount := (v_promo ->> 'discount')::numeric;

  select used_count, quota
  into v_used_count, v_quota
  from public.promos
  where id = v_promo_id
  for update;

  if v_quota is not null and v_used_count >= v_quota then
    return jsonb_build_object('valid', false, 'message', 'Kuota promo sudah habis.');
  end if;

  if v_order.promo_id is not null then
    perform public.release_promo_usage(null, p_order_id);
  end if;

  v_total := greatest(0, v_order.subtotal + v_order.service_fee - v_discount);

  update public.fnb_orders
  set promo_id = v_promo_id,
      discount = v_discount,
      total = v_total,
      updated_at = now()
  where id = p_order_id;

  insert into public.promo_redemptions (
    promo_id,
    user_id,
    fnb_order_id,
    discount_amount
  )
  values (
    v_promo_id,
    v_order.user_id,
    p_order_id,
    v_discount
  );

  update public.promos
  set used_count = used_count + 1
  where id = v_promo_id;

  update public.payments
  set amount = v_total,
      payment_url = null,
      updated_at = now()
  where fnb_order_id = p_order_id
    and status = 'pending';

  return jsonb_build_object(
    'valid', true,
    'promo_id', v_promo_id,
    'code', v_promo ->> 'code',
    'discount', v_discount,
    'total', v_total,
    'message', 'Promo berhasil diterapkan.'
  );
end;
$$;

grant execute on function public.apply_promo_to_booking(uuid, text) to authenticated;
grant execute on function public.apply_promo_to_fnb_order(uuid, text) to authenticated;
