import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function LegalPage({ slug }) {
  const [page, setPage] = useState(undefined) // undefined=carregando, null=não encontrada

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('pages')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle()
      if (active) setPage(data || null)
    })()
    return () => {
      active = false
    }
  }, [slug])

  return (
    <section className="relative bg-ink min-h-[70vh] pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-6 lg:px-10">
        {page === undefined ? (
          <p className="text-ivory/50">Carregando…</p>
        ) : page === null ? (
          <p className="text-ivory/60">Página não encontrada ou ainda não publicada.</p>
        ) : (
          <>
            <h1 className="font-serif text-4xl lg:text-5xl text-ivory mb-8">{page.title}</h1>
            <div className="text-ivory/70 leading-relaxed whitespace-pre-wrap">
              {(page.content && page.content.body) || 'Conteúdo em breve.'}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
