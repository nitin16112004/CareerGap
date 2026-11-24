import { CreditCard, FileText, LayoutDashboard, LogOut, Map, ScanLine, Settings, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { billingEnabled } from "../../config";
import { useAuth } from "../../hooks/use-auth";
import { ErrorMessage } from "../auth/FeedbackMessage";
import "./dashboard-shell.css";

const workspaceLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/skill-gap", label: "Skill gap", icon: ScanLine },
  { to: "/roadmap", label: "Roadmap", icon: Map },
  { to: "/resume-builder", label: "Resume builder", icon: FileText },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const DashboardShell = (): JSX.Element => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const logOut = async (): Promise<void> => {
    setSigningOut(true);
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="workspace-brand" to="/dashboard">
          <span className="workspace-brand-mark"><Sparkles size={18} aria-hidden="true" /></span>
          <span>CareerGuid AI</span>
        </Link>
        <nav aria-label="Career workspace">
          {workspaceLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}><Icon size={18} aria-hidden="true" />{label}</NavLink>
          ))}
          {billingEnabled && <NavLink to="/billing"><CreditCard size={18} aria-hidden="true" />Billing</NavLink>}
          {profile?.role === "admin" && <NavLink to="/admin"><ShieldCheck size={18} aria-hidden="true" />Administration</NavLink>}
        </nav>
        <button className="workspace-signout" type="button" disabled={signingOut} onClick={() => { void logOut(); }}>
          <LogOut size={17} aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {error && <div className="workspace-sidebar-feedback"><ErrorMessage>{error}</ErrorMessage></div>}
      </aside>
      <main className="workspace-content">
        <Outlet />
      </main>
    </div>
  );
};
