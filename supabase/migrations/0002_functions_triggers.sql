-- ============================================================
-- CINÉ — Functions, Triggers
-- Migration 0002
-- ============================================================

-- ------------------------------------------------------------
-- 1. updated_at otomatis
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'movies', 'cinemas', 'studios', 'showtimes', 'profiles', 'promos',
    'bookings', 'showtime_seats', 'fnb_categories', 'fnb_items',
    'fnb_variants', 'fnb_orders', 'payments', 'faqs', 'app_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. Helper role & settings
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'staff')
  );
$$;

-- Membaca angka dari app_settings. Mendukung value JSON number
-- maupun object {"amount": 2000}.
create or replace function public.get_app_setting_numeric(
  p_key text,
  p_default numeric
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select case jsonb_typeof(value)
        when 'number' then (value #>> '{}')::numeric
        when 'object' then coalesce(
          (value ->> 'amount')::numeric,
          (value ->> 'value')::numeric
        )
        else null
      end
      from public.app_settings
      where key = p_key
    ),
    p_default
  );
$$;

-- ------------------------------------------------------------
-- 3. Generator kode
-- ------------------------------------------------------------
create or replace function public.generate_booking_code()
returns text
language plpgsql
volatile
as $$
declare
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := 'CNE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    exit when not exists (
      select 1 from public.bookings where booking_code = v_code
    );

    if v_try >= 20 then
      raise exception 'Gagal membuat kode booking unik.';
    end if;
  end loop;

  return v_code;
end;
$$;

create or replace function public.generate_order_code()
returns text
language plpgsql
volatile
as $$
declare
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := 'FNB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    exit when not exists (
      select 1 from public.fnb_orders where order_code = v_code
    );

    if v_try >= 20 then
      raise exception 'Gagal membuat kode pesanan unik.';
    end if;
  end loop;

  return v_code;
end;
$$;

