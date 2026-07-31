-- ============================================================
-- Empório Gourmet (e frentes afins): cestas/kits, harmonizações, fornecedores.
-- Tabelas reaproveitáveis por Empório, Cafeteria, Vinhos, Floricultura, etc.
-- ============================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  contact text,
  email text,
  phone text,
  category text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.hampers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  type text not null default 'cesta',
  description text,
  price numeric default 0,
  occasion text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.pairings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  title text not null,
  item_a text,
  item_b text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_suppliers_tenant on public.suppliers(tenant_id);
create index if not exists idx_hampers_tenant on public.hampers(tenant_id);
create index if not exists idx_pairings_tenant on public.pairings(tenant_id);

grant select, insert, update, delete on public.suppliers to anon, authenticated, service_role;
grant select, insert, update, delete on public.hampers to anon, authenticated, service_role;
grant select, insert, update, delete on public.pairings to anon, authenticated, service_role;

alter table public.suppliers enable row level security;
alter table public.hampers enable row level security;
alter table public.pairings enable row level security;

drop policy if exists suppliers_tenant on public.suppliers;
create policy suppliers_tenant on public.suppliers for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
drop policy if exists hampers_tenant on public.hampers;
create policy hampers_tenant on public.hampers for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
drop policy if exists pairings_tenant on public.pairings;
create policy pairings_tenant on public.pairings for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
