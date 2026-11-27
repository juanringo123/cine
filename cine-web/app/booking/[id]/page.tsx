import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import OrderSummaryActions from "@/components/order-summary-actions";
import { BackHeader } from "@/components/ui/primitives";
import { FIGMA_ICONS, resolveMoviePoster } from "@/lib/assets";
import { isWeekendDate } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!booking) notFound();

  const [{ data: seats }, { data: showtime }] = await Promise.all([
    supabase
      .from("booking_seats")
      .select("seat_label_snapshot, price_snapshot")
      .eq("booking_id", booking.id),
    supabase.from("showtimes").select("*").eq("id", booking.showtime_id).maybeSingle(),
  ]);

  const [{ data: movie }, { data: studio }] = await Promise.all([
    showtime
      ? supabase.from("movies").select("*").eq("id", showtime.movie_id).maybeSingle()
      : Promise.resolve({ data: null }),
    showtime
      ? supabase.from("studios").select("*").eq("id", showtime.studio_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: cinema } = studio
    ? await supabase.from("cinemas").select("*").eq("id", studio.cinema_id).maybeSingle()
    : { data: null };

  const poster = resolveMoviePoster(
    movie?.poster_url,
    movie?.slug ?? booking.id,
    movie?.status,
  );
  const seatCount = seats?.length ?? 0;
  const ticketPrice =
    seats?.[0]?.price_snapshot ??
    (seatCount > 0 ? booking.subtotal / seatCount : (showtime?.price ?? 0));
  const isWeekendShow = showtime ? isWeekendDate(showtime.show_date) : false;

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BackHeader
        title="Buy Ticket"
        href={showtime ? `/showtimes/${showtime.id}` : "/my-bookings"}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px] xl:grid-cols-[640px_1fr] xl:gap-10">
        {/* Kartu Ringkasan (Figma 1:1315) */}
        <div className="cine-card flex flex-col gap-3.5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-[100px] w-[77px] shrink-0 overflow-hidden rounded-xl bg-white">
              <Image src={poster} alt={movie?.title ?? "Film"} fill sizes="77px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="text-lg font-bold text-cine-ink">
                {movie?.title ?? booking.booking_code}
              </h2>
              <p className="text-[13px] text-cine-muted">
                {movie ? `${formatDuration(movie.duration_minutes)} · ${movie.age_rating ?? "SU"}` : booking.booking_code}
              </p>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-cine-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FIGMA_ICONS.pin} alt="" width={16} height={16} className="size-4" />
                <span>{cinema?.name ?? "CINÉ"}</span>
              </div>
            </div>
          </div>

          <div className="cine-divider" />

          <Row label="Kode Booking" value={booking.booking_code} />
          <Row
            label="Status"
            value={booking.status === "completed" ? "USED (Sudah Digunakan)" : booking.status}
          />
          {showtime && (
            <Row
              label="Date"
              value={`${formatLongDate(showtime.show_date)}${isWeekendShow ? " (Tarif Weekend)" : ""}`}
            />
          )}
          {showtime && <Row label="Time" value={showtime.start_time.slice(0, 5)} />}
          {studio && <Row label="Hall" value={studio.name} />}
          <Row
            label="Seat"
            value={seats?.map((s) => s.seat_label_snapshot).join(", ") || "-"}
          />
          <Row
            label={`Ticket ${seatCount} x ${formatRupiah(ticketPrice)}${isWeekendShow ? " (Weekend)" : ""}`}
            value={formatRupiah(booking.subtotal)}
          />
          <Row label="Biaya layanan" value={formatRupiah(booking.service_fee)} />
          {booking.discount > 0 && (
            <Row label="Diskon" value={`-${formatRupiah(booking.discount)}`} />
          )}

          <div className="cine-divider" />

          <div className="flex items-center justify-between text-base font-bold text-cine-ink">
            <span>Total</span>
            <span>{formatRupiah(booking.total)}</span>
          </div>
        </div>

        {/* Kolom Kanan: Promo + Continue to Payment */}
        <OrderSummaryActions
          targetId={booking.id}
          kind="booking"
          status={booking.status}
          code={booking.booking_code}
          isPending={booking.status === "pending_payment"}
        />
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-cine-muted">{label}</span>
      <span className="text-cine-ink">{value}</span>
    </div>
  );
}
