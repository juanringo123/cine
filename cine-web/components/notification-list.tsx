"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/../supabase/types/database";
import { FIGMA_ICONS } from "@/lib/assets";
import { resolveNotificationHref } from "@/lib/notifications";

type Notification = Pick<
  Tables<"notifications">,
  "id" | "title" | "body" | "type" | "data" | "read_at" | "created_at"
>;

export default function NotificationList({ items }: { items: Notification[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const unread = items.filter((item) => !item.read_at).length;

  async function markAll() {
    const ids = items.filter((item) => !item.read_at).map((item) => item.id);
    if (!ids.length) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    router.refresh();
  }

  async function markOne(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    router.refresh();
  }

  async function openDetail(item: Notification) {
    const href = resolveNotificationHref(item);
    if (!item.read_at) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", item.id);
    }
    if (href !== "/notifications") {
      router.push(href);
    } else {
      router.refresh();
    }
  }

  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cine-muted">{unread} belum dibaca</p>
        <button
          type="button"
          onClick={markAll}
          disabled={!unread}
          className="cursor-pointer text-sm font-semibold text-cine-maroon hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tandai semua dibaca
        </button>
      </div>

      <div className="space-y-3.5">
        {items.map((item) => {
          const targetHref = resolveNotificationHref(item);
          const hasTarget = targetHref !== "/notifications";

          return (
            <div
              key={item.id}
              className={`cine-card-hover flex items-start gap-4 rounded-[20px] bg-cine-cream p-4 transition-opacity ${
                item.read_at ? "opacity-65" : ""
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FIGMA_ICONS.bell} alt="" width={20} height={20} className="size-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => openDetail(item)}
                  className="block w-full cursor-pointer space-y-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-cine-ink hover:text-cine-maroon">
                      {item.title}
                    </p>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-cine-maroon">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-sm text-cine-ink/90">{item.body}</p>
                </button>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-cine-muted">
                  <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
                  {hasTarget && (
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      className="cursor-pointer font-semibold text-cine-maroon hover:underline"
                    >
                      Lihat detail
                    </button>
                  )}
                  {!item.read_at && (
                    <button
                      type="button"
                      onClick={() => markOne(item.id)}
                      className="cursor-pointer font-semibold text-cine-maroon hover:underline"
                    >
                      Tandai dibaca
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="cursor-pointer text-red-700 hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {!item.read_at && (
                <span className="mt-1 size-2.5 shrink-0 rounded-full bg-cine-maroon" aria-hidden />
              )}
            </div>
          );
        })}

        {!items.length && (
          <div className="cine-card p-8 text-center text-sm text-cine-muted">
            Belum ada notifikasi.
          </div>
        )}
      </div>
    </div>
  );
}
