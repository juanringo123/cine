import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Verifikasi QR petugas — hanya admin/staff yang boleh memanggil. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Hanya admin/staff" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  try {
    const response = await fetch(`${apiUrl}/tickets/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return NextResponse.json(await response.json().catch(() => ({})), {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghubungi Go API" },
      { status: 502 },
    );
  }
}
