import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Gestão (super admin) do catálogo de comunidades sugeridas do Network.
// Grava em network_community_themes (RLS: escrita só super admin, leitura pública).

const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export function CommunityThemesAdmin({ notify }) {
  const { isSuperAdmin } = useTenant()
  const allowed = isSuperAdmin?.()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ name: '', category: '', description: '' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('network_community_themes').select('*').order('sort', { ascending: true })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    const name = form.name.trim()
    if (!name) return
    const slug = slugify(name)
    if (rows.some((r) => r.slug === slug)) return notify?.('Já existe uma comunidade com esse nome.', 'error')
    const nextSort = rows.reduce((mx, r) => Math.max(mx, r.sort || 0), 0) + 1
    const { data, error } = await supabase.from('network_community_themes').insert({ slug, name, category: form.category.trim() || null, description: form.description.trim() || null, sort: nextSort, active: true }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setRows((r) => [...r, data]); setForm({ name: '', category: '', description: '' }); notify?.('Comunidade adicionada ao catálogo', 'success')
  }
  const patch = async (id, patchObj) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patchObj } : x)))
    await supabase.from('network_community_themes').update(patchObj).eq('id', id)
  }
  const remove = async (id) => {
    setRows((r) => r.filter((x) => x.id !== id))
    await supabase.from('network_community_themes').delete().eq('id', id)
    notify?.('Removido do catálogo', 'success')
  }

  const cls = 'glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const filtered = useMemo(() => {
    const nq = q.toLowerCase()
    return rows.filter((r) => !nq || [r.name, r.category, r.description].join(' ').toLowerCase().includes(nq))
  }, [rows, q])
  const byCat = useMemo(() => filtered.reduce((acc, r) => { const k = r.category || 'Outras'; (acc[k] = acc[k] || []).push(r); return acc }, {}), [filtered])

  if (!allowed) return <div className="glass rounded-2xl p-12 text-center"><Icon name="ghost" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Área exclusiva do super admin da plataforma.</p></div>

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl text-admin-text">Comunidades do Ecossistema</h1>
          <p className="text-admin-muted/50 text-sm mt-1">Catálogo global de comunidades sugeridas no Network. Estas aparecem como sugestões para todos os tenants criarem em “Criar mais comunidades”.</p>
        </div>
        <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-56"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
      </div>

      <div className="glass rounded-2xl p-5 mb-5">
        <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Nova comunidade sugerida</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome (ex.: Sommelier & Vinhos)" className={cls} />
          <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Categoria (ex.: Hospitalidade & Gastronomia)" className={cls} />
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição curta" className={`${cls} sm:col-span-2`} />
        </div>
        <div className="flex justify-end mt-3"><button onClick={add} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Adicionar</button></div>
      </div>

      {loading ? <p className="text-admin-muted/40 text-sm py-8 text-center">Carregando…</p>
        : Object.keys(byCat).length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Nenhuma comunidade no catálogo.</p>
          : <div className="space-y-5">
              {Object.entries(byCat).map(([cat, list]) => (
                <div key={cat}>
                  <p className="text-[10px] uppercase tracking-wider text-admin-muted/45 mb-2">{cat} <span className="text-admin-muted/30">· {list.length}</span></p>
                  <div className="space-y-2">
                    {list.map((r) => (
                      <div key={r.id} className={`glass-input rounded-xl px-3 py-2.5 flex items-center gap-3 ${r.active ? '' : 'opacity-50'}`}>
                        <div className="flex-1 min-w-0">
                          <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} className="w-full bg-transparent text-sm text-admin-text outline-none" />
                          <input value={r.description || ''} onChange={(e) => patch(r.id, { description: e.target.value })} placeholder="Descrição…" className="w-full bg-transparent text-xs text-admin-muted/55 outline-none mt-0.5" />
                        </div>
                        <button onClick={() => patch(r.id, { active: !r.active })} className={`text-[10px] px-2 py-1 rounded-lg shrink-0 transition-colors ${r.active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.06] text-admin-muted/50'}`}>{r.active ? 'Ativo' : 'Inativo'}</button>
                        <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-admin-muted/50 hover:text-admin-rose hover:bg-white/[0.05] transition-colors shrink-0"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>}
    </div>
  )
}
