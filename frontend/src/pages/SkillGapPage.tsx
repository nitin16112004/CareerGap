import { ArrowRight, CheckCircle2, CircleDashed, Crown, Sparkles, Target, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/auth/AuthCard";
import { ErrorMessage, SuccessMessage } from "../components/auth/FeedbackMessage";
import { LoadingButton } from "../components/auth/Button";
import { billingEnabled } from "../config";
import { ApiError } from "../services/api";
import { roadmapService } from "../services/roadmap.service";
import { skillGapService, type JobRole, type SkillAnalysis } from "../services/skill-gap.service";

const priorityList = (analysis: SkillAnalysis | null): string[] => {
  if (!analysis) return [];
  const result = analysis.learning_order ?? analysis.analysis_result?.learning_order;
  if (Array.isArray(result)) return result.filter((item): item is string => typeof item === "string");
  return analysis.recommended_skills ?? [];
};

const needsUpgrade = (caught: unknown): boolean => caught instanceof ApiError && (caught.code === "PLAN_UPGRADE_REQUIRED" || caught.code === "PLAN_LIMIT_REACHED");

export const SkillGapPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [roleId, setRoleId] = useState("");
  const [analysis, setAnalysis] = useState<SkillAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [catalogError, setCatalogError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<"rag" | "basic_template" | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.allSettled([skillGapService.listRoles(), skillGapService.latest()]).then(([catalog, history]) => {
      if (!active) return;
      const availableRoles = catalog.status === "fulfilled" ? catalog.value : [];
      const latest = history.status === "fulfilled" ? history.value : null;
      const previousRoleId = latest?.role_id ?? latest?.role?.id ?? latest?.job_roles?.id;
      setRoles(availableRoles);
      setCatalogError(catalog.status === "rejected");
      setRoleId(availableRoles.find((role) => role.id === previousRoleId)?.id ?? "");
      if (history.status === "fulfilled") setAnalysis(latest);
      else setError("Your previous analysis could not be loaded. You can run a new analysis.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  const selectedRole = roles.find((role) => role.id === roleId);
  const analyzedRoleId = analysis?.role_id ?? analysis?.role?.id ?? analysis?.job_roles?.id;
  const analyzedRole = analysis?.role ?? analysis?.job_roles ?? roles.find((role) => role.id === analyzedRoleId);
  const learningOrder = priorityList(analysis);

  const retryCatalog = (): void => {
    setLoading(true);
    setError("");
    setLoadAttempt((attempt) => attempt + 1);
  };

  const analyze = async (): Promise<void> => {
    if (!roleId) { setError("Select a target role before running the analysis."); return; }
    setAnalyzing(true); setError(""); setSuccess(""); setGenerationError(""); setUpgradeRequired(false);
    try {
      const next = await skillGapService.analyze(roleId, sessionStorage.getItem("careerguid:last-resume-id") ?? undefined);
      setAnalysis(next); setSuccess("Skill-gap analysis updated from your current profile.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not analyze your skill gap."); }
    finally { setAnalyzing(false); }
  };

  const roadmapInput = (): { skillAnalysisId: string; roleId?: string; roleName?: string } | null => analysis ? { skillAnalysisId: analysis.id, roleId: analyzedRoleId, roleName: analyzedRole?.role_name } : null;

  const generateRagRoadmap = async (): Promise<void> => {
    const input = roadmapInput();
    if (!input) { setError("Run a skill-gap analysis before generating a roadmap."); return; }
    setGeneratingMode("rag"); setError(""); setSuccess(""); setGenerationError(""); setUpgradeRequired(false);
    try {
      const roadmapId = await roadmapService.generateRagAndWait(input);
      navigate(`/roadmap/${roadmapId}`);
    } catch (caught) {
      setUpgradeRequired(needsUpgrade(caught)); setGenerationError(caught instanceof Error ? caught.message : "Could not generate your AI roadmap.");
    } finally { setGeneratingMode(null); }
  };

  const generateBasicRoadmap = async (): Promise<void> => {
    const input = roadmapInput();
    if (!input) { setError("Run a skill-gap analysis before generating a roadmap."); return; }
    setGeneratingMode("basic_template"); setError(""); setSuccess(""); setGenerationError(""); setUpgradeRequired(false);
    try {
      const roadmap = await roadmapService.generate(input);
      navigate(`/roadmap/${roadmap.id}`);
    } catch (caught) {
      setUpgradeRequired(needsUpgrade(caught)); setGenerationError(caught instanceof Error ? caught.message : "Could not generate your basic roadmap.");
    } finally { setGeneratingMode(null); }
  };

  return (
    <AuthCard className="onboarding-card" eyebrow="Career readiness" title="Skill Gap Analysis" subtitle="See exactly how your current skills compare with the role you want, then turn the missing skills into a practical learning plan.">
      <ErrorMessage>{error}</ErrorMessage><SuccessMessage>{success}</SuccessMessage>

      {loading ? <div className="review-loading"><CircleDashed className="spin-icon" size={18} /> Loading career roles and your latest analysis...</div> : <>
        <section className="skill-gap-control-card">
          <div>
            <label className="field-label" htmlFor="skill-gap-role">Target job role</label>
            <select id="skill-gap-role" className="auth-input" disabled={!roles.length} value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">{roles.length ? "Select a role" : "No roles available"}</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
            </select>
            {selectedRole?.role_description && <p className="form-hint">{selectedRole.role_description}</p>}
            {!roles.length && <>
              <p className="form-hint" role="status">{catalogError ? "Job roles could not load. Try again." : "There are no active job roles right now."}</p>
              <button type="button" className="button button-secondary" onClick={retryCatalog}>Retry loading roles</button>
            </>}
          </div>
          <LoadingButton type="button" disabled={!selectedRole} loading={analyzing} loadingLabel="Analyzing skills..." onClick={() => { void analyze(); }}><Target size={16} /> Analyze skill gap</LoadingButton>
        </section>
        {!analysis ? <div className="empty-state-box"><TriangleAlert size={18} /><div><h3>No skill analysis yet</h3><p>Select a target role and compare it with the skills saved in your completed profile.</p></div></div> : <>
          <div className="skill-gap-metrics"><article className="career-metric-card"><span>Role match</span><strong>{analysis.match_score}%</strong><p>{analyzedRole?.role_name ?? "Target role"}</p></article><article className="career-metric-card"><span>Matched skills</span><strong>{analysis.matched_skills.length}</strong><p>Already working in your favor</p></article><article className="career-metric-card"><span>Missing skills</span><strong>{analysis.missing_skills.length}</strong><p>Prioritize these next</p></article></div>
          <div className="skill-gap-columns"><section className="skill-result-card"><div className="section-heading"><div><span className="eyebrow">Strengths</span><h2>Matched skills</h2></div><CheckCircle2 size={18} /></div><div className="skill-chip-list">{analysis.matched_skills.length ? analysis.matched_skills.map((skill) => <span className="skill-chip matched" key={skill}>{skill}</span>) : <p className="form-hint">No required skills matched yet. That is useful baseline information.</p>}</div></section><section className="skill-result-card"><div className="section-heading"><div><span className="eyebrow">Gaps</span><h2>Missing skills</h2></div><TriangleAlert size={18} /></div><div className="skill-chip-list">{analysis.missing_skills.length ? analysis.missing_skills.map((skill) => <span className="skill-chip missing" key={skill}>{skill}</span>) : <p className="form-hint">Great coverage. Keep strengthening depth and practical proof.</p>}</div></section></div>
          <section className="learning-order-card">
            <div className="section-heading"><h2>Recommended learning order</h2></div>
            {learningOrder.length ? <ol className="learning-order-list">{learningOrder.map((skill, index) => <li key={`${skill}-${index}`}><span>{index + 1}</span><strong>{skill}</strong></li>)}</ol> : <p className="form-hint">No missing skills need prioritization for this role.</p>}
            {analysis.missing_skills.length > 0 && <><div className="skill-gap-roadmap-cta">
              <div>
                <strong>Turn these gaps into a weekly plan</strong>
                <p>The AI roadmap uses indexed learning resources to create weekly tasks for your target role.</p>
                {billingEnabled && <p>AI roadmaps require Pro or Premium. Your monthly plan limit applies to both roadmap options.</p>}
              </div>
              <div className="roadmap-generation-actions">
                <LoadingButton type="button" loading={generatingMode === "rag"} disabled={generatingMode !== null} loadingLabel="Generating AI roadmap..." onClick={() => { void generateRagRoadmap(); }}><Sparkles size={16} /> Generate AI roadmap <ArrowRight size={16} /></LoadingButton>
                <LoadingButton variant="secondary" type="button" loading={generatingMode === "basic_template"} disabled={generatingMode !== null} loadingLabel="Building basic plan..." onClick={() => { void generateBasicRoadmap(); }}>Use basic plan</LoadingButton>
              </div>
            </div>
              <ErrorMessage>{generationError}</ErrorMessage>
              {billingEnabled && upgradeRequired && <div className="billing-entitlement-callout"><Crown size={18} /><div><strong>Your current plan does not include this action.</strong><p>Review Pro and Premium limits before retrying the roadmap generation.</p></div><Link className="button button-primary" to="/billing?plan=pro">View plans</Link></div>}
            </>}
          </section>
        </>}
      </>}
    </AuthCard>
  );
};
