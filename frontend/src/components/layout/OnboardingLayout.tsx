import { Check } from "lucide-react";
import { useEffect } from "react";
import { matchPath, Outlet, useLocation } from "react-router-dom";
import { Logo } from "../auth/Logo";
import "./onboarding-layout.css";

const steps = [
  { path: "/onboarding/upload-resume", label: "Upload resume" },
  { path: "/onboarding/review-profile", label: "Review profile" },
  { path: "/onboarding/success", label: "Complete" },
];

export const OnboardingLayout = (): JSX.Element => {
  const { pathname } = useLocation();
  const currentStep = steps.findIndex(({ path }) => matchPath(path, pathname));

  useEffect(() => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  return (
    <main className="onboarding-shell">
      <div className="onboarding-frame">
        <header className="onboarding-header">
          <Logo />
          <ol className="onboarding-steps" aria-label="Profile setup progress">
            {steps.map(({ label, path }, index) => (
              <li key={path} aria-current={index === currentStep ? "step" : undefined} className={index < currentStep ? "onboarding-step-done" : undefined}>
                <span className="onboarding-step-number" aria-hidden="true">{index < currentStep ? <Check size={14} /> : index + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </header>
        <Outlet />
      </div>
    </main>
  );
};
