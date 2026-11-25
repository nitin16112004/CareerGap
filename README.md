# CareerGap

CareerGuid AI helps job seekers turn a resume into a career profile. It analyzes skill gaps against target roles, builds learning roadmaps with skill quizzes, and creates ATS-friendly resume drafts.

The frontend uses React and TypeScript. The API uses Express, the AI service uses FastAPI, and Supabase provides Postgres, authentication, and private resume storage. Redis runs the background queues.

## Run locally

You need Docker with Compose and access to a Supabase project you can use for development. Node 22 and Python 3.12 are useful for running tests directly.

1. Review the SQL in [supabase/migrations](supabase/migrations). Check the target project's migration history before applying pending migrations. Use a development project for your first run.
2. Copy `.env.example` to `.env`. Set `SUPABASE_URL` and `VITE_SUPABASE_URL` to the same project URL. Set `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` to that project's public key. Put the server-only key in `SUPABASE_SERVICE_ROLE_KEY`.
3. In Supabase Auth, allow the exact paths `/auth/callback`, `/verify-email`, and `/reset-password` on `http://localhost:8080`. Set up email confirmation and the SMTP sender before testing email delivery.
4. Start the services and open `http://localhost:8080`.

```powershell
Copy-Item .env.example .env
# Set the project values described above, then run
docker compose --env-file .env config --quiet
docker compose up --build
```

The Compose settings use `FRONTEND_URL=http://localhost:8080` and `VITE_API_URL=/api/v1`. For AI roadmaps, configure the language and embedding provider in the server environment and index the knowledge base with the admin panel. The database expects 1,536-dimensional vectors.

## Run tests

Install dependencies in each package before running its tests.

| Directory | Install | Check |
| --- | --- | --- |
| `frontend` | `npm ci` | `npm run typecheck` and `npm test` |
| `backend` | `npm ci` | `npm run typecheck` and `npm test` |
| `ai-service` | `python -m pip install -r requirements.txt` | `python -m pytest -q` |

## Hosted setup

[netlify.toml](netlify.toml) builds the frontend. Set `VITE_API_URL` to the Render API HTTPS URL ending in `/api/v1`, plus `VITE_SUPABASE_URL` and the public `VITE_SUPABASE_ANON_KEY`.

[render.yaml](render.yaml) defines the API, AI service, and queue. Set the API's `FRONTEND_URL` to the assigned Netlify HTTPS origin and `AI_SERVICE_URL` to the assigned AI service HTTPS URL. The two Render services share a server-only `AI_SERVICE_TOKEN`. The AI service takes its model names and credentials from the `LLM_*` and `EMBEDDING_*` environment variables. Keep all private keys in the provider dashboards.

Set the Supabase Auth Site URL to the Netlify origin and allow the same three auth paths on that origin. Supabase Auth can use Gmail SMTP for verification and recovery. Optional reminder emails from Render use the Gmail API and need a sender OAuth grant. Free Render services can sleep, which can delay background jobs.

**Release checks.** Review Product CI, apply the pending Cloud Supabase migrations, and verify signup, resume processing, and AI roadmaps on the hosted URLs. Gmail reminders require a sender OAuth grant.