-- ------------------------------------------------------------
-- 4. Profil otomatis saat signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
  v_phone text;
  v_terms_version text;
  v_terms_accepted boolean;
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

  v_phone := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'whatsapp'
  )), '');

  v_terms_version := nullif(trim(new.raw_user_meta_data ->> 'terms_version'), '');

  v_terms_accepted := lower(coalesce(
    new.raw_user_meta_data ->> 'terms_accepted',
    ''
  )) in ('true', '1', 'yes', 'ya');

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    terms_accepted_at,
    terms_version
  )
  values (
    new.id,
    v_full_name,
    new.email,
    v_phone,
    case when v_terms_accepted then now() else null end,
    v_terms_version
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 5. Cegah user mengubah role sendiri
-- ------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() null berarti akses langsung SQL/service role.
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Hanya admin yang dapat mengubah role pengguna.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_role_change on public.profiles;

create trigger prevent_role_change
  before update of role on public.profiles
  for each row execute function public.prevent_role_change();

-- ------------------------------------------------------------
-- 6. Isi showtime_seats otomatis saat showtime dibuat
-- ------------------------------------------------------------
create or replace function public.create_showtime_seats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.showtime_seats (showtime_id, seat_id)
  select new.id, s.id
  from public.seats s
  where s.studio_id = new.studio_id
    and s.is_active = true
  on conflict (showtime_id, seat_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_showtime_seats on public.showtimes;

create trigger create_showtime_seats
  after insert on public.showtimes
  for each row execute function public.create_showtime_seats();

-- ------------------------------------------------------------
-- 7. Validasi promo
-- Mengembalikan JSON: { valid, message, promo_id, discount, ... }
-- ------------------------------------------------------------
create or replace function public.validate_promo(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_promo public.promos%rowtype;
  v_user_id uuid := p_user_id;
  v_subtotal numeric(12, 2) := coalesce(p_subtotal, 0);
  v_discount numeric(12, 2) := 0;
  v_used integer := 0;
begin
  -- User biasa hanya boleh mengecek pemakaian promo miliknya sendiri.
  if v_user_id is distinct from auth.uid() and not public.is_staff() then
    v_user_id := auth.uid();
  end if;

  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'message', 'Kode promo wajib diisi.');
  end if;

  select *
  into v_promo
  from public.promos
  where code = upper(btrim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Kode promo tidak ditemukan.');
  end if;

  if not v_promo.is_active then
    return jsonb_build_object('valid', false, 'message', 'Kode promo sudah tidak aktif.');
  end if;

  if now() < v_promo.valid_from then
    return jsonb_build_object('valid', false, 'message', 'Kode promo belum berlaku.');
  end if;

  if now() > v_promo.valid_until then
    return jsonb_build_object('valid', false, 'message', 'Kode promo sudah kedaluwarsa.');
  end if;

  if v_subtotal < v_promo.min_purchase then
    return jsonb_build_object(
      'valid', false,
      'message', 'Minimal pembelian Rp ' ||
        to_char(v_promo.min_purchase, 'FM999999999') ||
        ' untuk memakai promo ini.',
      'min_purchase', v_promo.min_purchase
    );
  end if;

  if v_promo.quota is not null and v_promo.used_count >= v_promo.quota then
    return jsonb_build_object('valid', false, 'message', 'Kuota promo sudah habis.');
  end if;

  if v_user_id is not null then
    select count(*)
    into v_used
    from public.promo_redemptions
    where promo_id = v_promo.id
      and user_id = v_user_id;

    if v_used >= v_promo.per_user_limit then
      return jsonb_build_object(
        'valid', false,
        'message', 'Kamu sudah pernah memakai promo ini.'
      );
    end if;
  end if;

  if v_promo.discount_type = 'percent' then
    v_discount := floor(v_subtotal * v_promo.discount_value / 100);

    if v_promo.max_discount is not null then
      v_discount := least(v_discount, v_promo.max_discount);
    end if;
  else
    v_discount := v_promo.discount_value;
  end if;

  v_discount := greatest(0, least(v_discount, v_subtotal));

  return jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'description', v_promo.description,
    'discount', v_discount
  );
end;
$$;

-- ------------------------------------------------------------
-- 8. Buat booking tiket (atomik + lock kursi)
-- ------------------------------------------------------------
create or replace function public.create_booking(
  p_showtime_id uuid,
  p_seat_ids uuid[],
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_showtime public.showtimes%rowtype;
  v_seat_ids uuid[];
  v_seat_count integer;
  v_found integer := 0;
  v_seat record;
  v_now timestamptz := now();
  v_subtotal numeric(12, 2);
  v_service_fee numeric(12, 2);
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_promo jsonb;
  v_promo_id uuid;
  v_hold_minutes integer;
  v_expires_at timestamptz;
  v_booking_id uuid;
  v_booking_code text;
  v_used_count integer;
  v_quota integer;
begin
  if v_user_id is null then
    raise exception 'Kamu harus login untuk memesan tiket.';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profil pengguna tidak ditemukan.';
  end if;

  v_seat_ids := array(select distinct unnest(p_seat_ids));
  v_seat_count := coalesce(array_length(v_seat_ids, 1), 0);

  if v_seat_count = 0 then
    raise exception 'Pilih minimal satu kursi.';
  end if;

  if v_seat_count > 8 then
    raise exception 'Maksimal 8 kursi per transaksi.';
  end if;

  select *
  into v_showtime
  from public.showtimes
  where id = p_showtime_id
    and is_active = true;

  if not found then
    raise exception 'Jadwal tidak ditemukan atau tidak aktif.';
  end if;

  if (v_showtime.show_date + v_showtime.start_time)
     < (now() at time zone 'Asia/Jakarta') then
    raise exception 'Jadwal sudah lewat.';
  end if;

  -- Lock semua baris kursi yang diminta. Baris yang sudah dipegang
  -- transaksi lain akan menunggu sampai transaksi tersebut selesai.
  for v_seat in
    select ss.id,
           ss.status,
           ss.held_until,
           s.row_label,
           s.seat_number
    from public.showtime_seats ss
    join public.seats s on s.id = ss.seat_id
    where ss.showtime_id = p_showtime_id
      and ss.seat_id = any(v_seat_ids)
    order by s.row_label, s.seat_number
    for update of ss
  loop
    if v_seat.status = 'booked' or v_seat.status = 'blocked' then
      raise exception 'Kursi % % sudah tidak tersedia.',
        v_seat.row_label, v_seat.seat_number;
    end if;

    if v_seat.status = 'held'
       and v_seat.held_until is not null
       and v_seat.held_until > v_now then
      raise exception 'Kursi % % sedang ditahan pengguna lain.',
        v_seat.row_label, v_seat.seat_number;
    end if;

    v_found := v_found + 1;
  end loop;

  if v_found <> v_seat_count then
    raise exception 'Sebagian kursi tidak ditemukan pada jadwal ini.';
  end if;

  v_subtotal := v_showtime.price * v_seat_count;
  v_service_fee := public.get_app_setting_numeric('service_fee', 2000);

  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    v_promo := public.validate_promo(p_promo_code, v_subtotal, v_user_id);

    if not coalesce((v_promo ->> 'valid')::boolean, false) then
      raise exception '%', coalesce(v_promo ->> 'message', 'Kode promo tidak valid.');
    end if;

    v_promo_id := (v_promo ->> 'promo_id')::uuid;
    v_discount := (v_promo ->> 'discount')::numeric;

    -- Serialisasi pemakaian promo supaya kuota tidak jebol saat ramai.
    select used_count, quota
    into v_used_count, v_quota
    from public.promos
    where id = v_promo_id
    for update;

    if v_quota is not null and v_used_count >= v_quota then
      raise exception 'Kuota promo sudah habis.';
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_service_fee - v_discount);
  v_hold_minutes := greatest(
    1,
    public.get_app_setting_numeric('booking_hold_minutes', 15)::integer
  );
  v_expires_at := v_now + make_interval(mins => v_hold_minutes);
  v_booking_code := public.generate_booking_code();

  insert into public.bookings (
    booking_code,
    user_id,
    showtime_id,
    status,
    subtotal,
    service_fee,
    discount,
    total,
    promo_id,
    expires_at
  )
  values (
    v_booking_code,
    v_user_id,
    p_showtime_id,
    'pending_payment',
    v_subtotal,
    v_service_fee,
    v_discount,
    v_total,
    v_promo_id,
    v_expires_at
  )
  returning id into v_booking_id;

  insert into public.booking_seats (
    booking_id,
    showtime_seat_id,
    seat_label_snapshot,
    price_snapshot
  )
  select
    v_booking_id,
    ss.id,
    s.row_label || s.seat_number::text,
    v_showtime.price
  from public.showtime_seats ss
  join public.seats s on s.id = ss.seat_id
  where ss.showtime_id = p_showtime_id
    and ss.seat_id = any(v_seat_ids);

  update public.showtime_seats
  set status = 'held',
      booking_id = v_booking_id,
      held_until = v_expires_at
  where showtime_id = p_showtime_id
    and seat_id = any(v_seat_ids);

  if v_promo_id is not null then
    insert into public.promo_redemptions (
      promo_id,
      user_id,
      booking_id,
      discount_amount
    )
    values (
      v_promo_id,
      v_user_id,
      v_booking_id,
      v_discount
    );

    update public.promos
    set used_count = used_count + 1
    where id = v_promo_id;
  end if;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    v_user_id,
    'Booking berhasil dibuat',
    format(
      'Booking %s menunggu pembayaran. Selesaikan sebelum %s WIB.',
      v_booking_code,
      to_char(v_expires_at at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI')
    ),
    'booking',
    jsonb_build_object(
      'booking_id', v_booking_id,
      'booking_code', v_booking_code,
      'expires_at', v_expires_at
    )
  );

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'booking_code', v_booking_code,
    'subtotal', v_subtotal,
    'service_fee', v_service_fee,
    'discount', v_discount,
    'total', v_total,
    'expires_at', v_expires_at,
    'seat_count', v_seat_count
  );
end;
$$;

-- ------------------------------------------------------------
-- 9. Buat pesanan F&B
-- p_items: [{"item_id":"...","variant_id":"...","quantity":2,"notes":"..."}]
-- ------------------------------------------------------------
create or replace function public.create_fnb_order(
  p_items jsonb,
  p_cinema_id uuid,
  p_pickup_date date,
  p_pickup_time time,
  p_booking_id uuid default null,
  p_promo_code text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_item record;
  v_variant record;
  v_variant_id uuid;
  v_variant_name text;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_service_fee numeric(12, 2);
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_promo jsonb;
  v_promo_id uuid;
  v_used_count integer;
  v_quota integer;
  v_hold_minutes integer;
  v_expires_at timestamptz;
  v_order_id uuid;
  v_order_code text;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Kamu harus login untuk memesan F&B.';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profil pengguna tidak ditemukan.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Pesanan F&B masih kosong.';
  end if;

  if p_pickup_date is null or p_pickup_time is null then
    raise exception 'Tanggal dan jam pengambilan wajib diisi.';
  end if;

  if p_pickup_date < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal pengambilan tidak boleh di masa lalu.';
  end if;

  if not exists (
    select 1 from public.cinemas
    where id = p_cinema_id and is_active = true
  ) then
    raise exception 'Cinema tidak ditemukan atau tidak aktif.';
  end if;

  if p_booking_id is not null then
    select b.id
    into v_booking_id
    from public.bookings b
    join public.showtimes st on st.id = b.showtime_id
    join public.studios s on s.id = st.studio_id
    where b.id = p_booking_id
      and b.user_id = v_user_id
      and s.cinema_id = p_cinema_id
      and b.status in ('pending_payment', 'paid', 'confirmed');

    if not found then
      raise exception 'Booking tidak ditemukan atau bukan milikmu di cinema ini.';
    end if;
  end if;

  for v_line in
    select *
    from jsonb_to_recordset(p_items) as x(
      item_id uuid,
      variant_id uuid,
      quantity integer,
      notes text
    )
  loop
    if v_line.item_id is null then
      raise exception 'Item F&B tidak valid.';
    end if;

    if v_line.quantity is null or v_line.quantity < 1 or v_line.quantity > 20 then
      raise exception 'Jumlah item harus antara 1 dan 20.';
    end if;

    select i.id, i.name, i.base_price, i.is_active
    into v_item
    from public.fnb_items i
    where i.id = v_line.item_id;

    if not found or not v_item.is_active then
      raise exception 'Item F&B tidak ditemukan atau tidak aktif.';
    end if;

    v_variant_id := null;
    v_variant_name := null;

    if v_line.variant_id is not null then
      select v.id, v.name, v.price
      into v_variant
      from public.fnb_variants v
      where v.id = v_line.variant_id
        and v.item_id = v_item.id
        and v.is_active = true;

      if not found then
        raise exception 'Varian untuk % tidak ditemukan.', v_item.name;
      end if;

      v_variant_id := v_variant.id;
      v_variant_name := v_variant.name;
      v_unit_price := v_variant.price;
    else
      v_unit_price := v_item.base_price;
    end if;

    v_line_total := v_unit_price * v_line.quantity;
    v_subtotal := v_subtotal + v_line_total;

    v_lines := v_lines || jsonb_build_object(
      'item_id', v_item.id,
      'variant_id', v_variant_id,
      'item_name_snapshot', v_item.name,
      'variant_name_snapshot', v_variant_name,
      'unit_price', v_unit_price,
      'quantity', v_line.quantity,
      'notes', nullif(btrim(coalesce(v_line.notes, '')), ''),
      'line_total', v_line_total
    );
  end loop;

  v_service_fee := public.get_app_setting_numeric('fnb_service_fee', 2000);

  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    v_promo := public.validate_promo(p_promo_code, v_subtotal, v_user_id);

    if not coalesce((v_promo ->> 'valid')::boolean, false) then
      raise exception '%', coalesce(v_promo ->> 'message', 'Kode promo tidak valid.');
    end if;

    v_promo_id := (v_promo ->> 'promo_id')::uuid;
    v_discount := (v_promo ->> 'discount')::numeric;

    select used_count, quota
    into v_used_count, v_quota
    from public.promos
    where id = v_promo_id
    for update;

    if v_quota is not null and v_used_count >= v_quota then
      raise exception 'Kuota promo sudah habis.';
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_service_fee - v_discount);
  v_hold_minutes := greatest(
    1,
    public.get_app_setting_numeric('booking_hold_minutes', 15)::integer
  );
  v_expires_at := v_now + make_interval(mins => v_hold_minutes);
  v_order_code := public.generate_order_code();

  insert into public.fnb_orders (
    order_code,
    user_id,
    booking_id,
    cinema_id,
    pickup_date,
    pickup_time,
    status,
    subtotal,
    service_fee,
    discount,
    total,
    promo_id,
    expires_at,
    notes
  )
  values (
    v_order_code,
    v_user_id,
    v_booking_id,
    p_cinema_id,
    p_pickup_date,
    p_pickup_time,
    'pending_payment',
    v_subtotal,
    v_service_fee,
    v_discount,
    v_total,
    v_promo_id,
    v_expires_at,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  insert into public.fnb_order_items (
    order_id,
    item_id,
    variant_id,
    item_name_snapshot,
    variant_name_snapshot,
    unit_price,
    quantity,
    notes,
    line_total
  )
  select
    v_order_id,
    x.item_id,
    x.variant_id,
    x.item_name_snapshot,
    x.variant_name_snapshot,
    x.unit_price,
    x.quantity,
    x.notes,
    x.line_total
  from jsonb_to_recordset(v_lines) as x(
    item_id uuid,
    variant_id uuid,
    item_name_snapshot text,
    variant_name_snapshot text,
    unit_price numeric,
    quantity integer,
    notes text,
    line_total numeric
  );

  if v_promo_id is not null then
    insert into public.promo_redemptions (
      promo_id,
      user_id,
      fnb_order_id,
      discount_amount
    )
    values (
      v_promo_id,
      v_user_id,
      v_order_id,
      v_discount
    );

    update public.promos
    set used_count = used_count + 1
    where id = v_promo_id;
  end if;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    v_user_id,
    'Pesanan F&B dibuat',
    format(
      'Pesanan %s menunggu pembayaran. Ambil pada %s pukul %s WIB.',
      v_order_code,
      to_char(p_pickup_date, 'DD Mon YYYY'),
      to_char(p_pickup_time, 'HH24:MI')
    ),
    'fnb',
    jsonb_build_object(
      'fnb_order_id', v_order_id,
      'order_code', v_order_code,
      'expires_at', v_expires_at
    )
  );

  return jsonb_build_object(
    'fnb_order_id', v_order_id,
    'order_code', v_order_code,
    'subtotal', v_subtotal,
    'service_fee', v_service_fee,
    'discount', v_discount,
    'total', v_total,
    'expires_at', v_expires_at,
    'item_count', jsonb_array_length(v_lines)
  );
end;
$$;

-- ------------------------------------------------------------
-- 10. Buat pembayaran (dipanggil dari aplikasi)
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

  -- Idempoten: pakai pembayaran pending yang sudah ada.
  select id, external_id, amount, expires_at
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
    return jsonb_build_object(
      'payment_id', v_existing.id,
      'external_id', v_existing.external_id,
      'amount', v_existing.amount,
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
    'amount', v_amount,
    'status', 'pending',
    'expires_at', coalesce(v_expires, now() + interval '15 minutes'),
    'reused', false
  );
end;
$$;

-- ------------------------------------------------------------
-- 11. Konfirmasi pembayaran (webhook / service role)
-- ------------------------------------------------------------
create or replace function public.confirm_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_order public.fnb_orders%rowtype;
begin
  if auth.role() is not null
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'Hanya service role atau admin yang dapat mengonfirmasi pembayaran.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Pembayaran tidak ditemukan.';
  end if;

  if v_payment.status = 'paid' then
    return jsonb_build_object(
      'payment_id', v_payment.id,
      'status', 'paid',
      'already_paid', true
    );
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Pembayaran tidak dapat dikonfirmasi karena status %.',
      v_payment.status;
  end if;

  update public.payments
  set status = 'paid',
      paid_at = now()
  where id = p_payment_id;

  if v_payment.booking_id is not null then
    select *
    into v_booking
    from public.bookings
    where id = v_payment.booking_id
    for update;

    if not found then
      raise exception 'Booking tidak ditemukan.';
    end if;

    if v_booking.status in ('expired', 'canceled') then
      raise exception 'Booking sudah % dan tidak dapat dibayar.', v_booking.status;
    end if;

    update public.bookings
    set status = 'confirmed',
        paid_at = now()
    where id = v_booking.id;

    update public.showtime_seats
    set status = 'booked',
        held_until = null
    where booking_id = v_booking.id;

    return jsonb_build_object(
      'payment_id', p_payment_id,
      'status', 'paid',
      'booking_id', v_booking.id,
      'booking_code', v_booking.booking_code
    );
  end if;

  select *
  into v_order
  from public.fnb_orders
  where id = v_payment.fnb_order_id
  for update;

  if not found then
    raise exception 'Pesanan F&B tidak ditemukan.';
  end if;

  if v_order.status = 'canceled' then
    raise exception 'Pesanan F&B sudah dibatalkan.';
  end if;

  update public.fnb_orders
  set status = 'paid',
      paid_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'paid',
    'fnb_order_id', v_order.id,
    'order_code', v_order.order_code
  );
