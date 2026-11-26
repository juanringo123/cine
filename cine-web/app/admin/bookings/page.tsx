import StatusActions from "@/components/admin/status-actions";
import PaymentActions from "@/components/admin/payment-actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const profile = await requireRole(["admin", "staff"]);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_code, status, total, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: payments } = bookings && bookings.length
    ? await supabase
        .from("payments")
        .select("id, booking_id")
        .in("booking_id", bookings.map((b) => b.id))
        .eq("status", "pending")
    : { data: [] as { id: string; booking_id: string | null }[] };

  const paymentByBooking = new Map(
    (payments ?? []).filter((p) => p.booking_id).map((p) => [p.booking_id as string, p.id]),
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Booking Tiket</h2>
      <div className="space-y-2">
        {bookings?.map((booking) => {
          const transitions = [
            booking.status === "confirmed" && { label: "Selesai", status: "completed" },
            ["paid", "confirmed"].includes(booking.status) && { label: "Refund", status: "refunded" },
            ["pending_payment", "paid", "confirmed"].includes(booking.status) && { label: "Batalkan", status: "canceled" },
          ].filter(Boolean) as { label: string; status: string }[];

          return (
            <div key={booking.id} className="cine-card flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{booking.booking_code}</p>
                <p className="text-xs text-cine-muted">{formatRupiah(booking.total)} · {booking.created_at.slice(0, 10)}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs">{booking.status}</span>
              {isAdmin && paymentByBooking.has(booking.id) && (
                <PaymentActions paymentId={paymentByBooking.get(booking.id)!} />
              )}
              <StatusActions table="bookings" id={booking.id} current={booking.status} transitions={transitions} />
            </div>
          );
        })}
        {!bookings?.length && <p className="text-sm text-cine-muted">Belum ada booking.</p>}
      </div>
    </div>
  );
}
