-- Restringe a gestão (admin) apenas ao super admin helvokhelvok@gmail.com.
-- Leitura pública (published = true) e envio público de contato permanecem abertos.

-- ===== contact_submissions (mantém insert público) =====
drop policy if exists contact_select_auth on public.contact_submissions;
drop policy if exists contact_update_auth on public.contact_submissions;
drop policy if exists contact_delete_auth on public.contact_submissions;

create policy contact_select_admin on public.contact_submissions
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy contact_update_admin on public.contact_submissions
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy contact_delete_admin on public.contact_submissions
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

-- ===== specialties =====
drop policy if exists specialties_select_auth on public.specialties;
drop policy if exists specialties_insert_auth on public.specialties;
drop policy if exists specialties_update_auth on public.specialties;
drop policy if exists specialties_delete_auth on public.specialties;

create policy specialties_select_admin on public.specialties
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy specialties_insert_admin on public.specialties
  for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy specialties_update_admin on public.specialties
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy specialties_delete_admin on public.specialties
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

-- ===== portfolio_items =====
drop policy if exists portfolio_select_auth on public.portfolio_items;
drop policy if exists portfolio_insert_auth on public.portfolio_items;
drop policy if exists portfolio_update_auth on public.portfolio_items;
drop policy if exists portfolio_delete_auth on public.portfolio_items;

create policy portfolio_select_admin on public.portfolio_items
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy portfolio_insert_admin on public.portfolio_items
  for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy portfolio_update_admin on public.portfolio_items
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy portfolio_delete_admin on public.portfolio_items
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

-- ===== sections =====
drop policy if exists sections_select_auth on public.sections;
drop policy if exists sections_insert_auth on public.sections;
drop policy if exists sections_update_auth on public.sections;
drop policy if exists sections_delete_auth on public.sections;

create policy sections_select_admin on public.sections
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy sections_insert_admin on public.sections
  for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy sections_update_admin on public.sections
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
create policy sections_delete_admin on public.sections
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');
