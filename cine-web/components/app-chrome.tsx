"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import BottomNav from "@/components/bottom-nav";
import CineAiAssistant from "@/components/cine-ai-assistant";
import type { InitialNavbarUser } from "@/lib/auth";

const AUTH_FULLBLEED_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/simulasi-bayar",
];

export default function AppChrome({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: InitialNavbarUser | null;
}) {
  const pathname = usePathname();
  const hideChrome = AUTH_FULLBLEED_PATHS.some((p) => pathname.startsWith(p));

  if (hideChrome) {
    return (
      <div key={pathname} className="cine-page-enter">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar initialUser={initialUser} />
      <div key={pathname} className="cine-page-enter flex-1 pb-4 sm:pb-0">
        {children}
      </div>
      <Footer />
      <BottomNav />
      <CineAiAssistant />
    </div>
  );
}
