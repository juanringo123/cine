-- ============================================================
-- CINÉ — Supabase Database Schema
-- Migration 0001: extensions, enums, tables, indexes, constraints
-- Target: PostgreSQL 15+ (Supabase)
-- ============================================================

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type public.user_role as enum ('customer', 'admin', 'staff');

create type public.movie_status as enum ('now_showing', 'coming_soon', 'archived');

create type public.movie_age_rating as enum ('SU', '13+', '17+', '21+');

create type public.screen_type as enum ('regular_2d', '3d', 'imax', 'premiere');

create type public.showtime_format as enum ('regular_2d', '3d', 'imax', 'premiere');

create type public.seat_type as enum ('regular', 'premium', 'couple');

create type public.showtime_seat_status as enum ('available', 'held', 'booked', 'blocked');

create type public.booking_status as enum (
  'pending_payment',
  'paid',
  'confirmed',
  'canceled',
  'expired',
  'completed',
  'refunded'
);

create type public.payment_method as enum (
  'qris',
  'gopay',
  'ovo',
  'bank_transfer',
  'card'
);

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'expired',
  'refunded'
);

create type public.promo_discount_type as enum ('fixed', 'percent');

create type public.fnb_order_status as enum (
  'cart',
  'pending_payment',
  'paid',
  'preparing',
  'ready',
  'completed',
  'canceled'
);

create type public.notification_type as enum (
  'booking',
  'payment',
  'promo',
  'fnb',
  'system'
);

