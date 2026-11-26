import { Suspense } from "react";
import ResetPasswordForm from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white px-4 text-sm text-cine-muted">
          Memuat halaman atur ulang kata sandi...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
