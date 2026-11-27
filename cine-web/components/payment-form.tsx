"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, QrCode, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Json } from "@/../supabase/types/database";
import Button from "@/components/ui/button";
import { PAYMENT_METHOD_ICONS } from "@/lib/assets";
import { cn, formatRupiah } from "@/lib/utils";

const METHODS: {
  value: Enums<"payment_method">;
  label: string;
  subtitle?: string;
}[] = [
  { value: "qris", label: "QRIS", subtitle: "Scan QRIS dengan E-Wallet HP (Simulasi)" },
  { value: "gopay", label: "GoPay", subtitle: "Bayar instan lewat GoPay" },
  { value: "ovo", label: "OVO" },
  { value: "bank_transfer", label: "Transfer Bank", subtitle: "BCA, BNI, Mandiri" },
  { value: "card", label: "Kartu Debit / Kredit" },
];

export type InitialPendingPayment = {
  payment_id: string;
  external_id: string;
  method: Enums<"payment_method">;
  amount: number;
  status: string;
  expires_at: string | null;
  simulasi_token?: string | null;
  simulasi_url?: string | null;
};

type CreatePaymentRpcResult = {
  payment_id?: string;
  external_id?: string;
  method?: Enums<"payment_method">;
  amount?: number;
  status?: string;
  expires_at?: string | null;
};

