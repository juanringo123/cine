import AuthForm from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: cinemas } = await supabase
    .from("cinemas")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return <AuthForm mode="register" cinemas={cinemas ?? []} />;
}
