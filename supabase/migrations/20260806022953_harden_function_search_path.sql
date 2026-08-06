-- ============================================================
-- ENDURECIMENTO — fixar search_path das funções helper SECURITY DEFINER.
--
-- Sem `search_path` fixo, uma sessão que manipule o search_path poderia
-- desviar a resolução de nomes de tabela/função dentro de funções
-- SECURITY DEFINER (que rodam com privilégios do dono). Todas estas funções
-- já qualificam os objetos com `public.`, então fixar o search_path não altera
-- o comportamento — apenas remove o WARN do linter e fecha o vetor.
--
-- Lógica preservada byte a byte; muda-se apenas a cláusula `SET search_path`.
-- ============================================================

create or replace function public.get_my_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  SELECT tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  SELECT r.slug
  FROM public.memberships m
  JOIN public.roles r ON r.id = m.role_id
  WHERE m.user_id = auth.uid() AND m.status = 'active'
  LIMIT 1;
$$;

create or replace function public.get_my_profile()
returns jsonb language sql stable security definer set search_path = public as $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'tenant_id', t.id,
    'tenant_name', t.name,
    'tenant_slug', t.slug,
    'tenant_logo', t.logo_url,
    'tenant_color', t.primary_color,
    'role_slug', r.slug,
    'role_name', r.name,
    'permissions', r.permissions,
    'modules', (
      SELECT jsonb_agg(mo.slug)
      FROM public.tenant_modules tm
      JOIN public.modules mo ON mo.id = tm.module_id
      WHERE tm.tenant_id = t.id
    ),
    'membership_status', m.status
  )
  FROM public.memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  JOIN public.roles r ON r.id = m.role_id
  WHERE m.user_id = auth.uid() AND m.status = 'active'
  LIMIT 1;
$$;

create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.status = 'active'
      and (r.permissions ? '*' or r.permissions ? p or r.slug in ('super_admin','admin'))
  );
$$;

create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND (
        r.permissions @> '["*"]'::jsonb
        OR r.permissions @> jsonb_build_array(perm)
      )
  );
$$;

create or replace function public.can_edit(module text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm('edit:' || module) or public.has_perm('manage:' || module);
$$;

create or replace function public.can_delete(module text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm('manage:' || module);
$$;
