"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";

type VerifyResult = {
  valid?: boolean;
  kind?: string;
  code?: string;
  status?: string;
  message?: string;
  error?: string;
};

function parseQR(raw: string): { code: string; token: string } | null {
  const value = raw.trim();
  if (value.startsWith("CINE:")) {
    const parts = value.split(":");
    if (parts.length >= 4) return { code: parts[2], token: parts.slice(3).join(":") };
  }
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const code = segments[segments.length - 1] ?? "";
    const token = url.searchParams.get("t") ?? "";
    if (code && token) return { code, token };
  } catch {
    // bukan URL
  }
  return null;
}

export default function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function verify(code: string, token: string) {
    setError(null);
    setResult(null);
    if (!code || !token) {
      setError("QR tidak mengandung kode & token.");
      return;
    }
    try {
      const response = await fetch("/api/tickets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token }),
      });
      const data = (await response.json()) as VerifyResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi.");
    }
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
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

      if (!BarcodeDetectorCtor) {
        stopCamera();
        setError(
          "Browser tidak mendukung BarcodeDetector. Gunakan Chrome/Edge Android, atau input manual di bawah.",
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      let last = "";

      const tick = async () => {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue;
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
    else setError("Format harus CINE:TICKET:<kode>:<token> atau URL tiket dengan ?t=<token>.");
  }

  return (
    <div className="space-y-5">
      <div className="cine-card space-y-3 p-5">
        <video
          ref={videoRef}
          className={scanning ? "aspect-video w-full rounded bg-black" : "hidden aspect-video w-full rounded bg-black"}
          muted
          playsInline
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={startCamera} disabled={scanning}>{scanning ? "Memindai..." : "Aktifkan Kamera"}</Button>
          {scanning && <Button variant="outline" onClick={stopCamera}>Stop</Button>}
        </div>
        <p className="text-xs text-cine-muted">
          Kamera memakai BarcodeDetector (Chrome/Edge Android). Atau tempel isi QR secara manual.
        </p>
      </div>

      <form onSubmit={submitManual} className="cine-card space-y-3 p-5">
        <label className="block space-y-1">
          <span className="cine-label">Isi QR / kode + token</span>
          <input
            className="cine-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="CINE:TICKET:CNE-ABC123:uuid-token"
          />
        </label>
        <Button type="submit" variant="gold">Verifikasi Manual</Button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {result && (
        <div
          className={`cine-card p-5 ${result.valid ? "border-green-600 bg-green-50" : "border-red-700 bg-red-50"}`}
        >
          <p className={`text-lg font-bold ${result.valid ? "text-green-700" : "text-red-700"}`}>
            {result.valid ? "TIKET VALID" : "TIDAK VALID"}
          </p>
          <pre className="mt-2 overflow-x-auto text-xs text-cine-muted">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
