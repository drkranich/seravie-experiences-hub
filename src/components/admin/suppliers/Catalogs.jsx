import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, brl } from '../../../lib/suppliersMarket'

// Catálogos + Marketplace de produtos — grade de produtos de todos os fornecedores,
// filtrável por categoria/tipo. Clique abre o fornecedor.

export function Catalogs({ suppliers, onOpenSupplier }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try { const { data } = await supabase.from('supplier_products').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(300); if (alive) setProducts(data || []) }
      catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers])
  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products])
  const filtered = useMemo(() => {
    const nq = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return products.filter((p) => {
      if (cat && p.category !== cat) return false
      if (nq && !`${p.name} ${p.description || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(nq)) return false
      return true
    })
  }, [products, cat, q])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Catálogos</h1><p className="text-admin-muted/50 text-sm mt-1">Produtos de todos os fornecedores homologados, num só lugar.</p></div>
        <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-64"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
      </div>

      {cats.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
          <button onClick={() => setCat('')} className={`shrink-0 text-xs px-3.5 py-2 rounded-xl transition-colors ${!cat ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todos</button>
          {cats.map((c) => <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-colors ${cat === c ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}><Icon name={CATEGORY_ICON[c] || 'box'} className="w-3.5 h-3.5" />{SUPPLIER_CATEGORIES[c] || c}</button>)}
        </div>
      )}

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="glass rounded-2xl h-56 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <Empty text="Nenhum produto encontrado. Fornecedores publicam produtos no perfil deles." />
          : <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filtered.map((p) => { const sup = supplierById[p.supplier_id]; return (
                <button key={p.id} onClick={() => sup && onOpenSupplier(sup)} className="group text-left glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="h-40 bg-white/[0.03] overflow-hidden">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="box" className="w-9 h-9 text-admin-champ/20" /></div>}</div>
                  <div className="p-4">
                    <p className="text-admin-text text-sm font-medium truncate">{p.name}</p>
                    {sup && <p className="text-admin-muted/40 text-[11px] truncate">{sup.name}</p>}
                    <div className="flex items-center justify-between mt-3"><span className="text-admin-champ text-sm">{p.price ? brl(p.price) : 'Sob consulta'}</span>{p.unit && <span className="text-admin-muted/40 text-[11px]">/{p.unit}</span>}</div>
                  </div>
                </button>
              )})}
            </div>}
    </div>
  )
}

function Empty({ text }) { return <div className="glass rounded-2xl p-12 text-center"><Icon name="box" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">{text}</p></div> }
