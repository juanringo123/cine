import HelpClient from "@/components/help-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: faqs } = await supabase
    .from("faqs")
    .select("id, category, question, answer")
    .eq("is_active", true)
    .order("sort_order");

  return <HelpClient faqs={faqs ?? []} />;
}
