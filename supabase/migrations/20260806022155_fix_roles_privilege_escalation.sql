-- ============================================================
-- CORREÇÃO DE SEGURANÇA — escalonamento de privilégio via tabela `roles`.
--
-- Falha: a policy `roles_tenant_write` (cmd = ALL) permitia que QUALQUER
-- membro do tenant (não só admin) fizesse INSERT/UPDATE/DELETE em `roles`.
-- Um usuário comum podia então executar:
--     update roles set slug='super_admin', permissions='["*"]' where tenant_id = <seu tenant>;
-- e, como get_my_profile()/is_super_admin() derivam o papel do slug da role
-- vinculada, obter acesso de Super Admin. Signup self-service cria conta para
-- qualquer um — logo, "qualquer um entrava no super admin".
--
-- Correções:
--  1) Leitura de `roles` continua liberada para membros do tenant.
--  2) Escrita em `roles` passa a exigir papel de ADMIN do próprio tenant.
--  3) `super_admin` é papel de PLATAFORMA: ninguém (nem admin de tenant) pode
--     criar/renomear/alterar uma role com slug 'super_admin' via cliente.
--  4) Roles de sistema (is_system) não podem ser alteradas/excluídas via cliente.
--  5) Endurece funções auxiliares (search_path fixo) e substitui o is_admin()
--     legado (preso a um e-mail de outro projeto) por checagem baseada em papel.
-- ============================================================

-- ---------- Funções auxiliares de papel (SECURITY DEFINER, search_path fixo) ----------
-- is_tenant_admin(): usuário é admin OU super_admin (ativo) do próprio tenant.
create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and r.slug in ('admin', 'super_admin')
  );
$$;

-- Redefine is_admin() legado (estava amarrado a 'helvokhelvok@gmail.com',
-- e-mail de outro projeto — sempre falso aqui) para checagem por papel.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_tenant_admin();
$$;

-- Endurece funções existentes fixando o search_path (boa prática de segurança
-- para SECURITY DEFINER). Mantém a lógica idêntica.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.status = 'active' and r.slug = 'super_admin'
  );
$$;

-- ---------- Reescrever policies de `roles` ----------
alter table public.roles enable row level security;

drop policy if exists roles_tenant_write on public.roles;
drop policy if exists roles_member_read  on public.roles;

-- Leitura: qualquer membro ativo do tenant pode ler os papéis do tenant.
create policy roles_member_read on public.roles
  for select
  using (
    tenant_id in (
      select m.tenant_id from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
    )
  );

-- Criar papel: só ADMIN do tenant, dentro do próprio tenant, e NUNCA com
-- slug 'super_admin' (papel de plataforma) nem marcando is_system.
create policy roles_admin_insert on public.roles
  for insert
  with check (
    tenant_id = public.get_my_tenant_id()
    and public.is_tenant_admin()
    and slug <> 'super_admin'
    and coalesce(is_system, false) = false
  );

-- Editar papel: só ADMIN do tenant; não pode transformar em super_admin,
-- não pode editar papéis de sistema, e o alvo tem de continuar no tenant.
-- (Bloquear a LEITURA/USING para papéis super_admin/is_system impede também
--  que um admin comum os altere.)
create policy roles_admin_update on public.roles
  for update
  using (
    tenant_id = public.get_my_tenant_id()
    and public.is_tenant_admin()
    and slug <> 'super_admin'
    and coalesce(is_system, false) = false
  )
  with check (
    tenant_id = public.get_my_tenant_id()
    and slug <> 'super_admin'
    and coalesce(is_system, false) = false
  );

-- Excluir papel: só ADMIN do tenant; nunca super_admin nem papéis de sistema.
create policy roles_admin_delete on public.roles
  for delete
  using (
    tenant_id = public.get_my_tenant_id()
    and public.is_tenant_admin()
    and slug <> 'super_admin'
    and coalesce(is_system, false) = false
  );

-- ---------- Blindagem extra: gatilho contra escalonamento por slug ----------
-- Defesa em profundidade: mesmo que uma policy futura seja afrouxada, o
-- gatilho impede que qualquer sessão de cliente (authenticated) crie ou
-- promova uma role para 'super_admin'. A service role (edge functions /
-- provisionamento) NÃO é afetada, pois roda como 'service_role'.
create or replace function public.guard_role_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass confiável para provisionamento server-side. Verifica tanto o papel
  -- do JWT (auth.role) quanto o papel Postgres efetivo (service_role/postgres),
  -- cobrindo edge functions, MCP e migrations.
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('service_role', 'postgres', 'supabase_admin')
     or session_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.slug = 'super_admin' then
    raise exception 'super_admin é um papel de plataforma e não pode ser atribuído por clientes';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_role_privilege on public.roles;
create trigger trg_guard_role_privilege
  before insert or update on public.roles
  for each row execute function public.guard_role_privilege();

-- ---------- Blindar memberships (defesa em profundidade) ----------
-- Já não havia policy de escrita (só SELECT próprio), mas garantimos que RLS
-- está habilitada para que INSERT/UPDATE/DELETE de cliente permaneçam negados.
-- Escrita de membership continua exclusiva da service role (edge functions).
alter table public.memberships enable row level security;
