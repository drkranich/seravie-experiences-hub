-- ============ Storage bucket de mídia ============
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select to public
  using (bucket_id = 'media');

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

-- ============ Tabela de configurações do site ============
create table if not exists public.site_settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com');

insert into public.site_settings (id, data)
values (
  1,
  '{
    "brand": {"name": "Seravie", "suffix": "EXPERIENCES", "tagline": "Transformamos espaços em destinos memoráveis."},
    "social": {"instagram": "", "pinterest": ""},
    "footer_links": ["Política de Privacidade", "Termos de Uso", "Cookies", "Mapa do Site"],
    "seo": {"title": "Seravie Experiences", "description": "Transformamos espaços em destinos memoráveis."}
  }'::jsonb
)
on conflict (id) do nothing;

-- ============ Seed do hero (se ainda não existir) ============
insert into public.sections (key, title, content, published)
values (
  'hero',
  'Hero',
  '{"title": "Transformamos espaços em destinos memoráveis.", "subtitle": "Design de experiências que despertam emoções, fortalecem marcas e permanecem na memória.", "cta_text": "Solicitar avaliação"}'::jsonb,
  true
)
on conflict (key) do nothing;
