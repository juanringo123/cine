import NotificationList from "@/components/notification-list";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: items } = user
    ? await supabase
        .from("notifications")
        .select("id, title, body, type, data, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <h1 className="text-[36px] font-bold leading-tight text-cine-ink">Notifikasi</h1>
      <NotificationList items={items ?? []} />
    </main>
  );
}
