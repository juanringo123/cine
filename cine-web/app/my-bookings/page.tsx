import Image from "next/image";
import Link from "next/link";
import GlassTabs from "@/components/ui/glass-tabs";
import { resolveFnbImage, resolveMoviePoster } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah, formatTanggal } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyBookings({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const group = tab === "history" ? "history" : "active";
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("v_my_bookings")
    .select("*")
    .eq("status_group", group)
    .order("created_at", { ascending: false });

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">My Booking</h1>

      <GlassTabs
        items={[
          { key: "active", label: "Aktif", href: "/my-bookings?tab=active" },
          { key: "history", label: "Riwayat", href: "/my-bookings?tab=history" },
        ]}
        activeKey={group}
        className="w-fit"
      />

      <div className="space-y-4">
        {rows?.map((row) => {
          const thumb =
            row.kind === "fnb"
              ? resolveFnbImage(row.image_url, row.code)
              : resolveMoviePoster(row.image_url, row.code);
          const canViewQr = ["confirmed", "paid", "preparing", "ready", "completed"].includes(
            row.status,
          );

          return (
            <div
              key={`${row.kind}-${row.id}`}
              className="cine-card-hover flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-cine-cream p-4 sm:p-[18px]"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-[104px] w-[76px] shrink-0 overflow-hidden rounded-[14px] bg-white sm:h-[120px] sm:w-[88px]">
                  <Image src={thumb} alt={row.title} fill sizes="(max-width: 640px) 76px, 88px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h2 className="truncate text-lg font-bold text-cine-ink">{row.title}</h2>
                  <p className="text-sm text-cine-muted">
                    {formatTanggal(row.schedule_date)} · {row.schedule_time.slice(0, 5)} · {row.venue}
                  </p>
                  <p className="text-xs font-medium text-cine-ink">
                    {row.kind === "ticket" ? "Tiket" : "F&B"} ·{" "}
                    {row.status === "completed" ? "USED" : row.status} · {formatRupiah(row.total)}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
                {row.status === "pending_payment" && (
                  <Link
                    href={`/payment/${row.id}`}
                    className="rounded-xl bg-cine-gold px-5 py-2.5 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
                  >
                    Bayar
                  </Link>
                )}
                <Link
                  href={row.kind === "fnb" ? `/order/${row.id}` : `/booking/${row.id}`}
                  className="rounded-xl border border-cine-border bg-white px-5 py-2.5 text-sm font-bold text-cine-ink transition-colors hover:border-cine-maroon"
                >
                  Detail
                </Link>
                {canViewQr && (
                  <Link
                    href={`/ticket/${row.code}`}
                    className="rounded-xl bg-cine-gold px-6 py-2.5 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
                  >
                    {row.kind === "ticket" ? "Lihat E-Tiket" : "Lihat QR"}
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {!rows?.length && (
          <div className="cine-card p-8 text-center text-sm text-cine-muted">
            Belum ada pesanan pada tab ini.
          </div>
        )}
      </div>
    </main>
  );
}
