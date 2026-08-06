-- ============================================================
-- Planos modulares e combos.
-- - modules ganha preço avulso (mensal/anual) → assinar 1 módulo (ex: Seravie Hub).
-- - plans vira "combo": tipo (module | combo | franchise), lista de módulos,
--   modo de preço (sum | fixed) e desconto. Preço híbrido: soma automática dos
--   módulos, com override fixo por plano.
-- - custom_combos: combo montado pelo próprio cliente (self-service).
-- - automation_settings: config de agendador por tenant (horário do resumo diário).
-- ============================================================

alter table public.modules add column if not exists price_monthly numeric default 0;
alter table public.modules add column if not exists price_yearly numeric default 0;
alter table public.modules add column if not exists sellable boolean not null default true;
alter table public.modules add column if not exists stripe_price_monthly text;
alter table public.modules add column if not exists stripe_price_yearly text;

alter table public.plans add column if not exists plan_type text not null default 'combo';
alter table public.plans add column if not exists module_slugs jsonb default '[]'::jsonb;
alter table public.plans add column if not exists pricing_mode text not null default 'fixed';
alter table public.plans add column if not exists discount_pct numeric default 0;

create table if not exists public.custom_combos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default get_my_tenant_id(),
  name text default 'Meu combo',
  module_slugs jsonb not null default '[]'::jsonb,
  billing_cycle text default 'monthly',
  computed_price numeric default 0,
  status text not null default 'draft',
  provider_subscription_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_custom_combos_tenant on public.custom_combos (tenant_id);

create table if not exists public.automation_settings (
  tenant_id uuid primary key default get_my_tenant_id(),
  daily_hour_utc integer default 12,
  timezone text default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);

create or replace function public.plan_effective_price(p_plan_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_plan record; v_sum_m numeric := 0; v_sum_y numeric := 0; v_m numeric; v_y numeric;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then return jsonb_build_object('monthly', 0, 'yearly', 0); end if;
  select coalesce(sum(m.price_monthly),0), coalesce(sum(m.price_yearly),0) into v_sum_m, v_sum_y
    from public.modules m where m.slug in (select jsonb_array_elements_text(coalesce(v_plan.module_slugs, '[]'::jsonb)));
  if v_plan.pricing_mode = 'sum' then
    v_m := round(v_sum_m * (1 - coalesce(v_plan.discount_pct,0)/100.0), 2);
    v_y := round(v_sum_y * (1 - coalesce(v_plan.discount_pct,0)/100.0), 2);
  else v_m := coalesce(v_plan.price_monthly, 0); v_y := coalesce(v_plan.price_yearly, 0); end if;
  return jsonb_build_object('monthly', v_m, 'yearly', v_y, 'base_monthly', v_sum_m, 'base_yearly', v_sum_y);
end;
$$;

create or replace function public.combo_price(p_slugs jsonb, p_cycle text default 'monthly')
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when p_cycle = 'yearly' then m.price_yearly else m.price_monthly end), 0)
  from public.modules m
  where m.sellable = true and m.slug in (select jsonb_array_elements_text(coalesce(p_slugs, '[]'::jsonb)));
$$;

alter table public.custom_combos enable row level security;
alter table public.automation_settings enable row level security;

drop policy if exists custom_combos_tenant on public.custom_combos;
create policy custom_combos_tenant on public.custom_combos
  for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

drop policy if exists automation_settings_tenant on public.automation_settings;
create policy automation_settings_tenant on public.automation_settings
  for all using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

alter table public.modules enable row level security;
drop policy if exists modules_public_read on public.modules;
create policy modules_public_read on public.modules for select using (true);
