"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Clock, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import Button from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import type { SimulasiPaymentDetails } from "@/lib/simulasi-payment";

export default function SimulasiBayarClient({
  initial,
}: {
  initial: SimulasiPaymentDetails;
}) {
  const [status, setStatus] = useState(initial.status);
  const [paidAt, setPaidAt] = useState(initial.paid_at);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmPay() {
    if (busy || status !== "pending") return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/simulasi-bayar/${encodeURIComponent(initial.order_id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        status?: string;
        paid_at?: string | null;
        error?: string;
      };
      if (!response.ok) {
        if (data.status) setStatus(data.status);
        throw new Error(data.error ?? "Konfirmasi pembayaran gagal.");
      }
      setStatus(data.status ?? "paid");
      setPaidAt(data.paid_at ?? new Date().toISOString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memproses pembayaran.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isPaid = status === "paid";
  const isPending = status === "pending";

  return (
    <main className="min-h-screen bg-cine-cream px-4 py-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        {/* Header ala aplikasi E-Wallet / QRIS */}
        <header className="flex items-center justify-between rounded-[22px] bg-cine-maroon px-5 py-4 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
              <Smartphone className="size-5 text-cine-gold" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-cine-gold">
                Simulasi E-Wallet
              </p>
              <h1 className="text-base font-bold leading-tight">
                Pembayaran QRIS
              </h1>
            </div>
          </div>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide">
            QRIS
          </span>
        </header>

        {/* Kartu Merchant & Rincian */}
        <section className="space-y-4 rounded-[24px] border border-cine-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-16 items-center justify-center rounded-xl border border-cine-border bg-cine-cream/70 p-1.5">
                <Image
                  src="/assets/cine-logo.png"
                  alt="CINÉ"
                  width={551}
                  height={314}
                  className="h-full w-auto object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-bold text-cine-ink">CINÉ Bioskop</p>
                <p className="text-xs text-cine-muted">Merchant Resmi QRIS</p>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="cine-divider" />

          <div className="space-y-1 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-cine-muted">
              Total Nominal Pembayaran
            </p>
            <p className="text-3xl font-bold tracking-tight text-cine-maroon">
              {formatRupiah(initial.amount)}
            </p>
          </div>

          <div className="space-y-2.5 rounded-2xl bg-cine-cream/75 p-4 text-sm">
            <DetailRow label="Order ID" value={initial.order_id} mono />
            <DetailRow label="Kode Transaksi" value={initial.reference_code} />
            <DetailRow label="Pesanan" value={initial.title} />
            {initial.subtitle && (
              <DetailRow label="Rincian" value={initial.subtitle} />
            )}
            {initial.customer_name && (
              <DetailRow label="Pemesan" value={initial.customer_name} />
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {isPending && (
            <div className="space-y-2.5 pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={confirmPay}
                disabled={busy}
                className="w-full py-4 text-base"
              >
                {busy ? "Memproses Pembayaran..." : "Konfirmasi Bayar"}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-cine-muted">
                <ShieldCheck className="size-3.5 text-cine-maroon" />
                Simulasi pembayaran lokal instan tanpa saldo sungguhan
              </p>
            </div>
          )}

          {isPaid && (
            <div className="space-y-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
              <CheckCircle2 className="mx-auto size-10 text-green-600" />
              <p className="text-base font-bold text-green-800">
                Transaksi Sudah Lunas
              </p>
              <p className="text-xs text-green-700">
                Pembayaran telah diterima
                {paidAt
                  ? ` pada ${new Date(paidAt).toLocaleString("id-ID")}`
                  : ""}
                . Halaman checkout di perangkat pemesan akan otomatis
                diperbarui.
              </p>
            </div>
          )}

          {!isPending && !isPaid && (
            <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <XCircle className="mx-auto size-10 text-red-600" />
              <p className="text-sm font-bold text-red-800">
                Transaksi Tidak Dapat Dibayar ({status})
              </p>
              <p className="text-xs text-red-700">
                Batas waktu pembayaran mungkin telah habis atau pesanan
                dibatalkan.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-cine-muted">{label}</span>
      <span
        className={`text-right text-xs font-semibold text-cine-ink ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">
        <CheckCircle2 className="size-3.5" />
        Lunas
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
        <Clock className="size-3.5" />
        Menunggu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">
      <XCircle className="size-3.5" />
      {status}
    </span>
  );
}