end;
$$;

-- ------------------------------------------------------------
-- 12. Tandai pembayaran gagal
-- ------------------------------------------------------------
create or replace function public.fail_payment(
  p_payment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
begin
  if auth.role() is not null
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'Hanya service role atau admin yang dapat mengubah pembayaran.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Pembayaran tidak ditemukan.';
  end if;

  if v_payment.status = 'failed' then
    return jsonb_build_object(
      'payment_id', v_payment.id,
      'status', 'failed',
      'already_failed', true
    );
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Pembayaran tidak dapat digagalkan karena status %.',
      v_payment.status;
  end if;

  update public.payments
  set status = 'failed',
      raw_response = coalesce(raw_response, '{}'::jsonb) ||
        jsonb_build_object(
          'failure_reason', coalesce(p_reason, 'Pembayaran gagal.'),
          'failed_at', now()
        )
  where id = p_payment_id;

  if v_payment.booking_id is not null then
    update public.bookings
    set status = 'canceled'
    where id = v_payment.booking_id
      and status = 'pending_payment';

    update public.showtime_seats
    set status = 'available',
        booking_id = null,
        held_until = null
    where booking_id = v_payment.booking_id;
  elsif v_payment.fnb_order_id is not null then
    update public.fnb_orders
    set status = 'canceled'
    where id = v_payment.fnb_order_id
      and status = 'pending_payment';
  end if;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'failed'
  );
