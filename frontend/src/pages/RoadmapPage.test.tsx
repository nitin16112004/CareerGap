import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoadmapPage } from "./RoadmapPage";

const roadmap = {
    id: "roadmap-123",
    user_id: "user-1",
    skill_analysis_id: "analysis-1",
    role_id: "role-1",
    title: "Frontend Engineer Roadmap",
    description: "A roadmap built from your current skills and target role.",
    duration_weeks: 2,
    progress_percentage: 50,
    generated_by: "basic_template",
    ai_response: {
        generation_mode: "basic_template",
        target_role: "Frontend Engineer",
        missing_skills: ["Testing", "System Design"],
        recommended_skills: ["Testing", "System Design", "Accessibility"],
    },
    is_active: true,
    weeks: [
        {
            id: "week-1",
            roadmap_id: "roadmap-123",
            week_number: 1,
            title: "Week 1: Testing",
            description: "Practice testing fundamentals.",
            start_date: "2026-08-14",
            due_date: "2026-08-21",
            status: "pending",
            tasks: [
                {
                    id: "task-1",
                    roadmap_id: "roadmap-123",
                    week_id: "week-1",
                    task_title: "Write unit tests for a React feature",
                    task_description: "Practice testing React component behaviour.",
                    resource_links: [{ label: "Testing guide", url: "https://example.com/testing" }],
                    status: "pending",
                    due_date: "2026-08-18",
                    completed_at: null,
                    sort_order: 0,
                },
            ],
        },
    ],
};

const pendingProgress = {
    roadmapId: "roadmap-123",
    progressPercentage: 50,
    expectedProgressPercentage: 0,
    totalTasks: 1,
    completedTasks: 0,
    pendingTasks: 1,
    skippedTasks: 0,
    overdueTasks: 1,
    currentWeek: {
        id: "week-1",
        weekNumber: 1,
        title: "Week 1: Testing",
        startDate: "2026-08-14",
        dueDate: "2026-08-21",
        pendingTasks: 1,
        overdueTasks: 1,
    },
    behindSchedule: true,
};

const completedProgress = {
    ...pendingProgress,
    progressPercentage: 100,
    completedTasks: 1,
    pendingTasks: 0,
    overdueTasks: 0,
    currentWeek: {
        ...pendingProgress.currentWeek,
        pendingTasks: 0,
        overdueTasks: 0,
    },
    behindSchedule: false,
};

const reminderStatus = {
    preferences: {
        emailEnabled: true,
        weeklyPendingEnabled: true,
        inactiveEnabled: true,
        motivationalEnabled: true,
    },
    lastReminder: null,
    unreadNotifications: 0,
    progress: pendingProgress,
};

const roadmapServiceMock = vi.hoisted(() => ({
    list: vi.fn(),
    get: vi.fn(),
    progress: vi.fn(),
    completeTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    getTaskQuiz: vi.fn(),
    submitTaskQuiz: vi.fn(),
}));

const reminderServiceMock = vi.hoisted(() => ({
    status: vi.fn(),
}));

vi.mock("../services/roadmap.service", () => ({
    roadmapService: roadmapServiceMock,
}));

vi.mock("../services/reminder.service", () => ({
    reminderService: reminderServiceMock,
}));

const renderPage = (initialEntry: string = "/roadmap") => render(
    <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/roadmap/:roadmapId" element={<RoadmapPage />} />
        </Routes>
    </MemoryRouter>,
);

