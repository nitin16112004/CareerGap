import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
}));

vi.mock("../config/supabase", () => ({
    getSupabaseStorageClient: () => ({ from: mocked.from, rpc: mocked.rpc }),
}));

import { roadmapQuizQuestions } from "../data/roadmap-quiz-questions";
import { roadmapService } from "./roadmap.service";
import type { RoadmapTaskStatus } from "../types/roadmap";

const userId = "d3c17b3a-5c62-4f68-a0ca-d1c4bea196c7";
const roleId = "6cf6dbba-90aa-485b-84d7-9ea4e99194b2";
const skillAnalysisId = "1d3d1545-03f8-4f9f-8916-1435a0d0b72b";
const roadmapId = "roadmap-4";
const taskId = "task-4";

const table = () => {
    const chain: Record<string, any> = { data: null, error: null };
    chain.eq = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => ({ data: chain.data, error: chain.error }));
    chain.single = vi.fn(async () => ({ data: chain.data, error: chain.error }));
    return chain;
};

beforeEach(() => {
    vi.resetAllMocks();
    mocked.from.mockImplementation(() => table());
});

const mockOwnedTask = (taskTitle: string, quizSkill: string | null = null) => {
    const roadmap = { id: roadmapId, user_id: userId, generated_by: "basic_template", progress_percentage: 0 };
    const week = { id: "week-4", roadmap_id: roadmapId, week_number: 1 };
    const task = {
        id: taskId,
        roadmap_id: roadmapId,
        week_id: week.id,
        task_title: taskTitle,
        quiz_skill: quizSkill,
        status: "pending" as RoadmapTaskStatus,
        completed_at: null as string | null,
    };
    const roadmapTable = table();
    roadmapTable.data = roadmap;
    const weekTable = table();
    weekTable.data = [week];
    const taskTable = table();
    taskTable.data = [task];
    taskTable.maybeSingle.mockResolvedValue({ data: task, error: null });

    mocked.from.mockImplementation((tableName: string) => {
        if (tableName === "roadmaps") return roadmapTable;
        if (tableName === "roadmap_weeks") return weekTable;
        if (tableName === "roadmap_tasks") return taskTable;
        return table();
    });
    mocked.rpc.mockImplementation(async (_name, { p_status }: { p_status: RoadmapTaskStatus }) => {
        task.status = p_status;
        task.completed_at = "2026-09-03T12:00:00.000Z";
        roadmap.progress_percentage = 100;
        return { data: true, error: null };
    });
    return { roadmapTable, taskTable };
};

