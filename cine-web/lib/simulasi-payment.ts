import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SimulasiPaymentDetails = {
  payment_id: string;
  order_id: string;
  status: string;
  amount: number;
  method: string;
  expires_at: string | null;
  paid_at: string | null;
  kind: "ticket" | "fnb";
  reference_id: string;
  reference_code: string;
  title: string;
  subtitle: string;
  customer_name: string | null;
};

/** Mengambil detail pembayaran (berdasarkan external_id `PAY-...` atau UUID `payments.id`). */
export async function findSimulasiPayment(
  orderIdOrPaymentId: string,
): Promise<SimulasiPaymentDetails | null> {
  const key = decodeURIComponent(orderIdOrPaymentId || "").trim();
  if (!key) return null;

  const admin = createAdminClient();
  const isUuid = UUID_RE.test(key);
  const query = admin
    .from("payments")
    .select(
      "id, external_id, status, amount, method, expires_at, paid_at, booking_id, fnb_order_id",
    );

  const { data: payment } = isUuid
    ? await query.or(`external_id.eq.${key},id.eq.${key}`).maybeSingle()
    : await query.eq("external_id", key.toUpperCase()).maybeSingle();

  if (!payment) return null;

  const orderId = payment.external_id ?? payment.id;

  if (payment.booking_id) {
    const [{ data: booking }, { data: seats }] = await Promise.all([
      admin
        .from("bookings")
        .select("id, booking_code, user_id, showtime_id")
        .eq("id", payment.booking_id)
        .maybeSingle(),
      admin
        .from("booking_seats")
        .select("seat_label_snapshot")
        .eq("booking_id", payment.booking_id),
    ]);

    const [{ data: showtime }, { data: profile }] = await Promise.all([
      booking
        ? admin
            .from("showtimes")
            .select("movie_id, studio_id, show_date, start_time")
            .eq("id", booking.showtime_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      booking
        ? admin
            .from("profiles")
            .select("full_name, nickname")
            .eq("id", booking.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const [{ data: movie }, { data: studio }] = await Promise.all([
      showtime
        ? admin
            .from("movies")
            .select("title")
            .eq("id", showtime.movie_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      showtime
        ? admin
            .from("studios")
            .select("name, cinema_id")
            .eq("id", showtime.studio_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const { data: cinema } = studio
      ? await admin
          .from("cinemas")
          .select("name")
          .eq("id", studio.cinema_id)
          .maybeSingle()
      : { data: null };

    const seatText = (seats ?? []).map((s) => s.seat_label_snapshot).join(", ");
    const subParts = [
      cinema?.name,
      studio?.name,
      showtime ? `${showtime.show_date} ${showtime.start_time.slice(0, 5)}` : null,
      seatText ? `Kursi ${seatText}` : null,
    ].filter(Boolean);

    return {
      payment_id: payment.id,
      order_id: orderId,
      status: payment.status,
      amount: Number(payment.amount),
      method: payment.method,
      expires_at: payment.expires_at,
      paid_at: payment.paid_at,
      kind: "ticket",
      reference_id: payment.booking_id,
      reference_code: booking?.booking_code ?? orderId,
      title: movie?.title ? `Tiket: ${movie.title}` : `Tiket ${booking?.booking_code ?? ""}`,
      subtitle: subParts.join(" · ") || "Pembelian Tiket Bioskop",
      customer_name: profile?.nickname || profile?.full_name || null,
    };
  }

  if (payment.fnb_order_id) {
    const [{ data: order }, { data: items }] = await Promise.all([
      admin
        .from("fnb_orders")
        .select("id, order_code, user_id, cinema_id, pickup_date, pickup_time")
        .eq("id", payment.fnb_order_id)
        .maybeSingle(),
      admin
        .from("fnb_order_items")
        .select("item_name_snapshot, quantity")
        .eq("order_id", payment.fnb_order_id),
    ]);

    const [{ data: cinema }, { data: profile }] = await Promise.all([
      order
        ? admin
            .from("cinemas")
            .select("name")
            .eq("id", order.cinema_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      order
        ? admin
            .from("profiles")
            .select("full_name, nickname")
            .eq("id", order.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const itemSummary = (items ?? [])
      .map((i) => `${i.quantity}x ${i.item_name_snapshot}`)
      .join(", ");

    const subParts = [
      cinema?.name,
      order ? `Ambil ${order.pickup_date} ${order.pickup_time.slice(0, 5)}` : null,
      itemSummary || null,
    ].filter(Boolean);

    return {
      payment_id: payment.id,
      order_id: orderId,
      status: payment.status,
      amount: Number(payment.amount),
      method: payment.method,
      expires_at: payment.expires_at,
      paid_at: payment.paid_at,
      kind: "fnb",
      reference_id: payment.fnb_order_id,
      reference_code: order?.order_code ?? orderId,
      title: `Pesanan F&B (${order?.order_code ?? orderId})`,
      subtitle: subParts.join(" · ") || "Pembelian Food & Beverage CINÉ",
      customer_name: profile?.nickname || profile?.full_name || null,
    };
  }

  return null;
}
