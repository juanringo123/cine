"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const SPLASH_STORAGE_KEY = "cine_login_splash_shown";

type SplashStage = "idle" | "visible" | "fading" | "done";

/**
 * Layar pembuka (splash screen) hanya tampil satu kali per sesi di halaman login awal,
 * tidak muncul ulang saat refresh atau berpindah halaman/tab.
 */
export default function LoginSplash({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<SplashStage>("idle");
  const fadingStartedRef = useRef(false);
  const fadeTimerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (fadingStartedRef.current) return;
    fadingStartedRef.current = true;
    setStage("fading");
    fadeTimerRef.current = window.setTimeout(() => {
      setStage("done");
    }, 400);
  }, []);

  useLayoutEffect(() => {
    try {
      if (window.sessionStorage.getItem(SPLASH_STORAGE_KEY) === "1") {
        setStage("done");
        return;
      }
      window.sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    } catch {
      // Abaikan jika sessionStorage tidak tersedia
    }
    setStage("visible");
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== "visible") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = prefersReduced ? 450 : 1500;

    const holdTimer = window.setTimeout(() => {
      dismiss();
    }, holdMs);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(holdTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [stage, dismiss]);

  useEffect(() => {
    if (stage !== "visible") {
      document.body.style.overflow = "";
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [stage]);

  const showOverlay = stage === "visible" || stage === "fading";

  return (
    <>
      {children}
      {showOverlay && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Memuat CINÉ"
          onClick={dismiss}
          className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-white px-6 transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            stage === "visible" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="cine-splash-in flex flex-col items-center text-center">
            <Image
              src="/assets/cine-logo.png"
              alt="CINÉ"
              width={551}
              height={314}
              priority
              className="h-auto w-[176px] object-contain sm:w-[220px]"
            />
            <p className="mt-2.5 font-serif text-[13px] italic tracking-[0.02em] text-cine-muted sm:text-[15px]">
              Every CINÉ Has a Story
            </p>
            <div className="mt-6 h-[2px] w-28 overflow-hidden rounded-full bg-cine-cream">
              <div className="cine-splash-bar h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-cine-gold-dark to-transparent" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
