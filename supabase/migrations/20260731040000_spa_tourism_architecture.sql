-- ============================================================
-- Frentes Spa, Turismo e Arquitetura: tabelas próprias.
-- ============================================================

create table if not exists public.spa_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, name text not null, category text, duration_min integer,
  price numeric default 0, description text, is_active boolean default true, created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, contact_id uuid, customer_name text, service text, professional text,
  date date, time text, status text not null default 'scheduled', notes text, created_at timestamptz not null default now()
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, name text not null, description text, type text,
  duration text, price numeric default 0, capacity integer, status text not null default 'active', created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, name text not null, client_name text, contact_id uuid,
  status text not null default 'briefing', budget numeric, start_date date, deadline date, notes text, created_at timestamptz not null default now()
);

create index if not exists idx_spa_services_tenant on public.spa_services(tenant_id);
create index if not exists idx_appointments_tenant on public.appointments(tenant_id, date);
create index if not exists idx_tours_tenant on public.tours(tenant_id);
create index if not exists idx_projects_tenant on public.projects(tenant_id);

grant select, insert, update, delete on public.spa_services to anon, authenticated, service_role;
grant select, insert, update, delete on public.appointments to anon, authenticated, service_role;
grant select, insert, update, delete on public.tours to anon, authenticated, service_role;
grant select, insert, update, delete on public.projects to anon, authenticated, service_role;

alter table public.spa_services enable row level security;
alter table public.appointments enable row level security;
alter table public.tours enable row level security;
alter table public.projects enable row level security;

drop policy if exists spa_services_tenant on public.spa_services;
create policy spa_services_tenant on public.spa_services for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
drop policy if exists appointments_tenant on public.appointments;
create policy appointments_tenant on public.appointments for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
drop policy if exists tours_tenant on public.tours;
create policy tours_tenant on public.tours for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
drop policy if exists projects_tenant on public.projects;
create policy projects_tenant on public.projects for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
