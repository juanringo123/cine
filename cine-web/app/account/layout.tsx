import { redirect } from "next/navigation";
import AccountSidebar from "@/components/account/account-sidebar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">Akun Saya</h1>
      <div className="flex flex-col gap-10 md:flex-row md:items-start">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
