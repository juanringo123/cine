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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  try {
    const response = await fetch(`${apiUrl}/auth/whatsapp/request`, {
      method: "POST",
      headers: forwardedHeaders(request),
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
