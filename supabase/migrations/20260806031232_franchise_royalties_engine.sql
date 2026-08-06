-- ============================================================
-- Royalties & Faturamento de Rede — o coração que faltava para
-- "sistema de franquias" (não apenas multi-loja).
--
-- Modelo:
--   franchise_contracts  — contrato por unidade (taxa de royalty, fundo de
--                          marketing, vigência, franqueado)
--   unit_revenues        — faturamento reportado por unidade/mês
--   royalty_charges      — cobranças de royalty calculadas por período
-- Todas com RLS por tenant (a rede/franqueador).
-- ============================================================

create table if not exists public.franchise_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  unit_id uuid,
  unit_name text,
  franchisee_name text,
  royalty_pct numeric default 0,        -- % sobre faturamento
  marketing_fund_pct numeric default 0, -- % fundo de propaganda
  fixed_fee numeric default 0,          -- taxa fixa mensal (se houver)
  start_date date,
  end_date date,
  status text not null default 'active', -- active | suspended | ended
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_fcontracts_tenant on public.franchise_contracts (tenant_id);

create table if not exists public.unit_revenues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  unit_id uuid,
  unit_name text,
  period text not null,                 -- 'YYYY-MM'
  gross_revenue numeric not null default 0,
  source text default 'manual',         -- manual | pdv | import
  created_at timestamptz not null default now()
);
create index if not exists idx_urev_tenant on public.unit_revenues (tenant_id, period);
create unique index if not exists idx_urev_unit_period on public.unit_revenues (tenant_id, unit_id, period);

create table if not exists public.royalty_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  contract_id uuid references public.franchise_contracts (id) on delete set null,
  unit_id uuid,
  unit_name text,
  period text not null,
  gross_revenue numeric default 0,
  royalty_amount numeric default 0,
  marketing_amount numeric default 0,
  fixed_amount numeric default 0,
  total_due numeric default 0,
  status text not null default 'pending', -- pending | paid | overdue | waived
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_royalty_tenant on public.royalty_charges (tenant_id, period);

-- Log de execução de automações (motor real registra aqui cada disparo)
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  automation_id uuid,
  trigger_event text,
  status text default 'success',        -- success | error | skipped
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_arun_tenant on public.automation_runs (tenant_id, created_at desc);

-- ---------- Função: calcular royalties de um período a partir dos faturamentos ----------
-- Gera/atualiza royalty_charges cruzando unit_revenues x franchise_contracts.
-- Chamável via RPC pelo painel (SECURITY DEFINER, escopo do tenant do chamador).
create or replace function public.compute_royalties(p_period text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := get_my_tenant_id();
  v_count integer := 0;
  r record;
begin
  if v_tenant is null then raise exception 'sem tenant'; end if;
  for r in
    select ur.unit_id, ur.unit_name, ur.gross_revenue,
           c.id as contract_id, coalesce(c.royalty_pct,0) rp, coalesce(c.marketing_fund_pct,0) mp, coalesce(c.fixed_fee,0) ff
    from public.unit_revenues ur
    left join public.franchise_contracts c
      on c.tenant_id = ur.tenant_id and c.unit_id = ur.unit_id and c.status = 'active'
    where ur.tenant_id = v_tenant and ur.period = p_period
  loop
    delete from public.royalty_charges where tenant_id = v_tenant and unit_id = r.unit_id and period = p_period;
    insert into public.royalty_charges (tenant_id, contract_id, unit_id, unit_name, period, gross_revenue,
      royalty_amount, marketing_amount, fixed_amount, total_due, status, due_date)
    values (v_tenant, r.contract_id, r.unit_id, r.unit_name, p_period, r.gross_revenue,
      round(r.gross_revenue * r.rp / 100.0, 2), round(r.gross_revenue * r.mp / 100.0, 2), r.ff,
      round(r.gross_revenue * r.rp / 100.0, 2) + round(r.gross_revenue * r.mp / 100.0, 2) + r.ff,
      'pending', (to_date(p_period || '-01','YYYY-MM-DD') + interval '1 month' + interval '9 days')::date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------- RLS ----------
alter table public.franchise_contracts enable row level security;
alter table public.unit_revenues enable row level security;
alter table public.royalty_charges enable row level security;
alter table public.automation_runs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['franchise_contracts','unit_revenues','royalty_charges','automation_runs'] loop
    execute format('drop policy if exists %I_tenant on public.%I', t, t);
    execute format('create policy %I_tenant on public.%I for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id())', t, t);
  end loop;
end $$;
