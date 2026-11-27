import { NextResponse } from "next/server";
import { resolvePublicBaseUrl } from "@/lib/base-url";
import {
  buildSimulasiUrl,
  createSimulasiToken,
  findSimulasiPayment,
  isDemoPaymentEnabled,
  verifySimulasiAuth,
} from "@/lib/simulasi-payment";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET: Cek status & detail pembayaran (hanya pemilik pembayaran / admin via RLS). */
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { found: false, error: "Harus login untuk memeriksa status pembayaran." },
      { status: 401 },
    );
  }

  const { orderId } = await context.params;
  try {
    const details = await findSimulasiPayment(orderId);
    if (!details) {
      return NextResponse.json(
        { found: false, error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    // RLS memastikan hanya pemilik transaksi (atau admin/staff) yang dapat mengakses & menerima token QR.
    const { data: owned } = await supabase
      .from("payments")
      .select("id")
      .eq("id", details.payment_id)
      .maybeSingle();

    if (!owned) {
      return NextResponse.json(
        { found: false, error: "Anda tidak memiliki akses ke pembayaran ini." },
        { status: 403 },
      );
    }

    const baseUrl = resolvePublicBaseUrl(request);
    const demoEnabled = isDemoPaymentEnabled();
    let simulasiToken: string | null = null;
    let simulasiError: string | null = null;

    if (!demoEnabled) {
      simulasiError =
        "Simulasi pembayaran QRIS dinonaktifkan (NEXT_PUBLIC_DEMO_PAYMENT=false).";
    } else {
      try {
        simulasiToken = createSimulasiToken(details.order_id, details.payment_id);
      } catch (err) {
        simulasiError =
          err instanceof Error
            ? err.message
            : "Secret simulasi pembayaran belum dikonfigurasi.";
      }
    }

    return NextResponse.json(
      {
        found: true,
        ...details,
        demo_enabled: demoEnabled,
        simulasi_error: simulasiError,
        simulasi_token: simulasiToken,
        simulasi_url: simulasiToken
          ? buildSimulasiUrl(baseUrl, details.order_id, simulasiToken)
          : null,
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
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  if (!isDemoPaymentEnabled()) {
    return NextResponse.json(
      {
        error:
          "Simulasi pembayaran dinonaktifkan (NEXT_PUBLIC_DEMO_PAYMENT=false).",
      },
      { status: 403 },
    );
  }

  const { orderId } = await context.params;
  try {
    const details = await findSimulasiPayment(orderId);
    if (!details) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    if (!verifySimulasiAuth(details.order_id, details.payment_id, request)) {
      return NextResponse.json(
        {
          error:
            "Akses ditolak: token simulasi pembayaran tidak valid atau tidak disertakan.",
        },
        { status: 403 },
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

    if (details.expires_at && new Date(details.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        {
          error: "Batas waktu pembayaran telah habis.",
          status: "expired",
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
