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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  try {
    const response = await fetch(
      `${apiUrl}/${endpoint}/${encodeURIComponent(cleanCode)}/qr.png`,
      {
        headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "" },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Gagal mengambil QR code" },
        { status: response.status },
      );
    }

    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghubungi Go API" },
      { status: 502 },
    );
  }
}
