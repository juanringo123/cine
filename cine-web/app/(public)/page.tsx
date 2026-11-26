import { cookies } from "next/headers";
import HomeClient from "@/components/home-client";
import { getCachedHomeCatalog } from "@/lib/public-catalog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  const [catalog, authInfo] = await Promise.all([
    getCachedHomeCatalog(),
    hasAuthCookie
      ? (async () => {
          const supabase = await createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return { user: null, profile: null };
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname, full_name")
            .eq("id", user.id)
            .maybeSingle();
          return { user, profile };
        })()
      : Promise.resolve({ user: null, profile: null }),
  ]);

  const { user, profile } = authInfo;

  const genreNameById = new Map(catalog.genres.map((g) => [g.id, g.name]));
  const movieGenreMap: Record<string, string> = {};
  catalog.movieGenres.forEach((mg) => {
    if (!movieGenreMap[mg.movie_id]) {
      const name = genreNameById.get(mg.genre_id);
      if (name) movieGenreMap[mg.movie_id] = name;
    }
  });

  const nowShowing = catalog.movies.filter((m) => m.status === "now_showing");
  const comingSoon = catalog.movies.filter((m) => m.status === "coming_soon");

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
      {catalog.errorMessage && (
        <div className="cine-container pt-6">
          <div className="rounded-xl border border-cine-maroon/30 bg-cine-cream px-4 py-3 text-sm text-cine-maroon">
            Gagal memuat sebagian data dari server ({catalog.errorMessage}). Silakan muat ulang halaman.
          </div>
        </div>
      )}
      <HomeClient
        firstName={firstName}
        todayLabel={todayLabel}
        nowShowing={nowShowing}
        comingSoon={comingSoon}
        promos={catalog.promos}
        cinemas={catalog.cinemas}
        movieGenreMap={movieGenreMap}
      />
    </>
  );
}
