import MoviesCatalog from "@/components/movies-catalog";
import { getCachedMoviesCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const [{ status, q }, catalog] = await Promise.all([
    searchParams,
    getCachedMoviesCatalog(),
  ]);

  const genreNameById = new Map(catalog.genres.map((g) => [g.id, g.name]));
  const movieGenreIds: Record<string, string[]> = {};
  const movieGenreLabel: Record<string, string> = {};

  catalog.movieGenres.forEach((mg) => {
    movieGenreIds[mg.movie_id] = [...(movieGenreIds[mg.movie_id] ?? []), mg.genre_id];
    if (!movieGenreLabel[mg.movie_id]) {
      const name = genreNameById.get(mg.genre_id);
      if (name) movieGenreLabel[mg.movie_id] = name;
    }
  });

  const initialStatus = status === "coming_soon" ? "coming_soon" : "now_showing";

  return (
    <>
      {catalog.errorMessage && (
        <div className="cine-container pt-6">
          <div className="rounded-xl border border-cine-maroon/30 bg-cine-cream px-4 py-3 text-sm text-cine-maroon">
            Gagal memuat daftar film ({catalog.errorMessage}). Silakan coba beberapa saat lagi.
          </div>
        </div>
      )}
      <MoviesCatalog
        movies={catalog.movies}
        genres={catalog.genres}
        movieGenreIds={movieGenreIds}
        movieGenreLabel={movieGenreLabel}
        initialStatus={initialStatus}
        initialQuery={q ?? ""}
      />
    </>
  );
}
