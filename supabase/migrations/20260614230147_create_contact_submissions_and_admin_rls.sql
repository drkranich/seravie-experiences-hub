-- 1. contact_submissions table (matches the app's expected shape)
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- Anyone (public form) may submit a contact message
create policy "contact_insert_public"
  on public.contact_submissions for insert
  to anon, authenticated
  with check (true);

-- Only authenticated (admin) may read / manage messages
create policy "contact_select_auth"
  on public.contact_submissions for select
  to authenticated using (true);

create policy "contact_update_auth"
  on public.contact_submissions for update
  to authenticated using (true) with check (true);

create policy "contact_delete_auth"
  on public.contact_submissions for delete
  to authenticated using (true);

-- 2. Admin (authenticated) write + full-read policies on content tables.
-- Existing "public_read_*" policies (published = true) for anon remain untouched.

-- specialties
create policy "specialties_select_auth" on public.specialties for select to authenticated using (true);
create policy "specialties_insert_auth" on public.specialties for insert to authenticated with check (true);
create policy "specialties_update_auth" on public.specialties for update to authenticated using (true) with check (true);
create policy "specialties_delete_auth" on public.specialties for delete to authenticated using (true);

-- portfolio_items
create policy "portfolio_select_auth" on public.portfolio_items for select to authenticated using (true);
create policy "portfolio_insert_auth" on public.portfolio_items for insert to authenticated with check (true);
create policy "portfolio_update_auth" on public.portfolio_items for update to authenticated using (true) with check (true);
create policy "portfolio_delete_auth" on public.portfolio_items for delete to authenticated using (true);

-- sections
create policy "sections_select_auth" on public.sections for select to authenticated using (true);
create policy "sections_insert_auth" on public.sections for insert to authenticated with check (true);
create policy "sections_update_auth" on public.sections for update to authenticated using (true) with check (true);
create policy "sections_delete_auth" on public.sections for delete to authenticated using (true);
