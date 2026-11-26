import ShowtimeManager from "@/components/admin/showtime-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminShowtimes() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: movies }, { data: studios }, { data: showtimes }] = await Promise.all([
    supabase.from("movies").select("id, title, duration_minutes, status").order("title"),
    supabase.from("studios").select("id, name, screen_type").order("name"),
    supabase.from("showtimes").select("id, show_date, start_time, end_time, price, format, movie_id, studio_id")
      .order("show_date", { ascending: false }).limit(100),
  ]);

  const movieMap = new Map((movies ?? []).map((m) => [m.id, m]));
  const studioMap = new Map((studios ?? []).map((s) => [s.id, s]));

  const rows = (showtimes ?? []).map((st) => ({
    id: st.id,
    show_date: st.show_date,
    start_time: st.start_time,
    end_time: st.end_time,
    price: st.price,
    format: st.format,
    movie_title: movieMap.get(st.movie_id)?.title ?? "-",
    studio_name: studioMap.get(st.studio_id)?.name ?? "-",
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Kelola Jadwal</h2>
      <ShowtimeManager movies={movies ?? []} studios={studios ?? []} showtimes={rows} />
    </div>
  );
}
