import { NextResponse } from "next/server";

function forwardedHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const xff = request.headers.get("x-forwarded-for");
  const xri = request.headers.get("x-real-ip");
  if (xff) headers["X-Forwarded-For"] = xff;
  if (xri) headers["X-Real-IP"] = xri;
  return headers;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!apiUrl || (process.env.VERCEL && /localhost|127\.0\.0\.1/i.test(apiUrl))) {
    return NextResponse.json(
      {
        error:
          "Layanan WhatsApp OTP belum aktif di server ini. Silakan masuk menggunakan Email & Kata Sandi.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${apiUrl}/auth/whatsapp/verify`, {
      method: "POST",
      headers: forwardedHeaders(request),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
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
