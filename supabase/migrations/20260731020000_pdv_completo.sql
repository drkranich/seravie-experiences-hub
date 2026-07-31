-- ============================================================
-- PDV completo: pagamentos múltiplos, comandas e estoque avançado
-- ============================================================

-- Pedidos: pagamentos múltiplos, cliente avulso e canal de venda
alter table public.orders add column if not exists payments jsonb;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists channel text default 'pdv';

-- Produtos: estoque mínimo (alerta)
alter table public.products add column if not exists min_stock integer default 0;

-- Comandas (vendas em espera / segurar-retomar)
create table if not exists public.pos_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  session_id uuid references public.cash_sessions(id) on delete set null,
  label text not null,
  items jsonb not null default '[]'::jsonb,
  discount numeric default 0,
  customer_name text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Movimentos de estoque (histórico por produto)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid references public.products(id) on delete cascade,
  type text not null check (type in ('sale','entry','adjustment','loss','return')),
  quantity integer not null,
  balance_after integer,
  reference_id uuid,
  reference_type text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_pos_holds_tenant on public.pos_holds(tenant_id);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_tenant on public.stock_movements(tenant_id);

grant select, insert, update, delete on public.pos_holds to anon, authenticated, service_role;
grant select, insert, update, delete on public.stock_movements to anon, authenticated, service_role;

alter table public.pos_holds enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists pos_holds_tenant on public.pos_holds;
create policy pos_holds_tenant on public.pos_holds for all
  using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

drop policy if exists stock_movements_tenant on public.stock_movements;
create policy stock_movements_tenant on public.stock_movements for all
  using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());
