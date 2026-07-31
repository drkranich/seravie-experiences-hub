import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon, GlassSelect } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

const ACTIONS = { create: 'Criação', update: 'Edição', delete: 'Exclusão', login: 'Login', logout: 'Logout', password_change: 'Troca de senha', export: 'Exportação' }
const ACTION_STYLE = { create: 'bg-admin-sage/10 text-admin-sage', update: 'bg-admin-champ/10 text-admin-champ', delete: 'bg-admin-rose/10 text-admin-rose', login: 'bg-admin-gold/10 text-admin-gold', logout: 'bg-white/[0.05] text-admin-muted', password_change: 'bg-admin-champ/10 text-admin-champ', export: 'bg-white/[0.05] text-admin-muted' }
const RESOURCE_LABELS = {
  products: 'Produtos', contacts: 'Contatos', financial_entries: 'Financeiro', gift_items: 'Presentes',
  chocolate_kits: 'Chocolate · Kits', chocolate_lines: 'Chocolate · Linhas', coffee_menu: 'Café · Cardápio',
  wine_labels: 'Vinhos', hampers: 'Cestas & Kits', spa_services: 'Spa · Serviços', appointments: 'Agenda',
  tours: 'Turismo', projects: 'Arquitetura', events: 'Eventos', suppliers: 'Fornecedores', pairings: 'Harmonizações', roles: 'Perfis',
  auth: 'Autenticação', invitations: 'Convites', plans: 'Planos', agenda_notes: 'Agenda', coupons: 'Cupons', courses: 'Cursos', sla_policies: 'SLA', goals: 'Metas', equipment: 'Equipamentos',
}
const resLabel = (r) => RESOURCE_LABELS[r] || r

export function AuditLogPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [fAction, setFAction] = useState('')
  const [fResource, setFResource] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      setLogs(data || []); setLoading(false)
    })()
  }, [])

  const resources = useMemo(() => [...new Set(logs.map((l) => l.resource_type).filter(Boolean))], [logs])
  const filtered = logs.filter((l) => (!fAction || l.action === fAction) && (!fResource || l.resource_type === fResource))

  const nameOf = (l) => l.new_data?.name || l.new_data?.title || l.old_data?.name || l.old_data?.title || l.resource_id || '—'
  const exportRows = () => filtered.map((l) => ({
    'Data/hora': l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : '',
    Ação: ACTIONS[l.action] || l.action,
    Módulo: resLabel(l.resource_type),
    Registro: nameOf(l),
    Usuário: l.user_id ? l.user_id.slice(0, 8) : 'sistema',
  }))

  const counts = { total: logs.length, create: logs.filter((l) => l.action === 'create').length, update: logs.filter((l) => l.action === 'update').length, delete: logs.filter((l) => l.action === 'delete').length }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Auditoria</h1><p className="text-admin-muted/60 text-sm mt-1">Trilha de ações · {logs.length} registros</p></div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv('auditoria.csv', exportRows()) || null} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf('Auditoria', exportRows()) || null} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>

      <div className="grid gap-3 mb-6 sm:grid-cols-4">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Total</p><p className="text-admin-champ text-2xl font-medium">{counts.total}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Criações</p><p className="text-admin-sage text-2xl font-medium">{counts.create}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Edições</p><p className="text-admin-champ text-2xl font-medium">{counts.update}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Exclusões</p><p className="text-admin-rose text-2xl font-medium">{counts.delete}</p></div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="min-w-44"><GlassSelect value={fAction} onChange={setFAction} options={[{ value: '', label: 'Todas as ações' }, ...Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))]} /></div>
        <div className="min-w-44"><GlassSelect value={fResource} onChange={setFResource} options={[{ value: '', label: 'Todos os módulos' }, ...resources.map((r) => ({ value: r, label: resLabel(r) }))]} /></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="check" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">{logs.length === 0 ? 'Nenhuma ação registrada ainda. A trilha passa a gravar conforme a equipe cria, edita e exclui registros.' : 'Nada encontrado com esses filtros'}</p></div>
        ) : (
          <div className="space-y-2">
            {filtered.map((l) => (
              <div key={l.id} className="glass rounded-xl px-5 py-3">
                <button onClick={() => setOpen(open === l.id ? null : l.id)} className="w-full flex items-center gap-4 text-left">
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg shrink-0 ${ACTION_STYLE[l.action] || 'bg-white/[0.05] text-admin-muted'}`}>{ACTIONS[l.action] || l.action}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-admin-text text-sm truncate">{nameOf(l)} <span className="text-admin-muted/40">· {resLabel(l.resource_type)}</span></p>
                    <p className="text-admin-muted/40 text-xs mt-0.5">{l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : ''}{l.user_id ? ` · usuário ${l.user_id.slice(0, 8)}` : ' · sistema'}</p>
                  </div>
                  {(l.old_data || l.new_data) && <Icon name={open === l.id ? 'up' : 'down'} className="w-4 h-4 text-admin-muted/40 shrink-0" />}
                </button>
                {open === l.id && (l.old_data || l.new_data) && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] grid sm:grid-cols-2 gap-3">
                    {l.old_data && <div><p className="text-[10px] uppercase tracking-wider text-admin-rose/70 mb-1">Antes</p><pre className="text-[11px] text-admin-muted/60 whitespace-pre-wrap break-all glass-soft rounded-lg p-2 max-h-48 overflow-y-auto">{JSON.stringify(l.old_data, null, 1)}</pre></div>}
                    {l.new_data && <div><p className="text-[10px] uppercase tracking-wider text-admin-sage/70 mb-1">Depois</p><pre className="text-[11px] text-admin-muted/60 whitespace-pre-wrap break-all glass-soft rounded-lg p-2 max-h-48 overflow-y-auto">{JSON.stringify(l.new_data, null, 1)}</pre></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
