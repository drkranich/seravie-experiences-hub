-- ============================================================
-- Seravie Flow — vendas autônomas por QR Code.
-- Transforma qualquer espaço (quarto, mesa, frigobar, expositor…) em um
-- ponto de venda com catálogo próprio, carrinho e checkout.
--
-- Modelo:
--   flow_points   — pontos físicos com um code único (usado no QR /#flow/<code>)
--   flow_products — catálogo (global do tenant ou vinculado a um ponto)
--   flow_orders   — pedidos recebidos (cliente anônimo via QR)
--
-- RLS:
--   - Pontos e produtos ATIVOS têm leitura pública (necessário para a
--     página do QR funcionar sem login). Escrita e leitura de inativos:
--     apenas dentro do tenant.
--   - Pedidos: somente o tenant lê/gerencia (o insert do cliente anônimo
--     é feito pela edge function flow-order com a service role).
-- ============================================================

-- ---------- Pontos de venda (QR) ----------
create table if not exists public.flow_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  name text not null,
  kind text not null default 'mesa',
  code text not null unique default encode(gen_random_bytes(6), 'hex'),
  branch text,
  description text,
  cover_url text,
  active boolean not null default true,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_flow_points_tenant on public.flow_points (tenant_id);
create index if not exists idx_flow_points_code on public.flow_points (code);

-- ---------- Catálogo ----------
create table if not exists public.flow_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  point_id uuid references public.flow_points (id) on delete set null,
  name text not null,
  description text,
  category text,
  price numeric not null default 0,
  promo_price numeric,
  image_url text,
  video_url text,
  stock integer,
  min_stock integer,
  active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_flow_products_tenant on public.flow_products (tenant_id);
create index if not exists idx_flow_products_point on public.flow_products (point_id);

-- ---------- Pedidos ----------
create table if not exists public.flow_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  point_id uuid references public.flow_points (id) on delete set null,
  point_name text,
  reference text,
  customer_name text,
  items jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  discount numeric default 0,
  tip numeric default 0,
  total numeric default 0,
  coupon text,
  notes text,
  status text not null default 'pending',
  payment_method text,
  payment_status text not null default 'pending',
  provider_ref text,
  created_at timestamptz not null default now()
);

create index if not exists idx_flow_orders_tenant on public.flow_orders (tenant_id, created_at desc);
create index if not exists idx_flow_orders_point on public.flow_orders (point_id);

-- ---------- RLS ----------
alter table public.flow_points enable row level security;
alter table public.flow_products enable row level security;
alter table public.flow_orders enable row level security;

-- Pontos: leitura pública dos ativos (para o QR abrir sem login); resto só do tenant.
drop policy if exists flow_points_read on public.flow_points;
create policy flow_points_read on public.flow_points
  for select using (active = true or tenant_id = get_my_tenant_id());

drop policy if exists flow_points_write on public.flow_points;
create policy flow_points_write on public.flow_points
  for all using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());

-- Produtos: mesma lógica (catálogo público quando ativo).
drop policy if exists flow_products_read on public.flow_products;
create policy flow_products_read on public.flow_products
  for select using (active = true or tenant_id = get_my_tenant_id());

drop policy if exists flow_products_write on public.flow_products;
create policy flow_products_write on public.flow_products
  for all using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());

-- Pedidos: somente o tenant. (O insert do cliente anônimo passa pela
-- edge function flow-order, que usa a service role e ignora a RLS.)
drop policy if exists flow_orders_tenant on public.flow_orders;
create policy flow_orders_tenant on public.flow_orders
  for all using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());
