import Image from "next/image";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import PaymentForm from "@/components/payment-form";
import { BackHeader } from "@/components/ui/primitives";
import { FIGMA_ICONS, resolveMoviePoster } from "@/lib/assets";
import { resolvePublicBaseUrl } from "@/lib/base-url";
import { isWeekendDate } from "@/lib/pricing";
import {
  buildSimulasiUrl,
  createSimulasiToken,
  isDemoPaymentEnabled,
} from "@/lib/simulasi-payment";
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

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // id bisa berupa payment.id, booking.id, atau fnb_order.id
  let { data: payment } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  let bookingId = payment?.booking_id ?? null;
  let fnbOrderId = payment?.fnb_order_id ?? null;

  if (!payment) {
    const byBooking = await supabase.from("bookings").select("id").eq("id", id).maybeSingle();
    if (byBooking.data) {
      bookingId = byBooking.data.id;
    } else {
      const byOrder = await supabase.from("fnb_orders").select("id").eq("id", id).maybeSingle();
      if (byOrder.data) fnbOrderId = byOrder.data.id;
    }
  }

  if (!bookingId && !fnbOrderId) notFound();

  if (!payment) {
    const existingPending = bookingId
      ? await supabase
          .from("payments")
          .select("*")
          .eq("booking_id", bookingId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await supabase
          .from("payments")
          .select("*")
          .eq("fnb_order_id", fnbOrderId!)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
    if (existingPending.data) {
      payment = existingPending.data;
    }
  }

  const reqHeaders = await headers();
  const publicBaseUrl = resolvePublicBaseUrl(
    new Request("http://localhost", { headers: reqHeaders }),
  );

  let initialSimulasiToken: string | null = null;
  let initialSimulasiUrl: string | null = null;
  if (payment && payment.status === "pending" && isDemoPaymentEnabled()) {
    try {
      const extId = payment.external_id ?? payment.id;
      initialSimulasiToken = createSimulasiToken(extId, payment.id);
      initialSimulasiUrl = buildSimulasiUrl(
        publicBaseUrl,
        extId,
        initialSimulasiToken,
      );
    } catch {
      initialSimulasiToken = null;
      initialSimulasiUrl = null;
    }
  }

  const initialPayment =
    payment && payment.status === "pending"
      ? {
          payment_id: payment.id,
          external_id: payment.external_id ?? payment.id,
          method: payment.method,
          amount: Number(payment.amount),
          status: payment.status,
          expires_at: payment.expires_at,
          simulasi_token: initialSimulasiToken,
          simulasi_url: initialSimulasiUrl,
        }
      : null;

  const [{ data: savedCards }, { data: profile }] = await Promise.all([
    supabase
      .from("saved_cards")
      .select("id, brand, last4, expiry_month, expiry_year")
      .eq("user_id", user.id),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  let summarySlot: React.ReactNode = null;
  let backHref = "/my-bookings";
  let targetStatus = "pending_payment";
  let targetCode = "";

  if (bookingId) {
    backHref = `/booking/${bookingId}`;
    const [{ data: booking }, { data: seats }] = await Promise.all([
      supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle(),
      supabase
        .from("booking_seats")
        .select("seat_label_snapshot, price_snapshot")
        .eq("booking_id", bookingId),
    ]);
    if (!booking) notFound();
    targetStatus = booking.status;
    targetCode = booking.booking_code;

    const { data: showtime } = await supabase
      .from("showtimes")
      .select("*")
      .eq("id", booking.showtime_id)
      .maybeSingle();
    const [{ data: movie }, { data: studio }] = await Promise.all([
      showtime
        ? supabase.from("movies").select("*").eq("id", showtime.movie_id).maybeSingle()
        : Promise.resolve({ data: null }),
      showtime
        ? supabase.from("studios").select("*").eq("id", showtime.studio_id).maybeSingle()
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
    const seatCount = seats?.length ?? 0;
    const ticketPrice =
      seats?.[0]?.price_snapshot ??
      (seatCount > 0 ? booking.subtotal / seatCount : (showtime?.price ?? 0));
    const isWeekendShow = showtime ? isWeekendDate(showtime.show_date) : false;

    summarySlot = (
      <div className="cine-card flex flex-col gap-3.5 p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-[100px] w-[77px] shrink-0 overflow-hidden rounded-xl bg-white">
            <Image src={poster} alt={movie?.title ?? "Film"} fill sizes="77px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-[17px] font-bold leading-snug text-cine-ink">
              {movie?.title ?? booking.booking_code}
            </h3>
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

        {showtime && (
          <Row
            label="Date"
            value={`${formatLongDate(showtime.show_date)}${isWeekendShow ? " (Tarif Weekend)" : ""}`}
          />
        )}
        {showtime && <Row label="Time" value={showtime.start_time.slice(0, 5)} />}
        {studio && <Row label="Hall" value={studio.name} />}
        <Row label="Seat" value={seats?.map((s) => s.seat_label_snapshot).join(", ") || "-"} />
        <Row
          label={`Ticket ${seatCount} x ${formatRupiah(ticketPrice)}${isWeekendShow ? " (Weekend)" : ""}`}
          value={formatRupiah(booking.subtotal)}
        />
        <Row label="Biaya layanan" value={formatRupiah(booking.service_fee)} />
        {booking.discount > 0 && <Row label="Diskon" value={`-${formatRupiah(booking.discount)}`} />}

        <div className="cine-divider" />

        <div className="flex items-center justify-between text-base font-bold text-cine-ink">
          <span>Total</span>
          <span>{formatRupiah(booking.total)}</span>
        </div>
      </div>
    );
  } else if (fnbOrderId) {
    backHref = `/order/${fnbOrderId}`;
    const [{ data: order }, { data: items }] = await Promise.all([
      supabase.from("fnb_orders").select("*").eq("id", fnbOrderId).maybeSingle(),
      supabase.from("fnb_order_items").select("*").eq("order_id", fnbOrderId),
    ]);
    if (!order) notFound();
    targetStatus = order.status;
    targetCode = order.order_code;

    const { data: cinema } = await supabase
      .from("cinemas")
      .select("name, city")
      .eq("id", order.cinema_id)
      .maybeSingle();

    const totalQty = (items ?? []).reduce((sum, i) => sum + i.quantity, 0);

    summarySlot = (
      <div className="cine-card flex flex-col gap-3.5 p-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-cine-ink">Ringkasan pesanan</h3>
          <p className="text-xs font-medium text-cine-muted">
            {cinema ? `${cinema.name} · ${cinema.city}` : order.order_code}
          </p>
        </div>
        <div className="cine-divider" />
        <Row label="Tanggal pengambilan" value={order.pickup_date} />
        <Row label="Waktu pengambilan" value={`${order.pickup_time.slice(0, 5)} WIB`} />
        <div className="cine-divider" />
        <div className="space-y-2 text-sm">
          {items?.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-cine-ink">
                {item.quantity}x {item.item_name_snapshot}
              </span>
              <span className="text-cine-ink">{formatRupiah(item.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="cine-divider" />
        <Row label={`Subtotal (${totalQty} item)`} value={formatRupiah(order.subtotal)} />
        <Row label="Biaya layanan" value={formatRupiah(order.service_fee)} />
        {order.discount > 0 && <Row label="Diskon" value={`-${formatRupiah(order.discount)}`} />}
        <div className="cine-divider" />
        <div className="flex items-center justify-between text-base font-bold text-cine-ink">
          <span>Total pembayaran</span>
          <span>{formatRupiah(order.total)}</span>
        </div>
      </div>
    );
  }

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BackHeader title="Payment Method" href={backHref} />
      <PaymentForm
        bookingId={bookingId}
        fnbOrderId={fnbOrderId}
        targetStatus={targetStatus}
        targetCode={targetCode}
        isAdmin={profile?.role === "admin"}
        publicBaseUrl={publicBaseUrl}
        initialPayment={initialPayment}
        savedCards={savedCards ?? []}
        summarySlot={summarySlot}
      />
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
