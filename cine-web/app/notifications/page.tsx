import { redirect } from "next/navigation";
import NotificationList from "@/components/notification-list";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("notifications")
    .select("id, title, body, type, data, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">Notifikasi</h1>
      <NotificationList items={items ?? []} />
    </main>
  );
}