end;
$$;

-- ------------------------------------------------------------
-- 13. Batalkan booking (user / admin)
-- ------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Kamu harus login.';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking tidak ditemukan.';
  end if;

  if v_booking.user_id <> v_user_id and not public.is_admin() then
    raise exception 'Kamu tidak berhak membatalkan booking ini.';
  end if;

  if v_booking.status not in ('pending_payment', 'paid', 'confirmed') then
    raise exception 'Booking dengan status % tidak dapat dibatalkan.',
      v_booking.status;
  end if;

  update public.bookings
  set status = 'canceled'
  where id = p_booking_id;

  update public.showtime_seats
  set status = 'available',
      booking_id = null,
      held_until = null
  where booking_id = p_booking_id;

  update public.payments
  set status = 'expired'
  where booking_id = p_booking_id
    and status = 'pending';

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'canceled'
  );
end;
$$;

-- ------------------------------------------------------------
-- 14. Lepas booking & kursi yang kedaluwarsa
-- Dijalankan pg_cron tiap menit.
-- ------------------------------------------------------------
create or replace function public.release_expired_bookings()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bookings integer := 0;
  v_fnb integer := 0;
  v_payments integer := 0;
begin
  with expired as (
    update public.bookings
    set status = 'expired'
    where status = 'pending_payment'
      and expires_at is not null
      and expires_at < now()
    returning id
  )
  select count(*) into v_bookings from expired;

  update public.showtime_seats ss
  set status = 'available',
      booking_id = null,
      held_until = null
  where ss.status = 'held'
    and (
      (ss.held_until is not null and ss.held_until < now())
      or exists (
        select 1
        from public.bookings b
        where b.id = ss.booking_id
          and b.status in ('expired', 'canceled')
      )
    );

  update public.fnb_orders
  set status = 'canceled'
  where status = 'pending_payment'
    and expires_at is not null
    and expires_at < now();
  get diagnostics v_fnb = row_count;

  update public.payments p
  set status = 'expired'
  where p.status = 'pending'
    and (
      exists (
        select 1 from public.bookings b
        where b.id = p.booking_id
          and b.status = 'expired'
      )
      or exists (
        select 1 from public.fnb_orders o
        where o.id = p.fnb_order_id
          and o.status = 'canceled'
      )
    );
  get diagnostics v_payments = row_count;

  return jsonb_build_object(
    'expired_bookings', v_bookings,
    'canceled_fnb_orders', v_fnb,
    'expired_payments', v_payments
  );
