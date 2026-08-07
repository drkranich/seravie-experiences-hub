import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

// Permissões por operador: o responsável define quais abas do Seravie Cuisine
// cada funcionário pode acessar. allowed_tabs = null significa "todas".
export function KdsPermissions({ kind = 'kitchen', notify, allTabs = [] }) {
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null) // operador em edição

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('kds_operators').select('*').eq('kind', kind).order('sort_order')
    setOperators(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [kind])

  // abas que podem ser controladas (todas menos Permissões, para não travar o dono)
  const controllable = allTabs.filter((t) => t.key !== 'permissions')

  const openEdit = (o) => setEdit({ ...o, allowed: o.allowed_tabs == null ? controllable.map((t) => t.key) : o.allowed_tabs })
  const toggleTab = (key) => setEdit((e) => ({ ...e, allowed: e.allowed.includes(key) ? e.allowed.filter((k) => k !== key) : [...e.allowed, key] }))
  const setAll = (on) => setEdit((e) => ({ ...e, allowed: on ? controllable.map((t) => t.key) : [] }))
  const save = async () => {
    // se marcou todas, grava null (acesso total); senão grava a lista
    const isAll = controllable.every((t) => edit.allowed.includes(t.key))
    const { error } = await supabase.from('kds_operators').update({ allowed_tabs: isAll ? null : edit.allowed, email: edit.email || null }).eq('id', edit.id)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    notify?.('Permissões atualizadas', 'success'); setEdit(null); load()
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>

  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 text-[12px] text-admin-muted/70 leading-relaxed flex items-start gap-2">
        <Icon name="ghost" className="w-4 h-4 text-admin-champ shrink-0 mt-0.5" />
        <span>Defina quais abas do Seravie Cuisine cada funcionário pode acessar. Vincule o <b className="text-admin-champ">e-mail de login</b> do funcionário ao operador para que as permissões sejam aplicadas quando ele entrar. Sem restrição = acesso a todas as abas.</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {operators.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Cadastre operadores na aba Equipe primeiro.</p>}
        {operators.map((o) => {
          const all = o.allowed_tabs == null
          const count = all ? controllable.length : (o.allowed_tabs || []).length
          return (
            <div key={o.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${o.color || '#B89C61'}22` }}><Icon name="user" className="w-5 h-5" style={{ color: o.color || '#B89C61' }} /></div>
                <div className="min-w-0 flex-1"><p className="text-admin-text text-sm font-medium truncate">{o.name}</p><p className="text-admin-muted/50 text-[11px] truncate">{o.email || 'sem e-mail vinculado'}</p></div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] px-2 py-1 rounded-lg ${all ? 'bg-admin-sage/15 text-admin-sage' : 'bg-admin-champ/15 text-admin-champ'}`}>{all ? 'acesso total' : `${count} de ${controllable.length} abas`}</span>
                <button onClick={() => openEdit(o)} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Definir acesso</button>
              </div>
            </div>
          )
        })}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEdit(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Acesso · {edit.name}</h2><button onClick={() => setEdit(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

            <div className="mb-4"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">E-mail de login do funcionário</label><input value={edit.email || ''} onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="funcionario@email.com" /></div>

            <div className="flex items-center justify-between mb-2"><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Abas permitidas</p><div className="flex gap-2"><button onClick={() => setAll(true)} className="text-[10px] text-admin-sage hover:underline">todas</button><button onClick={() => setAll(false)} className="text-[10px] text-admin-rose hover:underline">nenhuma</button></div></div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {controllable.map((t) => {
                const on = edit.allowed.includes(t.key)
                return (
                  <button key={t.key} onClick={() => toggleTab(t.key)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${on ? 'bg-admin-champ/15 text-admin-champ ring-1 ring-admin-champ/30' : 'bg-white/[0.04] text-admin-muted/60'}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'border-admin-champ bg-admin-champ/20' : 'border-white/20'}`}>{on && <Icon name="check" className="w-3 h-3" />}</span>
                    <Icon name={t.icon} className="w-4 h-4 shrink-0" />{t.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Salvar permissões</button><button onClick={() => setEdit(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
