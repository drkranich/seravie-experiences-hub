-- ============================================================
-- Paridade CPlug — food service + varejo, nativo no ecossistema Seravie.
--
-- Adiciona: KDS (cozinha), Mesas & Comandas, Emissão Fiscal (estrutura +
-- gateway), TEF (transações), e reforço de Delivery/Fidelidade.
--
-- Padrão de segurança do projeto: RLS por tenant via get_my_tenant_id();
-- leitura pública apenas onde o cliente anônimo precisa (cardápio/comanda).
-- ============================================================

-- ============================================================
-- KDS — Kitchen Display System
-- ============================================================

-- Estações de preparo (cozinha, bar, chapa, montagem…)
create table if not exists public.kds_stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  name text not null,
  color text default '#B89C61',
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_kds_stations_tenant on public.kds_stations (tenant_id);

-- Tickets da cozinha (um pedido/comanda vira 1+ tickets, por estação)
create table if not exists public.kds_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  station_id uuid references public.kds_stations (id) on delete set null,
  order_id uuid,            -- referência flexível (orders, flow_orders, tabs)
  source text default 'pos',-- pos | flow | delivery | tab
  reference text,           -- nº mesa/comanda/pedido para exibir
  items jsonb not null default '[]'::jsonb, -- [{name, qty, notes}]
  status text not null default 'queued',    -- queued | preparing | ready | delivered | cancelled
  notes text,
  priority integer default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz
);
create index if not exists idx_kds_tickets_tenant on public.kds_tickets (tenant_id, created_at desc);
create index if not exists idx_kds_tickets_station on public.kds_tickets (station_id);
create index if not exists idx_kds_tickets_status on public.kds_tickets (status);

-- ============================================================
-- MESAS & COMANDAS
-- ============================================================

-- Mesas físicas do salão
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  label text not null,          -- "Mesa 7", "Balcão 2"
  area text,                    -- "Salão", "Varanda", "Deck"
  seats integer default 2,
  status text not null default 'free', -- free | occupied | reserved | closing
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_tables_tenant on public.tables (tenant_id);

-- Comandas (conta aberta): acumula itens até o fechamento; permite dividir.
create table if not exists public.tabs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  table_id uuid references public.tables (id) on delete set null,
  code text not null default encode(gen_random_bytes(5), 'hex'), -- QR opcional da comanda
  label text,                   -- "Mesa 7" / nome do cliente
  status text not null default 'open',   -- open | closed | cancelled
  items jsonb not null default '[]'::jsonb, -- [{product_id,name,qty,unit_price,notes,station_id}]
  people integer default 1,     -- para dividir a conta
  subtotal numeric default 0,
  service_fee numeric default 0,-- taxa de serviço (10%)
  discount numeric default 0,
  total numeric default 0,
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  order_id uuid                 -- pedido gerado no fechamento (PDV)
);
create index if not exists idx_tabs_tenant on public.tabs (tenant_id, status);
create index if not exists idx_tabs_table on public.tabs (table_id);
create unique index if not exists idx_tabs_code on public.tabs (code);

-- ============================================================
-- EMISSÃO FISCAL (estrutura + integração com gateway)
-- ============================================================

