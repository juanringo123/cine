import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MovieBookingWidget, {
  type MovieShowtimeOption,
} from "@/components/movie-booking-widget";
import TrailerPlayer from "@/components/trailer-player";
import {
  isUsableImageUrl,
  resolveCastPhoto,
  resolveMovieBackdrop,
  resolveMoviePoster,
} from "@/lib/assets";
import { getJakartaDateISO, getJakartaTimeHHMM } from "@/lib/utils";
import { toYouTubeThumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function MovieDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: movie, error: movieErr } = await supabase
    .from("movies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (movieErr) {
    throw new Error(`Gagal memuat detail film: ${movieErr.message}`);
  }
  if (!movie) notFound();

  const todayJakarta = getJakartaDateISO();
  const nowTimeJakarta = getJakartaTimeHHMM();

  const [{ data: genreRows }, { data: genreMaster }, { data: cast }, { data: showtimes }] =
    await Promise.all([
      supabase.from("movie_genres").select("genre_id").eq("movie_id", movie.id),
      supabase.from("genres").select("id, name"),
      supabase.from("movie_cast").select("*").eq("movie_id", movie.id).order("sort_order"),
      supabase
        .from("showtimes")
        .select("id, show_date, start_time, end_time, price, format, studio_id")
        .eq("movie_id", movie.id)
        .eq("is_active", true)
        .gte("show_date", todayJakarta)
        .order("show_date")
        .order("start_time"),
    ]);

  const upcomingShowtimes = (showtimes ?? []).filter(
    (st) => st.show_date > todayJakarta || st.start_time.slice(0, 5) >= nowTimeJakarta,
  );

  const genreIds = new Set((genreRows ?? []).map((row) => row.genre_id));
  const genres = (genreMaster ?? []).filter((g) => genreIds.has(g.id));

  const { data: studios } = upcomingShowtimes.length
    ? await supabase
        .from("studios")
        .select("id, name, cinema_id")
        .in(
          "id",
          upcomingShowtimes.map((s) => s.studio_id),
        )
    : { data: [] as { id: string; name: string; cinema_id: string }[] };

  const { data: cinemas } =
    studios && studios.length
      ? await supabase
          .from("cinemas")
          .select("id, name, slug")
          .in(
            "id",
            studios.map((s) => s.cinema_id),
          )
      : { data: [] as { id: string; name: string; slug: string }[] };

  const studioMap = new Map((studios ?? []).map((s) => [s.id, s]));
  const cinemaMap = new Map((cinemas ?? []).map((c) => [c.id, c]));

  const showtimeOptions: MovieShowtimeOption[] = upcomingShowtimes.map((st) => {
    const studio = studioMap.get(st.studio_id);
    const cinema = studio ? cinemaMap.get(studio.cinema_id) : undefined;
    return {
      id: st.id,
      show_date: st.show_date,
      start_time: st.start_time,
      end_time: st.end_time,
      price: st.price,
      format: st.format,
      studio_name: studio?.name ?? "Studio",
      cinema_id: cinema?.id ?? "",
      cinema_name: cinema?.name ?? "CINÉ",
    };
  });

  const poster = resolveMoviePoster(movie.poster_url, movie.slug, movie.status);
  const ytThumb = toYouTubeThumbnailUrl(movie.trailer_url);
  const backdrop = isUsableImageUrl(movie.backdrop_url)
    ? movie.backdrop_url
    : (ytThumb ?? resolveMovieBackdrop(movie.backdrop_url));

  const year = movie.release_date ? movie.release_date.slice(0, 4) : "2026";
  const metaItems = [
    year,
    formatDuration(movie.duration_minutes),
    genres.map((g) => g.name).join(", ") || "Drama",
    movie.age_rating ?? "SU",
    movie.country ?? "IDN",
  ].filter(Boolean);

  return (
    <main className="pb-20">
      {/* Backdrop Hero + Play Trailer YouTube (Figma 1:742) */}
      <div className="relative h-[220px] w-full overflow-hidden bg-cine-maroon-deep sm:h-[300px] lg:h-[340px]">
        <Image
          src={backdrop}
          alt={movie.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />

        <TrailerPlayer title={movie.title} trailerUrl={movie.trailer_url} />
      </div>

      {/* Konten Detail Film */}
      <div className="cine-container relative pt-6 xl:pt-10">
        <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[252px_minmax(0,1fr)_356px] xl:gap-10">
          {/* Poster Overlap */}
          <div className="-mt-12 sm:-mt-16 md:-mt-28 xl:-mt-[190px]">
            <div className="relative mx-auto h-[300px] w-[200px] overflow-hidden rounded-[16px] border-2 border-white bg-cine-cream shadow-lg md:mx-0 xl:h-[378px] xl:w-[252px]">
              <Image
                src={poster}
                alt={movie.title}
                fill
                sizes="(max-width: 1280px) 200px, 252px"
                className="object-cover"
              />
            </div>
          </div>

          {/* Info Film + Story Line + Cast */}
          <div className="min-w-0 space-y-3.5">
            <h1 className="text-[26px] font-bold leading-[1.15] text-cine-ink sm:text-[32px] xl:text-[40px]">
              {movie.title}
            </h1>
            <p className="text-sm text-cine-muted">{metaItems.join("  •  ")}</p>
            {movie.director && (
              <p className="text-sm text-cine-ink">Director: {movie.director}</p>
            )}

            <div className="space-y-2 pt-1">
              <h2 className="text-xl font-bold text-cine-ink">Story Line</h2>
              <p className="text-[15px] leading-relaxed text-cine-muted">
                {movie.synopsis ?? "Sinopsis film akan segera hadir."}
              </p>
            </div>

            {cast && cast.length > 0 && (
              <div className="space-y-2 pt-1">
                <h2 className="text-xl font-bold text-cine-ink">Cast</h2>
                <div className="no-scrollbar flex gap-3 overflow-x-auto py-2">
                  {cast.map((person) => (
                    <a
                      key={person.id}
                      href={`/api/cast/bio?name=${encodeURIComponent(person.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Lihat biografi ${person.name}${person.character_name ? ` (${person.character_name})` : ""}`}
                      className="group flex w-[84px] shrink-0 cursor-pointer flex-col items-center gap-2 text-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5"
                    >
                      <div className="relative size-[70px] overflow-hidden rounded-full bg-cine-cream ring-2 ring-transparent transition-all duration-200 group-hover:ring-cine-maroon">
                        <Image
                          src={resolveCastPhoto(person.photo_url, person.id)}
                          alt={person.name}
                          fill
                          sizes="70px"
                          className="object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                      <span className="line-clamp-2 text-xs text-cine-muted transition-colors duration-200 group-hover:font-medium group-hover:text-cine-maroon group-hover:underline">
                        {person.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panel Pemilih Jadwal & Book Now */}
          <div className="md:col-span-2 xl:col-span-1">
            <MovieBookingWidget showtimes={showtimeOptions} />
          </div>
        </div>
      </div>
    </main>
  );
}