end;
$$;

-- ------------------------------------------------------------
-- 15. Peta kursi untuk UI
-- ------------------------------------------------------------
create or replace function public.get_seat_map(p_showtime_id uuid)
returns table (
  seat_id uuid,
  row_label text,
  seat_number integer,
  seat_type public.seat_type,
  x_position integer,
  y_position integer,
  status public.showtime_seat_status,
  held_until timestamptz,
  is_mine boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.row_label,
    s.seat_number,
    s.seat_type,
    s.x_position,
    s.y_position,
    case
      when ss.status = 'held'
        and ss.held_until is not null
        and ss.held_until < now()
      then 'available'::public.showtime_seat_status
      else ss.status
    end as status,
    ss.held_until,
    coalesce(b.user_id = auth.uid(), false) as is_mine
  from public.showtime_seats ss
  join public.seats s on s.id = ss.seat_id
  left join public.bookings b on b.id = ss.booking_id
  where ss.showtime_id = p_showtime_id
  order by s.y_position nulls last, s.x_position nulls last, s.seat_number;
$$;

-- ------------------------------------------------------------
-- 16. Trigger notifikasi status
-- ------------------------------------------------------------
create or replace function public.notify_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'pending_payment' then
      v_title := 'Booking dibuat';
      v_body := format('Booking %s menunggu pembayaran.', new.booking_code);
    when 'paid' then
      v_title := 'Pembayaran diterima';
      v_body := format('Pembayaran untuk booking %s telah diterima.', new.booking_code);
    when 'confirmed' then
      v_title := 'Tiket kamu siap';
      v_body := format(
        'Booking %s sudah dikonfirmasi. Tunjukkan QR tiket saat masuk.',
        new.booking_code
      );
    when 'canceled' then
      v_title := 'Booking dibatalkan';
      v_body := format('Booking %s telah dibatalkan.', new.booking_code);
    when 'expired' then
      v_title := 'Booking kedaluwarsa';
      v_body := format(
        'Booking %s kedaluwarsa karena pembayaran tidak diselesaikan.',
        new.booking_code
      );
    when 'completed' then
      v_title := 'Tiket telah digunakan';
      v_body := format(
        'Booking %s telah selesai. Terima kasih sudah menonton di CINÉ.',
        new.booking_code
      );
    when 'refunded' then
      v_title := 'Refund diproses';
      v_body := format('Refund untuk booking %s sedang diproses.', new.booking_code);
    else
      v_title := 'Status booking diperbarui';
      v_body := format(
        'Booking %s sekarang berstatus %s.',
        new.booking_code,
        new.status
      );
  end case;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    new.user_id,
    v_title,
    v_body,
    'booking',
    jsonb_build_object(
      'booking_id', new.id,
      'booking_code', new.booking_code,
      'status', new.status
    )
  );

  return new;
