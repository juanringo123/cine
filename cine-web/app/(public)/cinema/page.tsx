import CinemaListClient from "@/components/cinema-list-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CinemaListPage() {
  const supabase = await createClient();
  const { data: cinemas } = await supabase
    .from("cinemas")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return <CinemaListClient cinemas={cinemas ?? []} />;
}
