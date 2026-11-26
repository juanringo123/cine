-- ============================================================
-- CINÉ — Seed data
-- Migration 0004
-- Prasyarat: 0001, 0002, 0003
-- Catatan: judul film & nama pemeran bersifat fiktif (data contoh).
-- Seat harus dibuat SEBELUM showtimes, karena trigger
-- create_showtime_seats mengisi showtime_seats saat showtime di-insert.
-- ============================================================

-- ------------------------------------------------------------
-- 1. App settings
-- ------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('service_fee',          '2000'::jsonb),
  ('fnb_service_fee',      '2000'::jsonb),
  ('booking_hold_minutes', '15'::jsonb),
  ('terms_version',        '"2026-01"'::jsonb),
  ('contact',              '{"email": "halo@cine.example", "phone": "021-5551234"}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- ------------------------------------------------------------
-- 2. Genres
-- ------------------------------------------------------------
insert into public.genres (name, slug) values
  ('Aksi',       'aksi'),
  ('Drama',      'drama'),
  ('Komedi',     'komedi'),
  ('Horor',      'horor'),
  ('Fiksi Ilmiah', 'fiksi-ilmiah'),
  ('Animasi',    'animasi'),
  ('Romantis',   'romantis'),
  ('Thriller',   'thriller'),
  ('Petualangan','petualangan')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 3. Movies
-- ------------------------------------------------------------
insert into public.movies
  (slug, title, synopsis, duration_minutes, release_date, age_rating,
   country, director, status, poster_url, backdrop_url, rating)
values
  ('bintang-di-ujung-senja', 'Bintang di Ujung Senja',
   'Seorang astronom muda menemukan sinyal misterius dari ujung galaksi yang mengubah hidupnya dan seluruh umat manusia.',
   128, current_date - 10, '13+', 'Indonesia', 'Raka Pramudya', 'now_showing',
   'https://picsum.photos/seed/bintang-di-ujung-senja/400/600',
   'https://picsum.photos/seed/bintang-di-ujung-senja-bg/1280/720', 8.1),

  ('jalan-pulang', 'Jalan Pulang',
   'Dua saudara yang lama terpisah melakukan perjalanan darat melintasi Jawa untuk menyelesaikan warisan keluarga.',
   112, current_date - 21, 'SU', 'Indonesia', 'Sinta Laksmi', 'now_showing',
   'https://picsum.photos/seed/jalan-pulang/400/600',
   'https://picsum.photos/seed/jalan-pulang-bg/1280/720', 7.8),

  ('rumah-di-ujung-gang', 'Rumah di Ujung Gang',
   'Keluarga baru pindah ke rumah tua dan mulai mendengar suara aneh setiap malam ke-13.',
   101, current_date - 5, '17+', 'Indonesia', 'Dimas Wicaksono', 'now_showing',
   'https://picsum.photos/seed/rumah-di-ujung-gang/400/600',
   'https://picsum.photos/seed/rumah-di-ujung-gang-bg/1280/720', 7.2),

  ('kota-tanpa-malam', 'Kota Tanpa Malam',
   'Di kota masa depan yang tak pernah gelap, seorang detektif memburu pencuri mimpi.',
   139, current_date - 14, '13+', 'Amerika Serikat', 'Marcus Hale', 'now_showing',
   'https://picsum.photos/seed/kota-tanpa-malam/400/600',
   'https://picsum.photos/seed/kota-tanpa-malam-bg/1280/720', 8.4),

  ('petualangan-si-kancil', 'Petualangan Si Kancil',
   'Si Kancil dan kawan-kawan hutan berpetualang menyelamatkan sungai dari pawang serakah.',
   94, current_date - 7, 'SU', 'Indonesia', 'Laras Anindita', 'now_showing',
   'https://picsum.photos/seed/petualangan-si-kancil/400/600',
   'https://picsum.photos/seed/petualangan-si-kancil-bg/1280/720', 7.6),

  ('cinta-dalam-hujan', 'Cinta dalam Hujan',
   'Pertemuan tak sengaja di halte bus mempertemukan dua orang asing yang sama-sama sedang patah hati.',
   105, current_date - 3, '13+', 'Indonesia', 'Nadia Kusuma', 'now_showing',
   'https://picsum.photos/seed/cinta-dalam-hujan/400/600',
   'https://picsum.photos/seed/cinta-dalam-hujan-bg/1280/720', 7.0),

  ('operasi-garuda', 'Operasi Garuda',
   'Tim elite gabungan harus menggagalkan sabotase di jalur laut tersibuk Asia Tenggara dalam 72 jam.',
   132, current_date + 14, '17+', 'Indonesia', 'Bayu Santoso', 'coming_soon',
   'https://picsum.photos/seed/operasi-garuda/400/600',
   'https://picsum.photos/seed/operasi-garuda-bg/1280/720', null),

  ('lembah-cahaya', 'Lembah Cahaya',
   'Sebuah ekspedisi menemukan lembah tersembunyi tempat waktu berjalan berbeda.',
   118, current_date + 28, '13+', 'Inggris', 'Eleanor Whitmore', 'coming_soon',
   'https://picsum.photos/seed/lembah-cahaya/400/600',
   'https://picsum.photos/seed/lembah-cahaya-bg/1280/720', null),

  ('warung-nenek', 'Warung Nenek',
   'Cucu perantauan pulang kampung dan terpaksa mengurus warung legendaris milik neneknya.',
   99, current_date + 7, 'SU', 'Indonesia', 'Yoga Prasetya', 'coming_soon',
   'https://picsum.photos/seed/warung-nenek/400/600',
   'https://picsum.photos/seed/warung-nenek-bg/1280/720', null)
on conflict (slug) do nothing;

-- Genre per film
insert into public.movie_genres (movie_id, genre_id)
select m.id, g.id
from (values
  ('bintang-di-ujung-senja', 'fiksi-ilmiah'),
  ('bintang-di-ujung-senja', 'drama'),
  ('jalan-pulang',           'drama'),
  ('jalan-pulang',           'petualangan'),
  ('rumah-di-ujung-gang',    'horor'),
  ('rumah-di-ujung-gang',    'thriller'),
  ('kota-tanpa-malam',       'fiksi-ilmiah'),
  ('kota-tanpa-malam',       'thriller'),
  ('kota-tanpa-malam',       'aksi'),
  ('petualangan-si-kancil',  'animasi'),
  ('petualangan-si-kancil',  'petualangan'),
  ('cinta-dalam-hujan',      'romantis'),
  ('cinta-dalam-hujan',      'drama'),
  ('operasi-garuda',         'aksi'),
  ('operasi-garuda',         'thriller'),
  ('lembah-cahaya',          'petualangan'),
  ('lembah-cahaya',          'fiksi-ilmiah'),
  ('warung-nenek',           'komedi'),
  ('warung-nenek',           'drama')
) as x(movie_slug, genre_slug)
join public.movies m on m.slug = x.movie_slug
join public.genres g on g.slug = x.genre_slug
on conflict do nothing;

-- Pemeran (hanya diisi jika film belum punya data cast)
insert into public.movie_cast (movie_id, name, character_name, sort_order)
select m.id, x.name, x.character_name, x.sort_order
from (values
  ('bintang-di-ujung-senja', 'Anindya Rahma',  'Dr. Kirana',   1),
  ('bintang-di-ujung-senja', 'Bimo Hartanto',  'Arga',         2),
  ('jalan-pulang',           'Satria Wibowo',  'Dewa',         1),
  ('jalan-pulang',           'Maya Kartika',   'Laksmi',       2),
  ('rumah-di-ujung-gang',    'Citra Ayuningtyas', 'Rina',      1),
  ('rumah-di-ujung-gang',    'Fajar Nugroho',  'Pak Hendra',   2),
  ('kota-tanpa-malam',       'Daniel Cross',   'Det. Voss',    1),
  ('kota-tanpa-malam',       'Mira Okafor',    'Lena',         2),
  ('petualangan-si-kancil',  'Tarra Wulandari','Si Kancil (suara)', 1),
  ('cinta-dalam-hujan',      'Alya Prameswari','Sekar',        1),
  ('cinta-dalam-hujan',      'Reza Mahendra',  'Bayu',         2)
) as x(movie_slug, name, character_name, sort_order)
join public.movies m on m.slug = x.movie_slug
where not exists (
  select 1 from public.movie_cast c where c.movie_id = m.id
);

-- ------------------------------------------------------------
-- 4. Cinemas
-- ------------------------------------------------------------
insert into public.cinemas
  (name, slug, city, address, phone, latitude, longitude, image_url,
   facilities, operating_hours)
values
  ('CINÉ Grand Indonesia', 'cine-grand-indonesia', 'Jakarta',
   'Jl. M.H. Thamrin No. 1, Jakarta Pusat', '021-5551001', -6.195000, 106.820000,
   'https://picsum.photos/seed/cine-gi/800/450',
   array['IMAX', 'Premiere', 'Dolby Atmos', 'Parkir', 'Food Court'],
   '{"mon_sun": {"open": "10:00", "close": "23:59"}}'::jsonb),

  ('CINÉ Depok Town Square', 'cine-depok-town-square', 'Depok',
   'Jl. Margonda Raya, Depok', '021-5551002', -6.368000, 106.834000,
   'https://picsum.photos/seed/cine-dtc/800/450',
   array['3D', 'Dolby Atmos', 'Parkir', 'Musala'],
   '{"mon_sun": {"open": "10:00", "close": "23:59"}}'::jsonb),

  ('CINÉ Paris Van Java', 'cine-paris-van-java', 'Bandung',
   'Jl. Sukajadi No. 137-139, Bandung', '022-5551003', -6.889000, 107.596000,
   'https://picsum.photos/seed/cine-pvj/800/450',
   array['Premiere', 'Dolby Atmos', 'Parkir', 'Cafe'],
   '{"mon_sun": {"open": "10:00", "close": "23:59"}}'::jsonb)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 5. Studios
-- ------------------------------------------------------------
insert into public.studios (cinema_id, name, screen_type)
select c.id, x.name, x.screen_type::public.screen_type
from (values
  ('cine-grand-indonesia',   'Studio 1', 'regular_2d'),
  ('cine-grand-indonesia',   'Studio 2', '3d'),
  ('cine-grand-indonesia',   'IMAX',     'imax'),
  ('cine-grand-indonesia',   'Premiere', 'premiere'),
  ('cine-depok-town-square', 'Studio 1', 'regular_2d'),
  ('cine-depok-town-square', 'Studio 2', '3d'),
  ('cine-paris-van-java',    'Studio 1', 'regular_2d'),
  ('cine-paris-van-java',    'Premiere', 'premiere')
) as x(cinema_slug, name, screen_type)
join public.cinemas c on c.slug = x.cinema_slug
on conflict (cinema_id, name) do nothing;

-- ------------------------------------------------------------
-- 6. Seats
--    Layout per studio:
--      regular_2d / 3d : 8 baris (A-H) x 12 kursi
--                        baris A-E regular, F-G premium, H couple (6 kursi)
--      imax            : 10 baris (A-J) x 14 kursi, baris H-J premium
--      premiere        : 5 baris (A-E) x 8 kursi, semua premium,
--                        baris E couple (4 kursi)
-- ------------------------------------------------------------
do $$
declare
  s record;
  v_rows integer;
  v_cols integer;
  r integer;
  n integer;
  v_label text;
  v_type public.seat_type;
  v_max_n integer;
begin
  for s in select id, screen_type from public.studios loop
    -- lewati studio yang sudah punya kursi (idempotent)
    if exists (select 1 from public.seats where studio_id = s.id) then
      continue;
    end if;

    if s.screen_type = 'imax' then
      v_rows := 10; v_cols := 14;
    elsif s.screen_type = 'premiere' then
      v_rows := 5;  v_cols := 8;
    else
      v_rows := 8;  v_cols := 12;
    end if;

    for r in 1..v_rows loop
      v_label := chr(64 + r);
      v_max_n := v_cols;

      if s.screen_type = 'premiere' then
        if r = v_rows then v_type := 'couple'; v_max_n := 4;
        else v_type := 'premium'; end if;
      elsif s.screen_type = 'imax' then
        v_type := case when r >= 8 then 'premium' else 'regular' end;
      else
        if r = v_rows then v_type := 'couple'; v_max_n := 6;
        elsif r >= 6 then v_type := 'premium';
        else v_type := 'regular'; end if;
      end if;

      for n in 1..v_max_n loop
        insert into public.seats
          (studio_id, row_label, seat_number, seat_type, x_position, y_position)
        values
          (s.id, v_label, n, v_type, n, r);
      end loop;
    end loop;
  end loop;

  -- Sinkronkan total_rows & total_seats
  update public.studios st
  set total_rows = x.rows_count,
      total_seats = x.seats_count
  from (
    select studio_id,
           count(distinct row_label) as rows_count,
           count(*) as seats_count
    from public.seats
    group by studio_id
  ) x
  where x.studio_id = st.id;
end $$;

-- ------------------------------------------------------------
-- 7. Showtimes: 7 hari ke depan (mulai hari ini)
--    5 slot per studio, film now_showing dirotasi per studio.
--    Slot terakhir 21:00 + durasi maks 139 menit = 23:19 (< tengah malam).
--    Insert memicu create_showtime_seats -> showtime_seats terisi otomatis.
-- ------------------------------------------------------------
with studios_ranked as (
  select s.id as studio_id, s.screen_type,
         (row_number() over (order by s.cinema_id, s.name) - 1) as sidx
  from public.studios s
),
movies_ranked as (
  select m.id as movie_id, m.duration_minutes,
         (row_number() over (order by m.slug) - 1) as midx
  from public.movies m
  where m.status = 'now_showing'
),
mcount as (
  select count(*)::int as n from movies_ranked
),
slots as (
  select * from (values
    (0, time '10:00'),
    (1, time '12:45'),
    (2, time '15:30'),
    (3, time '18:15'),
    (4, time '21:00')
  ) as t(slot_idx, start_time)
),
days as (
  select d::date as show_date
  from generate_series(current_date, current_date + 6, interval '1 day') as d
)
insert into public.showtimes
  (movie_id, studio_id, show_date, start_time, end_time, price, format, language)
select
  mr.movie_id,
  sr.studio_id,
  d.show_date,
  sl.start_time,
  (sl.start_time + make_interval(mins => mr.duration_minutes))::time,
  case sr.screen_type
    when 'regular_2d' then
      case when extract(isodow from d.show_date) in (5, 6, 7) then 50000 else 40000 end
    when '3d' then
      case when extract(isodow from d.show_date) in (5, 6, 7) then 60000 else 50000 end
    when 'imax' then
      case when extract(isodow from d.show_date) in (5, 6, 7) then 85000 else 75000 end
    when 'premiere' then
      case when extract(isodow from d.show_date) in (5, 6, 7) then 110000 else 95000 end
  end,
  sr.screen_type::text::public.showtime_format,
  'IDN'
from studios_ranked sr
cross join mcount
cross join days d
cross join slots sl
join movies_ranked mr
  on mr.midx = ((sr.sidx + sl.slot_idx) % mcount.n)
on conflict (studio_id, show_date, start_time) do nothing;

-- ------------------------------------------------------------
-- 8. F&B
-- ------------------------------------------------------------
insert into public.fnb_categories (name, slug, sort_order) values
  ('Popcorn', 'popcorn', 1),
  ('Minuman', 'minuman', 2),
  ('Snack',   'snack',   3),
  ('Combo',   'combo',   4)
on conflict (slug) do nothing;

-- Item (dibuat sekali; dicek berdasarkan kategori + nama)
insert into public.fnb_items (category_id, name, description, image_url, base_price, is_combo)
select c.id, x.name, x.description, x.image_url, x.base_price, x.is_combo
from (values
  ('popcorn', 'Popcorn Caramel',  'Popcorn renyah berlapis karamel manis.',
    'https://picsum.photos/seed/popcorn-caramel/400/400', 35000, false),
  ('popcorn', 'Popcorn Asin',     'Popcorn klasik dengan garam laut.',
    'https://picsum.photos/seed/popcorn-asin/400/400', 30000, false),
  ('minuman', 'Cola',             'Minuman bersoda dingin.',
    'https://picsum.photos/seed/cola/400/400', 22000, false),
  ('minuman', 'Es Teh Lemon',     'Teh dingin dengan perasan lemon segar.',
    'https://picsum.photos/seed/es-teh/400/400', 20000, false),
  ('minuman', 'Air Mineral',      'Air mineral 600 ml.',
    'https://picsum.photos/seed/air-mineral/400/400', 10000, false),
  ('snack',   'Nachos Keju',      'Nachos dengan saus keju hangat.',
    'https://picsum.photos/seed/nachos/400/400', 32000, false),
  ('snack',   'Hot Dog',          'Sosis sapi dengan roti lembut.',
    'https://picsum.photos/seed/hotdog/400/400', 28000, false),
  ('snack',   'Kentang Goreng',   'Kentang goreng renyah.',
    'https://picsum.photos/seed/fries/400/400', 25000, false),
  ('combo',   'Combo Solo',       '1 Popcorn Medium + 1 Minuman.',
    'https://picsum.photos/seed/combo-solo/400/400', 50000, true),
  ('combo',   'Combo Couple',     '1 Popcorn Large + 2 Minuman.',
    'https://picsum.photos/seed/combo-couple/400/400', 85000, true)
) as x(category_slug, name, description, image_url, base_price, is_combo)
join public.fnb_categories c on c.slug = x.category_slug
where not exists (
  select 1 from public.fnb_items i
  where i.category_id = c.id and i.name = x.name
);

-- Varian (harga final per varian)
insert into public.fnb_variants (item_id, name, price, sku)
select i.id, x.variant_name, x.price, x.sku
from (values
  ('Popcorn Caramel', 'Medium', 35000, 'POP-CAR-M'),
  ('Popcorn Caramel', 'Large',  45000, 'POP-CAR-L'),
  ('Popcorn Asin',    'Medium', 30000, 'POP-ASN-M'),
  ('Popcorn Asin',    'Large',  40000, 'POP-ASN-L'),
  ('Cola',            'Regular', 22000, 'DRK-COL-R'),
  ('Cola',            'Large',   27000, 'DRK-COL-L'),
  ('Es Teh Lemon',    'Regular', 20000, 'DRK-TEH-R'),
  ('Es Teh Lemon',    'Large',   25000, 'DRK-TEH-L'),
  ('Air Mineral',     'Regular', 10000, 'DRK-AIR-R'),
  ('Nachos Keju',     'Regular', 32000, 'SNK-NCH-R'),
  ('Hot Dog',         'Regular', 28000, 'SNK-HTD-R'),
  ('Kentang Goreng',  'Regular', 25000, 'SNK-FRY-R'),
  ('Combo Solo',      'Regular', 50000, 'CMB-SOL-R'),
  ('Combo Couple',    'Regular', 85000, 'CMB-CPL-R')
) as x(item_name, variant_name, price, sku)
join public.fnb_items i on i.name = x.item_name
on conflict (sku) do nothing;

-- ------------------------------------------------------------
-- 9. Promo
-- ------------------------------------------------------------
insert into public.promos
  (code, description, discount_type, discount_value, min_purchase,
   max_discount, valid_from, valid_until, quota, per_user_limit)
values
  ('WELCOME10', 'Diskon 10% untuk pembelian pertama, maks Rp20.000.',
   'percent', 10, 40000, 20000, now(), now() + interval '90 days', 1000, 1),
  ('HEMAT15K',  'Potongan Rp15.000 untuk pembelian min. Rp100.000.',
   'fixed', 15000, 100000, null, now(), now() + interval '60 days', 500, 2),
  ('WEEKDAY20', 'Diskon 20% hari kerja, maks Rp25.000.',
   'percent', 20, 60000, 25000, now(), now() + interval '30 days', null, 3),
  ('NONTONRAME','Diskon 25% untuk 4 kursi atau lebih, maks Rp50.000.',
   'percent', 25, 160000, 50000, now(), now() + interval '45 days', 300, 1)
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 10. FAQ
-- ------------------------------------------------------------
insert into public.faqs (category, question, answer, sort_order)
select x.category, x.question, x.answer, x.sort_order
from (values
  ('pemesanan', 'Berapa lama kursi ditahan sebelum pembayaran?',
   'Kursi ditahan selama 15 menit setelah pemesanan dibuat. Jika pembayaran belum selesai, pesanan otomatis kedaluwarsa dan kursi dilepas.', 1),
  ('pemesanan', 'Bagaimana cara memesan tiket?',
   'Pilih film, bioskop, jadwal, dan kursi. Tambahkan F&B bila perlu, lalu lanjutkan ke pembayaran.', 2),
  ('pembayaran', 'Metode pembayaran apa saja yang tersedia?',
   'QRIS, GoPay, OVO, transfer bank (virtual account), dan kartu.', 1),
  ('pembayaran', 'Apakah ada biaya layanan?',
   'Ya, biaya layanan per transaksi ditampilkan sebelum Anda membayar.', 2),
  ('tiket', 'Bagaimana cara menukar tiket di bioskop?',
   'Tunjukkan kode QR dari halaman pesanan Anda kepada petugas di pintu studio.', 1),
  ('tiket', 'Apakah tiket bisa dibatalkan atau di-refund?',
   'Pesanan yang belum dibayar dapat dibatalkan kapan saja. Pesanan yang sudah dibayar mengikuti kebijakan refund yang berlaku.', 2),
  ('fnb', 'Bagaimana cara mengambil pesanan F&B?',
   'Tunjukkan kode QR pesanan F&B di konter bioskop pada tanggal dan jam pengambilan yang dipilih.', 1),
  ('umum', 'Bagaimana cara menggunakan kode promo?',
   'Masukkan kode promo pada halaman pembayaran. Diskon akan dihitung otomatis jika syarat terpenuhi.', 1)
) as x(category, question, answer, sort_order)
where not exists (
  select 1 from public.faqs f where f.question = x.question
);
