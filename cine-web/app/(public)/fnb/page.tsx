import FnbCatalog from "@/components/fnb-catalog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FnbPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: items }, { data: variants }, { data: cinemas }] =
    await Promise.all([
      supabase.from("fnb_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("fnb_items").select("*").eq("is_active", true).order("name"),
      supabase.from("fnb_variants").select("*").eq("is_active", true),
      supabase.from("cinemas").select("id, name, city").eq("is_active", true).order("name"),
    ]);

  return (
    <FnbCatalog
      categories={categories ?? []}
      items={items ?? []}
      variants={variants ?? []}
      cinemas={cinemas ?? []}
    />
  );
}
