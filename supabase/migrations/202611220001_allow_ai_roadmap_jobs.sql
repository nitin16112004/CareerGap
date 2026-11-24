alter table public.ai_jobs
  drop constraint ai_jobs_job_type_check,
  add constraint ai_jobs_job_type_check check (job_type in (
    'resume_parsing',
    'skill_gap_analysis',
    'roadmap_generation',
    'ats_resume_generation',
    'embedding_generation',
    'roadmap_rag'
  ));
