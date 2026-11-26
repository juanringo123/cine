-- ============================================================
-- CINÉ — Integrasi TMDb API
-- Migration 0012: tambah kolom tmdb_id (unique) & pastikan RLS SELECT publik
-- Prasyarat: 0001 - 0011
-- ============================================================

-- 1. Tambah kolom tmdb_id pada public.movies
alter table public.movies
  add column if not exists tmdb_id integer;

-- 2. Full UNIQUE constraint agar kompatibel dengan ON CONFLICT (tmdb_id)
--    pada PostgREST / Supabase JS upsert(). Nilai NULL tetap diizinkan banyak baris.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movies_tmdb_id_key'
      and conrelid = 'public.movies'::regclass
  ) then
    alter table public.movies
      add constraint movies_tmdb_id_key unique (tmdb_id);
  end if;
end $$;

-- 3. Pastikan RLS aktif dan public read (SELECT) diizinkan untuk katalog film
alter table public.movies enable row level security;
alter table public.genres enable row level security;
alter table public.movie_genres enable row level security;
alter table public.movie_cast enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['movies', 'genres', 'movie_genres', 'movie_cast']
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = t || '_select_public'
    ) then
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        t || '_select_public',
        t
      );
    end if;
  end loop;
end $$;

-- ============================================================
-- Selesai. Urutan apply: 0001 ... 0011 -> 0012
-- ============================================================
