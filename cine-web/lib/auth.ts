import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/../supabase/types/database";

export type InitialNavbarUser = {
  displayName: string;
  avatarUrl: string | null;
  isStaffOrAdmin: boolean;
  city: string | null;
};

const getCurrentProfile = cache(async () => {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) return { user: null, profile: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, city, role")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});

/** Ambil ringkasan sesi awal di server untuk mencegah kedip state auth pada Navbar. */
export async function getInitialNavbarUser(): Promise<InitialNavbarUser | null> {
  await cookies();
  try {
    const { user, profile } = await getCurrentProfile();
    if (!user) return null;

    const displayName =
      profile?.nickname ||
      profile?.full_name?.split(" ")[0] ||
      (user.user_metadata?.nickname as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
      user.email?.split("@")[0] ||
      "User";

    return {
      displayName,
      avatarUrl: profile?.avatar_url ?? null,
      isStaffOrAdmin: profile?.role === "admin" || profile?.role === "staff",
      city: profile?.city ?? null,
    };
  } catch {
    return null;
  }
}

/** Pastikan user login dan punya salah satu role yang diberikan. */
export async function requireRole(roles: Enums<"user_role">[]) {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile || !roles.includes(profile.role)) redirect("/");
  return profile;
}
