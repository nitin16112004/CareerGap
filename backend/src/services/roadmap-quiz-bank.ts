import { roadmapQuizQuestions } from "../data/roadmap-quiz-questions";

export const ROADMAP_QUIZ_PASS_SCORE = 8;

export interface RoadmapQuiz {
  skill: string;
  questions: Array<{ id: string; prompt: string; options: string[] }>;
}

const skillAliases: ReadonlyMap<string, string> = new Map([
  ["js", "javascript"],
  ["ecmascript", "javascript"],
  ["ts", "typescript"],
  ["react", "reactjs"],
  ["node", "nodejs"],
  ["express", "expressjs"],
  ["postgres", "postgresql"],
  ["rest", "restapi"],
  ["jsonwebtoken", "jwt"],
  ["hld", "systemdesign"],
  ["lld", "systemdesign"],
  ["retrievalaugmentedgeneration", "rag"],
  ["ai", "aiml"],
  ["ml", "aiml"],
  ["machinelearning", "aiml"],
  ["artificialintelligence", "aiml"],
]);

const quizBySkill = new Map(Object.entries(roadmapQuizQuestions));

const findQuiz = (skill: string) => {
  const key = skill.toLowerCase().replace(/[^a-z0-9]/g, "");
  return quizBySkill.get(skillAliases.get(key) ?? key);
};

export const resolveRoadmapQuizSkill = (skill: string): string | undefined => findQuiz(skill)?.skill;

export const getRoadmapQuiz = (skill: string): RoadmapQuiz | undefined => {
  const quiz = findQuiz(skill);
  if (!quiz) return;

  return {
    skill: quiz.skill,
    questions: quiz.questions.map(([id, prompt, options]) => ({ id, prompt, options: [...options] })),
  };
};

export const gradeRoadmapQuiz = (skill: string, answers: Record<string, number>): { score: number; total: number } | undefined => {
  const quiz = findQuiz(skill);
  if (!quiz || Object.keys(answers).length !== quiz.questions.length) return;

  let score = 0;
  for (const [id, , options, correct] of quiz.questions) {
    const selected = answers[id];
    if (!Object.hasOwn(answers, id) || !Number.isInteger(selected) || selected < 0 || selected >= options.length) return;
    if (selected === correct) score += 1;
  }
  return { score, total: quiz.questions.length };
};
