-- Seravie Flow Studio — construtor de formulários/experiências cinematográficas.
create table if not exists public.flow_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  slug text not null default encode(gen_random_bytes(6), 'hex'),
  title text not null default 'Nova experiência',
  description text, theme jsonb not null default '{}'::jsonb, settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft', cover_url text,
  submit_message text default 'Recebemos sua resposta. Obrigado!',
  response_count integer not null default 0, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_flow_forms_tenant on public.flow_forms (tenant_id, created_at desc);
create unique index if not exists idx_flow_forms_slug on public.flow_forms (slug);

create table if not exists public.flow_form_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  form_id uuid not null references public.flow_forms (id) on delete cascade,
  type text not null, label text, help text, placeholder text, required boolean not null default false,
  options jsonb default '[]'::jsonb, config jsonb default '{}'::jsonb, sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_flow_blocks_form on public.flow_form_blocks (form_id, sort_order);
create index if not exists idx_flow_blocks_tenant on public.flow_form_blocks (tenant_id);

create table if not exists public.flow_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, form_id uuid not null references public.flow_forms (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb, meta jsonb default '{}'::jsonb,
  completed boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_flow_responses_form on public.flow_responses (form_id, created_at desc);
create index if not exists idx_flow_responses_tenant on public.flow_responses (tenant_id, created_at desc);

alter table public.flow_forms enable row level security;
alter table public.flow_form_blocks enable row level security;
alter table public.flow_responses enable row level security;

drop policy if exists flow_forms_read on public.flow_forms;
create policy flow_forms_read on public.flow_forms for select using (status = 'published' or tenant_id = get_my_tenant_id());
drop policy if exists flow_forms_write on public.flow_forms;
create policy flow_forms_write on public.flow_forms for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

drop policy if exists flow_blocks_read on public.flow_form_blocks;
create policy flow_blocks_read on public.flow_form_blocks for select using (tenant_id = get_my_tenant_id() or exists (select 1 from public.flow_forms f where f.id = form_id and f.status = 'published'));
drop policy if exists flow_blocks_write on public.flow_form_blocks;
create policy flow_blocks_write on public.flow_form_blocks for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

drop policy if exists flow_responses_tenant on public.flow_responses;
create policy flow_responses_tenant on public.flow_responses for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

create or replace function public.increment_flow_response(p_form uuid)
returns void language sql security definer set search_path = public as $$
  update public.flow_forms set response_count = response_count + 1, updated_at = now() where id = p_form;
$$;
