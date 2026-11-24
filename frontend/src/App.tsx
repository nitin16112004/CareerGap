import { lazy, Suspense, useSyncExternalStore } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthLayout } from "./components/layout/AuthLayout";
import { DashboardShell } from "./components/layout/DashboardShell";
import { OnboardingLayout } from "./components/layout/OnboardingLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { FullPageLoader } from "./components/layout/FullPageLoader";
import { billingEnabled } from "./config";
import { FeaturesPage, LandingPage, NotFoundPage, PublicLayout } from "./pages/PublicPages";
import { apiIsStarting, subscribeToApiStartup } from "./services/api";

const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import("./pages/auth/SignupPage").then((module) => ({ default: module.SignupPage })));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage").then((module) => ({ default: module.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const AuthCallbackPage = lazy(() => import("./pages/auth/AuthCallbackPage").then((module) => ({ default: module.AuthCallbackPage })));
const ResumeUploadPage = lazy(() => import("./pages/onboarding/ResumeUploadPage").then((module) => ({ default: module.ResumeUploadPage })));
const ReviewProfilePage = lazy(() => import("./pages/onboarding/ReviewProfilePage").then((module) => ({ default: module.ReviewProfilePage })));
const OnboardingSuccessPage = lazy(() => import("./pages/onboarding/OnboardingSuccessPage").then((module) => ({ default: module.OnboardingSuccessPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SkillGapPage = lazy(() => import("./pages/SkillGapPage").then((module) => ({ default: module.SkillGapPage })));
const ResumeBuilderPage = lazy(() => import("./pages/resume-builder/ResumeBuilderPage").then((module) => ({ default: module.ResumeBuilderPage })));
const ResumeBuilderPreviewPage = lazy(() => import("./pages/resume-builder/ResumeBuilderPreviewPage").then((module) => ({ default: module.ResumeBuilderPreviewPage })));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage").then((module) => ({ default: module.RoadmapPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const BillingPage = lazy(() => import("./pages/BillingPage").then((module) => ({ default: module.BillingPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AdminRoleManagementPage = lazy(() => import("./pages/AdminRoleManagementPage").then((module) => ({ default: module.AdminRoleManagementPage })));

const ApiStartupStatus = (): JSX.Element | null =>
  useSyncExternalStore(subscribeToApiStartup, apiIsStarting, () => false)
    ? <div role="status" className="api-startup-status">Starting the server. This can take about a minute.</div>
    : null;

export const App = (): JSX.Element => (
  <>
   <ApiStartupStatus />
   <Suspense fallback={<FullPageLoader label="Loading your secure workspace..." />}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<OnboardingLayout />}>
          <Route path="/onboarding/upload-resume" element={<ResumeUploadPage />} />
          <Route path="/onboarding/review-profile" element={<ReviewProfilePage />} />
          <Route path="/onboarding/success" element={<OnboardingSuccessPage />} />
        </Route>
        <Route element={<DashboardShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/skill-gap" element={<SkillGapPage />} />
          <Route path="/resume-builder" element={<ResumeBuilderPage />} />
          <Route path="/resume-builder/:id" element={<ResumeBuilderPage />} />
          <Route path="/resume-builder/:id/preview" element={<ResumeBuilderPreviewPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/roadmap/:roadmapId" element={<RoadmapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {billingEnabled && <Route path="/billing" element={<BillingPage />} />}
          {billingEnabled && <Route path="/billing/checkout" element={<BillingPage />} />}
        </Route>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/users" element={<AdminPage />} />
        <Route path="/admin/job-roles" element={<AdminRoleManagementPage />} />
        <Route path="/admin/knowledge-base" element={<AdminPage />} />
        <Route path="/admin/reminders" element={<AdminPage />} />
        <Route path="/admin/logs" element={<AdminPage />} />
      </Route>

    </Routes>
   </Suspense>
  </>
);