end;
$$;

create or replace function public.notify_fnb_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'pending_payment' then
      v_title := 'Pesanan F&B dibuat';
      v_body := format('Pesanan %s menunggu pembayaran.', new.order_code);
    when 'paid' then
      v_title := 'Pembayaran F&B diterima';
      v_body := format(
        'Pesanan %s sudah dibayar. Tunjukkan QR saat mengambil pesanan.',
        new.order_code
      );
    when 'preparing' then
      v_title := 'Pesanan sedang disiapkan';
      v_body := format('Pesanan %s sedang disiapkan di counter F&B.', new.order_code);
    when 'ready' then
      v_title := 'Pesanan siap diambil';
      v_body := format(
        'Pesanan %s sudah siap. Ambil di counter F&B CINÉ.',
        new.order_code
      );
    when 'completed' then
      v_title := 'Pesanan selesai';
      v_body := format('Pesanan %s telah selesai. Selamat menikmati!', new.order_code);
    when 'canceled' then
      v_title := 'Pesanan F&B dibatalkan';
      v_body := format('Pesanan %s telah dibatalkan.', new.order_code);
    else
      v_title := 'Status pesanan diperbarui';
      v_body := format(
        'Pesanan %s sekarang berstatus %s.',
        new.order_code,
        new.status
      );
  end case;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    new.user_id,
    v_title,
    v_body,
    'fnb',
    jsonb_build_object(
      'fnb_order_id', new.id,
      'order_code', new.order_code,
      'status', new.status
    )
  );

  return new;
