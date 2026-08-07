import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { fmtMin } from '../../../lib/flowEngine'

// Cardápio de produção — itens que a cozinha produz, com tempo previsto e estação.
// Alimenta o autocompletar do editor de pedidos e as métricas de tempo esperado.
export function KdsMenu({ kind = 'kitchen', notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: m }, { data: st }] = await Promise.all([
      supabase.from('kds_menu').select('*').eq('kind', kind).order('sort_order').order('name'),
      supabase.from('kds_stations').select('id, name').eq('active', true).order('sort_order'),
    ])
    setRows(m || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load() }, [kind])

  const stName = (id) => stations.find((s) => s.id === id)?.name || '—'
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? rows.filter((r) => `${r.name} ${r.category} ${r.barcode || ''}`.toLowerCase().includes(q)) : rows
  }, [rows, search])
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))], [rows])

  const openNew = () => setModal({ name: '', category: '', station_id: '', prep_min: 10, price: '', barcode: '', active: true, kind })
  const save = async () => {
    if (!modal.name.trim()) return notify?.('Informe o nome', 'error')
    const payload = { name: modal.name.trim(), category: modal.category?.trim() || null, station_id: modal.station_id || null, prep_seconds: (Number(modal.prep_min) || 10) * 60, price: Number(modal.price) || 0, barcode: (modal.barcode || '').trim() || null, active: modal.active, kind, tenant_id: tenantId }
    const res = modal.id ? await supabase.from('kds_menu').update(payload).eq('id', modal.id) : await supabase.from('kds_menu').insert(payload)
    if (res.error) return notify?.('Erro ao salvar: ' + res.error.message, 'error')
    notify?.(modal.id ? 'Item atualizado' : 'Item criado', 'success'); setModal(null); load()
  }
  const toggle = async (r) => { await supabase.from('kds_menu').update({ active: !r.active }).eq('id', r.id); load() }
  const remove = async (r) => { if (confirm(`Remover "${r.name}"?`)) { await supabase.from('kds_menu').delete().eq('id', r.id); load() } }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando cardápio…</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo item</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhum item. Cadastre os produtos que a cozinha produz.</p>}
        {filtered.map((r) => (
          <div key={r.id} className={`glass rounded-2xl p-4 group relative ${r.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-admin-text text-sm font-medium truncate">{r.name}</p>
                <p className="text-admin-muted/50 text-[11px]">{r.category || 'sem categoria'}{r.price ? ` · R$ ${Number(r.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</p>
              </div>
              <button onClick={() => toggle(r)} className={`text-[10px] px-2 py-1 rounded-lg shrink-0 ${r.active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{r.active ? 'ativo' : 'inativo'}</button>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[11px] text-admin-muted/60 flex-wrap">
              <span className="flex items-center gap-1"><Icon name="clock" className="w-3.5 h-3.5" />{fmtMin(r.prep_seconds || 0)}</span>
              <span className="flex items-center gap-1"><Icon name="layers" className="w-3.5 h-3.5" />{stName(r.station_id)}</span>
              {r.barcode && <span className="flex items-center gap-1 font-mono text-admin-muted/40">{r.barcode}</span>}
            </div>
            <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setModal({ ...r, prep_min: Math.round((r.prep_seconds || 600) / 60), price: r.price || '' })} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose ml-auto" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{modal.id ? 'Editar item' : 'Novo item'}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome</label><input value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Burger Clássico" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Categoria</label><input value={modal.category || ''} onChange={(e) => setModal((m) => ({ ...m, category: e.target.value }))} list="kds-menu-cats" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Lanches" /><datalist id="kds-menu-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tempo (min)</label><input type="number" value={modal.prep_min} onChange={(e) => setModal((m) => ({ ...m, prep_min: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Preço (R$)</label><input type="number" step="0.01" value={modal.price} onChange={(e) => setModal((m) => ({ ...m, price: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="0,00" /></div>
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Estação padrão</label><GlassSelect value={modal.station_id || ''} onChange={(v) => setModal((m) => ({ ...m, station_id: v }))} options={[{ value: '', label: '— nenhuma —' }, ...stations.map((s) => ({ value: s.id, label: s.name }))]} /></div>
              </div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Código de barras</label><input value={modal.barcode || ''} onChange={(e) => setModal((m) => ({ ...m, barcode: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none font-mono" placeholder="Escaneie ou digite o código" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{modal.id ? 'Salvar' : 'Criar'}</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
