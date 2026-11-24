import { ArrowRight, BriefcaseBusiness, Crosshair, Crown, FileUp, Layers3, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "../../components/auth/AuthCard";
import { LoadingButton } from "../../components/auth/Button";
import { ErrorMessage, SuccessMessage } from "../../components/auth/FeedbackMessage";
import { billingEnabled } from "../../config";
import { ApiError } from "../../services/api";
import { onboardingService } from "../../services/onboarding.service";
import { resumeService, type ResumeHistoryItem } from "../../services/resume.service";
import type { ResumeBuilderAnalysis } from "../../types/ats-resume";

interface BuilderState {
    analysis: ResumeBuilderAnalysis | null;
    resume: ResumeHistoryItem | null;
    isAnalyzing: boolean;
    isGenerating: boolean;
    targetRole: string;
    jobDescription: string;
    versionName: string;
}

const displayPercent = (analysis: ResumeBuilderAnalysis | null, key: keyof Pick<ResumeBuilderAnalysis, "atsScore" | "keywordMatch" | "skillsMatch" | "experienceRelevance" | "sectionCompleteness">): string => analysis ? `${analysis[key]}%` : "—";
const needsUpgrade = (caught: unknown): boolean => caught instanceof ApiError && (caught.code === "PLAN_LIMIT_REACHED" || caught.code === "PLAN_UPGRADE_REQUIRED");

export const ResumeBuilderPage = (): JSX.Element => {
    const navigate = useNavigate();
    const [state, setState] = useState<BuilderState>({ analysis: null, resume: null, isAnalyzing: false, isGenerating: false, targetRole: "", jobDescription: "", versionName: "ATS v1" });
    const [upgradeRequired, setUpgradeRequired] = useState(false);
    const [error, setError] = useState<string>();
    const [success, setSuccess] = useState<string>();

    useEffect(() => {
        let active = true;
        void Promise.all([resumeService.history(), onboardingService.getProfile()])
            .then(async ([uploads, profile]) => {
                if (!active) return;
                const resume = uploads.find((item) => item.parsing_status === "completed") ?? null;
                const role = profile.target_job_role ?? "";
                setState((current) => ({ ...current, resume, targetRole: role, isAnalyzing: Boolean(resume && role) }));
                if (resume && role) {
                    const analysis = await resumeService.analyzeResume(resume.id, role);
                    if (active) setState((current) => current.targetRole === role && !current.jobDescription ? { ...current, analysis } : current);
                }
            })
            .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load your reviewed resume profile."); })
            .finally(() => { if (active) setState((current) => ({ ...current, isAnalyzing: false })); });
        return () => { active = false; };
    }, []);

    const analyze = async (): Promise<void> => {
        const resumeId = state.resume?.id;
        if (!resumeId) { setError("Upload and review a resume before running ATS analysis."); return; }
        if (!state.targetRole.trim()) { setError("Choose a target job role before running ATS analysis."); return; }
        setUpgradeRequired(false); setError(undefined); setSuccess(undefined); setState((current) => ({ ...current, isAnalyzing: true }));
        try {
            const analysis = await resumeService.analyzeResume(resumeId, state.targetRole, state.jobDescription || undefined);
            setState((current) => ({ ...current, analysis, isAnalyzing: false })); setSuccess("ATS analysis updated from your reviewed resume facts.");
        } catch (caught) { setState((current) => ({ ...current, isAnalyzing: false })); setError(caught instanceof Error ? caught.message : "Unable to analyze your resume."); }
    };

    const generate = async (): Promise<void> => {
        const resumeId = state.resume?.id;
        if (!resumeId) { setError("Upload and review a resume before creating an ATS resume."); return; }
        if (!state.targetRole.trim()) { setError("Choose a target job role before generating the resume."); return; }
        setUpgradeRequired(false); setError(undefined); setSuccess(undefined); setState((current) => ({ ...current, isGenerating: true }));
        try {
            const record = await resumeService.generateResume(resumeId, state.targetRole, state.jobDescription || undefined, state.versionName);
            setState((current) => ({ ...current, analysis: record.analysis ?? current.analysis, isGenerating: false }));
            navigate(`/resume-builder/${record.id}/preview`);
        } catch (caught) {
            setState((current) => ({ ...current, isGenerating: false })); setUpgradeRequired(needsUpgrade(caught)); setError(caught instanceof Error ? caught.message : "Unable to generate the ATS resume.");
        }
    };

    const analysis = state.analysis;
    return (
        <AuthCard className="onboarding-card" eyebrow="ATS resume builder" title="Target your next role" subtitle="Analyze your reviewed resume against a role, then create an ATS-friendly version without inventing employers, projects, metrics, or experience.">
            <ErrorMessage>{error}</ErrorMessage><SuccessMessage>{success}</SuccessMessage>
            {billingEnabled && upgradeRequired && <div className="billing-entitlement-callout"><Crown size={18} /><div><strong>Your ATS generation allowance is exhausted.</strong><p>Compare higher monthly ATS limits before generating another version.</p></div><Link className="button button-primary" to="/billing?plan=pro">View plans</Link></div>}
            <div className="resume-builder-grid">
                <div className="resume-builder-panel">
                    <div className="field-group"><label className="field-label">Target role</label><div className="input-shell"><span className="input-icon"><BriefcaseBusiness size={15} /></span><input value={state.targetRole} onChange={(event) => setState((current) => ({ ...current, targetRole: event.target.value, analysis: null }))} placeholder="Frontend Engineer" /></div></div>
                    <div className="field-group"><label className="field-label">Job description <span className="field-hint">Optional</span></label><textarea className="resume-textarea" value={state.jobDescription} onChange={(event) => setState((current) => ({ ...current, jobDescription: event.target.value, analysis: null }))} rows={8} placeholder="Paste the real role description here to compare target keywords..." /></div>
                    <div className="field-group"><label className="field-label">Version name</label><div className="input-shell"><span className="input-icon"><Layers3 size={15} /></span><input value={state.versionName} onChange={(event) => setState((current) => ({ ...current, versionName: event.target.value }))} placeholder="ATS v1" /></div></div>
                    {state.resume && <p className="form-hint">Source resume: {state.resume.file_name}</p>}
                    <div className="resume-builder-actions">
                        <LoadingButton type="button" variant="secondary" disabled={!state.resume || state.isGenerating} loading={state.isAnalyzing} loadingLabel="Analyzing..." onClick={() => { void analyze(); }}><Crosshair size={15} /> Analyze fit</LoadingButton>
                        <LoadingButton type="button" disabled={!state.resume || state.isAnalyzing} loading={state.isGenerating} loadingLabel="Generating..." onClick={() => { void generate(); }}><Sparkles size={15} /> Generate factual ATS resume</LoadingButton>
                        <Link className="button button-secondary" to={state.resume ? "/profile" : "/onboarding/upload-resume"}><FileUp size={15} /> {state.resume ? "Update career profile" : "Upload a resume"}</Link>
                    </div>
                </div>
                <aside className="resume-builder-ats-box">
                    <div className="resume-score-header"><span className="ai-badge"><Crosshair size={13} /> ATS analysis</span></div><div className="ats-score-value">{analysis ? analysis.atsScore : "—"}</div>
                    <div className="ats-score-grid"><div><strong>{displayPercent(analysis, "keywordMatch")}</strong><span>Keyword match</span></div><div><strong>{displayPercent(analysis, "skillsMatch")}</strong><span>Skill match</span></div><div><strong>{displayPercent(analysis, "experienceRelevance")}</strong><span>Experience evidence</span></div><div><strong>{displayPercent(analysis, "sectionCompleteness")}</strong><span>Completeness</span></div></div>
                    <div className="resume-builder-suggestions"><h3><Wand2 size={14} /> Suggestions</h3><ul>{analysis?.suggestions.length ? analysis.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>) : <li>Run the analysis to see evidence-based suggestions. No demo score is shown.</li>}</ul></div>
                    {analysis?.keywords.length ? <div className="resume-builder-suggestions"><h3><ArrowRight size={14} /> Target keywords</h3><div className="skill-chip-list">{analysis.keywords.map((keyword) => <span className="skill-chip" key={keyword}>{keyword}</span>)}</div></div> : null}
                    {analysis?.missingSkills.length ? <div className="resume-builder-suggestions"><h3>Not evidenced yet</h3><p className="form-hint">Only add these if you can truthfully support them from your real work, education, or projects.</p><div className="skill-chip-list">{analysis.missingSkills.map((keyword) => <span className="skill-chip missing" key={keyword}>{keyword}</span>)}</div></div> : null}
                </aside>
            </div>
        </AuthCard>
    );
};
