import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const STATUS_COLORS = { active:'text-admin-sage', inactive:'text-admin-muted/40', vacation:'text-admin-gold', terminated:'text-admin-rose' }
const STATUS_LABELS = { active:'Ativo', inactive:'Inativo', vacation:'Férias', terminated:'Desligado' }

export function TeamPanel({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '', department: '', status: 'active', hire_date: '' })
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState({ title: '', type: 'sales', target_value: '', period_start: '', period_end: '' })
  const [filterStatus, setFilterStatus] = useState('')

  const loadEmployees = async () => {
    setLoading(true)
    let q = supabase.from('employees').select('*').order('name')
    if (filterStatus) q = q.eq('status', filterStatus)
    const { data } = await q
    setEmployees(data || [])
    setLoading(false)
  }

  const loadGoals = async () => {
    setLoading(true)
    const { data } = await supabase.from('goals').select('*, employees(name)').order('created_at', { ascending: false }).limit(50)
    setGoals(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'employees') loadEmployees()
    else if (tab === 'goals') loadGoals()
  }, [tab, filterStatus])

  const saveEmployee = async () => {
    if (!form.name.trim()) { notify('Nome obrigatório', 'error'); return }
    const { error } = await supabase.from('employees').insert({ ...form, tenant_id: profile?.tenant_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Colaborador adicionado', 'success')
    setShowForm(false)
    setForm({ name: '', email: '', phone: '', role: '', department: '', status: 'active', hire_date: '' })
    loadEmployees()
  }

  const saveGoal = async () => {
    if (!goalForm.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('goals').insert({ ...goalForm, tenant_id: profile?.tenant_id, target_value: parseFloat(goalForm.target_value) || 0 })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Meta criada', 'success')
    setShowGoalForm(false)
    setGoalForm({ title: '', type: 'sales', target_value: '', period_start: '', period_end: '' })
    loadGoals()
  }

  const removeEmployee = async (id) => {
    if (!confirm('Remover colaborador?')) return
    await supabase.from('employees').delete().eq('id', id)
    notify('Removido', 'success'); loadEmployees()
  }

  const progressColor = (pct) => pct >= 100 ? 'bg-admin-sage' : pct >= 60 ? 'bg-admin-gold' : 'bg-admin-rose/60'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Equipe</h1>
          <p className="text-admin-muted/60 text-sm mt-1">{employees.length} colaboradores</p>
        </div>
        <div className="flex gap-2">
          {tab === 'employees' && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">
              <Icon name="spark" className="w-4 h-4" />Novo colaborador
            </button>
          )}
          {tab === 'goals' && (
            <button onClick={() => setShowGoalForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">
              <Icon name="spark" className="w-4 h-4" />Nova meta
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['employees','Colaboradores'],['goals','Metas']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            {v}
          </button>
        ))}
      </div>

      {tab === 'employees' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {Object.entries(STATUS_LABELS).map(([k,v]) => (
              <button key={k} onClick={() => setFilterStatus(k === filterStatus ? '' : k)}
                className={`text-[10px] px-3 py-1.5 rounded-lg transition-colors ${filterStatus === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/50 hover:text-admin-muted border border-white/[0.06]'}`}>
                {v}
              </button>
            ))}
          </div>
          {loading
            ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : employees.length === 0
              ? <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum colaborador</p></div>
              : <div className="grid gap-2">
                  {employees.map(e => (
                    <div key={e.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4 group">
                      <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0">
                        <span className="text-admin-champ font-serif text-sm">{e.name[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-admin-text text-sm font-medium truncate">{e.name}</p>
                        <p className="text-admin-muted/50 text-xs">{[e.role, e.department].filter(Boolean).join(' · ') || e.email || '—'}</p>
                      </div>
                      <span className={`text-[10px] hidden sm:block ${STATUS_COLORS[e.status]}`}>{STATUS_LABELS[e.status]}</span>
                      {e.hire_date && <span className="text-[10px] text-admin-muted/30 hidden md:block">{new Date(e.hire_date).toLocaleDateString('pt-BR')}</span>}
                      <button onClick={() => removeEmployee(e.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-admin-rose text-admin-muted transition-all rounded-lg hover:bg-white/[0.05]">
                        <Icon name="x" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
          }
        </>
      )}

      {tab === 'goals' && (
        <div className="space-y-3">
          {loading
            ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : goals.length === 0
              ? <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/40 text-sm">Nenhuma meta cadastrada</p></div>
              : goals.map(g => {
                  const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0
                  return (
                    <div key={g.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-admin-text text-sm font-medium">{g.title}</p>
                          <p className="text-admin-muted/40 text-xs mt-0.5">{g.employees?.name || 'Geral'} · {g.type}</p>
                        </div>
                        <span className="text-admin-champ text-sm font-serif">{pct}%</span>
                      </div>
                      <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-admin-muted/40">{g.current_value} / {g.target_value}</span>
                        {g.period_end && <span className="text-[10px] text-admin-muted/30">Até {new Date(g.period_end).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                  )
                })
          }
        </div>
      )}

      {/* Modal colaborador */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Novo colaborador</h2>
              <button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">E-mail</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Telefone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cargo</label>
                  <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Atendente" />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Departamento</label>
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                    {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Admissão</label>
                  <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEmployee} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Adicionar</button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal meta */}
      {showGoalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Nova meta</h2>
              <button onClick={() => setShowGoalForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label>
                <input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Vendas mensais" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label>
                  <select value={goalForm.type} onChange={e => setGoalForm(f => ({ ...f, type: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                    {['sales','service','quality','attendance','custom'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor alvo</label>
                  <input type="number" value={goalForm.target_value} onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Início</label>
                  <input type="date" value={goalForm.period_start} onChange={e => setGoalForm(f => ({ ...f, period_start: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Fim</label>
                  <input type="date" value={goalForm.period_end} onChange={e => setGoalForm(f => ({ ...f, period_end: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveGoal} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar meta</button>
              <button onClick={() => setShowGoalForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
