import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { routeParam } from '../lib/publicRoute'

// Página pública de um fornecedor (/fornecedor/<id>) — leitura dos publicados.
const CAT = {
  arquitetura: 'Arquitetura', mobiliario: 'Mobiliário', marcenaria: 'Marcenaria', iluminacao: 'Iluminação',
  paisagismo: 'Paisagismo', embalagens: 'Embalagens', grafica: 'Gráfica', comunicacao_visual: 'Comunicação Visual',
  uniformes: 'Uniformes', aromatizacao: 'Fragrâncias & Aromas', tecnologia: 'Tecnologia', decoracao: 'Decoração',
  cafe: 'Cafés Especiais', vinho: 'Vinícola', chocolate: 'Chocolateria',
}
const LEVEL = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platinum: 'Platinum', signature: 'Signature' }

export function SupplierPublic() {
  const id = routeParam('fornecedor')
  const [s, setS] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('suppliers').select('*').eq('id', id).in('status', ['published', 'active', 'open']).maybeSingle()
        if (!alive) return
        if (!data) { setNotFound(true); setLoading(false); return }
        setS(data)
        const { data: p } = await supabase.from('supplier_products').select('*').eq('supplier_id', id).eq('status', 'active').order('created_at', { ascending: false })
        if (alive) { setProducts(p || []); setLoading(false) }
      } catch { if (alive) { setNotFound(true); setLoading(false) } }
    })()
    return () => { alive = false }
  }, [id])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/50 font-serif tracking-widest">Carregando…</div>
  if (notFound || !s) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-center px-6">
      <p className="font-serif text-3xl text-ivory/80">Fornecedor não encontrado</p>
      <p className="text-ivory/40 text-sm mt-2">O link pode ter expirado ou o fornecedor não está mais público.</p>
    </div>
  )
  const specialties = Array.isArray(s.specialties) ? s.specialties : []
  const gallery = Array.isArray(s.gallery) ? s.gallery : []
  const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="min-h-screen bg-ink text-ivory">
      <div className="relative h-56 sm:h-72 bg-gradient-to-br from-[#c9a86a]/20 to-[#a0522d]/10 overflow-hidden">
        {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
      </div>
      <div className="max-w-4xl mx-auto px-6 sm:px-10">
        <div className="flex items-end gap-4 -mt-12 relative z-10 flex-wrap">
          <div className="w-24 h-24 rounded-2xl bg-white/[0.06] ring-4 ring-ink overflow-hidden shrink-0 flex items-center justify-center">{s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : null}</div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-3xl text-ivory">{s.name}</h1>
            <span className="text-[11px] px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(255,255,255,0.85)', color: '#1c1c1c' }}>Seravie {LEVEL[s.verification_level] || 'Homologado'}</span>
          </div>
          <p className="text-ivory/50 text-sm mt-1">{CAT[s.category] || s.category}{s.city ? ` · ${s.city}${s.state ? '/' + s.state : ''}` : ''}</p>
          {s.rating > 0 && <p className="text-[#c9a86a] text-sm mt-1">★ {Number(s.rating).toFixed(1)} · {s.reviews_count || 0} avaliações</p>}
        </div>

        <div className="grid sm:grid-cols-4 gap-3 mt-6">
          {[['Anos de mercado', s.years_market || '—'], ['Projetos', s.projects_count || '—'], ['Pedido mínimo', s.min_order || '—'], ['Prazo médio', s.lead_time || '—']].map(([l, v], i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3 text-center"><p className="text-ivory text-lg font-serif">{v}</p><p className="text-[10px] uppercase tracking-wider text-ivory/40 mt-0.5">{l}</p></div>
          ))}
        </div>

        {s.description && <div className="mt-8"><h2 className="text-[11px] uppercase tracking-wider text-[#c9a86a]/70 mb-2">Sobre</h2><p className="text-ivory/70 text-sm leading-relaxed">{s.description}</p></div>}
        {specialties.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{specialties.map((sp, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-ivory/70">{sp}</span>)}</div>}

        {products.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] uppercase tracking-wider text-[#c9a86a]/70 mb-4">Produtos</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <div key={p.id} className="rounded-2xl overflow-hidden bg-white/[0.03] ring-1 ring-white/[0.06]">
                  <div className="h-36 bg-white/[0.04] overflow-hidden">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : null}</div>
                  <div className="p-4"><p className="text-ivory text-sm font-medium">{p.name}</p><p className="text-[#c9a86a] text-sm mt-1">{p.price ? brl(p.price) : 'Sob consulta'}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {gallery.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] uppercase tracking-wider text-[#c9a86a]/70 mb-4">Galeria</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{gallery.map((url, i) => <div key={i} className="rounded-xl overflow-hidden aspect-square bg-white/[0.03]"><img src={url} alt="" className="w-full h-full object-cover" /></div>)}</div>
          </div>
        )}

        <div className="mt-14 py-6 border-t border-white/[0.06] text-center"><p className="text-ivory/30 text-xs">Fornecedor homologado <span className="text-[#c9a86a]/70">Seravie Suppliers</span></p></div>
      </div>
    </div>
  )
}
