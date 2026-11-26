import PromoManager from "@/components/admin/promo-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPromos() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: promos } = await supabase.from("promos").select("*").order("code");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Kelola Promo</h2>
      <PromoManager promos={promos ?? []} />
    </div>
  );
}
