import Link from "next/link";
import { notFound } from "next/navigation";
import SimulasiBayarClient from "@/components/simulasi-bayar-client";
import {
  findSimulasiPayment,
  isDemoPaymentEnabled,
  verifySimulasiToken,
  type SimulasiPaymentDetails,
} from "@/lib/simulasi-payment";

export const dynamic = "force-dynamic";

export default async function SimulasiBayarPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  if (!isDemoPaymentEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cine-cream px-4 py-10">
        <div className="w-full max-w-md space-y-4 rounded-[24px] border border-cine-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-cine-maroon">
            Simulasi Pembayaran Dinonaktifkan
          </h1>
          <p className="text-sm leading-relaxed text-cine-muted">
            Endpoint simulasi pembayaran tidak aktif karena{" "}
            <code className="font-mono font-semibold text-cine-ink">
              NEXT_PUBLIC_DEMO_PAYMENT
            </code>{" "}
            belum diset ke{" "}
            <code className="font-mono font-semibold text-cine-ink">true</code>.
          </p>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-5 py-2.5 text-sm font-bold text-cine-ink hover:bg-cine-gold-dark"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  const { orderId } = await params;

  let details: SimulasiPaymentDetails | null = null;
  let configError: string | null = null;

  try {
    details = await findSimulasiPayment(orderId);
  } catch (err) {
    configError =
      err instanceof Error ? err.message : "Gagal memuat data pembayaran.";
  }

  if (configError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cine-cream px-4 py-10">
        <div className="w-full max-w-md space-y-4 rounded-[24px] border border-cine-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-cine-maroon">
            Konfigurasi Server Belum Lengkap
          </h1>
          <p className="text-sm leading-relaxed text-cine-muted">
            {configError}
          </p>
          <p className="rounded-xl bg-cine-cream p-3 text-left text-xs leading-relaxed text-cine-ink">
            Pastikan variabel{" "}
            <code className="font-mono font-semibold">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            sudah ditambahkan di{" "}
            <strong>Vercel Project Settings → Environment Variables</strong>,
            lalu lakukan <strong>Redeploy</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-5 py-2.5 text-sm font-bold text-cine-ink hover:bg-cine-gold-dark"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  if (!details) notFound();

  const { t } = await searchParams;
  const token = typeof t === "string" ? t.trim() : "";
  if (!verifySimulasiToken(details.order_id, details.payment_id, token)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cine-cream px-4 py-10">
        <div className="w-full max-w-md space-y-4 rounded-[24px] border border-cine-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-cine-maroon">
            Akses Simulasi Ditolak
          </h1>
          <p className="text-sm leading-relaxed text-cine-muted">
            Token verifikasi QR tidak ditemukan atau tidak valid. Buka halaman
            simulasi melalui QR Code resmi di halaman pembayaran akun pemesan.
          </p>
          <Link
            href="/my-bookings"
            className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-5 py-2.5 text-sm font-bold text-cine-ink hover:bg-cine-gold-dark"
          >
            Ke My Booking
          </Link>
        </div>
      </main>
    );
  }

  return <SimulasiBayarClient initial={details} confirmToken={token} />;
}