-- ------------------------------------------------------------
-- MASTER FILM
-- ------------------------------------------------------------
create table public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  synopsis text,
  duration_minutes integer not null check (duration_minutes > 0),
  release_date date,
  age_rating public.movie_age_rating,
  country text,
  director text,
  status public.movie_status not null default 'coming_soon',
  poster_url text,
  backdrop_url text,
  trailer_url text,
  rating numeric(3, 1) check (rating is null or (rating >= 0 and rating <= 10)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.movie_genres (
  movie_id uuid not null references public.movies(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (movie_id, genre_id)
);

create table public.movie_cast (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  name text not null,
  character_name text,
  photo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CINEMA, STUDIO, SEAT
-- ------------------------------------------------------------
create table public.cinemas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null,
  address text,
  phone text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  image_url text,
  facilities text[] not null default '{}',
  operating_hours jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  name text not null,
  screen_type public.screen_type not null default 'regular_2d',
  total_rows integer not null default 0 check (total_rows >= 0),
  total_seats integer not null default 0 check (total_seats >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cinema_id, name)
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  row_label text not null,
  seat_number integer not null check (seat_number > 0),
  seat_type public.seat_type not null default 'regular',
  x_position integer,
  y_position integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (studio_id, row_label, seat_number)
);

-- ------------------------------------------------------------
-- SHOWTIME & SEAT INVENTORY
-- ------------------------------------------------------------
create table public.showtimes (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete restrict,
  studio_id uuid not null references public.studios(id) on delete restrict,
  show_date date not null,
  start_time time not null,
  end_time time not null,
  price numeric(12, 2) not null check (price >= 0),
  format public.showtime_format not null default 'regular_2d',
  language text not null default 'IDN',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showtimes_time_check check (end_time > start_time),
  unique (studio_id, show_date, start_time)
);

-- ------------------------------------------------------------
-- PROFILE (extends auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  birth_date date,
  city text,
  preferred_cinema_id uuid references public.cinemas(id) on delete set null,
  avatar_url text,
  role public.user_role not null default 'customer',
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_key
  on public.profiles (lower(email))
  where email is not null;

create unique index profiles_phone_key
  on public.profiles (phone)
  where phone is not null;

-- ------------------------------------------------------------
-- PROMO
-- ------------------------------------------------------------
create table public.promos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text,
  discount_type public.promo_discount_type not null,
  discount_value numeric(12, 2) not null check (discount_value > 0),
  min_purchase numeric(12, 2) not null default 0 check (min_purchase >= 0),
  max_discount numeric(12, 2) check (max_discount is null or max_discount >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  quota integer check (quota is null or quota >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promos_validity_check check (valid_until > valid_from)
);

-- ------------------------------------------------------------
-- BOOKING (tiket bioskop)
-- ------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  showtime_id uuid not null references public.showtimes(id) on delete restrict,
  status public.booking_status not null default 'pending_payment',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  service_fee numeric(12, 2) not null default 0 check (service_fee >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  promo_id uuid references public.promos(id) on delete set null,
  qr_token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.showtime_seats (
  id uuid primary key default gen_random_uuid(),
  showtime_id uuid not null references public.showtimes(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  status public.showtime_seat_status not null default 'available',
  booking_id uuid references public.bookings(id) on delete set null,
  held_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (showtime_id, seat_id)
);

create table public.booking_seats (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  showtime_seat_id uuid not null references public.showtime_seats(id) on delete restrict,
  seat_label_snapshot text not null,
  price_snapshot numeric(12, 2) not null check (price_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique (booking_id, showtime_seat_id)
);

-- ------------------------------------------------------------
-- F&B
-- ------------------------------------------------------------
create table public.fnb_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fnb_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.fnb_categories(id) on delete restrict,
  name text not null,
  description text,
  image_url text,
  base_price numeric(12, 2) not null check (base_price >= 0),
  is_combo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fnb_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.fnb_items(id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  sku text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, name)
);

create table public.fnb_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  cinema_id uuid not null references public.cinemas(id) on delete restrict,
  pickup_date date not null,
  pickup_time time not null,
  status public.fnb_order_status not null default 'pending_payment',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  service_fee numeric(12, 2) not null default 0 check (service_fee >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  promo_id uuid references public.promos(id) on delete set null,
  qr_token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fnb_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.fnb_orders(id) on delete cascade,
  item_id uuid not null references public.fnb_items(id) on delete restrict,
  variant_id uuid references public.fnb_variants(id) on delete set null,
  item_name_snapshot text not null,
  variant_name_snapshot text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  notes text,
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PAYMENT (mendukung booking tiket & F&B)
-- ------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  fnb_order_id uuid references public.fnb_orders(id) on delete cascade,
  method public.payment_method not null,
  provider text,
  amount numeric(12, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  va_number text,
  payment_url text,
  external_id text unique,
  paid_at timestamptz,
  expires_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_target_check check (num_nonnulls(booking_id, fnb_order_id) = 1)
);

-- ------------------------------------------------------------
-- PROMO REDEMPTION
-- ------------------------------------------------------------
create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  fnb_order_id uuid references public.fnb_orders(id) on delete cascade,
  discount_amount numeric(12, 2) not null check (discount_amount >= 0),
  redeemed_at timestamptz not null default now(),
  constraint promo_redemptions_target_check check (num_nonnulls(booking_id, fnb_order_id) = 1)
);

create unique index promo_redemptions_booking_key
  on public.promo_redemptions (booking_id)
  where booking_id is not null;

create unique index promo_redemptions_fnb_order_key
  on public.promo_redemptions (fnb_order_id)
  where fnb_order_id is not null;

-- ------------------------------------------------------------
-- NOTIFICATION, FAQ, SETTINGS
-- ------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type public.notification_type not null default 'system',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'umum',
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index profiles_preferred_cinema_idx on public.profiles (preferred_cinema_id);
create index profiles_role_idx on public.profiles (role);

create index movies_status_idx on public.movies (status);
create index movies_release_date_idx on public.movies (release_date);
create index movie_cast_movie_idx on public.movie_cast (movie_id, sort_order);

create index studios_cinema_idx on public.studios (cinema_id);
create index seats_studio_idx on public.seats (studio_id, y_position, x_position);

create index showtimes_movie_date_idx on public.showtimes (movie_id, show_date);
create index showtimes_studio_date_idx on public.showtimes (studio_id, show_date);
create index showtimes_active_idx on public.showtimes (show_date, is_active);

create index showtime_seats_showtime_status_idx on public.showtime_seats (showtime_id, status);
create index showtime_seats_booking_idx on public.showtime_seats (booking_id);
create index showtime_seats_held_until_idx on public.showtime_seats (held_until)
  where status = 'held';

create index bookings_user_created_idx on public.bookings (user_id, created_at desc);
create index bookings_showtime_idx on public.bookings (showtime_id);
create index bookings_status_expires_idx on public.bookings (status, expires_at);

create index booking_seats_booking_idx on public.booking_seats (booking_id);

create index fnb_items_category_idx on public.fnb_items (category_id);
create index fnb_variants_item_idx on public.fnb_variants (item_id);
create index fnb_orders_user_created_idx on public.fnb_orders (user_id, created_at desc);
create index fnb_orders_status_expires_idx on public.fnb_orders (status, expires_at);
create index fnb_orders_booking_idx on public.fnb_orders (booking_id);
create index fnb_order_items_order_idx on public.fnb_order_items (order_id);

create index payments_booking_idx on public.payments (booking_id);
create index payments_fnb_order_idx on public.payments (fnb_order_id);
create index payments_status_idx on public.payments (status);

create index promo_redemptions_promo_user_idx on public.promo_redemptions (promo_id, user_id);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;

create index faqs_active_sort_idx on public.faqs (is_active, sort_order);
