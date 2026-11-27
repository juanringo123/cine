import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Server route: meneruskan charge ke Go API dengan internal key setelah cek auth & kepemilikan. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { payment_id?: string };
  const paymentId = typeof body.payment_id === "string" ? body.payment_id.trim() : "";

  if (!paymentId) {
    return NextResponse.json({ error: "payment_id wajib diisi" }, { status: 400 });
  }

  // RLS memastikan user hanya dapat melihat pembayaran miliknya sendiri (atau admin/staff).
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Pembayaran tidak ditemukan" }, { status: 404 });
  }

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!apiUrl || (process.env.VERCEL && /localhost|127\.0\.0\.1/i.test(apiUrl))) {
    return NextResponse.json(
      {
        error:
          "Gateway Midtrans belum terhubung di server ini. Gunakan metode QRIS (Simulasi) untuk melanjutkan pembayaran.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${apiUrl}/payments/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify({ payment_id: paymentId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghubungi Go API" },
      { status: 502 },
    );
  }
}
