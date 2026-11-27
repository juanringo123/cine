import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import BookingStatusWatcher from "@/components/booking-status-watcher";
import GlassTabs from "@/components/ui/glass-tabs";
import { resolveFnbImage, resolveMoviePoster } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah, formatTanggal } from "@/lib/utils";

export const dynamic = "force-dynamic";

function renderStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center rounded-full bg-cine-maroon px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          USED
        </span>
      );
    case "confirmed":
    case "paid":
    case "ready":
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-800">
          {status === "confirmed" ? "Aktif" : status === "ready" ? "Siap Diambil" : "Lunas"}
        </span>
      );
    case "preparing":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-800">
          Diproses
        </span>
      );
    case "pending_payment":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
          Menunggu Bayar
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-cine-border/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cine-muted">
          {status}
        </span>
      );
  }
}

export default async function MyBookings({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab =
    tab === "used" ? "used" : tab === "history" ? "history" : "active";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("v_my_bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (activeTab === "used") {
    query = query.eq("status", "completed");
  } else if (activeTab === "history") {
    query = query.eq("status_group", "history").neq("status", "completed");
  } else {
    query = query.eq("status_group", "active");
  }

  const { data: rows } = await query;

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BookingStatusWatcher userId={user?.id} />

      <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">
        My Booking
      </h1>

      <GlassTabs
        items={[
          { key: "active", label: "Aktif", href: "/my-bookings?tab=active" },
          { key: "used", label: "Used", href: "/my-bookings?tab=used" },
          { key: "history", label: "Riwayat", href: "/my-bookings?tab=history" },
        ]}
        activeKey={activeTab}
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
                  <Image
                    src={thumb}
                    alt={row.title}
                    fill
                    sizes="(max-width: 640px) 76px, 88px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-cine-ink">{row.title}</h2>
                    {renderStatusBadge(row.status)}
                  </div>
                  <p className="text-sm text-cine-muted">
                    {formatTanggal(row.schedule_date)} · {row.schedule_time.slice(0, 5)} · {row.venue}
                  </p>
                  <p className="text-xs font-medium text-cine-ink">
                    {row.kind === "ticket" ? "Tiket" : "F&B"} ·{" "}
                    <span className="font-mono">{row.code}</span> · {formatRupiah(row.total)}
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