export default function PaymentForm({
  bookingId,
  fnbOrderId,
  targetStatus = "pending_payment",
  targetCode = "",
  isAdmin = false,
  publicBaseUrl = "",
  initialPayment = null,
  savedCards = [],
  summarySlot,
}: {
  bookingId: string | null;
  fnbOrderId: string | null;
  targetStatus?: string;
  targetCode?: string;
  isAdmin?: boolean;
  publicBaseUrl?: string;
  initialPayment?: InitialPendingPayment | null;
  savedCards?: {
    id: string;
    brand: Enums<"card_brand">;
    last4: string;
    expiry_month: number;
    expiry_year: number;
  }[];
  summarySlot?: React.ReactNode;
}) {
  const router = useRouter();
  const isPending = targetStatus === "pending_payment";
  const isPaidOrDone = ["paid", "confirmed", "preparing", "ready", "completed"].includes(
    targetStatus,
  );
  const supabase = useMemo(() => createClient(), []);
  const [selectedMethod, setSelectedMethod] = useState<Enums<"payment_method">>(
    initialPayment?.method ?? "qris",
  );
  const [selectedCardId, setSelectedCardId] = useState<string>(savedCards[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Json | null>(initialPayment);
  const [paymentId, setPaymentId] = useState<string | null>(
    initialPayment?.payment_id ?? null,
  );
  const [orderId, setOrderId] = useState<string | null>(
    initialPayment?.external_id ?? null,
  );
  const [paymentAmount, setPaymentAmount] = useState<number | null>(
    initialPayment?.amount ?? null,
  );
  const [activeMethod, setActiveMethod] = useState<Enums<"payment_method"> | null>(
    initialPayment?.method ?? null,
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(
    initialPayment?.status ?? "",
  );
  const [simulasiToken, setSimulasiToken] = useState<string>(
    initialPayment?.simulasi_token ?? "",
  );
  const [simulasiUrl, setSimulasiUrl] = useState<string>(
    initialPayment?.simulasi_url ?? "",
  );

  const showDummyQris =
    Boolean(orderId) &&
    activeMethod === "qris" &&
    (paymentStatus === "pending" || paymentStatus === "paid");

  // Auto-polling status pembayaran QRIS setiap 2.5 detik.
  useEffect(() => {
    if (!orderId || activeMethod !== "qris" || paymentStatus !== "pending") return;

    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/simulasi-bayar/${encodeURIComponent(orderId)}`,
          { cache: "no-store" },
        );
        if (!res.ok || stopped) return;
        const data = (await res.json()) as {
          status?: string;
          amount?: number;
          simulasi_token?: string | null;
          simulasi_url?: string | null;
        };
        if (stopped) return;

        if (data.simulasi_token) {
          setSimulasiToken(data.simulasi_token);
        }
        if (data.simulasi_url) {
          setSimulasiUrl(data.simulasi_url);
        }
        if (typeof data.amount === "number") {
          setPaymentAmount(data.amount);
        }
        if (data.status && data.status !== "pending") {
          setPaymentStatus(data.status);
        }
      } catch {
        // Abaikan error jaringan sementara; polling berikutnya akan mencoba lagi.
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [orderId, activeMethod, paymentStatus]);

  // Redirect otomatis ke halaman Pembayaran Berhasil setelah status berubah jadi paid.
  useEffect(() => {
    if (paymentStatus !== "paid" || !orderId) return;
    const timer = setTimeout(() => {
      router.push(`/payment/success/${encodeURIComponent(orderId)}`);
    }, 900);
    return () => clearTimeout(timer);
  }, [paymentStatus, orderId, router]);

  async function payNow() {
    setLoading(true);
    setError(null);

    try {
      const useCard = selectedMethod === "card" && selectedCardId;
      const { data, error } = await supabase.rpc("create_payment", {
        p_booking_id: bookingId ?? undefined,
        p_fnb_order_id: fnbOrderId ?? undefined,
        p_method: selectedMethod,
        p_saved_card_id: useCard ? selectedCardId : undefined,
      });

      if (error) {
        setError(error.message);
        return;
      }

      const res = (data ?? {}) as CreatePaymentRpcResult;
      const extId = res.external_id ?? res.payment_id ?? null;

      setResult(data);
      setPaymentId(res.payment_id ?? null);
      setOrderId(extId);
      setPaymentAmount(typeof res.amount === "number" ? res.amount : null);
      setActiveMethod(res.method ?? selectedMethod);
      setPaymentStatus(res.status ?? "pending");

      if (extId && extId !== orderId) {
        setSimulasiToken("");
        setSimulasiUrl("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pembayaran.");
    } finally {
      setLoading(false);
    }
  }

  async function markPaidDemo() {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("admin_mark_paid", {
        p_payment_id: paymentId,
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (orderId) {
        router.push(`/payment/success/${encodeURIComponent(orderId)}`);
      } else if (targetCode) {
        router.push(`/ticket/${targetCode}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai lunas.");
    } finally {
      setLoading(false);
    }
  }

  async function charge() {
    if (!paymentId) {
      setError("Pembayaran belum dibuat.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payment/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId }),
      });
      const data = (await response.json()) as { redirect_url?: string; error?: string };
      if (!response.ok || !data.redirect_url) {
        throw new Error(data.error ?? "Gagal membuat transaksi gateway.");
      }
      window.location.assign(data.redirect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setLoading(false);
    }
  }

  const qrImageSrc = simulasiUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(simulasiUrl)}`
    : "";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_460px] xl:gap-10">
      {/* Kiri: Daftar Metode Pembayaran */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-cine-ink">Pilih metode pembayaran</h2>

        {METHODS.map((method) => {
          const active = selectedMethod === method.value;
          const iconSrc = PAYMENT_METHOD_ICONS[method.value];
          return (
            <button
              key={method.value}
              type="button"
              disabled={loading || paymentStatus === "paid"}
              onClick={() => setSelectedMethod(method.value)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3.5 rounded-[14px] bg-cine-cream py-3.5 pl-3.5 pr-[18px] text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.99] disabled:opacity-50",
                active ? "border border-cine-maroon" : "border border-cine-border hover:border-cine-maroon/50",
              )}
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-full border border-cine-border bg-white">
                <Image src={iconSrc} alt={method.label} fill sizes="48px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-cine-ink">
                  {method.label}
                </span>
                {method.subtitle && (
                  <span className="block text-xs text-cine-muted">{method.subtitle}</span>
                )}
              </span>
              <span
                className={cn(
                  "flex size-[22px] shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                  active
                    ? "border-2 border-cine-maroon bg-white"
                    : "border border-cine-placeholder bg-white",
                )}
              >
                <span
                  className={cn(
                    "size-2.5 rounded-full bg-cine-maroon transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    active ? "scale-100 opacity-100" : "scale-0 opacity-0",
                  )}
                />
              </span>
            </button>
          );
        })}

        {selectedMethod === "card" && savedCards.length > 0 && (
          <div className="rounded-[14px] border border-cine-border bg-white p-4 text-sm">
            <p className="mb-2 text-xs font-semibold text-cine-muted">Pilih kartu tersimpan</p>
            <div className="space-y-2">
              {savedCards.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="saved_card"
                    checked={selectedCardId === c.id}
                    onChange={() => setSelectedCardId(c.id)}
                    className="accent-cine-maroon"
                  />
                  <span>
                    {c.brand.toUpperCase()} •••• {c.last4} ({c.expiry_month}/{c.expiry_year})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Kanan: Ringkasan + Tombol Bayar + QRIS Dummy / Status */}
      <div className="flex flex-col gap-4">
        {summarySlot}

        {error && <p className="text-sm text-red-700">{error}</p>}

        {isPending ? (
          <Button
            type="button"
            variant="gold"
            disabled={loading || paymentStatus === "paid"}
            onClick={payNow}
            className="w-full"
          >
            {loading
              ? "Memproses..."
              : orderId && activeMethod !== selectedMethod
                ? `Ubah ke ${selectedMethod.toUpperCase()}`
                : orderId && activeMethod === "qris"
                  ? "QRIS Aktif — Scan di Bawah"
                  : "Pay Now"}
          </Button>
        ) : isPaidOrDone && targetCode ? (
          <div className="cine-card-bordered space-y-3 p-4 text-sm">
            <p className="font-bold text-green-700">
              Transaksi sudah dibayar ({targetStatus}).
            </p>
            <Link
              href={`/ticket/${targetCode}`}
              className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-7 py-3 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
            >
              Lihat E-Tiket / QR
            </Link>
          </div>
        ) : (
          <div className="cine-card-bordered space-y-2 p-4 text-sm">
            <p className="font-semibold text-red-700">
              Transaksi berstatus {targetStatus} dan tidak dapat dibayar lagi.
            </p>
            <Link href="/my-bookings" className="text-xs font-semibold text-cine-maroon underline">
              Kembali ke My Booking
            </Link>
          </div>
        )}

        {/* Kartu Pembayaran Dummy QRIS + Auto-Polling */}
        {showDummyQris && orderId && (
          <div className="cine-card-bordered space-y-4 p-5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-cine-maroon" />
                <h3 className="text-base font-bold text-cine-ink">Pembayaran QRIS</h3>
              </div>
              {paymentStatus === "paid" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                  <CheckCircle2 className="size-3.5" />
                  Lunas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  <span className="size-2 animate-pulse rounded-full bg-amber-600" />
                  Menunggu Pembayaran
                </span>
              )}
            </div>

            {paymentStatus === "paid" ? (
              <div className="space-y-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
                <CheckCircle2 className="mx-auto size-9 text-green-600" />
                <p className="font-bold text-green-800">Pembayaran berhasil diterima!</p>
                <p className="text-xs text-green-700">
                  Mengalihkan ke halaman Pembayaran Berhasil...
                </p>
                <Link
                  href={`/payment/success/${encodeURIComponent(orderId)}`}
                  className="inline-flex items-center justify-center rounded-xl bg-green-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-green-800"
                >
                  Lihat Halaman Pembayaran Berhasil
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-cine-border bg-white p-4">
                  {qrImageSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrImageSrc}
                      alt={`QRIS ${orderId}`}
                      width={250}
                      height={250}
                      className="size-[230px] rounded-xl object-contain"
                    />
                  ) : (
                    <div className="flex size-[230px] items-center justify-center rounded-xl border border-dashed border-cine-border text-xs text-cine-muted">
                      Menyiapkan QRIS terverifikasi...
                    </div>
                  )}
                  <p className="text-center text-xs text-cine-muted">
                    Scan QR ini dari kamera HP / Google Lens yang terhubung di WiFi yang sama
                  </p>
                </div>

                <div className="space-y-1.5 rounded-xl bg-white p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-cine-muted">Nomor Pesanan</span>
                    <span className="font-mono font-bold text-cine-ink">{orderId}</span>
                  </div>
                  {paymentAmount !== null && (
                    <div className="flex justify-between gap-2">
                      <span className="text-cine-muted">Total Harga</span>
                      <span className="font-bold text-cine-maroon">
                        {formatRupiah(paymentAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-cine-muted">Status</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <RefreshCw className="size-3 animate-spin" />
                      Menunggu Pembayaran (auto-cek)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {simulasiToken && (
                    <Link
                      href={`/simulasi-bayar/${encodeURIComponent(orderId)}?t=${encodeURIComponent(simulasiToken)}`}
                      target="_blank"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cine-maroon bg-white px-4 py-2.5 text-xs font-bold text-cine-maroon transition-colors hover:bg-cine-maroon/5"
                    >
                      <ExternalLink className="size-3.5" />
                      Buka Halaman Simulasi (Tab Baru)
                    </Link>
                  )}
                  {simulasiUrl && (
                    <p className="break-all text-center font-mono text-[11px] text-cine-muted">
                      {simulasiUrl}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Fallback untuk metode non-QRIS atau status expired */}
        {result && !showDummyQris && (
          <div className="cine-card-bordered space-y-3 p-4 text-sm">
            <p className="font-bold text-cine-maroon">
              Pembayaran dibuat ({paymentStatus || "pending"})
            </p>
            <pre className="overflow-x-auto rounded-lg bg-white p-2.5 text-xs text-cine-muted">
              {JSON.stringify(result, null, 2)}
            </pre>
            {isAdmin && paymentId && paymentStatus === "pending" && (
              <Button
                type="button"
                onClick={markPaidDemo}
                disabled={loading}
                variant="gold"
                className="w-full"
              >
                {loading ? "Memproses..." : "Tandai Lunas (simulasi admin)"}
              </Button>
            )}
            {paymentStatus === "pending" && (
              <Button
                type="button"
                onClick={charge}
                disabled={loading || !paymentId}
                variant="outline"
                className="w-full"
              >
                {loading ? "Memproses..." : "Bayar via Midtrans (opsional)"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
