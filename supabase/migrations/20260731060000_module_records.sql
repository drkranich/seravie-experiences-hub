-- Registros genéricos por página do Experience OS: dá função real a toda
-- subpágina (antes placeholder). Escopo por tenant + chave da página.
create table if not exists public.module_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  page_key text not null,
  title text not null,
  notes text,
  status text not null default 'open',
  data jsonb default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_module_records_tenant_page on public.module_records(tenant_id, page_key);
grant select, insert, update, delete on public.module_records to anon, authenticated, service_role;
alter table public.module_records enable row level security;
drop policy if exists module_records_tenant on public.module_records;
create policy module_records_tenant on public.module_records for all
  using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
