import { NextResponse } from "next/server";
import { resolvePublicBaseUrl } from "@/lib/base-url";
import { findSimulasiPayment } from "@/lib/simulasi-payment";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET: Cek status & detail pembayaran (dipakai oleh auto-polling halaman QR). */
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  try {
    const details = await findSimulasiPayment(orderId);
    if (!details) {
      return NextResponse.json(
        { found: false, error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    const baseUrl = resolvePublicBaseUrl(request);
    return NextResponse.json(
      {
        found: true,
        ...details,
        simulasi_url: `${baseUrl}/simulasi-bayar/${encodeURIComponent(details.order_id)}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memeriksa status pembayaran.",
      },
      { status: 500 },
    );
  }
}

/** POST: Konfirmasi pembayaran simulasi QRIS dari halaman E-Wallet HP (`pending` -> `paid`). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  try {
    const details = await findSimulasiPayment(orderId);
    if (!details) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    if (details.status === "paid") {
      return NextResponse.json({
        ok: true,
        already_paid: true,
        status: "paid",
        payment_id: details.payment_id,
        order_id: details.order_id,
        reference_code: details.reference_code,
        paid_at: details.paid_at,
      });
    }

    if (details.status !== "pending") {
      return NextResponse.json(
        {
          error: `Transaksi berstatus "${details.status}" dan tidak dapat dibayar lagi.`,
          status: details.status,
        },
        { status: 409 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("confirm_payment", {
      p_payment_id: details.payment_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    const refreshed = await findSimulasiPayment(details.payment_id);
    return NextResponse.json({
      ok: true,
      already_paid: false,
      status: refreshed?.status ?? "paid",
      payment_id: details.payment_id,
      order_id: details.order_id,
      reference_code: details.reference_code,
      paid_at: refreshed?.paid_at ?? new Date().toISOString(),
      rpc: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memproses konfirmasi pembayaran.",
      },
      { status: 500 },
    );
  }
}
