import CardManager from "@/components/account/card-manager";
import { createClient } from "@/lib/supabase/server";

export default async function CardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // gateway_token sengaja tidak di-select (column-level grant).
  const { data: cards } = user
    ? await supabase
        .from("saved_cards")
        .select("id, brand, last4, expiry_month, expiry_year, holder_name, is_default, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return <CardManager cards={cards ?? []} userId={user?.id ?? ""} />;
}
