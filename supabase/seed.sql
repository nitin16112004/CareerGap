-- Local defaults for plans and resume templates.
-- Job roles and skills are applied through the catalog migration.

insert into public.plans (
  plan_name,
  plan_slug,
  description,
  price_monthly,
  price_yearly,
  currency,
  resume_upload_limit,
  roadmap_generation_limit,
  ats_resume_generation_limit,
  ai_chat_limit
)
values
  ('Free', 'free', 'Starter plan for validating resume-first career guidance.', 0, 0, 'INR', 1, 2, 1, 0),
  ('Pro', 'pro', 'Higher limits for active job seekers.', 499, 4990, 'INR', 10, 20, 10, 100),
  ('Premium', 'premium', 'Advanced career platform access for power users.', 999, 9990, 'INR', 25, 50, 25, 500)
on conflict (plan_slug) do update
set
  plan_name = excluded.plan_name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  currency = excluded.currency,
  resume_upload_limit = excluded.resume_upload_limit,
  roadmap_generation_limit = excluded.roadmap_generation_limit,
  ats_resume_generation_limit = excluded.ats_resume_generation_limit,
  ai_chat_limit = excluded.ai_chat_limit,
  is_active = true;

insert into public.resume_templates (
  template_name,
  template_slug,
  description,
  preview_image_url,
  is_premium,
  is_active
)
values
  ('Basic ATS', 'basic-ats', 'Simple single-column ATS-friendly resume template.', null, false, true),
  ('Modern ATS', 'modern-ats', 'Clean two-section resume template for technical profiles.', null, false, true),
  ('Developer ATS', 'developer-ats', 'Developer-focused ATS layout for technical projects and skills.', null, false, true),
  ('Premium Focus', 'premium-focus', 'Premium layout for role-targeted resume versions.', null, true, true)
on conflict (template_slug) do update
set
  template_name = excluded.template_name,
  description = excluded.description,
  preview_image_url = excluded.preview_image_url,
  is_premium = excluded.is_premium,
  is_active = excluded.is_active;
