import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, BackHeader } from "@/components/ui/primitives";
import { isWeekendDate } from "@/lib/pricing";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CinemaDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: cinema } = await supabase.from("cinemas").select("*").eq("slug", slug).maybeSingle();
  if (!cinema) notFound();

  const { data: studios } = await supabase
    .from("studios")
    .select("*")
    .eq("cinema_id", cinema.id)
    .eq("is_active", true)
    .order("name");

  const todayJakarta = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: showtimes } = studios?.length
    ? await supabase
        .from("showtimes")
        .select("id, studio_id, movie_id, show_date, start_time, price, format")
        .in("studio_id", studios.map((s) => s.id))
        .eq("is_active", true)
        .gte("show_date", todayJakarta)
        .order("show_date")
        .order("start_time")
    : { data: [] };

  const { data: movies } = showtimes?.length
    ? await supabase
        .from("movies")
        .select("id, title, slug")
        .in("id", showtimes.map((s) => s.movie_id))
    : { data: [] };

  const movieMap = new Map((movies ?? []).map((m) => [m.id, m]));
  const studioMap = new Map((studios ?? []).map((s) => [s.id, s]));
  const visibleShowtimes = (showtimes ?? []).filter((st) => movieMap.has(st.movie_id));

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BackHeader title={cinema.name} href="/cinema" />

      <div className="cine-card flex flex-col gap-3 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cine-maroon">
          {cinema.city}
        </p>
        <p className="text-sm text-cine-muted">{cinema.address}</p>
        {cinema.facilities.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {cinema.facilities.map((f) => (
              <Badge key={f} variant="white">
                {f}
              </Badge>
            ))}
          </div>
        )}
        {studios && studios.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {studios.map((st) => (
              <Badge key={st.id} variant="gold">
                {st.name} · {st.screen_type.replace("_", " ").toUpperCase()} ({st.total_seats} kursi)
              </Badge>
            ))}
          </div>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-cine-ink">Jadwal Tayang</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {visibleShowtimes.map((st) => {
            const studio = studioMap.get(st.studio_id);
            const movie = movieMap.get(st.movie_id);
            return (
              <Link
                key={st.id}
                href={`/showtimes/${st.id}`}
                className="cine-card-bordered flex items-center justify-between gap-4 p-4 transition-colors hover:border-cine-maroon"
              >
                <div className="space-y-1">
                  <p className="font-bold text-cine-ink">{movie?.title ?? "Film"}</p>
                  <p className="text-xs text-cine-muted">
                    {studio?.name} · {st.show_date} · {st.start_time.slice(0, 5)} ·{" "}
                    {st.format.replace("_", " ").toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {isWeekendDate(st.show_date) && (
                      <span className="rounded-full bg-cine-maroon/10 px-2 py-0.5 text-[10px] font-semibold text-cine-maroon">
                        Weekend
                      </span>
                    )}
                    <p className="font-bold text-cine-maroon">{formatRupiah(st.price)}</p>
                  </div>
                  <span className="text-xs font-semibold text-cine-ink underline">
                    Pilih kursi
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        {visibleShowtimes.length === 0 && (
          <p className="text-sm text-cine-muted">Belum ada jadwal di cinema ini.</p>
        )}
      </section>
    </main>
  );
}
