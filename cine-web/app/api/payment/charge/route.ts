import { NextResponse } from "next/server";
import { resolveGoApiUrl } from "@/lib/api-url";
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

  const resolved = resolveGoApiUrl("Gateway Midtrans");
  if (!resolved.ok) {
    return NextResponse.json(
      {
        error: `${resolved.error} Gunakan metode QRIS (Simulasi) jika belum memakai Midtrans.`,
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${resolved.url}/payments/charge`, {
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
