-- Admin do tenant pode editar o NOME da própria franquia (tenants.name), que
-- aparece na barra lateral sob "Seravie Experiences". Campos sensíveis
-- (slug, status, plan_id) ficam protegidos por trigger — só provisionamento
-- (service role) os altera. Escrita restrita a admin/super_admin do tenant.

drop policy if exists tenants_admin_update on public.tenants;
create policy tenants_admin_update on public.tenants
  for update
  using (id = get_my_tenant_id() and public.is_tenant_admin())
  with check (id = get_my_tenant_id() and public.is_tenant_admin());

-- PROTEGE campos sensíveis quando a sessão é de CLIENTE (auth.role in
-- authenticated/anon). Só isso distingue cliente de provisionamento de forma
-- confiável (current_user pode ser 'postgres' em ferramentas administrativas).
create or replace function public.guard_tenant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    new.slug := old.slug;
    new.status := old.status;
    new.plan_id := old.plan_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_tenant_update on public.tenants;
create trigger trg_guard_tenant_update
  before update on public.tenants
  for each row execute function public.guard_tenant_update();
