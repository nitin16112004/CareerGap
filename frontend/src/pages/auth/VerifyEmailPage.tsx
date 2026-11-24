import { ArrowLeft, MailCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../../components/auth/AuthCard";
import { AuthProgress } from "../../components/auth/AuthProgress";
import { ErrorMessage, SuccessMessage } from "../../components/auth/FeedbackMessage";
import { InputField } from "../../components/auth/InputField";
import { LoadingButton, Button } from "../../components/auth/Button";
import { ApiError } from "../../services/api";
import { authService } from "../../services/auth.service";
import { useAuth } from "../../hooks/use-auth";
import { afterSignIn } from "../../lib/auth-routing";

const schema = z.object({ token: z.string().regex(/^\d{6,10}$/, "Enter the 6- to 10-digit code from your email") });
const emailSchema = z.email();
type Values = z.infer<typeof schema>;

export const VerifyEmailPage = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = location.state as { email?: string; redirect?: string } | null;
  const savedEmail = useMemo(() => state?.email || sessionStorage.getItem("careerguid:verification-email") || user?.email || "", [state?.email, user?.email]);
  const [enteredEmail, setEnteredEmail] = useState("");
  const email = savedEmail || enteredEmail.trim();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur" });

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => value <= 1 ? 0 : value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async ({ token }: Values) => {
    if (loading || resendLoading) return;
    setError(undefined);
    setSuccess(undefined);
    if (!emailSchema.safeParse(email).success) {
      setError("Enter the email address you used to sign up.");
      return;
    }
    setLoading(true);
    try {
      const result = await authService.verifyEmail({ email, token });
      sessionStorage.removeItem("careerguid:verification-email");
      setSuccess("Email verified successfully. Preparing your next step...");
      navigate(afterSignIn(result.profile, state?.redirect), { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (loading || resendLoading || cooldown) return;
    setError(undefined);
    setSuccess(undefined);
    if (!emailSchema.safeParse(email).success) {
      setError("Enter the email address you used to sign up.");
      return;
    }
    setResendLoading(true);
    try {
      await authService.resendVerification(email);
      setCooldown(60);
      setSuccess("If this address needs verification, check your inbox and spam folder for a new code.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to resend the verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthCard eyebrow="Step 2 of 3" title="Verify your email" subtitle={savedEmail ? `Enter the verification code for ${savedEmail}.` : "Enter your signup email address and verification code."} footer={<p><Link to="/signup" className="back-link"><ArrowLeft size={14} /> Change email</Link></p>}>
      <AuthProgress activeStep={2} />
      <div className="verification-hero"><span><MailCheck size={24} /></span><p>Verification keeps your career workspace private and helps us send useful progress updates.</p></div>
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <ErrorMessage>{error}</ErrorMessage>
        <SuccessMessage>{success}</SuccessMessage>
        {!savedEmail && <InputField label="Email address" type="email" autoComplete="email" value={enteredEmail} disabled={loading || resendLoading} onChange={(event) => setEnteredEmail(event.target.value)} />}
        <InputField label="Verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} className="otp-input" error={errors.token?.message} {...register("token")} />
        <LoadingButton type="submit" loading={loading} disabled={resendLoading} loadingLabel="Verifying email...">Verify email <span aria-hidden="true">↗</span></LoadingButton>
        <Button type="button" variant="secondary" disabled={loading || resendLoading || Boolean(cooldown)} onClick={resend}>{resendLoading ? "Sending..." : cooldown ? `Resend available in ${cooldown}s` : "Resend verification email"}</Button>
      </form>
    </AuthCard>
  );
};
