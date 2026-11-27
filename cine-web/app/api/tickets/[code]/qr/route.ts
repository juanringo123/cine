import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

/** Generate QR PNG aman: cek login & kepemilikan via RLS, lalu buat PNG lokal dengan library qrcode. */
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
    .select("id, booking_code, qr_token")
    .eq("booking_code", cleanCode)
    .maybeSingle();

  const { data: order } = booking
    ? { data: null }
    : await supabase
        .from("fnb_orders")
        .select("id, order_code, qr_token")
        .eq("order_code", cleanCode)
        .maybeSingle();

  if (!booking && !order) {
    return NextResponse.json({ error: "Tiket atau pesanan tidak ditemukan" }, { status: 404 });
  }

  const qrPayload = booking
    ? `CINE:TICKET:${booking.booking_code}:${booking.qr_token}`
    : `CINE:FNB:${order!.order_code}:${order!.qr_token}`;

  try {
    const pngBuffer = await QRCode.toBuffer(qrPayload, {
      type: "png",
      width: 280,
      margin: 2,
      color: { dark: "#2b2b2b", light: "#ffffff" },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat QR code" },
      { status: 500 },
    );
  }
}
