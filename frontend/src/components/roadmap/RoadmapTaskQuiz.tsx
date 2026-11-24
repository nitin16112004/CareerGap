import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { roadmapService, type RoadmapQuiz, type RoadmapQuizResult } from "../../services/roadmap.service";
import { Button, LoadingButton } from "../auth/Button";
import { ErrorMessage } from "../auth/FeedbackMessage";

type PassedQuiz = Extract<RoadmapQuizResult, { passed: true }>;

interface RoadmapTaskQuizProps {
    roadmapId: string;
    taskId: string;
    skill: string;
    onClose: () => void;
    onPass: (result: PassedQuiz) => void;
}

export const RoadmapTaskQuiz = ({ roadmapId, taskId, skill, onClose, onPass }: RoadmapTaskQuizProps): JSX.Element => {
    const headingId = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    const resultMessage = useRef<HTMLParagraphElement>(null);
    const mounted = useRef(false);
    const [quiz, setQuiz] = useState<RoadmapQuiz>();
    const [reload, setReload] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [outcome, setOutcome] = useState<RoadmapQuizResult>();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        mounted.current = true;
        heading.current?.focus();
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        let active = true;
        void roadmapService.getTaskQuiz(roadmapId, taskId).then((result) => {
            if (active) setQuiz(result);
        }).catch((caught: unknown) => {
            if (active) setError(caught instanceof Error ? caught.message : "Could not load the skill quiz.");
        });
        return () => { active = false; };
    }, [reload, roadmapId, taskId]);

    useEffect(() => {
        if (outcome) resultMessage.current?.focus();
    }, [outcome]);

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!quiz || submitting || outcome || quiz.questions.some(({ id }) => answers[id] === undefined)) return;
        setSubmitting(true);
        setError(undefined);
        try {
            const result = await roadmapService.submitTaskQuiz(roadmapId, taskId, answers);
            if (!mounted.current) return;
            if (result.passed) onPass(result);
            else setOutcome(result);
        } catch (caught) {
            if (mounted.current) setError(caught instanceof Error ? caught.message : "Could not submit the skill quiz.");
        } finally {
            if (mounted.current) setSubmitting(false);
        }
    };

    const retry = (): void => {
        setOutcome(undefined);
        setAnswers({});
        setError(undefined);
        if (!quiz) setReload((current) => current + 1);
        heading.current?.focus();
    };

    return (
        <section className="roadmap-quiz" aria-labelledby={headingId}>
            <h4 id={headingId} ref={heading} tabIndex={-1}>{skill} quiz</h4>
            {quiz && <p>Answer all {quiz.questions.length} questions. Score at least {quiz.passingScore} to complete this skill task.</p>}
            {!quiz && !error && <p role="status">Loading quiz…</p>}
            <ErrorMessage>{error}</ErrorMessage>
            {outcome && <p className="roadmap-quiz-result" role="status" ref={resultMessage} tabIndex={-1}>You scored {outcome.score} out of {outcome.total}. Review the skill and try again.</p>}
            <form onSubmit={(event) => { void submit(event); }}>
                {quiz && !outcome && (
                    <div className="roadmap-quiz-questions">
                        {quiz.questions.map((question, number) => (
                            <fieldset key={question.id} disabled={submitting}>
                                <legend>{number + 1}. {question.prompt}</legend>
                                {question.options.map((option, index) => (
                                    <label className="roadmap-quiz-option" key={index}>
                                        <input type="radio" name={`${headingId}-${question.id}`} checked={answers[question.id] === index} onChange={() => setAnswers((current) => ({ ...current, [question.id]: index }))} required />
                                        <span>{option}</span>
                                    </label>
                                ))}
                            </fieldset>
                        ))}
                    </div>
                )}
                <div className="roadmap-quiz-actions">
                    {quiz && !outcome && <LoadingButton type="submit" loading={submitting} loadingLabel="Submitting…" disabled={quiz.questions.some(({ id }) => answers[id] === undefined)}>Submit quiz</LoadingButton>}
                    {(outcome || (!quiz && error)) && <Button type="button" onClick={retry}>Try again</Button>}
                    <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Close quiz</Button>
                </div>
            </form>
        </section>
    );
};
