import { logger } from "../config/logger";
import { emailWorker } from "./email.worker";
import { resumeProcessingWorker } from "./resume-processing.worker";
import { roadmapGenerationWorker } from "./roadmap-generation.worker";
import { closeScheduler, registerScheduler, weeklyReminderWorker } from "./weekly-reminder.scheduler";

export const startEmbeddedWorkers = async (): Promise<void> => {
  for (const worker of [emailWorker, resumeProcessingWorker, roadmapGenerationWorker, weeklyReminderWorker]) {
    worker.on("error", () => logger.error({ queue: worker.name }, "queue worker connection failed"));
  }
  await registerScheduler();
};

export const stopEmbeddedWorkers = async (): Promise<void> => {
  await Promise.all([
    closeScheduler(), emailWorker.close(), resumeProcessingWorker.close(), roadmapGenerationWorker.close(),
  ]);
};
