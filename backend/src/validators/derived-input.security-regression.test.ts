import { describe, expect, it } from "vitest";
import { atsGenerateSchema, atsUpdateSchema } from "./ats-resume.validators";
import { roadmapGenerateSchema, roadmapTaskUpdateSchema, roadmapUpdateSchema } from "./roadmap.validators";
import { analyzeSkillGapSchema } from "./skill-gap.validators";
import { resumePatchSchema } from "./resume.validators";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const envelope = (body: object, params: object = {}) => ({ body, params, query: {} });

describe("S2 actual exported request schemas", () => {
  it.each([{ atsScore: 100 }, { atsKeywords: ["forged"] }])(
    "S2-HTTP-ATS rejects caller-derived fields %j", (patch) => {
      expect(atsUpdateSchema.safeParse(envelope(
        { resumeContent: { summary: "Allowed manual edit" }, ...patch }, { generatedResumeId: id },
      )).success).toBe(false);
    },
  );

  it("S2-HTTP-PROGRESS rejects direct aggregate progress mutation", () => {
    expect(roadmapUpdateSchema.safeParse(envelope(
      { title: "Allowed label", progressPercentage: 100 }, { roadmapId: id },
    )).success).toBe(false);
  });

  it("S2-HTTP-OVERDUE keeps deadline-derived state out of user task intent", () => {
    expect(roadmapTaskUpdateSchema.safeParse(envelope(
      { status: "overdue" }, { roadmapId: id, taskId: id },
    )).success).toBe(false);
  });

  it("S2-INPUT-ANALYSIS removes forged result/evidence/owner fields from analysis input", () => {
    const parsed = analyzeSkillGapSchema.parse(envelope({
      roleId: id, resumeId: id, match_score: 100, analysis_result: { trusted: true },
      missing_skills: [], user_id: id, source: "system",
    }));
    expect(parsed.body).toEqual({ roleId: id, resumeId: id });
  });

  it("S2-INPUT-JOB generation input cannot set job status, outputs, refund or execution fields", () => {
    const parsed = roadmapGenerateSchema.parse(envelope({
      roleName: "Backend Engineer", generationMode: "basic_template",
      userId: id, status: "completed", output_payload: { billingUsageRefunded: true },
      input_payload: { userId: id }, retry_count: 0, created_at: "1999-01-01",
      started_at: "1999-01-01", completed_at: "1999-01-01", ai_response: { verified: true },
      generated_by: "rag", progress_percentage: 100,
    }));
    expect(parsed.body).toEqual({ roleName: "Backend Engineer", generationMode: "basic_template" });
    // This protects this API input only; direct ai_jobs database writes are deferred.
  });

  it("S2-INPUT-GENERATION strips ATS identity, score and provenance from generation input", () => {
    const parsed = atsGenerateSchema.parse(envelope({
      resumeId: id, targetRole: "Backend Engineer", user_id: id, atsScore: 100,
      atsKeywords: ["forged"], analysis_result: { trusted: true }, source_resume_id: id,
    }));
    expect(parsed.body).toEqual({ resumeId: id, targetRole: "Backend Engineer" });
  });

  it("S1-REVIEW strips storage identity and parser-state fields from manual review", () => {
    const parsed = resumePatchSchema.parse(envelope({
      extractedData: { name: "Owner A" }, storage_path: "foreign/object.pdf",
      file_url: "foreign/object.pdf", user_id: id, parsing_status: "completed",
    }, { resumeId: id }));
    expect(parsed.body).toEqual({ extractedData: { name: "Owner A" } });
  });

  it("S2-EDIT-SCHEMA retains intended content, roadmap label and completion intents", () => {
    expect(atsUpdateSchema.parse(envelope({
      versionName: "Reviewed", resumeContent: { summary: "Truthful edit" },
    }, { generatedResumeId: id })).body.resumeContent).toEqual({ summary: "Truthful edit" });
    expect(roadmapUpdateSchema.parse(envelope({ title: "My plan", isActive: false }, { roadmapId: id })).body)
      .toEqual({ title: "My plan", isActive: false });
    expect(roadmapTaskUpdateSchema.parse(envelope({ status: "completed" }, { roadmapId: id, taskId: id })).body)
      .toEqual({ status: "completed" });
  });
});
