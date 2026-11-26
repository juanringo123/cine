import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types/database";

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Data katalog halaman Beranda, di-cache 60 detik di server untuk memangkas latensi. */
export const getCachedHomeCatalog = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    if (!supabase) {
      return {
        movies: [],
        movieGenres: [],
        genres: [],
        promos: [],
        cinemas: [],
        errorMessage: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum diisi.",
      };
    }

    const [moviesRes, movieGenresRes, genresRes, promosRes, cinemasRes] =
      await Promise.all([
        supabase
          .from("movies")
          .select("*")
          .in("status", ["now_showing", "coming_soon"])
          .order("release_date", { ascending: false }),
        supabase.from("movie_genres").select("movie_id, genre_id"),
        supabase.from("genres").select("id, name"),
        supabase
          .from("promos")
          .select("*")
          .eq("is_active", true)
          .order("valid_until", { ascending: true }),
        supabase.from("cinemas").select("*").eq("is_active", true).order("name"),
      ]);

    const loadError = moviesRes.error ?? promosRes.error ?? cinemasRes.error;

    return {
      movies: moviesRes.data ?? [],
      movieGenres: movieGenresRes.data ?? [],
      genres: genresRes.data ?? [],
      promos: promosRes.data ?? [],
      cinemas: cinemasRes.data ?? [],
      errorMessage: loadError?.message ?? null,
    };
  },
  ["public-home-catalog-v1"],
  { revalidate: 60 },
);

/** Data katalog halaman Film, di-cache 60 detik di server. */
export const getCachedMoviesCatalog = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    if (!supabase) {
      return {
        movies: [],
        genres: [],
        movieGenres: [],
        errorMessage: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum diisi.",
      };
    }

    const [moviesRes, genresRes, movieGenresRes] = await Promise.all([
      supabase
        .from("movies")
        .select("*")
        .in("status", ["now_showing", "coming_soon"])
        .order("release_date", { ascending: false }),
      supabase.from("genres").select("*").order("name"),
      supabase.from("movie_genres").select("movie_id, genre_id"),
    ]);

    const loadError = moviesRes.error ?? genresRes.error;

    return {
      movies: moviesRes.data ?? [],
      genres: genresRes.data ?? [],
      movieGenres: movieGenresRes.data ?? [],
      errorMessage: loadError?.message ?? null,
    };
  },
  ["public-movies-catalog-v1"],
  { revalidate: 60 },
);

/** Data daftar bioskop aktif, di-cache 60 detik di server. */
export const getCachedCinemasCatalog = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("cinemas")
      .select("*")
      .eq("is_active", true)
      .order("name");

    return data ?? [];
  },
  ["public-cinemas-catalog-v1"],
  { revalidate: 60 },
);

/** Data katalog F&B aktif, di-cache 60 detik di server. */
export const getCachedFnbCatalog = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    if (!supabase) {
      return { categories: [], items: [], variants: [], cinemas: [] };
    }

    const [{ data: categories }, { data: items }, { data: variants }, { data: cinemas }] =
      await Promise.all([
        supabase.from("fnb_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("fnb_items").select("*").eq("is_active", true).order("name"),
        supabase.from("fnb_variants").select("*").eq("is_active", true),
        supabase.from("cinemas").select("id, name, city").eq("is_active", true).order("name"),
      ]);

    return {
      categories: categories ?? [],
      items: items ?? [],
      variants: variants ?? [],
      cinemas: cinemas ?? [],
    };
  },
  ["public-fnb-catalog-v1"],
  { revalidate: 60 },
);
