import SettingsClient from "@/components/account/settings-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
    : { data: null };

  const { data: cinema } = profile?.preferred_cinema_id
    ? await supabase
        .from("cinemas")
        .select("name")
        .eq("id", profile.preferred_cinema_id)
        .maybeSingle()
    : { data: null };

  return (
    <SettingsClient
      fullName={profile?.full_name ?? profile?.nickname ?? "Pengguna CINÉ"}
      email={user?.email ?? ""}
      city={profile?.city ?? "Depok"}
      cinemaName={cinema?.name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
    />
  );
}
