import { notFound, redirect } from "next/navigation";
import OrderSummaryActions from "@/components/order-summary-actions";
import { BackHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("fnb_orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: cinema }] = await Promise.all([
    supabase.from("fnb_order_items").select("*").eq("order_id", order.id),
    supabase.from("cinemas").select("name, city").eq("id", order.cinema_id).maybeSingle(),
  ]);

  const totalQty = (items ?? []).reduce((sum, i) => sum + i.quantity, 0);

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BackHeader title="Buy F&B" href="/fnb" />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px] xl:grid-cols-[640px_1fr] xl:gap-10">
        {/* Kartu Ringkasan F&B (Figma 1:2244) */}
        <div className="cine-card flex flex-col gap-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-cine-ink">Ringkasan pesanan</h2>
            <p className="text-xs font-medium text-cine-muted">
              {cinema ? `${cinema.name} · ${cinema.city}` : order.order_code}
            </p>
          </div>

          <div className="cine-divider" />

          <Row label="Kode pesanan" value={order.order_code} />
          <Row
            label="Status"
            value={order.status === "completed" ? "USED (Sudah Diambil)" : order.status}
          />
          <Row label="Tanggal pengambilan" value={formatLongDate(order.pickup_date)} />
          <Row label="Waktu pengambilan" value={`${order.pickup_time.slice(0, 5)} WIB`} />

          <div className="cine-divider" />

          <div className="space-y-3">
            {items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-cine-ink">{item.item_name_snapshot}</p>
                  <p className="text-xs text-cine-muted">
                    {item.variant_name_snapshot ?? "Reguler"} · {item.quantity}x
                  </p>
                </div>
                <span className="font-medium text-cine-ink">
                  {formatRupiah(item.line_total)}
                </span>
              </div>
            ))}
          </div>

          <div className="cine-divider" />

          <Row label={`Subtotal (${totalQty} item)`} value={formatRupiah(order.subtotal)} />
          <Row label="Biaya layanan" value={formatRupiah(order.service_fee)} />
          {order.discount > 0 && (
            <Row label="Diskon" value={`-${formatRupiah(order.discount)}`} />
          )}

          <div className="cine-divider" />

          <div className="flex items-center justify-between text-base font-bold text-cine-ink">
            <span>Total pembayaran</span>
            <span>{formatRupiah(order.total)}</span>
          </div>

          <p className="text-xs text-cine-muted">
            Ambil pesanan di konter F&amp;B dengan menunjukkan bukti pemesanan.
          </p>
        </div>

        {/* Kolom Kanan: Promo + Continue to Payment */}
        <OrderSummaryActions
          targetId={order.id}
          kind="fnb"
          status={order.status}
          code={order.order_code}
          isPending={order.status === "pending_payment"}
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
