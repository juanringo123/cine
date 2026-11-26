import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/../supabase/types/database";

const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});

/** Pastikan user login dan punya salah satu role yang diberikan. */
export async function requireRole(roles: Enums<"user_role">[]) {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile || !roles.includes(profile.role)) redirect("/");
  return profile;
}
