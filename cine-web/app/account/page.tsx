import ProfileForm from "@/components/account/profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
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
    <ProfileForm
      profile={profile}
      email={user?.email ?? ""}
      cinemaName={cinema?.name ?? null}
    />
  );
}
