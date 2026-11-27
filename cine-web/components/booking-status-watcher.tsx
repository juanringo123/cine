"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mendengarkan perubahan status booking/F&B secara realtime (mis. saat petugas scan QR -> USED)
 * lalu me-refresh halaman customer secara otomatis.
 */
export default function BookingStatusWatcher({ userId }: { userId?: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`booking-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `user_id=eq.${userId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fnb_orders",
          filter: `user_id=eq.${userId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, router]);

  return null;
}
