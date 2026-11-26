import StatusActions from "@/components/admin/status-actions";
import PaymentActions from "@/components/admin/payment-actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminFnbOrders() {
  const profile = await requireRole(["admin", "staff"]);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("fnb_orders")
    .select("id, order_code, status, total, pickup_date, pickup_time")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: payments } = orders && orders.length
    ? await supabase
        .from("payments")
        .select("id, fnb_order_id")
        .in("fnb_order_id", orders.map((o) => o.id))
        .eq("status", "pending")
    : { data: [] as { id: string; fnb_order_id: string | null }[] };

  const paymentByOrder = new Map(
    (payments ?? []).filter((p) => p.fnb_order_id).map((p) => [p.fnb_order_id as string, p.id]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Pesanan F&B</h2>
        <p className="text-xs text-cine-muted">Lanjutkan status: paid → preparing → ready → completed.</p>
      </div>
      <div className="space-y-2">
        {orders?.map((order) => {
          const transitions = [
            order.status === "paid" && { label: "Siapkan", status: "preparing" },
            order.status === "preparing" && { label: "Siap diambil", status: "ready" },
            order.status === "ready" && { label: "Selesai", status: "completed" },
            ["pending_payment", "paid", "preparing"].includes(order.status) && { label: "Batalkan", status: "canceled" },
          ].filter(Boolean) as { label: string; status: string }[];

          return (
            <div key={order.id} className="cine-card flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{order.order_code}</p>
                <p className="text-xs text-cine-muted">{order.pickup_date} · {order.pickup_time} · {formatRupiah(order.total)}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs">{order.status}</span>
              {isAdmin && paymentByOrder.has(order.id) && (
                <PaymentActions paymentId={paymentByOrder.get(order.id)!} />
              )}
              <StatusActions table="fnb_orders" id={order.id} current={order.status} transitions={transitions} />
            </div>
          );
        })}
        {!orders?.length && <p className="text-sm text-cine-muted">Belum ada pesanan.</p>}
      </div>
    </div>
  );
}
