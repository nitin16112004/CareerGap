import { expect, it } from "vitest";
import { roadmapQuizQuestions } from "../data/roadmap-quiz-questions";
import { getRoadmapQuiz, gradeRoadmapQuiz, resolveRoadmapQuizSkill, ROADMAP_QUIZ_PASS_SCORE } from "./roadmap-quiz-bank";

it.each(Object.values(roadmapQuizQuestions))("publishes ten answer-free questions for $skill", ({ skill, questions }) => {
  const quiz = getRoadmapQuiz(skill);
  expect(quiz?.questions).toEqual(questions.map(([id, prompt, options]) => ({ id, prompt, options })));
  expect(quiz?.questions).toHaveLength(10);
  expect(new Set(quiz?.questions.map((question) => question.id)).size).toBe(10);

  const answers = Object.fromEntries(questions.map(([id, , , correct]) => [id, correct]));
  expect(gradeRoadmapQuiz(skill, answers)).toEqual({ score: 10, total: 10 });
});

it("resolves aliases without treating unsupported tasks as skills", () => {
  expect(resolveRoadmapQuizSkill(" TypeScript ")).toBe("TypeScript");
  expect(resolveRoadmapQuizSkill("TS")).toBe("TypeScript");
  expect(resolveRoadmapQuizSkill("React")).toBe("React.js");
  expect(resolveRoadmapQuizSkill("JSON Web Token")).toBe("JWT");
  expect(resolveRoadmapQuizSkill("Review your weekly progress")).toBeUndefined();
});

it("scores wrong answers and rejects incomplete, foreign, and out-of-range answers", () => {
  const skill = "TypeScript";
  const questions = roadmapQuizQuestions.typescript.questions;
  const answers = Object.fromEntries(questions.map(([id, , options, correct]) => [id, (correct + 1) % options.length]));
  expect(gradeRoadmapQuiz(skill, answers)).toEqual({ score: 0, total: 10 });

  const [first, ...rest] = questions;
  const remaining = Object.fromEntries(rest.map(([id, , , correct]) => [id, correct]));
  const second = rest[0];
  expect(gradeRoadmapQuiz(skill, { ...remaining, [first[0]]: answers[first[0]], [second[0]]: answers[second[0]] })).toEqual({ score: ROADMAP_QUIZ_PASS_SCORE, total: 10 });
  expect(gradeRoadmapQuiz(skill, remaining)).toBeUndefined();
  expect(gradeRoadmapQuiz(skill, { ...remaining, "js-closure": 1 })).toBeUndefined();
  expect(gradeRoadmapQuiz(skill, { ...remaining, [first[0]]: 4 })).toBeUndefined();
  expect(gradeRoadmapQuiz(skill, { ...remaining, [first[0]]: 1.5 })).toBeUndefined();
});
