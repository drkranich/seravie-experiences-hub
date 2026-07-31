import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

export function TeamPanel({ notify }) {
  const { profile } = useTenant()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', department: '', phone: '', email: '', status: 'active' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) { notify('Nome obrigatório', 'error'); return }
    const { error } = await supabase.from('employees').insert({ ...form, tenant_id: profile?.tenant_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Colaborador adicionado', 'success'); setShowForm(false); setForm({ name: '', role: '', department: '', phone: '', email: '', status: 'active' }); load()
  }

  const STATUS_COLORS = { active: 'text-admin-sage bg-admin-sage/10', inactive: 'text-admin-muted/40 bg-white/[0.04]', vacation: 'text-admin-gold bg-admin-gold/10', terminated: 'text-admin-rose bg-admin-rose/10' }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="font-serif text-4xl text-admin-text">Equipe</h1><p className="text-admin-muted/60 text-sm mt-1">{employees.length} colaboradores</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo colaborador</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? <p className="text-admin-muted/30 text-sm py-8 col-span-3 text-center">Carregando…</p>
          : employees.length === 0 ? <div className="glass rounded-2xl p-10 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhum colaborador</p></div>
          : employees.map(e => (
            <div key={e.id} className="glass rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><span className="text-admin-champ font-serif">{e.name[0]}</span></div>
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{e.name}</p><p className="text-admin-muted/50 text-xs truncate">{e.role || '—'}</p></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px]">{e.department}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg ${STATUS_COLORS[e.status]}`}>{e.status}</span>
              </div>
            </div>
          ))
        }
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Novo colaborador</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              {[['name','Nome *','text'],['role','Cargo','text'],['department','Departamento','text'],['email','E-mail','email'],['phone','Telefone','text']].map(([k,l,t]) => (
                <div key={k}><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{l}</label><input type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Adicionar</button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
