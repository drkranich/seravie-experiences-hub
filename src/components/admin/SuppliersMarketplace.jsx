import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import {
  SUPPLIER_CATEGORIES, CATEGORY_ICON, VERIF_LEVELS, STATES, SORTS,
  MOODBOARD_THEMES, brl, sortSuppliers, filterSuppliers,
} from '../../lib/suppliersMarket'
import { SupplierProfile } from './suppliers/SupplierProfile'
import { Moodboards } from './suppliers/Moodboards'
import { Comparator } from './suppliers/Comparator'
import { RfqCenter } from './suppliers/RfqCenter'
import { Catalogs } from './suppliers/Catalogs'
import { TechLibrary } from './suppliers/TechLibrary'
import { BuyerProjects } from './suppliers/BuyerProjects'
import { PurchasingAnalytics, PurchasingAI } from './suppliers/PurchasingExtras'

// ═══════════════════════════════════════════════════════════════════════════
// Seravie Suppliers — marketplace B2B de descoberta (estilo Faire/Archiproducts)
// App próprio dentro do ecossistema: shell com navegação lateral, cobre/champanhe,
// glassmorphism. Onda 1: Descobrir + Perfil do fornecedor + Moodboards.
// ═══════════════════════════════════════════════════════════════════════════

const NAV = [
  { key: 'discover', label: 'Descobrir', icon: 'search' },
  { key: 'catalogs', label: 'Catálogos', icon: 'grid' },
  { key: 'compare', label: 'Comparar', icon: 'layers' },
  { key: 'rfq', label: 'Cotações', icon: 'mail' },
  { key: 'ai', label: 'IA de Compras', icon: 'sparkles' },
  { key: 'projects', label: 'Projetos', icon: 'layout' },
  { key: 'library', label: 'Biblioteca Técnica', icon: 'book' },
  { key: 'moodboards', label: 'Moodboards', icon: 'palette' },
  { key: 'analytics', label: 'Analytics', icon: 'chart' },
  { key: 'favorites', label: 'Favoritos', icon: 'heart' },
]

function Stars({ value = 0, size = 'text-xs' }) {
  const full = Math.round(value)
  return <span className={`${size} text-admin-gold tracking-tight`}>{'★'.repeat(full)}<span className="text-white/15">{'★'.repeat(5 - full)}</span></span>
}

