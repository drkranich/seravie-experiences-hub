-- Helper: super admin check (centraliza o e-mail num único lugar)
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$ select coalesce((auth.jwt() ->> 'email') = 'helvokhelvok@gmail.com', false) $$;

-- ================= Tabelas de conteúdo =================
create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  step_number text,
  title text not null,
  description text,
  icon text default 'spark',
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text default 'leaf',
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  quote text not null,
  avatar_url text,
  rating int,
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  bio text,
  photo_url text,
  instagram text,
  linkedin text,
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  body text,
  cover_image text,
  category text,
  tags text[] default '{}',
  author text,
  seo_title text,
  seo_description text,
  published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content jsonb default '{}'::jsonb,
  seo_title text,
  seo_description text,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text,
  url text not null,
  alt text,
  tags text[] default '{}',
  width int,
  height int,
  created_at timestamptz default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text default '#',
  location text default 'header',
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  confirmed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  namespace text default 'common',
  key text not null,
  locale text not null,
  value text,
  unique (namespace, key, locale)
);

-- ================= RLS: tabelas de conteúdo publicável =================
do $$
declare t text;
begin
  foreach t in array array['process_steps','segments','testimonials','faqs','team_members','posts','pages','menu_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (published = true)', t||'_public_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t||'_admin_all', t);
  end loop;
end $$;

-- ================= RLS: tabelas utilitárias (leitura pública livre) =================
do $$
declare t text;
begin
  foreach t in array array['media_assets','translations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t||'_public_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t||'_admin_all', t);
  end loop;
end $$;

-- ================= RLS: newsletter (inscrição pública, gestão admin) =================
alter table public.newsletter_subscribers enable row level security;
drop policy if exists newsletter_insert_public on public.newsletter_subscribers;
create policy newsletter_insert_public on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);
drop policy if exists newsletter_admin_all on public.newsletter_subscribers;
create policy newsletter_admin_all on public.newsletter_subscribers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ================= Seeds: processo e segmentos (migra do código) =================
insert into public.process_steps (step_number, title, description, icon, sort_order, published)
select * from (values
  ('01','Diagnóstico','Entendemos seu negócio, público e objetivos.','search',1,true),
  ('02','Conceito','Criamos um conceito autoral alinhado à sua marca.','spark',2,true),
  ('03','Storytelling','Construímos a narrativa visual que dará alma ao espaço.','book',3,true),
  ('04','Projeto','Desenvolvemos o projeto com cada detalhe planejado.','pen',4,true),
  ('05','Curadoria','Selecionamos materiais, fornecedores e acabamentos.','leaf',5,true),
  ('06','Implementação','Acompanhamos cada etapa até a entrega da experiência.','check',6,true)
) as v(step_number,title,description,icon,sort_order,published)
where not exists (select 1 from public.process_steps);

insert into public.segments (title, icon, sort_order, published)
select * from (values
  ('Cidades Históricas','building',1,true),
  ('Destinos Turísticos','map',2,true),
  ('Empórios Gourmet','cup',3,true),
  ('Cafeterias & Bistrôs','book',4,true),
  ('Pousadas & Hotéis','home',5,true),
  ('Vinícolas','wine',6,true),
  ('Fazendas Históricas','leaf',7,true),
  ('Marcas Artesanais','heart',8,true)
) as v(title,icon,sort_order,published)
where not exists (select 1 from public.segments);

-- ================= Seeds: páginas legais (rascunho) =================
insert into public.pages (slug, title, published)
select * from (values
  ('politica-de-privacidade','Política de Privacidade',false),
  ('termos-de-uso','Termos de Uso',false),
  ('cookies','Cookies',false)
) as v(slug,title,published)
where not exists (select 1 from public.pages);
