import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const migrationSql = (name: string): string => readFileSync(resolve(process.cwd(), "../supabase/migrations", name), "utf8");

it("keeps generated resume writes and export objects under the authorized API", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create schema storage;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function storage.foldername(name text) returns text[] language sql stable as
        $$ select string_to_array(name, '/') $$;

      create table public.generated_resumes (user_id uuid, ats_score integer);
      insert into public.generated_resumes values ('${owner}', 35), ('${other}', 65);
      alter table public.generated_resumes enable row level security;
      grant all on public.generated_resumes to anon, authenticated;
      grant update (ats_score) on public.generated_resumes to authenticated;

      create table storage.objects (bucket_id text, name text);
      insert into storage.objects values
        ('generated-resumes', '${owner}/document/resume.pdf'),
        ('resumes', '${owner}/resume.pdf');
      alter table storage.objects enable row level security;
      grant all on storage.objects to authenticated, service_role;
    `);

    const oldPolicies = migrationSql("202606290002_rls_storage_policies.sql").split(";");
    for (const statement of oldPolicies) {
      if (/create policy/i.test(statement) && (
        statement.includes("on public.generated_resumes") || statement.includes("on storage.objects")
        && /bucket_id = '(generated-resumes|resumes)'/.test(statement)
      )) {
        await db.exec(`${statement};`);
      }
    }

    const asRole = (role: "authenticated" | "service_role", sql: string) => db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [owner]);
      return tx.query(sql);
    });
    expect((await asRole("authenticated", "select bucket_id from storage.objects order by bucket_id")).rows)
      .toEqual([{ bucket_id: "generated-resumes" }, { bucket_id: "resumes" }]);

    await db.exec(migrationSql("202611240001_generated_resume_authorization.sql"));

    expect((await asRole("authenticated", "select user_id, ats_score from public.generated_resumes")).rows)
      .toEqual([{ user_id: owner, ats_score: 35 }]);
    expect((await asRole("authenticated", `
      select has_table_privilege('public.generated_resumes', 'insert') as insert_allowed,
        has_column_privilege('public.generated_resumes', 'ats_score', 'update') as update_allowed,
        has_table_privilege('public.generated_resumes', 'delete') as delete_allowed
    `)).rows).toEqual([{ insert_allowed: false, update_allowed: false, delete_allowed: false }]);
    expect((await asRole("authenticated", "select bucket_id from storage.objects")).rows)
      .toEqual([{ bucket_id: "resumes" }]);

    expect((await asRole("service_role", `
      update public.generated_resumes set ats_score = 40 where user_id = '${owner}' returning ats_score
    `)).rows).toEqual([{ ats_score: 40 }]);
    expect((await asRole("service_role", "select bucket_id from storage.objects where bucket_id = 'generated-resumes'")).rows)
      .toEqual([{ bucket_id: "generated-resumes" }]);
  } finally {
    await db.close();
  }
}, 120_000);
