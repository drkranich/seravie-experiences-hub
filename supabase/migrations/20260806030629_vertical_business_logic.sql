-- ============================================================
-- Lógica de negócio própria por vertical (deixa de ser "catálogo genérico").
-- Tabelas enxutas que dão identidade real às 4 verticais órfãs e reforçam
-- verticais existentes. Todas com RLS por tenant.
--
-- Também: assinaturas de CLIENTE (clube) — usadas por vinhos/café/floricultura,
-- separadas da assinatura de SaaS.
-- ============================================================

-- Encomendas sob demanda (padaria, confeitaria, floricultura, chocolate)
create table if not exists public.custom_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  vertical text,                       -- bakery | floriculture | chocolate | craft…
  customer_name text not null,
  customer_phone text,
  description text,                    -- "bolo 2kg, chocolate, 20 velas"
  items jsonb default '[]'::jsonb,
  due_date date,                       -- data de retirada/entrega
  due_time text,
  occasion text,                       -- aniversário, casamento…
  message text,                        -- mensagem do cartão / presente
  delivery_type text default 'retirada', -- retirada | entrega
  address jsonb default '{}'::jsonb,
  amount numeric default 0,
  deposit numeric default 0,           -- sinal pago
  status text not null default 'orcamento', -- orcamento | confirmado | producao | pronto | entregue | cancelado
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_custom_orders_tenant on public.custom_orders (tenant_id, due_date);

-- Planos de clube / assinatura de CLIENTE (vinhos, café, chocolate, floricultura)
create table if not exists public.club_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  vertical text,
  name text not null,                  -- "Clube Prata", "Assinatura Mensal de Café"
  description text,
  cadence text default 'mensal',       -- mensal | bimestral | trimestral
  price numeric not null default 0,
  items_per_cycle integer default 1,
  perks jsonb default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_club_plans_tenant on public.club_plans (tenant_id);

-- Assinaturas de clientes a um plano de clube
create table if not exists public.club_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  plan_id uuid references public.club_plans (id) on delete set null,
  contact_id uuid,
  customer_name text,
  customer_email text,
  status text not null default 'active', -- active | paused | cancelled
  started_at date default now(),
  next_delivery date,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists idx_club_subs_tenant on public.club_subscriptions (tenant_id, status);

-- Recursos agendáveis (terapeuta de spa, guia/veículo de turismo, sala) —
-- base para agendamento com disponibilidade real.
create table if not exists public.bookable_resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  vertical text,                       -- spa | tourism | beauty | events
  name text not null,                  -- "Ana (massoterapeuta)", "Van 15 lugares"
  kind text default 'profissional',    -- profissional | sala | veiculo | equipamento
  capacity integer default 1,
  work_hours jsonb default '{}'::jsonb, -- {mon:["09:00","18:00"], ...}
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_bookable_tenant on public.bookable_resources (tenant_id);

-- ---------- RLS ----------
alter table public.custom_orders enable row level security;
alter table public.club_plans enable row level security;
alter table public.club_subscriptions enable row level security;
alter table public.bookable_resources enable row level security;

do $$
declare t text;
begin
  foreach t in array array['custom_orders','club_subscriptions','bookable_resources'] loop
    execute format('drop policy if exists %I_tenant on public.%I', t, t);
    execute format('create policy %I_tenant on public.%I for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id())', t, t);
  end loop;
end $$;

-- club_plans: leitura pública dos ativos (para a página de clube do cliente); escrita só do tenant
drop policy if exists club_plans_read on public.club_plans;
create policy club_plans_read on public.club_plans
  for select using (active = true or tenant_id = get_my_tenant_id());
drop policy if exists club_plans_write on public.club_plans;
create policy club_plans_write on public.club_plans
  for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
