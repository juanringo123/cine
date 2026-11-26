import AuthForm from "@/components/auth-form";
import LoginSplash from "@/components/login-splash";

export default function LoginPage() {
  return (
    <LoginSplash>
      <AuthForm mode="login" />
    </LoginSplash>
  );
}
