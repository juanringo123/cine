import StudioManager from "@/components/admin/studio-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminStudios() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: cinemas }, { data: studios }] = await Promise.all([
    supabase.from("cinemas").select("id, name").order("name"),
    supabase.from("studios").select("*").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Kelola Studio & Kursi</h2>
        <p className="text-xs text-cine-muted">Jumlah kursi dijaga otomatis oleh trigger saat kursi dibuat/dihapus.</p>
      </div>
      <StudioManager cinemas={cinemas ?? []} studios={studios ?? []} />
    </div>
  );
}
