-- Add the default role catalog on hosted and local databases.
-- Seed aliases and mappings only for new catalog entries to preserve admin edits.
with added_skills as (
  insert into public.skills (skill_name, normalized_name, category, description)
  values
    ('JavaScript', 'javascript', 'Programming Language', 'Core language for web development.'),
    ('TypeScript', 'typescript', 'Programming Language', 'Typed JavaScript for scalable frontend and backend apps.'),
    ('React.js', 'reactjs', 'Frontend', 'Component-based frontend library for building user interfaces.'),
    ('Node.js', 'nodejs', 'Backend', 'JavaScript runtime for backend services.'),
    ('Express.js', 'expressjs', 'Backend', 'Minimal Node.js web framework.'),
    ('PostgreSQL', 'postgresql', 'Database', 'Relational database used through Supabase PostgreSQL.'),
    ('Supabase', 'supabase', 'Backend Platform', 'PostgreSQL, Auth, Storage, and pgvector platform.'),
    ('Redis', 'redis', 'Infrastructure', 'In-memory cache, queue backend, rate limit, and temporary data store.'),
    ('Docker', 'docker', 'DevOps', 'Containerization for local and production deployment.'),
    ('REST API', 'restapi', 'Backend', 'HTTP API design and integration skill.'),
    ('JWT', 'jwt', 'Security', 'JSON Web Token authentication and authorization.'),
    ('System Design', 'systemdesign', 'Architecture', 'Design of scalable and reliable software systems.'),
    ('Python', 'python', 'Programming Language', 'Language used for AI service and scripting.'),
    ('FastAPI', 'fastapi', 'Backend', 'Python web framework for AI service APIs.'),
    ('RAG', 'rag', 'AI', 'Retrieval Augmented Generation for contextual AI responses.'),
    ('AI/ML', 'aiml', 'AI', 'Artificial intelligence and machine learning fundamentals.')
  on conflict do nothing
  returning id, skill_name
), aliases(skill_name, alias_name, normalized_alias) as (
  values
    ('JavaScript', 'JS', 'js'),
    ('JavaScript', 'ECMAScript', 'ecmascript'),
    ('TypeScript', 'TS', 'ts'),
    ('React.js', 'React', 'react'),
    ('Node.js', 'Node', 'node'),
    ('Node.js', 'NodeJS', 'nodejs'),
    ('Express.js', 'Express', 'express'),
    ('PostgreSQL', 'Postgres', 'postgres'),
    ('REST API', 'REST', 'rest'),
    ('JWT', 'JSON Web Token', 'jsonwebtoken'),
    ('System Design', 'HLD', 'hld'),
    ('System Design', 'LLD', 'lld'),
    ('AI/ML', 'Machine Learning', 'machinelearning'),
    ('AI/ML', 'Artificial Intelligence', 'artificialintelligence')
)
insert into public.skill_aliases (skill_id, alias_name, normalized_alias)
select skills.id, aliases.alias_name, aliases.normalized_alias
from aliases
join added_skills as skills on skills.skill_name = aliases.skill_name
on conflict do nothing;