end;
$$;

create or replace function public.notify_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.booking_id is not null then
    select user_id into v_user_id
    from public.bookings
    where id = new.booking_id;
  elsif new.fnb_order_id is not null then
    select user_id into v_user_id
    from public.fnb_orders
    where id = new.fnb_order_id;
  end if;

  if v_user_id is null then
    return new;
  end if;

  case new.status
    when 'paid' then
      v_title := 'Pembayaran berhasil';
      v_body := 'Pembayaran kamu telah berhasil diproses.';
    when 'failed' then
      v_title := 'Pembayaran gagal';
      v_body := 'Pembayaran gagal diproses. Silakan coba lagi.';
    when 'expired' then
      v_title := 'Pembayaran kedaluwarsa';
      v_body := 'Batas waktu pembayaran telah habis.';
    when 'refunded' then
      v_title := 'Refund diproses';
      v_body := 'Refund pembayaran kamu sedang diproses.';
    else
      v_title := 'Status pembayaran diperbarui';
      v_body := format('Pembayaran sekarang berstatus %s.', new.status);
  end case;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    v_user_id,
    v_title,
    v_body,
    'payment',
    jsonb_build_object(
      'payment_id', new.id,
      'status', new.status,
      'booking_id', new.booking_id,
      'fnb_order_id', new.fnb_order_id
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_booking_status on public.bookings;
create trigger notify_booking_status
  after update of status on public.bookings
  for each row execute function public.notify_booking_status();

drop trigger if exists notify_fnb_status on public.fnb_orders;
create trigger notify_fnb_status
  after update of status on public.fnb_orders
  for each row execute function public.notify_fnb_status();

drop trigger if exists notify_payment_status on public.payments;
create trigger notify_payment_status
  after update of status on public.payments
  for each row execute function public.notify_payment_status();

-- ------------------------------------------------------------
-- 17. Lepas kursi saat booking dihapus
-- ------------------------------------------------------------
create or replace function public.release_seats_on_booking_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.showtime_seats
  set status = 'available',
      booking_id = null,
      held_until = null
  where booking_id = old.id;

  return old;
end;
$$;

drop trigger if exists release_seats_on_booking_delete on public.bookings;
create trigger release_seats_on_booking_delete
  before delete on public.bookings
  for each row execute function public.release_seats_on_booking_delete();

-- ------------------------------------------------------------
-- 18. Hak eksekusi function
-- ------------------------------------------------------------
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

grant execute on function public.validate_promo(text, numeric, uuid)
  to anon, authenticated;
grant execute on function public.get_seat_map(uuid)
  to anon, authenticated;

grant execute on function public.create_booking(uuid, uuid[], text)
  to authenticated;
grant execute on function public.create_fnb_order(
  jsonb, uuid, date, time, uuid, text, text
) to authenticated;
grant execute on function public.create_payment(
  uuid, uuid, public.payment_method, text
) to authenticated;
grant execute on function public.cancel_booking(uuid)
  to authenticated;

-- Function sensitif hanya untuk service_role / SQL editor.
revoke all on function public.confirm_payment(uuid) from public;
revoke all on function public.fail_payment(uuid, text) from public;
revoke all on function public.release_expired_bookings() from public;
revoke all on function public.get_app_setting_numeric(text, numeric) from public;
revoke all on function public.generate_booking_code() from public;
revoke all on function public.generate_order_code() from public;

grant execute on function public.confirm_payment(uuid) to service_role;
grant execute on function public.fail_payment(uuid, text) to service_role;
grant execute on function public.release_expired_bookings() to service_role;
grant execute on function public.get_app_setting_numeric(text, numeric)
  to service_role;
grant execute on function public.generate_booking_code() to service_role;
grant execute on function public.generate_order_code() to service_role;
