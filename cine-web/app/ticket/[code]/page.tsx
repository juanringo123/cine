import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import TicketActions from "@/components/ticket-actions";
import { BackHeader } from "@/components/ui/primitives";
import { FIGMA_ICONS, resolveFnbImage, resolveMoviePoster } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${iso}T00:00:00`));
}

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_code", code)
    .maybeSingle();

  const { data: order } = booking
    ? { data: null }
    : await supabase.from("fnb_orders").select("*").eq("order_code", code).maybeSingle();

  if (!booking && !order) notFound();

  const qrUrl = `/api/tickets/${encodeURIComponent(code)}/qr`;

  if (booking) {
    const [{ data: seats }, { data: showtime }] = await Promise.all([
      supabase
        .from("booking_seats")
        .select("seat_label_snapshot")
        .eq("booking_id", booking.id),
      supabase.from("showtimes").select("*").eq("id", booking.showtime_id).maybeSingle(),
    ]);

    const [{ data: movie }, { data: studio }] = await Promise.all([
      showtime
        ? supabase.from("movies").select("title, slug, status, poster_url").eq("id", showtime.movie_id).maybeSingle()
        : Promise.resolve({ data: null }),
      showtime
        ? supabase.from("studios").select("name, cinema_id").eq("id", showtime.studio_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const { data: cinema } = studio
      ? await supabase.from("cinemas").select("name").eq("id", studio.cinema_id).maybeSingle()
      : { data: null };

    const poster = resolveMoviePoster(
      movie?.poster_url,
      movie?.slug ?? booking.id,
      movie?.status,
    );

    const seatLabels = (seats ?? []).map((s) => s.seat_label_snapshot);
    const rowSet = Array.from(new Set(seatLabels.map((s) => s.replace(/\d+$/, "")))).join(", ") || "-";

    return (
      <main className="cine-container flex flex-col gap-8 pb-20 pt-8">
        <BackHeader title="Your Ticket" href="/my-bookings" />

        <div className="mx-auto flex w-full max-w-[960px] flex-col items-center gap-7">
          <div className="flex w-full flex-col items-center gap-6 rounded-[28px] bg-cine-cream p-5 md:flex-row">
            <div className="relative h-[290px] w-full shrink-0 overflow-hidden rounded-[18px] bg-white md:w-[232px]">
              <Image
                src={poster}
                alt={movie?.title ?? "Film"}
                fill
                sizes="(max-width: 768px) 100vw, 232px"
                className="object-cover"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <h2 className="text-[28px] font-bold leading-tight text-cine-ink">
                {movie?.title ?? booking.booking_code}
              </h2>
              <p className="text-sm font-bold text-cine-ink">{booking.booking_code} · {booking.status}</p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-cine-muted">
                {showtime && (
                  <span className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={FIGMA_ICONS.clock} alt="" width={16} height={16} className="size-4" />
                    {showtime.start_time.slice(0, 5)}
                  </span>
                )}
                {showtime && (
                  <span className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={FIGMA_ICONS.calendar} alt="" width={16} height={16} className="size-4" />
                    {formatShortDate(showtime.show_date)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={FIGMA_ICONS.pin} alt="" width={16} height={16} className="size-4" />
                  {cinema?.name ?? "CINÉ"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <TicketPill label="Hall" value={studio?.name ?? "-"} />
                <TicketPill label="Row" value={rowSet} />
                <TicketPill label="Seat" value={seatLabels.join(", ") || "-"} />
              </div>
            </div>

            <div
              className="hidden h-[290px] w-0.5 shrink-0 border-l-2 border-dashed border-cine-ticket-dash md:block"
              aria-hidden
            />

            <div className="flex h-[290px] w-full shrink-0 items-center justify-center rounded-[20px] bg-white p-3 md:w-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR tiket" width={260} height={260} className="size-[260px] object-contain" />
            </div>
          </div>

          <TicketActions code={booking.booking_code} qrUrl={qrUrl} />
        </div>
      </main>
    );
  }

  // F&B QR (Figma 1:1582 Barcode)
  const [{ data: items }, { data: cinema }] = await Promise.all([
    supabase.from("fnb_order_items").select("*").eq("order_id", order!.id),
    supabase.from("cinemas").select("name").eq("id", order!.cinema_id).maybeSingle(),
  ]);

  return (
    <main className="cine-container flex flex-col gap-8 pb-20 pt-8">
      <BackHeader title="Your F&B" href="/my-bookings" />

      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center gap-7">
        <div className="flex w-full flex-col items-center gap-6 rounded-[28px] bg-cine-cream p-5 md:flex-row">
          <div className="relative h-[290px] w-full shrink-0 overflow-hidden rounded-[18px] bg-white md:w-[232px]">
            <Image
              src={resolveFnbImage(null, order!.order_code)}
              alt="Pesanan F&B"
              fill
              sizes="(max-width: 768px) 100vw, 232px"
              className="object-cover"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="space-y-2.5">
              {items?.map((item) => (
                <div key={item.id} className="text-sm">
                  <p className="font-bold text-cine-ink">
                    {item.quantity}× {item.item_name_snapshot}
                  </p>
                  {item.variant_name_snapshot && (
                    <p className="text-xs text-cine-muted">{item.variant_name_snapshot}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="cine-divider" />

            <div className="flex flex-wrap items-center gap-4 text-sm text-cine-muted">
              <span className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FIGMA_ICONS.clock} alt="" width={16} height={16} className="size-4" />
                {order!.pickup_time.slice(0, 5)}
              </span>
              <span className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FIGMA_ICONS.calendar} alt="" width={16} height={16} className="size-4" />
                {formatShortDate(order!.pickup_date)}
              </span>
              <span className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FIGMA_ICONS.pin} alt="" width={16} height={16} className="size-4" />
                {cinema?.name ?? "CINÉ"}
              </span>
            </div>
          </div>

          <div
            className="hidden h-[290px] w-0.5 shrink-0 border-l-2 border-dashed border-cine-ticket-dash md:block"
            aria-hidden
          />

          <div className="flex h-[290px] w-full shrink-0 items-center justify-center rounded-[20px] bg-white p-3 md:w-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR F&B" width={260} height={260} className="size-[260px] object-contain" />
          </div>
        </div>

        <TicketActions code={order!.order_code} qrUrl={qrUrl} />
      </div>
    </main>
  );
}

function TicketPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-white px-4 py-2 text-center">
      <span className="text-xs font-bold text-cine-ink">{label}</span>
      <span className="text-[13px] text-cine-muted">{value}</span>
    </div>
  );
}
