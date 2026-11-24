import { AlertTriangle, ArrowLeft, ArrowUpRight, Bell, CalendarDays, Check, CircleDashed, ClipboardList, Map, RefreshCw, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/auth/Button";
import { ErrorMessage, SuccessMessage } from "../components/auth/FeedbackMessage";
import { RoadmapTaskQuiz } from "../components/roadmap/RoadmapTaskQuiz";
import { reminderService, type ReminderStatus } from "../services/reminder.service";
import { roadmapService, type RoadmapProgressResult, type RoadmapTaskCompletionResult } from "../services/roadmap.service";
import type { RoadmapRecord } from "../types/roadmap";
import "./roadmap-page.css";

interface RoadmapPageState {
    roadmap: RoadmapRecord | null;
    progress: RoadmapProgressResult | null;
    reminder: ReminderStatus | null;
    loading: boolean;
    submittingTaskId: string | null;
}

const formatProgress = (value: number): number => Math.max(0, Math.min(100, value));

const describeStatus = (status: string | null | undefined): string => {
    if (status === "completed") return "Completed";
    if (status === "skipped") return "Skipped";
    if (status === "overdue") return "Overdue";
    return "Pending";
};

const formatDate = (value: string): string => {
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const RoadmapPage = (): JSX.Element => {
    const { roadmapId } = useParams<{ roadmapId: string }>();
    const [state, setState] = useState<RoadmapPageState>({ roadmap: null, progress: null, reminder: null, loading: true, submittingTaskId: null });
    const [error, setError] = useState<string>();
    const [success, setSuccess] = useState<string>();
    const [quizTaskId, setQuizTaskId] = useState<string>();
    const quizTrigger = useRef<HTMLButtonElement | null>(null);

    const loadRoadmap = useCallback(async (): Promise<void> => {
        setError(undefined);
        setQuizTaskId(undefined);
        setState((current) => ({ ...current, loading: true, submittingTaskId: null }));
        try {
            let detail: RoadmapRecord | null = null;
            if (roadmapId) {
                detail = await roadmapService.get(roadmapId) as RoadmapRecord;
            } else {
                const [firstRoadmap] = await roadmapService.list();
                if (firstRoadmap) detail = await roadmapService.get(firstRoadmap.id) as RoadmapRecord;
            }

            if (!detail) {
                setState((current) => ({ ...current, roadmap: null, progress: null, reminder: null, loading: false }));
                return;
            }

            const [progress, reminder] = await Promise.all([
                roadmapService.progress(detail.id),
                reminderService.status(),
            ]);
            setState((current) => ({ ...current, roadmap: detail, progress, reminder, loading: false }));
        } catch (caught) {
            setState((current) => ({ ...current, loading: false }));
            setError(caught instanceof Error ? caught.message : "Unable to load your roadmap.");
        }
    }, [roadmapId]);

    useEffect(() => {
        void loadRoadmap();
    }, [loadRoadmap]);

    const applyTaskUpdate = async (result: RoadmapTaskCompletionResult): Promise<void> => {
        setState((current) => current.roadmap?.id === result.id ? {
            ...current,
            roadmap: { ...current.roadmap, progress_percentage: result.progress_percentage, weeks: result.weeks },
            progress: null,
        } : current);

        const [progressResult, reminderResult] = await Promise.allSettled([
            roadmapService.progress(result.id),
            reminderService.status(),
        ]);
        setState((current) => current.roadmap?.id === result.id ? {
            ...current,
            progress: progressResult.status === "fulfilled" ? progressResult.value : current.progress,
            reminder: reminderResult.status === "fulfilled" ? reminderResult.value : current.reminder,
            submittingTaskId: null,
        } : current);
    };

    const toggleTask = async (taskId: string, completed: boolean): Promise<void> => {
        if (!state.roadmap) return;
        setError(undefined);
        setSuccess(undefined);
        setState((current) => ({ ...current, submittingTaskId: taskId }));
        try {
            const result = await roadmapService.updateTaskStatus(state.roadmap.id, taskId, completed ? "pending" : "completed");
            await applyTaskUpdate(result);
            setSuccess(completed ? "Task reopened" : "Task completed");
        } catch (caught) {
            setState((current) => ({ ...current, submittingTaskId: null }));
            setError(caught instanceof Error ? caught.message : "Unable to update the roadmap task.");
        }
    };

    const closeQuiz = (): void => {
        setQuizTaskId(undefined);
        const trigger = quizTrigger.current;
        window.requestAnimationFrame(() => trigger?.focus());
    };

    const totalTasks = state.progress?.totalTasks ?? state.roadmap?.weeks.reduce((count, week) => count + week.tasks.length, 0) ?? 0;
    const completedTasks = state.progress?.completedTasks ?? state.roadmap?.weeks.reduce((count, week) => count + week.tasks.filter((task) => task.status === "completed").length, 0) ?? 0;
    const progress = state.progress ? formatProgress(state.progress.progressPercentage) : state.roadmap ? formatProgress(state.roadmap.progress_percentage) : 0;
    const targetRole = state.roadmap?.ai_response?.target_role ?? state.roadmap?.title ?? "Career roadmap";
    const missingSkills = Array.isArray(state.roadmap?.ai_response?.missing_skills) ? state.roadmap.ai_response.missing_skills as string[] : [];
    const isAiRoadmap = state.roadmap?.generated_by === "rag";
    const currentWeek = state.progress?.currentWeek;
    const lastReminder = state.reminder?.lastReminder;
    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="roadmap-page">
            <header className="roadmap-page-header">
                <h1>Your roadmap</h1>
                <Button type="button" variant="secondary" disabled={state.loading || state.submittingTaskId !== null || !!quizTaskId} onClick={() => { void loadRoadmap(); }}>
                    <RefreshCw size={16} aria-hidden="true" /> Refresh roadmap
                </Button>
            </header>

            <ErrorMessage>{error}</ErrorMessage>
            <SuccessMessage>{success}</SuccessMessage>

            {state.loading ? (
                <div className="roadmap-empty" role="status"><CircleDashed className="spin-icon" size={20} aria-hidden="true" /> Loading your roadmap...</div>
            ) : !state.roadmap ? (
                !error && <section className="roadmap-empty">
                    <span className="roadmap-empty-icon"><Map size={24} aria-hidden="true" /></span>
                    <h2>No roadmap yet</h2>
                    <p>Analyze your skills for a target role to create your weekly learning plan.</p>
                    <Link className="button button-secondary" to="/skill-gap">Analyze skill gap <ArrowUpRight size={16} aria-hidden="true" /></Link>
                </section>
            ) : (
                <>
                    <section className="roadmap-plan" aria-label="Plan overview">
                        <div className="roadmap-plan-copy">
                            <div className="roadmap-plan-type">
                                {isAiRoadmap ? <Sparkles size={16} aria-hidden="true" /> : <Map size={16} aria-hidden="true" />}
                                {isAiRoadmap ? "AI roadmap" : "Basic plan"}
                            </div>
                            <h2>{String(targetRole)}</h2>
                            {state.roadmap.description && <p>{state.roadmap.description}</p>}
                        </div>
                        <div className="roadmap-plan-progress" aria-live="polite">
                            <div><span>Plan progress</span><strong>{progress}%</strong></div>
                            <progress value={progress} max={100} aria-label="Roadmap progress" />
                            <span>{completedTasks} of {totalTasks} tasks complete</span>
                        </div>
                    </section>

                    {state.progress?.behindSchedule && (
                        <div className="roadmap-schedule-warning">
                            <AlertTriangle size={18} aria-hidden="true" />
                            <div>
                                <strong>Behind schedule</strong>
                                <p>{state.progress.overdueTasks > 0 ? `${state.progress.overdueTasks} overdue ${state.progress.overdueTasks === 1 ? "task needs" : "tasks need"} attention.` : `You’ve completed ${progress}% of your plan. The current target is ${state.progress.expectedProgressPercentage}%.`}</p>
                            </div>
                        </div>
                    )}

                    {(missingSkills.length > 0 || lastReminder) && (
                        <div className="roadmap-details">
                            {missingSkills.length > 0 && (
                                <section className="roadmap-detail" aria-labelledby="roadmap-skills-title">
                                    <h2 id="roadmap-skills-title">Skills to build</h2>
                                    <ul className="roadmap-skill-list">
                                        {missingSkills.map((skill, index) => <li key={`${skill}-${index}`}>{skill}</li>)}
                                    </ul>
                                </section>
                            )}
                            {lastReminder && (
                                <section className="roadmap-detail">
                                    <h2><Bell size={16} aria-hidden="true" /> Last reminder</h2>
                                    <p>{formatDate(lastReminder.sent_at ?? lastReminder.created_at)}{lastReminder.reason && ` · ${lastReminder.reason}`}</p>
                                </section>
                            )}
                        </div>
                    )}

                    <section className="roadmap-calendar" aria-labelledby="roadmap-calendar-title">
                        <header className="roadmap-calendar-header">
                            <h2 id="roadmap-calendar-title">Weekly plan</h2>
                            {currentWeek && <a href={`#roadmap-week-${currentWeek.id}`}>Jump to current week <ArrowUpRight size={15} aria-hidden="true" /></a>}
                        </header>
                        {state.roadmap.weeks.map((week) => {
                            const weekCompleted = week.tasks.filter((task) => task.status === "completed").length;
                            const isCurrentWeek = currentWeek?.id === week.id;
                            const title = week.title.replace(/^week\s+\d+\s*[:.–—-]\s*/i, "") || week.title;

                            return (
                                <section className="roadmap-week" id={`roadmap-week-${week.id}`} key={week.id} tabIndex={-1}>
                                    <header className="roadmap-week-top">
                                        <div>
                                            <span className="roadmap-week-label">Week {week.week_number}{isCurrentWeek && " · Current week"}</span>
                                            <h3>{title}</h3>
                                            {week.description && <p>{week.description}</p>}
                                        </div>
                                        <div className="roadmap-week-meta">
                                            <span><Check size={16} aria-hidden="true" /> {weekCompleted} of {week.tasks.length} complete</span>
                                            {week.due_date && <span><CalendarDays size={16} aria-hidden="true" /> Due <time dateTime={week.due_date}>{formatDate(week.due_date)}</time></span>}
                                        </div>
                                    </header>
                                    <ul className="roadmap-items">
                                        {week.tasks.map((task) => {
                                            const completed = task.status === "completed";
                                            const overdue = task.status === "pending" && task.due_date && task.due_date < today;
                                            const status = overdue ? "overdue" : task.status;
                                            const submitting = state.submittingTaskId === task.id;
                                            const quizSkill = completed ? null : task.quiz_skill;
                                            const quizOpen = quizTaskId === task.id;
                                            const actionLabel = completed ? "Reopen" : quizSkill ? "Take quiz" : "Mark complete";
                                            const ActionIcon = completed ? RotateCcw : quizSkill ? ClipboardList : Check;

                                            return (
                                                <li className="roadmap-item" key={task.id}>
                                                    <div className="roadmap-item-content">
                                                        <div className="roadmap-item-meta">
                                                            <span className={`roadmap-item-status ${status}`}>{describeStatus(status)}</span>
                                                            {task.due_date && !completed && <span>Due <time dateTime={task.due_date}>{formatDate(task.due_date)}</time></span>}
                                                        </div>
                                                        <h4>{task.task_title}</h4>
                                                        {task.task_description && <p>{task.task_description}</p>}
                                                        {task.resource_links.length > 0 && (
                                                            <div className="roadmap-item-resources">
                                                                {task.resource_links.map((resource, index) => (
                                                                    <a key={`${resource.url}-${index}`} href={resource.url} target="_blank" rel="noreferrer">{resource.label} <ArrowUpRight size={14} aria-hidden="true" /></a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="roadmap-item-action"
                                                        aria-label={`${actionLabel} ${task.task_title}`}
                                                        aria-expanded={quizSkill ? quizOpen : undefined}
                                                        aria-busy={submitting}
                                                        onClick={(event) => {
                                                            if (quizSkill) {
                                                                setSuccess(undefined);
                                                                quizTrigger.current = event.currentTarget;
                                                                setQuizTaskId(task.id);
                                                            } else void toggleTask(task.id, completed);
                                                        }}
                                                        disabled={state.submittingTaskId !== null || !!quizTaskId}
                                                    >
                                                        {submitting ? <CircleDashed className="spin-icon" size={16} aria-hidden="true" /> : <ActionIcon size={16} aria-hidden="true" />}
                                                        {submitting ? "Saving…" : actionLabel}
                                                    </button>
                                                    {quizOpen && quizSkill && <RoadmapTaskQuiz
                                                        roadmapId={task.roadmap_id}
                                                        taskId={task.id}
                                                        skill={quizSkill}
                                                        onClose={closeQuiz}
                                                        onPass={(result) => {
                                                            setState((current) => ({ ...current, submittingTaskId: task.id }));
                                                            setSuccess(`Quiz passed with ${result.score} out of ${result.total}. Task completed.`);
                                                            setQuizTaskId(undefined);
                                                            const trigger = quizTrigger.current;
                                                            void applyTaskUpdate(result.roadmap).then(() => window.requestAnimationFrame(() => trigger?.focus()));
                                                        }}
                                                    />}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            );
                        })}
                    </section>
                </>
            )}

            <footer className="roadmap-page-footer">
                <Link className="button button-secondary" to="/dashboard"><ArrowLeft size={16} aria-hidden="true" /> Back to dashboard</Link>
                <Link className="button button-secondary" to="/settings"><Settings2 size={16} aria-hidden="true" /> Reminder settings</Link>
            </footer>
        </div>
    );
};
