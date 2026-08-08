import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Gestão (super admin) da lista de "Tipos de profissional" do Network.
// Aparece no menu Sistema › Rede (Tipos de Profissional) somente para super_admin.
// Grava em network_person_types (RLS: escrita só super admin, leitura pública).

export function PersonTypesAdmin({ notify }) {
  const { isSuperAdmin } = useTenant()
  const allowed = isSuperAdmin?.()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('network_person_types').select('*').order('sort', { ascending: true })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    const label = novo.trim()
    if (!label) return
    const nextSort = (rows.reduce((mx, r) => Math.max(mx, r.sort || 0), 0)) + 1
    const { data, error } = await supabase.from('network_person_types').insert({ label, sort: nextSort, active: true }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setRows((r) => [...r, data]); setNovo(''); notify?.('Tipo adicionado', 'success')
  }
  const rename = async (id, label) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, label } : x)))
    await supabase.from('network_person_types').update({ label }).eq('id', id)
  }
  const toggle = async (row) => {
    const active = !row.active
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active } : x)))
    await supabase.from('network_person_types').update({ active }).eq('id', row.id)
  }
  const move = async (idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    next.forEach((r, i) => { r.sort = i + 1 })
    setRows(next)
    await Promise.all(next.map((r) => supabase.from('network_person_types').update({ sort: r.sort }).eq('id', r.id)))
  }
  const remove = async (id) => {
    setRows((r) => r.filter((x) => x.id !== id))
    await supabase.from('network_person_types').delete().eq('id', id)
    notify?.('Tipo removido', 'success')
  }

  if (!allowed) return <div className="glass rounded-2xl p-12 text-center"><Icon name="ghost" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Área exclusiva do super admin da plataforma.</p></div>

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-admin-text">Tipos de Profissional</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Lista usada no Network (briefings, banco de talentos, perfis). Define quais categorias os profissionais podem escolher em toda a plataforma.</p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Novo tipo (ex.: Paisagista)" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
          <button onClick={add} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Adicionar</button>
        </div>

        {loading ? <p className="text-admin-muted/40 text-sm py-8 text-center">Carregando…</p>
          : rows.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Nenhum tipo cadastrado.</p>
            : <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={r.id} className={`flex items-center gap-2 glass-input rounded-xl px-3 py-2 ${r.active ? '' : 'opacity-50'}`}>
                    <div className="flex flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-admin-muted/40 hover:text-admin-champ disabled:opacity-20 leading-none"><Icon name="up" className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-admin-muted/40 hover:text-admin-champ disabled:opacity-20 leading-none"><Icon name="down" className="w-3.5 h-3.5" /></button>
                    </div>
                    <input value={r.label} onChange={(e) => rename(r.id, e.target.value)} className="flex-1 bg-transparent text-sm text-admin-text outline-none" />
                    <button onClick={() => toggle(r)} className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${r.active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.06] text-admin-muted/50'}`}>{r.active ? 'Ativo' : 'Inativo'}</button>
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-admin-muted/50 hover:text-admin-rose hover:bg-white/[0.05] transition-colors"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>}
      </div>
    </div>
  )
}
