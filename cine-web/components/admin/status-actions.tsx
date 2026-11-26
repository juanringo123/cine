"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";

type Props = {
  table: "fnb_orders" | "bookings";
  id: string;
  current: string;
  transitions: { label: string; status: string }[];
};

export default function StatusActions({ table, id, current, transitions }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function change(status: string) {
    if (busy || refreshing || status === current) return;
    setBusy(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = supabase.from(table) as any;
      const { error } = await query.update({ status }).eq("id", id);
      if (error) {
        setError(error.message);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((t) => (
        <Button
          key={t.status}
          variant="outline"
          className="px-2 py-1 text-[11px]"
          disabled={busy || refreshing}
          onClick={() => change(t.status)}
        >
          {t.label}
        </Button>
      ))}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
