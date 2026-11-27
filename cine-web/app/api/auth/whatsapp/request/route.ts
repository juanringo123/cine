import { NextResponse } from "next/server";
import { resolveGoApiUrl } from "@/lib/api-url";

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
  const resolved = resolveGoApiUrl("Layanan WhatsApp OTP");
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 503 });
  }

  try {
    const response = await fetch(`${resolved.url}/auth/whatsapp/request`, {
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
