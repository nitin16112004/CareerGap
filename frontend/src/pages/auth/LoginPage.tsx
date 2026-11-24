import { Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../../components/auth/AuthCard";
import { ErrorMessage } from "../../components/auth/FeedbackMessage";
import { InputField } from "../../components/auth/InputField";
import { LoadingButton } from "../../components/auth/Button";
import { PasswordInput } from "../../components/auth/PasswordInput";
import { authService } from "../../services/auth.service";
import { ApiError } from "../../services/api";
import { afterSignIn, safeRedirect } from "../../lib/auth-routing";
import { GoogleSignIn } from "../../components/auth/GoogleSignIn";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address"), password: z.string().min(1, "Enter your password") });
type Values = z.infer<typeof schema>;

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = safeRedirect(new URLSearchParams(location.search).get("redirect"));
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur" });

  const goToVerification = (email: string) => {
    sessionStorage.setItem("careerguid:verification-email", email);
    navigate("/verify-email", { replace: true, state: { email, redirect } });
  };

  const onSubmit = async (values: Values) => {
    setError(undefined);
    setLoading(true);
    try {
      const result = await authService.login(values);
      if (result.requiresVerification) goToVerification(values.email);
      else navigate(afterSignIn(result.profile, redirect), { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "AUTH_EMAIL_UNVERIFIED") goToVerification(values.email);
      else setError(caught instanceof ApiError ? caught.message : "Login failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard eyebrow="Welcome back" title="Sign in to your career edge" subtitle="Pick up exactly where your next opportunity starts." footer={<p>New to CareerGuid? <Link to="/signup">Create an account <span aria-hidden="true">↗</span></Link></p>}>
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <ErrorMessage>{error}</ErrorMessage>
        <InputField label="Email address" placeholder="you@example.com" autoComplete="email" icon={<Mail size={16} />} error={errors.email?.message} {...register("email")} />
        <PasswordInput label="Password" placeholder="Enter your password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        <LoadingButton type="submit" loading={loading} loadingLabel="Authenticating...">Sign in <span aria-hidden="true">↗</span></LoadingButton>
        <GoogleSignIn redirect={redirect} disabled={loading} />
        <div className="trust-row"><ShieldCheck size={14} /> Secure session · Supabase Auth</div>
      </form>
    </AuthCard>
  );
};
