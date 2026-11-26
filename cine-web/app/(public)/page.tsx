import HomeClient from "@/components/home-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    moviesRes,
    movieGenresRes,
    genresRes,
    promosRes,
    cinemasRes,
    profileRes,
  ] = await Promise.all([
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
    user
      ? supabase.from("profiles").select("nickname, full_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const loadError = moviesRes.error ?? promosRes.error ?? cinemasRes.error;

  const genreNameById = new Map((genresRes.data ?? []).map((g) => [g.id, g.name]));
  const movieGenreMap: Record<string, string> = {};
  (movieGenresRes.data ?? []).forEach((mg) => {
    if (!movieGenreMap[mg.movie_id]) {
      const name = genreNameById.get(mg.genre_id);
      if (name) movieGenreMap[mg.movie_id] = name;
    }
  });

  const movies = moviesRes.data ?? [];
  const nowShowing = movies.filter((m) => m.status === "now_showing");
  const comingSoon = movies.filter((m) => m.status === "coming_soon");

  const profile = profileRes.data;
  const firstName =
    profile?.nickname ||
    profile?.full_name?.split(" ")[0] ||
    (user?.user_metadata?.nickname as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Pengunjung";

  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      {loadError && (
        <div className="cine-container pt-6">
          <div className="rounded-xl border border-cine-maroon/30 bg-cine-cream px-4 py-3 text-sm text-cine-maroon">
            Gagal memuat sebagian data dari server ({loadError.message}). Silakan muat ulang halaman.
          </div>
        </div>
      )}
      <HomeClient
        firstName={firstName}
        todayLabel={todayLabel}
        nowShowing={nowShowing}
        comingSoon={comingSoon}
        promos={promosRes.data ?? []}
        cinemas={cinemasRes.data ?? []}
        movieGenreMap={movieGenreMap}
      />
    </>
  );
}
