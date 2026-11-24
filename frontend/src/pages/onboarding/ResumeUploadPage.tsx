import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "../../components/auth/AuthCard";
import { ErrorMessage } from "../../components/auth/FeedbackMessage";
import { LoadingButton } from "../../components/auth/Button";
import { ParsingLoader } from "../../components/resume/ParsingLoader";
import { ResumeUploader } from "../../components/resume/ResumeUploader";
import { UploadProgress, type UploadStage } from "../../components/resume/UploadProgress";
import { resumeService } from "../../services/resume.service";
import type { ResumeRecord } from "../../types/resume";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowed = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

const wait = (duration: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, duration));

export const ResumeUploadPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState("");
  const manualConfirm = useRef<HTMLDialogElement>(null);

  const chooseFile = (nextFile: File): void => {
    setError("");
    const extension = nextFile.name.toLowerCase().split(".").pop();
    const validType = allowed.has(nextFile.type) && (extension === "pdf" || extension === "docx");
    if (!validType) { setFile(null); setError("Please upload a PDF or DOCX resume."); return; }
    if (nextFile.size > MAX_FILE_SIZE) { setFile(null); setError("File size must be less than 5 MB."); return; }
    setFile(nextFile);
  };

  const poll = async (resumeId: string): Promise<ResumeRecord> => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await wait(1500);
      const result = await resumeService.get(resumeId);
      if (result.parsing_status === "completed" || result.parsing_status === "failed") return result;
    }
    throw new Error("Resume parsing is taking longer than expected. Please try again shortly.");
  };

  const upload = async (): Promise<void> => {
    if (!file) { setError("Choose a resume before continuing."); return; }
    setError("");
    try {
      setStage("uploading");
      const uploaded = await resumeService.upload(file);
      setStage("processing");
      const queued = await resumeService.process(uploaded.resume.id);
      const result = queued.resume.parsing_status === "completed" ? queued.resume : await poll(uploaded.resume.id);
      if (result.parsing_status === "failed") throw new Error(result.parsing_error || "We could not extract details from your resume. Please retry.");
      sessionStorage.setItem("careerguid:last-resume-id", result.id);
      setStage("ready");
      await wait(350);
      navigate(`/onboarding/review-profile?resumeId=${encodeURIComponent(result.id)}`);
    } catch (caught) {
      setStage("failed");
      setError(caught instanceof Error ? caught.message : "Resume upload failed. Please try again.");
    }
  };

  const busy = stage === "uploading" || stage === "processing";
  return <AuthCard className="onboarding-card" title="Upload your resume to get started" subtitle="Upload a PDF or DOCX to fill in your profile. You can review and edit the details before saving.">
    <div className="onboarding-intro"><span className="onboarding-intro-icon"><ShieldCheck size={20} aria-hidden="true" /></span><p>Your uploaded resume is stored privately.</p></div>
    <ResumeUploader file={file} onFile={chooseFile} onRemove={() => { setFile(null); setError(""); }} disabled={busy} />
    <ErrorMessage>{error}</ErrorMessage>
    <UploadProgress stage={stage} />
    {busy && <ParsingLoader stage={stage} />}
    <div className="resume-upload-actions">
      <LoadingButton type="button" onClick={() => { void upload(); }} loading={busy} loadingLabel={stage === "uploading" ? "Uploading..." : "Analyzing..."}><ArrowRight size={16} /> Analyze resume</LoadingButton>
      {stage === "failed" && <Link className="button button-secondary" to="/onboarding/review-profile?manual=true">Continue manually</Link>}
      {stage === "idle" && <button className="button button-secondary" type="button" onClick={() => manualConfirm.current?.showModal()}>Skip for now</button>}
    </div>
    <dialog ref={manualConfirm} className="resume-skip-dialog" aria-labelledby="resume-skip-title">
      <h2 id="resume-skip-title">Enter your profile manually?</h2>
      <p>You’ll enter your details and skills yourself. You can upload a resume later from your profile.</p>
      <form method="dialog" className="review-bottom-actions">
        <button type="submit" className="button button-secondary">Keep uploading</button>
        <Link className="button button-primary" to="/onboarding/review-profile?manual=true">Continue manually</Link>
      </form>
    </dialog>
    {stage === "failed" && <button type="button" className="link-button retry-link" onClick={() => { setStage("idle"); setError(""); }}><RotateCcw size={14} /> Choose another file</button>}
  </AuthCard>;
};
