import AddressManager from "@/components/account/address-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AddressesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: addresses } = user
    ? await supabase.from("addresses").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
    : { data: [] };

  return <AddressManager addresses={addresses ?? []} userId={user?.id ?? ""} />;
}
