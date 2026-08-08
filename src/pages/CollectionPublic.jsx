import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { routeParam } from '../lib/publicRoute'

// Página pública de uma Experience Collection compartilhada por link
// (/colecao/<token>). Lê network_collections pelo share_token (is_public=true)
// e seus itens. Somente leitura, pensada para divulgação a clientes.

const KIND_LABEL = { supplier: 'Fornecedor', member: 'Profissional', product: 'Produto', image: 'Referência', note: 'Nota' }

export function CollectionPublic() {
  const token = routeParam('colecao')
  const [c, setC] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('network_collections').select('*').eq('share_token', token).eq('is_public', true).maybeSingle()
        if (!data) { if (alive) { setNotFound(true); setLoading(false) } return }
        const { data: its } = await supabase.from('network_collection_items').select('*').eq('collection_id', data.id).order('sort', { ascending: true })
        if (alive) { setC(data); setItems(its || []); setLoading(false) }
      } catch { if (alive) { setNotFound(true); setLoading(false) } }
    })()
    return () => { alive = false }
  }, [token])

  if (loading) return <div className="min-h-screen bg-[#0e0e0f] flex items-center justify-center text-white/40 text-sm">Carregando…</div>
  if (notFound || !c) return (
    <div className="min-h-screen bg-[#0e0e0f] flex flex-col items-center justify-center text-center px-6">
      <p className="font-serif text-2xl text-white/80 mb-2">Coleção não encontrada</p>
      <p className="text-white/40 text-sm">O link pode ter expirado ou a coleção não está mais pública.</p>
    </div>
  )

  const tags = Array.isArray(c.tags) ? c.tags : []

  return (
    <div className="min-h-screen bg-[#0e0e0f] text-white">
      {/* capa / hero */}
      <div className="relative h-64 sm:h-80 bg-gradient-to-br from-[#b08d57]/25 to-[#7a5c3e]/10 overflow-hidden">
        {c.cover_url && <img src={c.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0f] via-[#0e0e0f]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {c.theme && <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md">{c.theme}</span>}
            {c.style && <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md">{c.style}</span>}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl">{c.title}</h1>
          {c.subtitle && <p className="text-[#d9b88a] text-sm sm:text-base mt-1">{c.subtitle}</p>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8">
        {c.description && <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-3xl mb-5">{c.description}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-white/45 mb-4">
          {c.curator && <span>Curadoria: <span className="text-white/70">{c.curator}</span></span>}
          {c.location && <span>{c.location}</span>}
          {c.budget_hint && <span>Investimento: {c.budget_hint}</span>}
          <span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
        </div>
        {tags.length > 0 && <div className="flex flex-wrap gap-1.5 mb-8">{tags.map((t, i) => <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.05] text-white/55">{t}</span>)}</div>}

        {items.length === 0 ? (
          <div className="border border-white/[0.06] rounded-2xl p-12 text-center text-white/40 text-sm">Esta coleção ainda não tem itens.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <div key={it.id} className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05]">
                {it.image_url && <div className="h-44 overflow-hidden"><img src={it.image_url} alt="" className="w-full h-full object-cover" /></div>}
                <div className="p-4">
                  <span className="text-[9px] uppercase tracking-wider text-[#d9b88a]/80">{KIND_LABEL[it.kind] || it.kind}</span>
                  {it.title && <p className="text-white text-sm mt-1">{it.title}</p>}
                  {it.subtitle && <p className="text-white/45 text-xs mt-0.5">{it.subtitle}</p>}
                  {it.note && <p className="text-white/60 text-xs mt-2 leading-relaxed">{it.note}</p>}
                  {it.kind === 'supplier' && it.ref_id && <a href={`/fornecedor/${it.ref_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#d9b88a] hover:underline mt-2">Ver fornecedor →</a>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-white/[0.06] text-center">
          <p className="text-white/30 text-xs">Coleção curada no <span className="text-[#d9b88a]/70">Seravie Experiences</span></p>
        </div>
      </div>
    </div>
  )
}