export function VerifSeal({ level, className = '' }) {
  const v = VERIF_LEVELS[level] || VERIF_LEVELS.bronze
  return <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${v.style} ${className}`}>Seravie {v.label}</span>
}

// ---- Card grande do fornecedor (descoberta visual) ----
function SupplierCard({ s, fav, cmp, onOpen, onFav, onCmp }) {
  const cat = SUPPLIER_CATEGORIES[s.category] || s.category
  const specialties = Array.isArray(s.specialties) ? s.specialties : []
  return (
    <button onClick={() => onOpen(s)} className="group text-left glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-admin-champ/30 transition-all">
      <div className="relative h-40 bg-gradient-to-br from-admin-champ/10 to-admin-copper/10 overflow-hidden">
        {s.cover_url
          ? <img src={s.cover_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-10 h-10 text-admin-champ/25" /></div>}
        <div className="absolute top-3 left-3"><VerifSeal level={s.verification_level} /></div>
        <button onClick={(e) => { e.stopPropagation(); onFav(s) }} className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${fav ? 'bg-admin-rose/25 text-admin-rose' : 'bg-black/30 text-white/70 hover:text-admin-rose'}`} title="Favoritar">
          <Icon name="heart" className="w-4 h-4" />
        </button>
        {s.featured && <span className="absolute bottom-3 left-3 text-[9px] uppercase tracking-wider bg-admin-champ/25 text-admin-champ px-2 py-0.5 rounded-md backdrop-blur-md">Destaque</span>}
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 overflow-hidden -mt-8 ring-2 ring-admin-side/60 backdrop-blur-md">
            {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-5 h-5 text-admin-champ/60" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-admin-text font-medium truncate">{s.name}</p>
            <p className="text-admin-muted/45 text-xs truncate">{cat}{s.city ? ` · ${s.city}${s.state ? '/' + s.state : ''}` : ''}</p>
          </div>
        </div>
        {s.description && <p className="text-admin-muted/55 text-xs mt-3 line-clamp-2 leading-relaxed">{s.description}</p>}
        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {specialties.slice(0, 3).map((sp, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-admin-muted/60">{sp}</span>)}
          </div>
        )}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5">{s.rating > 0 ? <><Stars value={s.rating} /><span className="text-admin-muted/40 text-[11px]">{Number(s.rating).toFixed(1)}</span></> : <span className="text-admin-muted/30 text-[11px]">Novo</span>}</div>
          <span onClick={(e) => { e.stopPropagation(); onCmp(s) }} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg cursor-pointer transition-colors ${cmp ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/50 hover:text-admin-champ'}`} title="Adicionar ao comparador">
            <Icon name="layers" className="w-3.5 h-3.5" />{cmp ? 'Comparando' : 'Comparar'}
          </span>
        </div>
      </div>
    </button>
  )
}

// ---- Tela Descobrir ----
function Discover({ suppliers, favorites, compare, loading, onOpen, onFav, onCmp, onlyFav = false }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [uf, setUf] = useState('')
  const [level, setLevel] = useState('')
  const [sort, setSort] = useState('featured')

  const base = onlyFav ? suppliers.filter((s) => favorites.has(s.id)) : suppliers
  const filtered = useMemo(() => sortSuppliers(filterSuppliers(base, { q, cat, uf, level }), sort), [base, q, cat, uf, level, sort])
  const cats = useMemo(() => { const set = new Set(suppliers.map((s) => s.category).filter(Boolean)); return [...set] }, [suppliers])

  return (
    <div>
      {/* Hero */}
      {!onlyFav && (
        <div className="relative rounded-3xl overflow-hidden mb-6 bg-gradient-to-br from-admin-copper/15 via-admin-champ/10 to-transparent">
          <div className="px-8 py-10 sm:py-12 relative z-10 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-admin-champ/70 mb-3">Marketplace B2B homologado</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-admin-text leading-tight">Encontre os melhores fornecedores para o seu projeto</h1>
            <p className="text-admin-muted/55 text-sm mt-3">Descubra parceiros curados por segmento, categoria, região e homologação Seravie.</p>
            <div className="mt-6 flex items-center gap-2 glass-input rounded-2xl px-4 py-3 max-w-lg">
              <Icon name="search" className="w-4 h-4 text-admin-champ/60 shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fornecedores, especialidades…" className="flex-1 bg-transparent text-sm text-admin-text outline-none placeholder:text-admin-muted/40" />
            </div>
          </div>
          <div className="absolute -right-8 -top-8 opacity-[0.07] pointer-events-none"><Icon name="grid" className="w-64 h-64 text-admin-champ" /></div>
        </div>
      )}

      {/* Chips de categorias */}
      {!onlyFav && cats.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
          <button onClick={() => setCat('')} className={`shrink-0 text-xs px-3.5 py-2 rounded-xl transition-colors ${!cat ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>Todas</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-colors ${cat === c ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>
              <Icon name={CATEGORY_ICON[c] || 'box'} className="w-3.5 h-3.5" />{SUPPLIER_CATEGORIES[c] || c}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        {/* Filtros laterais */}
        {!onlyFav && (
          <aside className="hidden lg:block w-56 shrink-0 space-y-5">
            <div className="glass-soft rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-3">Filtros</p>
              <div className="space-y-3">
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Região (UF)</label><GlassSelect value={uf} onChange={setUf} options={[{ value: '', label: 'Todas' }, ...STATES.map((s) => ({ value: s, label: s }))]} /></div>
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Homologação</label><GlassSelect value={level} onChange={setLevel} options={[{ value: '', label: 'Todas' }, ...Object.entries(VERIF_LEVELS).map(([k, v]) => ({ value: k, label: v.label }))]} /></div>
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Ordenar por</label><GlassSelect value={sort} onChange={setSort} options={SORTS} /></div>
              </div>
              {(uf || level || cat || q) && <button onClick={() => { setUf(''); setLevel(''); setCat(''); setQ('') }} className="mt-4 text-[11px] text-admin-champ/70 hover:text-admin-champ">Limpar filtros</button>}
            </div>
          </aside>
        )}

        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-admin-muted/50 text-sm">{loading ? 'Carregando…' : `${filtered.length} fornecedor${filtered.length === 1 ? '' : 'es'}`}</p>
            <div className="lg:hidden w-40"><GlassSelect value={sort} onChange={setSort} options={SORTS} /></div>
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-72 animate-pulse opacity-40" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Icon name="box" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" />
              <p className="text-admin-muted/60 text-sm">{onlyFav ? 'Você ainda não favoritou fornecedores.' : 'Nenhum fornecedor encontrado.'}</p>
              <p className="text-admin-muted/35 text-xs mt-1">{onlyFav ? 'Explore em Descobrir e toque no coração.' : 'Ajuste os filtros ou cadastre fornecedores.'}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((s) => <SupplierCard key={s.id} s={s} fav={favorites.has(s.id)} cmp={compare.includes(s.id)} onOpen={onOpen} onFav={onFav} onCmp={onCmp} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SuppliersMarketplace({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [view, setView] = useState('discover')
  const [suppliers, setSuppliers] = useState([])
  const [favorites, setFavorites] = useState(new Set())
  const [compare, setCompare] = useState([])          // ids selecionados p/ comparar (máx 5)
  const [rfqPreset, setRfqPreset] = useState(null)    // ids vindos do comparador p/ criar RFQ
  const [loading, setLoading] = useState(true)
  const [openSupplier, setOpenSupplier] = useState(null)

  const toggleCompare = useCallback((s) => {
    setCompare((prev) => {
      if (prev.includes(s.id)) return prev.filter((x) => x !== s.id)
      if (prev.length >= 5) { notify?.('Você pode comparar até 5 fornecedores.', 'info'); return prev }
      return [...prev, s.id]
    })
  }, [notify])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: sup }, { data: favs }] = await Promise.all([
        supabase.from('suppliers').select('*').in('status', ['published', 'active', 'open']).limit(500),
        supabase.from('supplier_favorites').select('supplier_id'),
      ])
      setSuppliers(sup || [])
      setFavorites(new Set((favs || []).map((f) => f.supplier_id)))
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const toggleFav = useCallback(async (s) => {
    const has = favorites.has(s.id)
    setFavorites((prev) => { const n = new Set(prev); has ? n.delete(s.id) : n.add(s.id); return n })
    try {
      if (has) await supabase.from('supplier_favorites').delete().eq('supplier_id', s.id).eq('tenant_id', tenantId)
      else await supabase.from('supplier_favorites').insert({ supplier_id: s.id, tenant_id: tenantId })
    } catch { notify?.('Não foi possível atualizar o favorito', 'error') }
  }, [favorites, tenantId, notify])

  if (openSupplier) {
    return <SupplierProfile supplier={openSupplier} isFav={favorites.has(openSupplier.id)} onFav={() => toggleFav(openSupplier)} onBack={() => setOpenSupplier(null)} notify={notify} />
  }

  return (
    <div className="flex gap-6">
      {/* Navegação do app (própria) */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="glass-soft rounded-2xl p-2 sticky top-24">
          <div className="px-3 py-3 mb-1">
            <p className="font-serif text-lg text-admin-text leading-none">Suppliers</p>
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mt-1">Marketplace B2B</p>
          </div>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${view === n.key ? 'bg-admin-champ/12 text-admin-champ' : 'text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.03]'}`}>
              <Icon name={n.icon} className="w-4 h-4" /><span className="flex-1 text-left">{n.label}</span>
              {n.key === 'compare' && compare.length > 0 && <span className="text-[10px] bg-admin-champ/20 text-admin-champ rounded-full px-1.5 min-w-[18px] text-center">{compare.length}</span>}
              {n.key === 'favorites' && favorites.size > 0 && <span className="text-[10px] bg-admin-rose/20 text-admin-rose rounded-full px-1.5 min-w-[18px] text-center">{favorites.size}</span>}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        {/* seletor mobile */}
        <div className="md:hidden mb-4"><GlassSelect value={view} onChange={setView} options={NAV.map((n) => ({ value: n.key, label: n.label }))} /></div>

        {(view === 'discover' || view === 'favorites') && (
          <Discover suppliers={suppliers} favorites={favorites} compare={compare} loading={loading} onOpen={setOpenSupplier} onFav={toggleFav} onCmp={toggleCompare} onlyFav={view === 'favorites'} />
        )}
        {view === 'compare' && (
          <Comparator suppliers={suppliers} selected={compare} onToggle={(id) => setCompare((p) => p.filter((x) => x !== id))} onOpen={setOpenSupplier} onClear={() => setCompare([])} onRfq={(ids) => { setRfqPreset(ids || compare); setView('rfq') }} />
        )}
        {view === 'rfq' && (
          <RfqCenter suppliers={suppliers} presetSupplierIds={rfqPreset} onConsumePreset={() => setRfqPreset(null)} notify={notify} />
        )}
        {view === 'catalogs' && <Catalogs suppliers={suppliers} onOpenSupplier={setOpenSupplier} />}
        {view === 'ai' && <PurchasingAI notify={notify} />}
        {view === 'projects' && <BuyerProjects suppliers={suppliers} onOpenSupplier={setOpenSupplier} notify={notify} />}
        {view === 'library' && <TechLibrary suppliers={suppliers} notify={notify} />}
        {view === 'analytics' && <PurchasingAnalytics suppliers={suppliers} />}
        {view === 'moodboards' && <Moodboards suppliers={suppliers} onOpenSupplier={setOpenSupplier} notify={notify} />}
      </div>
    </div>
  )
}
