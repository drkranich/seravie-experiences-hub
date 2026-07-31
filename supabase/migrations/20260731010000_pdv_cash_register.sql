-- ============================================================
-- PDV / Ponto de Venda + Controle de Caixa (multi-tenant)
-- Reaproveita products / orders / financial_entries existentes.
-- Adiciona sessões de caixa, movimentos e vínculo com pedidos.
-- ============================================================

-- Sessão de caixa (abertura/fechamento por operador/unidade)
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  unit_id uuid,
  opening_amount numeric not null default 0,
  closing_amount numeric,
  expected_amount numeric,
  difference numeric,
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  opened_by uuid,
  closed_by uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Movimentos de caixa: venda, suprimento (deposit), sangria (withdrawal), abertura, ajuste
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  type text not null check (type in ('sale','deposit','withdrawal','opening','adjustment')),
  amount numeric not null default 0,
  payment_method text,
  description text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Vínculo das vendas de PDV com a sessão de caixa + valores pagos/troco
alter table public.orders add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;
alter table public.orders add column if not exists paid_amount numeric;
alter table public.orders add column if not exists change_amount numeric;

create index if not exists idx_cash_sessions_tenant on public.cash_sessions(tenant_id, status);
create index if not exists idx_cash_movements_session on public.cash_movements(session_id);
create index if not exists idx_cash_movements_tenant on public.cash_movements(tenant_id);
create index if not exists idx_orders_cash_session on public.orders(cash_session_id);

-- Grants (mesmo padrão das demais tabelas)
grant select, insert, update, delete on public.cash_sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.cash_movements to anon, authenticated, service_role;

-- RLS multi-tenant (mesmo padrão: tenant_id = get_my_tenant_id())
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

drop policy if exists cash_sessions_tenant on public.cash_sessions;
create policy cash_sessions_tenant on public.cash_sessions for all
  using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());

drop policy if exists cash_movements_tenant on public.cash_movements;
create policy cash_movements_tenant on public.cash_movements for all
  using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());
