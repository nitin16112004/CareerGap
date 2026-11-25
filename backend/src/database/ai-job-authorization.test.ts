import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/202611240002_protect_ai_job_writes.sql"), "utf8");

it("keeps AI job input and results writable only by the backend role", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.ai_jobs (id integer primary key, user_id uuid, status text);
      insert into public.ai_jobs values
        (1, '11111111-1111-4111-8111-111111111111', 'queued'),
        (2, '22222222-2222-4222-8222-222222222222', 'queued');
      alter table public.ai_jobs enable row level security;
      grant all on public.ai_jobs to public, anon, authenticated;
      create policy "Users can view own ai jobs" on public.ai_jobs for select to authenticated
        using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
      create policy "Users can insert own ai jobs" on public.ai_jobs for insert to authenticated with check (true);
      create policy "Users can update own ai jobs" on public.ai_jobs for update to authenticated using (true);
    `);

    await db.exec(migration);
    await db.exec(`
      set role authenticated;
      set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
    `);
    expect((await db.query("select id from public.ai_jobs")).rows).toEqual([{ id: 1 }]);
    await expect(db.query("update public.ai_jobs set status = 'completed' where id = 1"))
      .rejects.toMatchObject({ code: "42501" });
    await expect(db.query("insert into public.ai_jobs values (3, '11111111-1111-4111-8111-111111111111', 'queued')"))
      .rejects.toMatchObject({ code: "42501" });

    await db.exec("reset role; set role anon;");
    await expect(db.query("select id from public.ai_jobs")).rejects.toMatchObject({ code: "42501" });

    await db.exec("reset role; set role service_role;");
    const result = await db.query("update public.ai_jobs set status = 'completed' where id = 2 returning id");
    expect(result.rows).toEqual([{ id: 2 }]);
  } finally {
    await db.close();
  }
}, 120_000);
