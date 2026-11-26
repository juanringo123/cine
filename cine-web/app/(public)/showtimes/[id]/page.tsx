import { notFound } from "next/navigation";
import SeatMap from "@/components/seat-map";
import { BackHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { resolveMoviePoster } from "@/lib/assets";

export const dynamic = "force-dynamic";

export default async function ShowtimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: showtime } = await supabase
    .from("showtimes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!showtime) notFound();

  const [{ data: movie }, { data: studio }] = await Promise.all([
    supabase
      .from("movies")
      .select("title, slug, status, poster_url")
      .eq("id", showtime.movie_id)
      .maybeSingle(),
    supabase
      .from("studios")
      .select("name, cinema_id")
      .eq("id", showtime.studio_id)
      .maybeSingle(),
  ]);

  const { data: cinema } = studio
    ? await supabase.from("cinemas").select("name").eq("id", studio.cinema_id).maybeSingle()
    : { data: null };

  const posterUrl = resolveMoviePoster(
    movie?.poster_url,
    movie?.slug ?? showtime.movie_id,
    movie?.status,
  );

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BackHeader
        title="Select seat"
        href={movie?.slug ? `/movies/${movie.slug}` : "/movies"}
      />

      <SeatMap
        showtimeId={showtime.id}
        price={showtime.price}
        movieTitle={movie?.title ?? "Film"}
        posterUrl={posterUrl}
        cinemaName={cinema?.name ?? "CINÉ"}
        studioName={studio?.name ?? "Studio"}
        showDate={showtime.show_date}
        startTime={showtime.start_time}
      />
    </main>
  );
}