describe("RoadmapPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        roadmapServiceMock.list.mockResolvedValue([{ id: "roadmap-123", title: "Frontend Engineer Roadmap", description: "A roadmap built from your current skills and target role.", duration_weeks: 2, progress_percentage: 50, generated_by: "basic_template", ai_response: roadmap.ai_response, is_active: true, user_id: "user-1", skill_analysis_id: "analysis-1", role_id: "role-1", created_at: "2026-08-14", updated_at: "2026-08-14" }]);
        roadmapServiceMock.get.mockResolvedValue(roadmap);
        roadmapServiceMock.progress.mockResolvedValue(pendingProgress);
        reminderServiceMock.status.mockResolvedValue(reminderStatus);
        roadmapServiceMock.updateTaskStatus.mockResolvedValue({
            ...roadmap,
            progress_percentage: 100,
            weeks: [{
                ...roadmap.weeks[0],
                tasks: [{ ...roadmap.weeks[0].tasks[0], status: "completed", completed_at: "2026-08-14T00:00:00.000Z" }],
            }],
        });
    });

    it("renders the target role and missing skills from the real backend data", async () => {
        renderPage();

        expect(await screen.findByRole("heading", { name: "Frontend Engineer" })).toBeInTheDocument();
        const skills = screen.getByRole("region", { name: "Skills to build" });
        expect(within(skills).getByText("Testing")).toBeInTheDocument();
        expect(within(skills).getByText("System Design")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "Roadmap progress" })).toHaveAttribute("value", "50");
        expect(screen.getByRole("link", { name: "Jump to current week" })).toHaveAttribute("href", "#roadmap-week-week-1");
        expect(roadmapServiceMock.progress).toHaveBeenCalledWith("roadmap-123");
        expect(reminderServiceMock.status).toHaveBeenCalled();
    });

    it("updates the task status and progress when the user completes a task", async () => {
        roadmapServiceMock.progress
            .mockResolvedValueOnce(pendingProgress)
            .mockResolvedValueOnce(completedProgress);
        reminderServiceMock.status
            .mockResolvedValueOnce(reminderStatus)
            .mockResolvedValueOnce({ ...reminderStatus, progress: completedProgress });
        renderPage();

        const completeButton = await screen.findByRole("button", { name: /complete write unit tests for a react feature/i });
        fireEvent.click(completeButton);

        await waitFor(() => {
            expect(roadmapServiceMock.updateTaskStatus).toHaveBeenCalledWith("roadmap-123", "task-1", "completed");
        });
        expect(await screen.findByText("Task completed")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "Roadmap progress" })).toHaveAttribute("value", "100");
        expect(screen.getByRole("button", { name: /reopen write unit tests for a react feature/i })).toBeEnabled();
        expect(roadmapServiceMock.progress).toHaveBeenCalledTimes(2);
    });

    it("handles the empty state when no roadmap has been generated yet", async () => {
        roadmapServiceMock.list.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByRole("heading", { name: "No roadmap yet" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Analyze skill gap" })).toHaveAttribute("href", "/skill-gap");
        expect(roadmapServiceMock.progress).not.toHaveBeenCalled();
        expect(reminderServiceMock.status).not.toHaveBeenCalled();
    });

    it("requires eight correct answers out of ten to complete the skill task", async () => {
        const week = roadmap.weeks[0];
        const task = { ...week.tasks[0], quiz_skill: "Testing" };
        const questions = Array.from({ length: 10 }, (_, index) => ({
            id: `question-${index + 1}`,
            prompt: `Testing concept ${index + 1}`,
            options: ["Correct answer", "Incorrect answer"],
        }));
        roadmapServiceMock.get.mockResolvedValue({ ...roadmap, weeks: [{ ...week, tasks: [task] }] });
        roadmapServiceMock.progress.mockResolvedValueOnce(pendingProgress).mockResolvedValueOnce(completedProgress);
        roadmapServiceMock.getTaskQuiz.mockResolvedValue({ passingScore: 8, questions });
        roadmapServiceMock.submitTaskQuiz
            .mockResolvedValueOnce({ score: 7, total: 10, passed: false })
            .mockResolvedValueOnce({
                score: 8, total: 10, passed: true,
                roadmap: { ...roadmap, progress_percentage: 100, weeks: [{ ...week, tasks: [{ ...task, status: "completed" }] }] },
            });
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: /take quiz write unit tests/i }));
        const quiz = within(await screen.findByRole("region", { name: "Testing quiz" }));
        expect(await quiz.findByText("Answer all 10 questions. Score at least 8 to complete this skill task.")).toBeInTheDocument();
        const questionGroups = quiz.getAllByRole("group");
        expect(questionGroups).toHaveLength(10);
        const submit = quiz.getByRole("button", { name: "Submit quiz" });
        questionGroups.slice(0, 9).forEach((group, index) => {
            fireEvent.click(within(group).getByRole("radio", { name: index < 7 ? "Correct answer" : "Incorrect answer" }));
        });
        expect(submit).toBeDisabled();
        fireEvent.click(within(questionGroups[9]).getByRole("radio", { name: "Incorrect answer" }));
        fireEvent.click(submit);

        expect(await quiz.findByText(/scored 7 out of 10/i)).toHaveFocus();
        expect(screen.getByRole("progressbar", { name: "Roadmap progress" })).toHaveAttribute("value", "50");
        expect(screen.queryByRole("button", { name: /reopen write unit tests/i })).not.toBeInTheDocument();

        fireEvent.click(quiz.getByRole("button", { name: "Try again" }));
        quiz.getAllByRole("group").forEach((group, index) => {
            fireEvent.click(within(group).getByRole("radio", { name: index < 8 ? "Correct answer" : "Incorrect answer" }));
        });
        fireEvent.click(quiz.getByRole("button", { name: "Submit quiz" }));

        expect(await screen.findByText(/quiz passed with 8 out of 10/i)).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "Roadmap progress" })).toHaveAttribute("value", "100");
        expect(screen.getByRole("button", { name: /reopen write unit tests/i })).toBeEnabled();
        expect(roadmapServiceMock.submitTaskQuiz).toHaveBeenLastCalledWith("roadmap-123", "task-1", Object.fromEntries(questions.map(({ id }, index) => [id, index < 8 ? 0 : 1])));
        expect(roadmapServiceMock.updateTaskStatus).not.toHaveBeenCalled();
    });
});
