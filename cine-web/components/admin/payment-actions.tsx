"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";

/** Simulasi pembayaran untuk demo: langsung memanggil confirm_payment. */
export default function PaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("admin_mark_paid", {
        p_payment_id: paymentId,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setDone(true);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai lunas.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center rounded-lg bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-800">
        {refreshing ? "✓ Lunas (memperbarui...)" : "✓ Lunas"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="gold"
        className="px-2 py-1 text-[11px]"
        disabled={busy || refreshing}
        onClick={markPaid}
      >
        {busy ? "Memproses..." : "Tandai Lunas (simulasi)"}
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
