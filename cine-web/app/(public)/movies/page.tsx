import MoviesCatalog from "@/components/movies-catalog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();

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

  const genreNameById = new Map((genresRes.data ?? []).map((g) => [g.id, g.name]));
  const movieGenreIds: Record<string, string[]> = {};
  const movieGenreLabel: Record<string, string> = {};

  (movieGenresRes.data ?? []).forEach((mg) => {
    movieGenreIds[mg.movie_id] = [...(movieGenreIds[mg.movie_id] ?? []), mg.genre_id];
    if (!movieGenreLabel[mg.movie_id]) {
      const name = genreNameById.get(mg.genre_id);
      if (name) movieGenreLabel[mg.movie_id] = name;
    }
  });

  const initialStatus = status === "coming_soon" ? "coming_soon" : "now_showing";

  return (
    <>
      {loadError && (
        <div className="cine-container pt-6">
          <div className="rounded-xl border border-cine-maroon/30 bg-cine-cream px-4 py-3 text-sm text-cine-maroon">
            Gagal memuat daftar film ({loadError.message}). Silakan coba beberapa saat lagi.
          </div>
        </div>
      )}
      <MoviesCatalog
        movies={moviesRes.data ?? []}
        genres={genresRes.data ?? []}
        movieGenreIds={movieGenreIds}
        movieGenreLabel={movieGenreLabel}
        initialStatus={initialStatus}
        initialQuery={q ?? ""}
      />
    </>
  );
}