describe("roadmapService", () => {
    it("generates an honest basic-template roadmap from the user's skill analysis", async () => {
        const profileTable = table();
        profileTable.data = {
            id: userId,
            full_name: "Ava Stone",
            skills: ["React", "TypeScript"],
            target_job_role: "Frontend Engineer",
            career_goal: "Build product experiences and design systems",
        };

        const analysisTable = table();
        analysisTable.data = {
            id: skillAnalysisId,
            user_id: userId,
            role_id: roleId,
            current_skills: ["React", "TypeScript"],
            missing_skills: ["Node.js", "System Design", "Redis", "Testing"],
            matched_skills: ["React", "TypeScript"],
            recommended_skills: ["Node.js", "System Design"],
            analysis_result: { learning_order: ["Node.js", "System Design", "Redis", "Testing"] },
        };

        const docsTable = table();
        docsTable.data = [
            {
                id: "doc-1",
                title: "Node.js fundamentals",
                category: "skill",
                content: "Build Node.js APIs and practice testing.",
                source_url: "https://example.com/node",
            },
            {
                id: "doc-2",
                title: "System design basics",
                category: "roadmap",
                content: "Learn system design and Redis-backed caching patterns.",
                source_url: "https://example.com/system-design",
            },
        ];

        const roadmapTable = table();
        roadmapTable.data = {
            id: "roadmap-1",
            user_id: userId,
            skill_analysis_id: skillAnalysisId,
            role_id: roleId,
            title: "Frontend Engineer Roadmap",
            description: "Ava Stone's Frontend Engineer roadmap is built from the current skills, target role, and missing-skill gaps already captured in the account.",
            duration_weeks: 4,
            progress_percentage: 0,
            generated_by: "basic_template",
            ai_response: null,
            is_active: true,
        };
        roadmapTable.single.mockResolvedValue({ data: roadmapTable.data, error: null });

        const weekTable = table();
        weekTable.data = {
            id: "week-1",
            roadmap_id: "roadmap-1",
            week_number: 1,
            title: "Week 1: Node.js",
            description: "This week focuses on the most relevant skills.",
            start_date: "2026-09-03",
            due_date: "2026-09-10",
            status: "pending",
        };
        weekTable.single.mockResolvedValue({ data: weekTable.data, error: null });

        const taskTable = table();
        taskTable.select.mockResolvedValue({
            data: [{
                id: "task-1",
                roadmap_id: "roadmap-1",
                week_id: "week-1",
                task_title: "Practice Node.js",
                quiz_skill: "Node.js",
                task_description: "Apply Node.js in a practical project.",
                resource_links: [],
                status: "pending",
                due_date: "2026-09-10",
                completed_at: null,
                sort_order: 0,
            }],
            error: null,
        });

        mocked.from.mockImplementation((tableName: string) => {
            switch (tableName) {
                case "profiles": return profileTable;
                case "skill_analyses": return analysisTable;
                case "knowledge_base_documents": return docsTable;
                case "roadmaps": return roadmapTable;
                case "roadmap_weeks": return weekTable;
                case "roadmap_tasks": return taskTable;
                default: return table();
            }
        });

        const result = await roadmapService.generate(userId, {
            skillAnalysisId,
            roleName: "Frontend Engineer",
        });

        expect(result.generated_by).toBe("basic_template");
        expect(result.title).toContain("Frontend Engineer");
        expect(result.description).toContain("Ava Stone");
        expect(result.weeks.length).toBeGreaterThan(0);
        expect(result.ai_response.generation_mode).toBe("basic_template");
        expect(result.ai_response.context_documents).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "doc-1" }),
        ]));
        expect(mocked.from).not.toHaveBeenCalledWith("rag_queries");
        expect(roadmapTable.insert).toHaveBeenCalledWith(expect.objectContaining({
            generated_by: "basic_template",
            skill_analysis_id: skillAnalysisId,
            role_id: roleId,
        }));
        expect(taskTable.insert).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ task_title: "Strengthen Node.js", quiz_skill: "Node.js" }),
            expect.objectContaining({ task_title: "Review and apply your frontend engineer progress", quiz_skill: null }),
        ]));
    });

    it("requires a real skill-gap analysis before roadmap generation", async () => {
        const profileTable = table();
        profileTable.data = {
            id: userId,
            full_name: "Ava Stone",
            skills: ["React"],
            target_job_role: "Frontend Engineer",
        };
        const analysisTable = table();
        analysisTable.data = null;

        mocked.from.mockImplementation((tableName: string) => {
            if (tableName === "profiles") return profileTable;
            if (tableName === "skill_analyses") return analysisTable;
            return table();
        });

        await expect(roadmapService.generate(userId, { roleName: "Frontend Engineer" }))
            .rejects.toMatchObject({ code: "ROADMAP_SKILL_ANALYSIS_REQUIRED", statusCode: 400 });
        expect(mocked.from).not.toHaveBeenCalledWith("knowledge_base_documents");
        expect(mocked.from).not.toHaveBeenCalledWith("rag_queries");
    });

    it("returns the authenticated user's roadmap with week and task structure", async () => {
        const roadmapTable = table();
        roadmapTable.data = {
            id: "roadmap-3",
            user_id: userId,
            skill_analysis_id: skillAnalysisId,
            role_id: roleId,
            title: "Roadmap overview",
            description: "Career roadmap",
            duration_weeks: 4,
            progress_percentage: 25,
            generated_by: "basic_template",
            ai_response: { generation_mode: "basic_template" },
            is_active: true,
        };
        roadmapTable.maybeSingle.mockResolvedValue({ data: roadmapTable.data, error: null });

        const weekTable = table();
        weekTable.data = [{
            id: "week-3",
            roadmap_id: "roadmap-3",
            week_number: 1,
            title: "Week 1",
            description: "Foundation",
            start_date: "2026-09-03",
            due_date: "2026-09-10",
            status: "pending",
        }];

        const taskTable = table();
        taskTable.data = [{
            id: "task-3",
            roadmap_id: "roadmap-3",
            week_id: "week-3",
            task_title: "Practice TypeScript",
            task_description: "Build a small TypeScript app.",
            resource_links: [],
            status: "pending",
            due_date: "2026-09-10",
            completed_at: null,
            sort_order: 0,
        }];

        mocked.from.mockImplementation((tableName: string) => {
            if (tableName === "roadmaps") return roadmapTable;
            if (tableName === "roadmap_weeks") return weekTable;
            if (tableName === "roadmap_tasks") return taskTable;
            return table();
        });

        const result = await roadmapService.get(userId, "roadmap-3");
        expect(result.id).toBe("roadmap-3");
        expect(result.generated_by).toBe("basic_template");
        expect(result.weeks).toHaveLength(1);
        expect(result.weeks[0].tasks[0].task_title).toBe("Practice TypeScript");
        expect(result.weeks[0].tasks[0].quiz_skill).toBe("TypeScript");
    });

    it("marks a task complete and recalculates progress while enforcing roadmap ownership", async () => {
        const { roadmapTable, taskTable } = mockOwnedTask("Review your weekly progress");
        const result = await roadmapService.updateTaskStatus(userId, roadmapId, taskId, "completed");
        expect(result.progress_percentage).toBe(100);
        expect(result.weeks[0].tasks[0].status).toBe("completed");
        expect(roadmapTable.eq).toHaveBeenCalledWith("user_id", userId);
        expect(taskTable.eq).toHaveBeenCalledWith("roadmap_id", roadmapId);
        expect(mocked.rpc).toHaveBeenCalledWith("update_owned_roadmap_task", {
            p_user_id: userId,
            p_roadmap_id: roadmapId,
            p_task_id: taskId,
            p_status: "completed",
        });
    });

    it.each(["Practice TypeScript", "Strengthen TS"])("requires a quiz to complete the legacy skill task %s", async (taskTitle) => {
        mockOwnedTask(taskTitle);
        await expect(roadmapService.completeTask(userId, roadmapId, taskId)).rejects.toMatchObject({
            code: "ROADMAP_QUIZ_REQUIRED",
            statusCode: 409,
        });
        expect(mocked.rpc).not.toHaveBeenCalled();
    });

    it("leaves the skill task pending on a failed or invalid quiz submission", async () => {
        const { roadmapTable, taskTable } = mockOwnedTask("Practice TypeScript");
        const wrong = Object.fromEntries(roadmapQuizQuestions.typescript.questions.map(([id, , options, correct], index) => [
            id, index < 3 ? (correct + 1) % options.length : correct,
        ]));

        await expect(roadmapService.submitTaskQuiz(userId, roadmapId, taskId, wrong)).resolves.toEqual({ score: 7, total: 10, passed: false });
        await expect(roadmapService.submitTaskQuiz(userId, roadmapId, taskId, {})).rejects.toMatchObject({ code: "ROADMAP_QUIZ_ANSWERS_INVALID", statusCode: 400 });
        expect(mocked.rpc).not.toHaveBeenCalled();
        expect(roadmapTable.update).not.toHaveBeenCalled();
        expect(taskTable.update).not.toHaveBeenCalled();
    });

    it("completes a skill task and returns updated progress on a passing quiz", async () => {
        mockOwnedTask("Add types to an API response", "TypeScript");
        const answers = Object.fromEntries(roadmapQuizQuestions.typescript.questions.map(([id, , options, correct], index) => [
            id, index < 2 ? (correct + 1) % options.length : correct,
        ]));

        const result = await roadmapService.submitTaskQuiz(userId, roadmapId, taskId, answers);
        expect(result).toMatchObject({
            score: 8,
            total: 10,
            passed: true,
            roadmap: { progress_percentage: 100, weeks: [{ tasks: [{ id: taskId, status: "completed", quiz_skill: "TypeScript" }] }] },
        });
        expect(mocked.rpc).toHaveBeenCalledExactlyOnceWith("update_owned_roadmap_task", {
            p_user_id: userId,
            p_roadmap_id: roadmapId,
            p_task_id: taskId,
            p_status: "completed",
        });
    });
});
