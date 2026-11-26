"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { formatRupiah } from "@/lib/utils";

export default function OrderSummaryActions({
  targetId,
  kind,
  status,
  code,
  isPending,
}: {
  targetId: string;
  kind: "booking" | "fnb";
  status: string;
  code: string;
  isPending: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [promoCode, setPromoCode] = useState("");
  const [promoFeedback, setPromoFeedback] = useState<{
    valid: boolean;
    message: string;
    discount?: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  async function applyPromo(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = promoCode.trim().toUpperCase();
    if (!cleaned) return;
    setChecking(true);
    setPromoFeedback(null);

    const { data, error } =
      kind === "booking"
        ? await supabase.rpc("apply_promo_to_booking", {
            p_booking_id: targetId,
            p_promo_code: cleaned,
          })
        : await supabase.rpc("apply_promo_to_fnb_order", {
            p_order_id: targetId,
            p_promo_code: cleaned,
          });
    setChecking(false);

    if (error) {
      setPromoFeedback({ valid: false, message: error.message });
      return;
    }

    const res = data as { valid?: boolean; message?: string; discount?: number } | null;
    if (res?.valid) {
      setPromoFeedback({
        valid: true,
        message: `${res.message ?? "Promo berlaku"}: potongan ${formatRupiah(Number(res.discount ?? 0))}`,
        discount: Number(res.discount ?? 0),
      });
      router.refresh();
    } else {
      setPromoFeedback({
        valid: false,
        message: res?.message ?? "Kode promo tidak valid.",
      });
    }
  }

  const canViewTicket = ["confirmed", "paid", "preparing", "ready", "completed"].includes(
    status,
  );

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-4">
      {isPending && (
        <>
          <h2 className="text-lg font-bold text-cine-ink">Kode promo</h2>
          <form onSubmit={applyPromo} className="flex gap-2.5 sm:gap-3">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Masukkan kode promo"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="outline" disabled={checking} className="shrink-0 px-5 sm:px-6">
              {checking ? "..." : "Pakai"}
            </Button>
          </form>
          {promoFeedback && (
            <p
              className={`text-xs font-medium ${
                promoFeedback.valid ? "text-green-700" : "text-red-700"
              }`}
            >
              {promoFeedback.message}
            </p>
          )}
          <Link
            href={`/payment/${targetId}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-7 py-3.5 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
          >
            Continue to Payment
          </Link>
        </>
      )}

      {canViewTicket && (
        <Link
          href={`/ticket/${code}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-7 py-3.5 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
        >
          Lihat E-Tiket / QR
        </Link>
      )}
    </div>
  );
}
