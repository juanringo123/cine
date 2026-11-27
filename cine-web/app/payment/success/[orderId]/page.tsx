import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { BackHeader } from "@/components/ui/primitives";
import {
  findSimulasiPayment,
  type SimulasiPaymentDetails,
} from "@/lib/simulasi-payment";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatWibDateTime(iso: string) {
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso))} WIB`;
}

export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  let details: SimulasiPaymentDetails | null = null;
  let loadError: string | null = null;
  try {
    details = await findSimulasiPayment(orderId);
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Gagal memuat data pembayaran.";
  }

  if (loadError) {
    return (
      <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
        <BackHeader title="Status Pembayaran" href="/my-bookings" />
        <div className="mx-auto w-full max-w-xl rounded-[28px] border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {loadError}
        </div>
      </main>
    );
  }

  if (!details) notFound();

  if (details.status === "pending") {
    redirect(`/payment/${details.reference_id}`);
  }

  const isPaid = details.status === "paid";

  if (!isPaid) {
    return (
      <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
        <BackHeader title="Status Pembayaran" href="/my-bookings" />

        <div className="mx-auto w-full max-w-xl rounded-[28px] border border-cine-border bg-cine-cream p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle className="size-9" />
            </div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-800">
              Status: {details.status}
            </span>
            <h2 className="text-2xl font-bold text-cine-ink">
              Pembayaran Tidak Selesai
            </h2>
            <p className="text-sm text-cine-muted">
              Transaksi {details.order_id} berstatus <strong>{details.status}</strong> dan
              tidak dapat digunakan lagi. Silakan buat pesanan baru.
            </p>
          </div>

          <div className="my-6 space-y-2.5 rounded-2xl border border-cine-border bg-white p-5 text-sm">
            <Row label="Order ID" value={details.order_id} />
            <Row label="Kode Transaksi" value={details.reference_code} />
            <Row label="Rincian" value={details.subtitle} />
            <div className="cine-divider my-2" />
            <div className="flex items-center justify-between text-base font-bold text-cine-ink">
              <span>Nominal</span>
              <span className="text-cine-maroon">{formatRupiah(details.amount)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/my-bookings"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-cine-gold px-6 py-3.5 text-sm font-bold text-cine-ink transition-all duration-200 hover:bg-cine-gold-dark"
            >
              Ke My Booking
            </Link>
            <Link
              href="/"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-cine-border bg-white px-6 py-3.5 text-sm font-bold text-cine-ink transition-all duration-200 hover:border-cine-maroon"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <BackHeader title="Pembayaran Berhasil" href="/my-bookings" />

      <div className="mx-auto w-full max-w-xl rounded-[28px] border border-cine-border bg-cine-cream p-6 sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="size-9" />
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-800">
            Status: Lunas (PAID)
          </span>
          <h2 className="text-2xl font-bold text-cine-ink">
            Terima kasih! Pembayaran diterima
          </h2>
          <p className="text-sm text-cine-muted">{details.title}</p>
        </div>

        <div className="my-6 space-y-2.5 rounded-2xl border border-cine-border bg-white p-5 text-sm">
          <Row label="Order ID" value={details.order_id} />
          <Row label="Kode Transaksi" value={details.reference_code} />
          <Row label="Metode Pembayaran" value={details.method.toUpperCase()} />
          <Row label="Rincian" value={details.subtitle} />
          {details.paid_at && (
            <Row
              label="Waktu Pembayaran"
              value={formatWibDateTime(details.paid_at)}
            />
          )}
          <div className="cine-divider my-2" />
          <div className="flex items-center justify-between text-base font-bold text-cine-ink">
            <span>Total Dibayar</span>
            <span className="text-cine-maroon">
              {formatRupiah(details.amount)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/ticket/${encodeURIComponent(details.reference_code)}`}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-cine-gold px-6 py-3.5 text-sm font-bold text-cine-ink transition-all duration-200 hover:bg-cine-gold-dark"
          >
            {details.kind === "ticket" ? "Lihat E-Tiket / QR" : "Lihat QR F&B"}
          </Link>
          <Link
            href="/my-bookings"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-cine-border bg-white px-6 py-3.5 text-sm font-bold text-cine-ink transition-all duration-200 hover:border-cine-maroon"
          >
            My Booking
          </Link>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-cine-muted">{label}</span>
      <span className="text-right font-medium text-cine-ink">{value}</span>
    </div>
  );
}
