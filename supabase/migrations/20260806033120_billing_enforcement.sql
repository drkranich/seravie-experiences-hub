-- ============================================================
-- Billing real: enforcement de limites de plano.
--
-- check_plan_limit(resource) → jsonb { allowed, used, limit, plan }
-- Compara o uso atual do tenant (contagem na tabela do recurso) com o limite
-- definido em plans.limits (JSON). Sem assinatura/limite → permitido (ilimitado).
-- Usada pelo front antes de criar unidades, usuários, produtos, etc., e pode
-- ser reforçada por policies/triggers no futuro.
-- ============================================================

create or replace function public.check_plan_limit(p_resource text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := get_my_tenant_id();
  v_limit int;
  v_used int := 0;
  v_plan text;
begin
  if v_tenant is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_tenant');
  end if;

  -- limite do plano vigente do tenant
  select p.name, nullif((p.limits ->> p_resource), '')::int
    into v_plan, v_limit
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.tenant_id = v_tenant and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  -- sem plano ou sem limite definido para o recurso → ilimitado
  if v_limit is null then
    return jsonb_build_object('allowed', true, 'limit', null, 'plan', coalesce(v_plan, 'sem plano'));
  end if;

  -- uso atual conforme o recurso
  if p_resource = 'units' then
    select count(*) into v_used from public.units where tenant_id = v_tenant;
  elsif p_resource = 'users' then
    select count(*) into v_used from public.memberships where tenant_id = v_tenant and status = 'active';
  elsif p_resource = 'products' then
    select count(*) into v_used from public.products where tenant_id = v_tenant;
  elsif p_resource = 'flow_points' then
    select count(*) into v_used from public.flow_points where tenant_id = v_tenant;
  else
    v_used := 0;
  end if;

  return jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'limit', v_limit,
    'plan', v_plan
  );
end;
$$;
