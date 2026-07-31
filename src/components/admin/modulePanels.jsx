import { ResourcePanel } from './ResourcePanel'

const STATUS3 = { draft: 'Rascunho', active: 'Ativo', archived: 'Arquivado' }

// ---- Conhecimento: Cursos ----
export function CoursesPanel({ notify }) {
  const LEVEL = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' }
  const STATUS = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' }
  return (
    <ResourcePanel notify={notify} module="knowledge" table="courses" title="Cursos" subtitle="cursos e treinamentos" icon="book" exportName="cursos"
      orderBy={{ column: 'created_at', ascending: false }}
      fields={[
        { key: 'title', label: 'Título', type: 'text', primary: true, required: true, full: true },
        { key: 'category', label: 'Categoria', type: 'text', chip: true },
        { key: 'level', label: 'Nível', type: 'select', options: LEVEL, default: 'beginner', chip: true, filter: true },
        { key: 'duration_minutes', label: 'Duração (min)', type: 'int', chip: true },
        { key: 'is_mandatory', label: 'Obrigatório', type: 'bool', chip: true },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'draft', filter: true },
        { key: 'cover_url', label: 'Capa (URL)', type: 'text', full: true },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Cursos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Publicados', calc: (r) => r.filter((x) => x.status === 'published').length, fmt: 'int' },
        { label: 'Obrigatórios', calc: (r) => r.filter((x) => x.is_mandatory).length, fmt: 'int' },
        { label: 'Carga total (h)', calc: (r) => Math.round(r.reduce((s, x) => s + (Number(x.duration_minutes) || 0), 0) / 60), fmt: 'int' },
      ]}
    />
  )
}

// ---- Marketing / E-commerce: Cupons ----
export function CouponsPanel({ notify }) {
  const TYPE = { percent: 'Percentual (%)', fixed: 'Valor fixo (R$)', free_shipping: 'Frete grátis' }
  return (
    <ResourcePanel notify={notify} module="marketing" table="coupons" title="Cupons" subtitle="cupons de desconto" icon="tag" exportName="cupons"
      orderBy={{ column: 'created_at', ascending: false }} inject={{ is_active: true }}
      fields={[
        { key: 'code', label: 'Código', type: 'text', primary: true, required: true, chip: true },
        { key: 'type', label: 'Tipo', type: 'select', options: TYPE, default: 'percent', chip: true, filter: true },
        { key: 'value', label: 'Valor', type: 'number' },
        { key: 'min_order', label: 'Pedido mínimo (R$)', type: 'currency' },
        { key: 'max_uses', label: 'Usos máximos', type: 'int' },
        { key: 'valid_from', label: 'Válido de', type: 'date' },
        { key: 'valid_until', label: 'Válido até', type: 'date' },
        { key: 'is_active', label: 'Ativo', type: 'bool' },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Cupons', calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativos', calc: (r) => r.filter((x) => x.is_active).length, fmt: 'int' },
        { label: 'Usos totais', calc: (r) => r.reduce((s, x) => s + (Number(x.used_count) || 0), 0), fmt: 'int' },
      ]}
    />
  )
}

// ---- Help Desk: SLA ----
export function SlaPanel({ notify }) {
  const PRIORITY = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' }
  return (
    <ResourcePanel notify={notify} module="helpdesk" table="sla_policies" title="Políticas de SLA" subtitle="políticas de atendimento" icon="check" exportName="sla"
      orderBy={{ column: 'created_at', ascending: false }} inject={{ is_active: true }}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
        { key: 'priority', label: 'Prioridade', type: 'select', options: PRIORITY, default: 'medium', chip: true, filter: true },
        { key: 'first_response_hours', label: '1ª resposta (h)', type: 'int', chip: true },
        { key: 'resolution_hours', label: 'Resolução (h)', type: 'int', chip: true },
        { key: 'business_hours_only', label: 'Só horário comercial', type: 'bool', chip: true },
        { key: 'is_active', label: 'Ativa', type: 'bool' },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Políticas', calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativas', calc: (r) => r.filter((x) => x.is_active).length, fmt: 'int' },
      ]}
    />
  )
}

// ---- Equipe / Financeiro: Metas ----
export function GoalsPanel({ notify }) {
  const TYPE = { sales: 'Vendas', revenue: 'Receita', customers: 'Clientes', tickets: 'Atendimentos', custom: 'Personalizada' }
  const STATUS = { active: 'Ativa', achieved: 'Atingida', missed: 'Não atingida' }
  const pct = (x) => (x.target_value ? Math.min(100, Math.round((Number(x.current_value) || 0) / Number(x.target_value) * 100)) : 0)
  return (
    <ResourcePanel notify={notify} module="team" table="goals" title="Metas" subtitle="metas e objetivos" icon="chart" exportName="metas"
      orderBy={{ column: 'created_at', ascending: false }} inject={{ status: 'active' }}
      fields={[
        { key: 'title', label: 'Título', type: 'text', primary: true, required: true, full: true },
        { key: 'type', label: 'Tipo', type: 'select', options: TYPE, default: 'sales', chip: true, filter: true },
        { key: 'target_value', label: 'Meta (alvo)', type: 'number' },
        { key: 'current_value', label: 'Realizado', type: 'number' },
        { key: 'period_start', label: 'Início', type: 'date' },
        { key: 'period_end', label: 'Fim', type: 'date' },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Metas', calc: (r) => r.length, fmt: 'int' },
        { label: 'Atingidas', calc: (r) => r.filter((x) => x.status === 'achieved').length, fmt: 'int' },
        { label: 'Progresso médio', calc: (r) => (r.length ? Math.round(r.reduce((s, x) => s + pct(x), 0) / r.length) : 0), fmt: 'int' },
      ]}
    />
  )
}

// ---- Operações: Equipamentos ----
export function EquipmentPanel({ notify }) {
  const STATUS = { active: 'Ativo', maintenance: 'Em manutenção', broken: 'Quebrado', retired: 'Baixado' }
  return (
    <ResourcePanel notify={notify} module="operations" table="equipment" title="Equipamentos" subtitle="equipamentos e ativos" icon="box" exportName="equipamentos"
      orderBy={{ column: 'name', ascending: true }} inject={{ status: 'active' }}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', primary: true, required: true, full: true },
        { key: 'model', label: 'Modelo', type: 'text', chip: true },
        { key: 'serial_number', label: 'Nº de série', type: 'text' },
        { key: 'category', label: 'Categoria', type: 'text', chip: true },
        { key: 'status', label: 'Status', type: 'status', options: STATUS, default: 'active', filter: true },
        { key: 'purchase_date', label: 'Compra', type: 'date' },
        { key: 'warranty_until', label: 'Garantia até', type: 'date' },
        { key: 'next_maintenance', label: 'Próx. manutenção', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Equipamentos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Em manutenção', calc: (r) => r.filter((x) => x.status === 'maintenance').length, fmt: 'int' },
        { label: 'Quebrados', calc: (r) => r.filter((x) => x.status === 'broken').length, fmt: 'int' },
      ]}
    />
  )
}
