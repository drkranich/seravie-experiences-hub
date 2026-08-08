import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { routeParam } from '../lib/publicRoute'

// Página pública de um projeto compartilhado por link (/projeto/<token>).
// Lê buyer_projects OU network_projects pelo share_token (ambos com is_public=true).

const SEG_LABEL = { cafeteria: 'Cafeteria', hotel: 'Hotel Boutique', floricultura: 'Floricultura', chocolateria: 'Chocolateria', vinicola: 'Vinícola', boutique: 'Boutique' }

export function ProjectPublic() {
  const token = routeParam('projeto')
  const [project, setProject] = useState(null)
  const [kind, setKind] = useState(null) // 'buyer' | 'network'
  const [suppliers, setSuppliers] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        // tenta buyer_projects
        const { data: bp } = await supabase.from('buyer_projects').select('*').eq('share_token', token).eq('is_public', true).maybeSingle()
        if (bp && alive) {
          setProject(bp); setKind('buyer')
          const { data: links } = await supabase.from('buyer_project_suppliers').select('*').eq('project_id', bp.id)
          const ids = [...new Set((links || []).map((l) => l.supplier_id).filter(Boolean))]
          if (ids.length) { const { data: sup } = await supabase.from('suppliers').select('id,name,category,city,state,logo_url,cover_url,verification_level').in('id', ids); setSuppliers((sup || []).map((s) => ({ ...s, _cat: (links || []).find((l) => l.supplier_id === s.id)?.category }))) }
          setLoading(false); return
        }
        // tenta network_projects
        const { data: np } = await supabase.from('network_projects').select('*').eq('share_token', token).eq('is_public', true).maybeSingle()
        if (np && alive) {
          setProject(np); setKind('network')
          const { data: pm } = await supabase.from('network_project_members').select('*').eq('project_id', np.id)
          const mids = [...new Set((pm || []).map((m) => m.member_id).filter(Boolean))]
          if (mids.length) { const { data: mem } = await supabase.from('network_members').select('id,name,avatar_url,role_title,headline').in('id', mids); setTeam((mem || []).map((m) => ({ ...m, _role: (pm || []).find((x) => x.member_id === m.id)?.role }))) }
          setLoading(false); return
        }
        if (alive) { setNotFound(true); setLoading(false) }
      } catch { if (alive) { setNotFound(true); setLoading(false) } }
    })()
    return () => { alive = false }
  }, [token])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/50 font-serif tracking-widest">Carregando projeto…</div>
  if (notFound || !project) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-center px-6">
      <p className="font-serif text-3xl text-ivory/80">Projeto não encontrado</p>
      <p className="text-ivory/40 text-sm mt-2">O link pode ter expirado ou o projeto deixou de ser público.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-ink text-ivory">
      {/* capa */}
      <div className="relative h-56 sm:h-72 bg-gradient-to-br from-[#c9a86a]/20 to-[#a0522d]/10 overflow-hidden">
        {project.cover_url ? <img src={project.cover_url} alt="" className="w-full h-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
        <div className="absolute bottom-6 left-0 right-0 px-6 sm:px-10 max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#c9a86a]/80 mb-2">Projeto Seravie{kind === 'network' ? ' · Colaborativo' : ''}</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-ivory">{project.name}</h1>
          {project.segment && <p className="text-ivory/50 text-sm mt-1">{SEG_LABEL[project.segment] || project.segment}</p>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        {project.description && <p className="text-ivory/70 text-base leading-relaxed max-w-3xl mb-10">{project.description}</p>}

        {kind === 'buyer' && (
          <section>
            <h2 className="text-[12px] uppercase tracking-wider text-[#c9a86a]/70 mb-5">Fornecedores do projeto</h2>
            {suppliers.length === 0 ? <p className="text-ivory/40 text-sm">Nenhum fornecedor vinculado ainda.</p>
              : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {suppliers.map((s) => (
                    <div key={s.id} className="rounded-2xl overflow-hidden bg-white/[0.03] ring-1 ring-white/[0.06]">
                      <div className="h-32 bg-white/[0.04] overflow-hidden">{s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : null}</div>
                      <div className="p-4"><p className="text-ivory font-medium">{s.name}</p><p className="text-ivory/40 text-xs mt-0.5">{s._cat || s.category}{s.city ? ` · ${s.city}${s.state ? '/' + s.state : ''}` : ''}</p></div>
                    </div>
                  ))}
                </div>}
          </section>
        )}

        {kind === 'network' && (
          <section>
            <h2 className="text-[12px] uppercase tracking-wider text-[#c9a86a]/70 mb-5">Equipe do projeto</h2>
            {team.length === 0 ? <p className="text-ivory/40 text-sm">Nenhum membro na equipe ainda.</p>
              : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {team.map((m) => (
                    <div key={m.id} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
                      {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" /> : <div className="w-11 h-11 rounded-full bg-[#c9a86a]/15 text-[#c9a86a] flex items-center justify-center text-sm font-medium">{(m.name || '?').slice(0, 2).toUpperCase()}</div>}
                      <div className="min-w-0"><p className="text-ivory text-sm truncate">{m.name}</p><p className="text-ivory/40 text-[11px]">{m._role || m.role_title || 'Colaborador'}</p></div>
                    </div>
                  ))}
                </div>}
          </section>
        )}

        <div className="mt-14 pt-6 border-t border-white/[0.06] text-center">
          <p className="text-ivory/30 text-xs">Feito com <span className="text-[#c9a86a]/70">Seravie Experiences</span> — Experience Operating System</p>
        </div>
      </div>
    </div>
  )
}