with added_roles as (
  insert into public.job_roles (role_name, role_slug, role_description, category)
  values
    ('Backend Developer', 'backend-developer', 'Build APIs, services, databases, authentication, and scalable backend systems.', 'Software Engineering'),
    ('Frontend Developer', 'frontend-developer', 'Build responsive user interfaces, component systems, and client-side app flows.', 'Software Engineering'),
    ('Full Stack Developer', 'full-stack-developer', 'Build frontend, backend, database, and deployment pieces across the stack.', 'Software Engineering'),
    ('Data Analyst', 'data-analyst', 'Analyze data, build dashboards, query databases, and communicate insights.', 'Data'),
    ('Data Scientist', 'data-scientist', 'Use statistics, programming, and machine learning to solve data problems.', 'Data Science'),
    ('AI/ML Engineer', 'ai-ml-engineer', 'Build machine learning, AI, and model-powered application workflows.', 'AI'),
    ('AI Engineer', 'ai-engineer', 'Build production applications that use machine learning and generative AI.', 'AI'),
    ('Cloud Engineer', 'cloud-engineer', 'Design, deploy, and operate cloud infrastructure and services.', 'Cloud'),
    ('DevOps Engineer', 'devops-engineer', 'Automate CI/CD, infrastructure, monitoring, and deployment workflows.', 'DevOps'),
    ('Java Developer', 'java-developer', 'Build backend applications and services using Java ecosystem tools.', 'Software Engineering'),
    ('MERN Stack Developer', 'mern-stack-developer', 'Build Express, React, and Node.js applications with the documented Supabase PostgreSQL backend.', 'Software Engineering')
  on conflict do nothing
  returning id, role_slug
), role_skill_seed(role_slug, normalized_name, priority, skill_level, weight) as (
  values
    ('backend-developer', 'javascript', 'must_have', 'intermediate', 3),
    ('backend-developer', 'typescript', 'good_to_have', 'intermediate', 2),
    ('backend-developer', 'nodejs', 'must_have', 'intermediate', 3),
    ('backend-developer', 'expressjs', 'must_have', 'intermediate', 3),
    ('backend-developer', 'postgresql', 'must_have', 'intermediate', 3),
    ('backend-developer', 'redis', 'good_to_have', 'beginner', 2),
    ('backend-developer', 'restapi', 'must_have', 'intermediate', 3),
    ('backend-developer', 'jwt', 'must_have', 'beginner', 2),
    ('backend-developer', 'systemdesign', 'good_to_have', 'beginner', 2),
    ('frontend-developer', 'javascript', 'must_have', 'intermediate', 3),
    ('frontend-developer', 'typescript', 'must_have', 'intermediate', 3),
    ('frontend-developer', 'reactjs', 'must_have', 'intermediate', 3),
    ('frontend-developer', 'restapi', 'must_have', 'beginner', 2),
    ('full-stack-developer', 'javascript', 'must_have', 'intermediate', 3),
    ('full-stack-developer', 'typescript', 'must_have', 'intermediate', 3),
    ('full-stack-developer', 'reactjs', 'must_have', 'intermediate', 3),
    ('full-stack-developer', 'nodejs', 'must_have', 'intermediate', 3),
    ('full-stack-developer', 'expressjs', 'must_have', 'intermediate', 3),
    ('full-stack-developer', 'postgresql', 'must_have', 'intermediate', 3),
    ('full-stack-developer', 'supabase', 'good_to_have', 'beginner', 2),
    ('full-stack-developer', 'docker', 'good_to_have', 'beginner', 2),
    ('data-analyst', 'postgresql', 'must_have', 'intermediate', 3),
    ('data-analyst', 'python', 'good_to_have', 'beginner', 2),
    ('data-scientist', 'python', 'must_have', 'intermediate', 3),
    ('data-scientist', 'postgresql', 'good_to_have', 'intermediate', 2),
    ('data-scientist', 'aiml', 'must_have', 'intermediate', 3),
    ('ai-ml-engineer', 'python', 'must_have', 'intermediate', 3),
    ('ai-ml-engineer', 'aiml', 'must_have', 'intermediate', 3),
    ('ai-ml-engineer', 'rag', 'good_to_have', 'beginner', 2),
    ('ai-ml-engineer', 'fastapi', 'good_to_have', 'beginner', 2),
    ('ai-engineer', 'python', 'must_have', 'intermediate', 3),
    ('ai-engineer', 'aiml', 'must_have', 'intermediate', 3),
    ('ai-engineer', 'rag', 'good_to_have', 'beginner', 2),
    ('ai-engineer', 'fastapi', 'good_to_have', 'beginner', 2),
    ('cloud-engineer', 'docker', 'must_have', 'intermediate', 3),
    ('cloud-engineer', 'systemdesign', 'good_to_have', 'beginner', 2),
    ('devops-engineer', 'docker', 'must_have', 'intermediate', 3),
    ('devops-engineer', 'redis', 'good_to_have', 'beginner', 2),
    ('devops-engineer', 'systemdesign', 'good_to_have', 'beginner', 2),
    ('java-developer', 'postgresql', 'must_have', 'intermediate', 3),
    ('java-developer', 'restapi', 'must_have', 'intermediate', 3),
    ('java-developer', 'jwt', 'good_to_have', 'beginner', 2),
    ('java-developer', 'systemdesign', 'good_to_have', 'beginner', 2),
    ('mern-stack-developer', 'javascript', 'must_have', 'intermediate', 3),
    ('mern-stack-developer', 'typescript', 'good_to_have', 'beginner', 2),
    ('mern-stack-developer', 'reactjs', 'must_have', 'intermediate', 3),
    ('mern-stack-developer', 'nodejs', 'must_have', 'intermediate', 3),
    ('mern-stack-developer', 'expressjs', 'must_have', 'intermediate', 3),
    ('mern-stack-developer', 'restapi', 'must_have', 'intermediate', 3),
    ('mern-stack-developer', 'jwt', 'good_to_have', 'beginner', 2)
)
insert into public.role_skills (role_id, skill_id, priority, skill_level, weight)
select job_roles.id, skills.id, role_skill_seed.priority, role_skill_seed.skill_level, role_skill_seed.weight
from role_skill_seed
join added_roles as job_roles on job_roles.role_slug = role_skill_seed.role_slug
join public.skills on skills.normalized_name = role_skill_seed.normalized_name
on conflict do nothing;
