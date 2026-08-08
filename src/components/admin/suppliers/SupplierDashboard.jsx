import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Dashboard do Fornecedor — visão do desempenho do meu perfil de fornecedor:
// produtos, favoritos, cotações recebidas, avaliações e projetos vinculados.

async function count(table, filter) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count: c } = await q
  return c || 0
}

export function SupplierDashboard({ notify, onNavigate }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [supplier, setSupplier] = useState(null)
  const [stats, setStats] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const { data: sup } = await supabase.from('suppliers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1).maybeSingle()
        if (!alive) return
        setSupplier(sup || null)
        if (sup) {
          const [products, favorites, quotes, rfqInvites, revs, projects] = await Promise.all([
            count('supplier_products', (q) => q.eq('supplier_id', sup.id)),
            count('supplier_favorites', (q) => q.eq('supplier_id', sup.id)),
            count('supplier_quotes', (q) => q.eq('supplier_id', sup.id)),
            count('rfq_suppliers', (q) => q.eq('supplier_id', sup.id)),
            count('supplier_reviews', (q) => q.eq('supplier_id', sup.id)),
            count('buyer_project_suppliers', (q) => q.eq('supplier_id', sup.id)),
          ])
          const { data: recentRevs } = await supabase.from('supplier_reviews').select('*').eq('supplier_id', sup.id).order('created_at', { ascending: false }).limit(4)
          if (alive) { setStats({ products, favorites, quotes, rfqInvites, reviews: revs, projects }); setReviews(recentRevs || []) }
        }
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [tenantId])

  if (loading) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-28 animate-pulse opacity-40" />)}</div>

  if (!supplier) return (
    <div className="glass rounded-2xl p-12 text-center">
      <Icon name="box" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" />
      <p className="text-admin-muted/60 text-sm">Você ainda não tem um perfil de fornecedor.</p>
      <button onClick={() => onNavigate?.('suppliers_profile')} className="mt-4 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">Criar meu perfil de fornecedor</button>
    </div>
  )

  const published = supplier.status === 'published'
  const CARDS = [
    { icon: 'box', label: 'Produtos', value: stats?.products, hint: 'no catálogo' },
    { icon: 'star', label: 'Favoritos', value: stats?.favorites, hint: 'compradores' },
    { icon: 'tag', label: 'Cotações', value: stats?.quotes, hint: 'recebidas' },
    { icon: 'mail', label: 'Convites RFQ', value: stats?.rfqInvites, hint: 'para cotar' },
    { icon: 'check', label: 'Avaliações', value: stats?.reviews, hint: 'de clientes' },
    { icon: 'layout', label: 'Projetos', value: stats?.projects, hint: 'vinculados' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{supplier.logo_url ? <img src={supplier.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name="box" className="w-5 h-5 text-admin-champ/60" />}</div>
            <div><h1 className="font-serif text-2xl text-admin-text">{supplier.name}</h1><p className="text-admin-muted/50 text-sm">Desempenho do seu perfil de fornecedor</p></div>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-lg ${published ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.06] text-admin-muted/60'}`}>{published ? 'Publicado no diretório' : 'Rascunho (não visível)'}</span>
      </div>

      {!published && (
        <div className="glass-soft rounded-2xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-admin-muted/70 text-sm flex items-center gap-2"><Icon name="warning" className="w-4 h-4 text-admin-gold" />Seu perfil ainda não está publicado — os compradores não conseguem te encontrar.</p>
          <button onClick={() => onNavigate?.('suppliers_profile')} className="text-sm bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl transition-colors shrink-0">Publicar perfil</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {CARDS.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-admin-champ/10 flex items-center justify-center mb-3"><Icon name={c.icon} className="w-5 h-5 text-admin-champ/70" /></div>
            <p className="text-3xl font-serif text-admin-text">{(c.value || 0).toLocaleString('pt-BR')}</p>
            <p className="text-admin-muted/50 text-xs mt-1">{c.label} <span className="text-admin-muted/30">· {c.hint}</span></p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Avaliações recentes</p>
          {reviews.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><p className="text-admin-muted/50 text-sm">Sem avaliações ainda.</p></div>
            : <div className="glass rounded-2xl divide-y divide-white/[0.05]">
                {reviews.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between"><p className="text-admin-text text-sm">{r.author_name || 'Cliente'}</p><span className="text-admin-gold text-xs">{'★'.repeat(Math.round(r.rating || 0))}</span></div>
                    {r.comment && <p className="text-admin-muted/60 text-xs mt-1 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Atalhos</p>
          <div className="glass rounded-2xl p-2 space-y-1">
            {[
              { key: 'suppliers_profile', icon: 'pen', label: 'Editar perfil e catálogo' },
              { key: 'rfq', icon: 'mail', label: 'Cotações (RFQ)' },
              { key: 'suppliers', icon: 'search', label: 'Ver o diretório' },
            ].map((s) => (
              <button key={s.key} onClick={() => onNavigate?.(s.key)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.03] transition-colors"><Icon name={s.icon} className="w-4 h-4 shrink-0" />{s.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
