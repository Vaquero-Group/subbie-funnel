-- ─────────────────────────────────────────────────────────────────────────
--  subbie_applications — schema + RLS
--  Already live in project bctfwsmwxmhsfhayvwhj (verified accepting inserts).
--  Kept here as source of truth / for rebuilding in a fresh project.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists subbie_applications (
  id              uuid primary key default gen_random_uuid(),
  name            text,
  phone           text,
  email           text,
  specialty       text[],
  experience      text,
  abn             text,
  insurance       text,
  whitecard       text,
  postcode        text,
  availability    text,
  reference       text,
  work_link       text,
  notes           text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  referrer        text,
  landing_url     text,
  submitted_at    timestamptz,
  created_at      timestamptz default now()
);

alter table subbie_applications enable row level security;

-- anon (the publishable key in the page) may INSERT only — never read/update/delete.
-- A leaked publishable key can write applications, not exfiltrate them.
drop policy if exists "anon can insert applications" on subbie_applications;
create policy "anon can insert applications"
  on subbie_applications for insert
  to anon
  with check (true);

-- Review applications via the dashboard, a service-role query, or a downstream
-- system holding the service-role key. No anon select/update/delete policies exist.