-- Configuração fiscal por tenant (gateway, ambiente, emitente). Sem segredos
-- em texto puro no cliente: a chave/token do gateway fica em secret da edge
-- function (FISCAL_API_KEY). Aqui guardamos apenas parâmetros não sensíveis.
create table if not exists public.fiscal_settings (
  tenant_id uuid primary key default get_my_tenant_id(),
  provider text default 'plugnotas', -- plugnotas | focusnfe | nuvemfiscal | manual
  environment text default 'homologacao', -- homologacao | producao
  cnpj text,
  ie text,               -- inscrição estadual
  im text,               -- inscrição municipal
  legal_name text,       -- razão social
  trade_name text,       -- nome fantasia
  address jsonb default '{}'::jsonb,
  tax_regime text,       -- simples | presumido | real
  default_ncm text,
  default_cfop text,
  nfce_series text default '1',
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documentos fiscais emitidos (NFC-e / NF-e / SAT)
create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  order_id uuid,
  doc_type text not null default 'nfce', -- nfce | nfe | sat
  number text,
  series text,
  status text not null default 'pending', -- pending | authorized | rejected | cancelled | error
  access_key text,        -- chave de acesso (44 dígitos)
  protocol text,          -- protocolo de autorização
  provider_ref text,      -- id do documento no gateway
  amount numeric default 0,
  customer jsonb default '{}'::jsonb, -- {name, doc}
  items jsonb default '[]'::jsonb,
  danfe_url text,         -- link do PDF (DANFE)
  xml_url text,
  reject_reason text,
  created_at timestamptz not null default now(),
  authorized_at timestamptz
);
create index if not exists idx_fiscal_docs_tenant on public.fiscal_documents (tenant_id, created_at desc);
create index if not exists idx_fiscal_docs_order on public.fiscal_documents (order_id);

-- ============================================================
-- TEF — Transferência Eletrônica de Fundos (maquininha integrada)
-- ============================================================
create table if not exists public.tef_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  order_id uuid,
  provider text default 'sitef',  -- sitef | paygo | stone | cielo
  kind text default 'sale',       -- sale | refund
  method text,                    -- credito | debito | pix | voucher
  installments integer default 1,
  amount numeric not null default 0,
  status text not null default 'pending', -- pending | approved | declined | cancelled | error
  nsu text,                       -- número sequencial único
  authorization_code text,
  card_brand text,
  provider_ref text,
  message text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists idx_tef_tenant on public.tef_transactions (tenant_id, created_at desc);
create index if not exists idx_tef_order on public.tef_transactions (order_id);

-- ============================================================
-- DELIVERY — canais externos (iFood/Rappi/99Food) prontos p/ plugar
-- Reaproveita store_channels (credentials/settings) já existente.
-- Aqui só uma fila de pedidos vindos dos canais, unificada para o Hub.
-- ============================================================
create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  channel text not null default 'ifood', -- ifood | rappi | 99food | app | whatsapp
  external_id text,                       -- id do pedido no canal
  display_id text,                        -- código curto exibido
  customer_name text,
  customer_phone text,
  address jsonb default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric default 0,
  delivery_fee numeric default 0,
  total numeric default 0,
  status text not null default 'new',     -- new | confirmed | preparing | dispatched | delivered | cancelled
  payment_method text,
  payment_online boolean default true,
  eta_minutes integer,
  raw jsonb default '{}'::jsonb,           -- payload bruto do canal (auditoria)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_delivery_tenant on public.delivery_orders (tenant_id, created_at desc);
create index if not exists idx_delivery_status on public.delivery_orders (status);
create unique index if not exists idx_delivery_ext on public.delivery_orders (channel, external_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.kds_stations enable row level security;
alter table public.kds_tickets enable row level security;
alter table public.tables enable row level security;
alter table public.tabs enable row level security;
alter table public.fiscal_settings enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.tef_transactions enable row level security;
alter table public.delivery_orders enable row level security;

-- Tenant-only (padrão)
do $$
declare t text;
begin
  foreach t in array array[
    'kds_stations','kds_tickets','tables','fiscal_settings',
    'fiscal_documents','tef_transactions','delivery_orders'
  ] loop
    execute format('drop policy if exists %I_tenant on public.%I', t, t);
    execute format(
      'create policy %I_tenant on public.%I for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id())',
      t, t
    );
  end loop;
end $$;

-- tabs: escrita só do tenant; leitura pública por code (comanda via QR do cliente)
drop policy if exists tabs_tenant_write on public.tabs;
create policy tabs_tenant_write on public.tabs
  for all using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());

drop policy if exists tabs_public_read on public.tabs;
create policy tabs_public_read on public.tabs
  for select using (status = 'open' or tenant_id = get_my_tenant_id());
