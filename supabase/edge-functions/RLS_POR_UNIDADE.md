# RLS por unidade — isolamento do gerente por loja

Migrações aplicadas: `unit_scoped_rls_helpers` e `unit_scoped_restrictive_policies`.

## Como funciona

Duas funções auxiliares no banco:

- **`get_my_unit_id()`** — retorna o `unit_id` da membership ativa do usuário.
  Se for **NULL**, o usuário é dono/admin da rede (vê tudo).
- **`can_see_unit(row_unit)`** — regra central:
  - membership sem unidade (dono/admin) → vê tudo;
  - linha sem unidade (`unit_id` NULL) → visível a todos do tenant;
  - gerente com unidade → só enxerga/edita linhas da **própria unidade**.

Sobre 18 tabelas operacionais foi criada uma política **RESTRICTIVE**
`unit_scope_restrict` que faz **AND** com as políticas de tenant já existentes.
Isso significa que o isolamento por unidade **estreita** o acesso do gerente sem
afetar o dono da rede.

Tabelas cobertas: orders, contacts, conversations, cash_sessions,
financial_entries, tickets, employees, schedules, incidents, goals, audits,
checklists, checklist_responses, equipment, events, nonconformities,
action_plans, vm_executions.

## Efeito prático

| Quem | unit_id da membership | O que vê |
|------|----------------------|----------|
| Dono / admin da rede | NULL | Todas as unidades (visão consolidada) |
| Gerente da Loja A | (id da Loja A) | Só dados da Loja A + linhas sem unidade |
| Gerente da Loja A tentando ver Loja B | — | Bloqueado pela RLS |

## Importante

- As memberships existentes estão com `unit_id` NULL — **ninguém perdeu acesso**.
  O isolamento só passa a valer para gerentes convidados com uma unidade específica
  (botão "Convidar gerente" na aba Rede & Unidades).
- Para novas tabelas com `unit_id` que precisem do mesmo isolamento, basta criar a
  mesma política restritiva:
  ```sql
  create policy unit_scope_restrict on public.<tabela> as restrictive for all
    using (public.can_see_unit(unit_id))
    with check (public.can_see_unit(unit_id));
  ```
