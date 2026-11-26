"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/../supabase/types/database";
import { FIGMA_ICONS } from "@/lib/assets";
import { resolveNotificationHref } from "@/lib/notifications";

type Notification = Pick<
  Tables<"notifications">,
  "id" | "title" | "body" | "type" | "data" | "read_at" | "created_at"
>;

export default function NotificationBell() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function detachChannel() {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        detachChannel();
        setItems([]);
        return;
      }

      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, type, data, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!active) return;
      setItems(data ?? []);

      if (!channel) {
        channel = supabase
          .channel(`navbar-notifications-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            () => load(),
          )
          .subscribe();
      }
    }

    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      subscription.unsubscribe();
      detachChannel();
    };
  }, [supabase]);

  const unread = items.filter((item) => item.read_at === null).length;

  async function openNotification(item: Notification) {
    if (!item.read_at) {
      const nowIso = new Date().toISOString();
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, read_at: nowIso } : row)),
      );
      void supabase.from("notifications").update({ read_at: nowIso }).eq("id", item.id);
    }
    setOpen(false);
    router.push(resolveNotificationHref(item));
  }

  return (
    <div ref={menuRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="relative flex size-8 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-cine-cream active:scale-95"
        aria-label="Notifikasi"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FIGMA_ICONS.bell} alt="" width={20} height={20} className="size-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-cine-maroon text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="cine-popover-enter cine-glass-surface fixed inset-x-3 top-[70px] z-50 w-auto overflow-hidden rounded-2xl p-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-80">
          <div className="max-h-[380px] space-y-1 overflow-y-auto pr-0.5">
            {items.length === 0 ? (
              <p className="p-3 text-sm text-cine-muted">Belum ada notifikasi.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl p-2.5 text-left text-sm transition-colors duration-200 hover:bg-cine-cream/90 ${
                    item.read_at ? "opacity-65" : "bg-white/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-cine-ink">{item.title}</p>
                    <p className="line-clamp-2 text-xs text-cine-muted">{item.body}</p>
                  </div>
                  {!item.read_at && (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-cine-maroon"
                      aria-label="Belum dibaca"
                    />
                  )}
                </button>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 block border-t border-cine-border/80 pt-2.5 pb-1 text-center text-xs font-semibold text-cine-maroon hover:underline"
          >
            Lihat semua notifikasi
          </Link>
        </div>
      )}
    </div>
  );
}
