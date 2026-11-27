"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import Button from "@/components/ui/button";

type VerifyResult = {
  valid?: boolean;
  kind?: "ticket" | "fnb";
  code?: string;
  status?: string;
  message?: string;
  error?: string;
  title?: string;
  cinema?: string;
  studio?: string;
  schedule?: string;
  seats?: string;
  items?: string;
};

const PLAIN_CODE_RE = /^(CNE|FNB)-[A-Z0-9]{4,12}$/i;

function parseQR(raw: string): { code: string; token: string } | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("CINE:")) {
    const parts = value.split(":");
    if (parts.length >= 4) {
      return { code: parts[2].trim().toUpperCase(), token: parts.slice(3).join(":").trim() };
    }
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const code = (segments[segments.length - 1] ?? "").trim().toUpperCase();
    const token = (url.searchParams.get("t") ?? "").trim();
    if (code) return { code, token };
  } catch {
    // bukan URL
  }

  if (PLAIN_CODE_RE.test(value)) {
    return { code: value.toUpperCase(), token: "" };
  }

  return null;
}

export default function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function verify(code: string, token: string) {
    setError(null);
    setResult(null);
    if (!code) {
      setError("QR tidak mengandung kode tiket/pesanan yang valid.");
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch("/api/tickets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token }),
      });
      const data = (await response.json().catch(() => ({}))) as VerifyResult;
      if (!response.ok && data.error) {
        setError(data.error);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi.");
    } finally {
      setVerifying(false);
    }
  }

  function decodeFrameWithJsQR(video: HTMLVideoElement): string | null {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const decoded = jsQR(imgData.data, width, height, {
      inversionAttempts: "attemptBoth",
    });
    return decoded?.data ?? null;
  }

  async function startCamera() {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
      }).BarcodeDetector;

      const detector = BarcodeDetectorCtor
        ? new BarcodeDetectorCtor({ formats: ["qr_code"] })
        : null;

      let last = "";
      let lastScanTime = 0;

      const tick = async (now: number) => {
        if (!streamRef.current) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && now - lastScanTime >= 150) {
          lastScanTime = now;
          try {
            let raw: string | null = null;
            if (detector) {
              const codes = await detector.detect(video);
              raw = codes[0]?.rawValue ?? null;
            }
            if (!raw) {
              raw = decodeFrameWithJsQR(video);
            }
            if (raw && raw !== last) {
              last = raw;
              const parsed = parseQR(raw);
              if (parsed) {
                stopCamera();
                await verify(parsed.code, parsed.token);
                return;
              }
            }
          } catch {
            // abaikan frame gagal
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kamera tidak tersedia.");
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseQR(manual);
    if (parsed) void verify(parsed.code, parsed.token);
    else {
      setError("Format tidak dikenali. Masukkan kode seperti CNE-ABC123, FNB-ABC123, atau isi QR lengkap.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="cine-card space-y-3 p-5">
        <video
          ref={videoRef}
          className={
            scanning
              ? "aspect-video w-full rounded-xl bg-black object-cover"
              : "hidden aspect-video w-full rounded-xl bg-black object-cover"
          }
          muted
          playsInline
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={startCamera} disabled={scanning || verifying}>
            {scanning ? "Memindai QR..." : "Aktifkan Kamera"}
          </Button>
          {scanning && (
            <Button variant="outline" onClick={stopCamera}>
              Stop
            </Button>
          )}
        </div>
        <p className="text-xs text-cine-muted">
          Arahkan kamera ke QR e-tiket atau QR pesanan F&amp;B. Mendukung semua browser (Android, iOS, &amp; Desktop).
        </p>
      </div>

      <form onSubmit={submitManual} className="cine-card space-y-3 p-5">
        <label className="block space-y-1">
          <span className="cine-label">Kode Tiket / F&amp;B atau Isi QR Manual</span>
          <input
            className="cine-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="CNE-DC45CF atau CINE:TICKET:CNE-DC45CF:..."
          />
        </label>
        <Button type="submit" variant="gold" disabled={verifying}>
          {verifying ? "Memverifikasi..." : "Verifikasi Manual"}
        </Button>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`cine-card space-y-3 border p-5 ${
            result.valid
              ? "border-green-600 bg-green-50"
              : "border-red-700 bg-red-50"
          }`}
        >
          <p
            className={`text-lg font-bold ${
              result.valid ? "text-green-700" : "text-red-700"
            }`}
          >
            {result.valid
              ? result.kind === "fnb"
                ? "PESANAN F&B VALID"
                : "TIKET VALID"
              : "TIDAK VALID"}
          </p>

          {result.valid ? (
            <div className="space-y-1 text-sm text-cine-ink">
              {result.title && <p className="font-bold">{result.title}</p>}
              {result.code && (
                <p>
                  Kode: <span className="font-mono font-semibold">{result.code}</span> ·{" "}
                  <span className="uppercase">{result.status}</span>
                </p>
              )}
              {result.cinema && <p>Bioskop: {result.cinema}</p>}
              {result.studio && <p>Studio: {result.studio}</p>}
              {result.schedule && <p>Jadwal: {result.schedule}</p>}
              {result.seats && <p>Kursi: {result.seats}</p>}
              {result.items && <p>Menu: {result.items}</p>}
            </div>
          ) : (
            <p className="text-sm text-red-700">
              {result.message ?? result.error ?? "QR tidak valid."}
              {result.status ? ` (Status: ${result.status})` : ""}
            </p>
          )}

          <div className="pt-1">
            <Button type="button" variant="outline" onClick={startCamera}>
              Scan Lagi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
