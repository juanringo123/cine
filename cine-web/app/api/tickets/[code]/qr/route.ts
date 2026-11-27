import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Proxy aman untuk QR PNG: cek login & kepemilikan via RLS, lalu kirim X-Internal-Key ke Go API. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const cleanCode = decodeURIComponent(code || "").trim().toUpperCase();
  if (!cleanCode) {
    return NextResponse.json({ error: "Kode wajib diisi" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("booking_code", cleanCode)
    .maybeSingle();

  const { data: order } = booking
    ? { data: null }
    : await supabase
        .from("fnb_orders")
        .select("id")
        .eq("order_code", cleanCode)
        .maybeSingle();

  if (!booking && !order) {
    return NextResponse.json({ error: "Tiket atau pesanan tidak ditemukan" }, { status: 404 });
  }

  const endpoint = booking ? "tickets" : "orders";
  const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  const canTryGoApi =
    Boolean(configuredApiUrl) &&
    !(process.env.VERCEL && /localhost|127\.0\.0\.1/i.test(configuredApiUrl));

  if (canTryGoApi) {
    try {
      const response = await fetch(
        `${configuredApiUrl}/${endpoint}/${encodeURIComponent(cleanCode)}/qr.png`,
        {
          headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "" },
          cache: "no-store",
          signal: AbortSignal.timeout(2500),
        },
      );

      if (response.ok) {
        const bytes = await response.arrayBuffer();
        return new NextResponse(bytes, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=300",
          },
        });
      }
    } catch {
      // Lanjut ke fallback generator QR PNG agar tetap tampil di Vercel tanpa Go API.
    }
  }

  try {
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&format=png&data=${encodeURIComponent(cleanCode)}`;
    const qrRes = await fetch(fallbackUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!qrRes.ok) {
      return NextResponse.json(
        { error: "Gagal membuat QR code tiket" },
        { status: 502 },
      );
    }

    const bytes = await qrRes.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat QR code" },
      { status: 502 },
    );
  }
}
