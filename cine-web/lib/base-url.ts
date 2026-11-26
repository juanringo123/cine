import os from "node:os";

function isPrivateIPv4(ip: string): boolean {
  if (ip.startsWith("192.168.") || ip.startsWith("10.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

/** Deteksi IPv4 jaringan lokal (prioritas interface Wi-Fi) agar QR bisa discan dari HP. */
export function detectLocalLanIP(): string | null {
  const nets = os.networkInterfaces();
  let fallback: string | null = null;

  for (const [name, list] of Object.entries(nets)) {
    if (!list) continue;
    const isWifi = /wi-?fi|wlan|en0/i.test(name);
    for (const net of list) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (!isPrivateIPv4(net.address)) continue;
      if (isWifi) return net.address;
      if (!fallback) fallback = net.address;
    }
  }

  return fallback;
}

/**
 * Menentukan BASE_URL publik untuk URL QR Code:
 * 1. Env `NEXT_PUBLIC_APP_URL` / `APP_BASE_URL` (mis. URL Ngrok atau IP tetap)
 * 2. Header host dari request bila bukan localhost/127.0.0.1
 * 3. Fallback otomatis ke IP Wi-Fi/LAN lokal + port
 */
export function resolvePublicBaseUrl(request?: Request): string {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_BASE_URL ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (configured) return configured;

  const hostHeader =
    request?.headers.get("x-forwarded-host") ??
    request?.headers.get("host") ??
    "";
  const protoHeader = request?.headers.get("x-forwarded-proto") ?? "http";

  const cleanHost = hostHeader.split(",")[0].trim();
  const hostname = cleanHost.split(":")[0].toLowerCase();
  const port = cleanHost.includes(":") ? cleanHost.split(":")[1] : "3100";

  if (cleanHost && hostname !== "localhost" && hostname !== "127.0.0.1") {
    return `${protoHeader}://${cleanHost}`;
  }

  const lanIP = detectLocalLanIP();
  if (lanIP) {
    return `http://${lanIP}${port && port !== "80" && port !== "443" ? `:${port}` : ""}`;
  }

  return `http://localhost:${port || "3100"}`;
}
