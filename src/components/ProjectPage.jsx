import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function ProjectPage({ id }) {
  const [p, setP] = useState(undefined) // undefined=carregando, null=não encontrado

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('portfolio_items').select('*').eq('id', id).maybeSingle()
      if (active) setP(data || null)
    })()
    return () => {
      active = false
    }
  }, [id])

  return (
    <section className="relative bg-ink min-h-[80vh] pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-10">
        <a
          href="#/portfolio"
          className="text-[11px] tracking-widerx uppercase text-gold hover:text-champagne transition-colors"
        >
          ← Voltar ao portfólio
        </a>

        {p === undefined ? (
          <p className="text-ivory/50 mt-10">Carregando…</p>
        ) : p === null ? (
          <p className="text-ivory/60 mt-10">Projeto não encontrado.</p>
        ) : (
          <div className="mt-8">
            {p.category && (
              <p className="text-[11px] tracking-widerx uppercase text-gold/90 mb-3">{p.category}</p>
            )}
            <h1 className="font-serif text-4xl lg:text-6xl text-ivory mb-8 leading-tight">{p.title}</h1>
            {p.image_url && (
              <div className="rounded-2xl overflow-hidden mb-8">
                <img src={p.image_url} alt={p.title} className="w-full object-cover" />
              </div>
            )}
            {p.description && (
              <p className="text-ivory/70 leading-relaxed text-lg mb-10 max-w-2xl whitespace-pre-wrap">
                {p.description}
              </p>
            )}
            {Array.isArray(p.gallery) && p.gallery.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                {p.gallery.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden aspect-square">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            {p.link && (
              <a
                href={p.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gold text-ink text-[11px] tracking-widerx uppercase hover:bg-champagne transition-colors"
              >
                Ver no Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
