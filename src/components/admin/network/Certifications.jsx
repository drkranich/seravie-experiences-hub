import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Certificações Seravie — trilhas com critérios; o membro acompanha o progresso
// e recebe o selo ao concluir. Real (certifications + certification_awards).

export function Certifications({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [certs, setCerts] = useState([])
  const [awards, setAwards] = useState({}) // cert_id -> award
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: cs }, { data: aw }] = await Promise.all([
      supabase.from('certifications').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      supabase.from('certification_awards').select('*').eq('tenant_id', tenantId),
    ])
    setCerts(cs || [])
    const map = {}; (aw || []).forEach((a) => { map[a.certification_id] = a }); setAwards(map)
    setLoading(false)
  }
  useEffect(() => { if (tenantId) load() }, [tenantId])

  const start = async (cert) => {
    if (awards[cert.id]) return
    const { data } = await supabase.from('certification_awards').insert({ tenant_id: tenantId, certification_id: cert.id, member_id: me?.id, progress: 0 }).select('*').single()
    if (data) { setAwards((a) => ({ ...a, [cert.id]: data })); notify?.('Trilha iniciada', 'success') }
  }
  const setProgress = async (cert, progress) => {
    const a = awards[cert.id]; if (!a) return
    const completed = progress >= 100
    const patch = { progress, completed, awarded_at: completed ? new Date().toISOString() : null }
    setAwards((m) => ({ ...m, [cert.id]: { ...a, ...patch } }))
    await supabase.from('certification_awards').update(patch).eq('id', a.id)
    if (completed) notify?.(`Certificação "${cert.title}" concluída! 🏅`, 'success')
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5"><h1 className="font-serif text-2xl text-admin-text">Certificações Seravie</h1><p className="text-admin-muted/50 text-sm mt-1">Trilhas que comprovam sua excelência no ecossistema.</p></div>

      {loading ? <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass rounded-2xl h-48 animate-pulse opacity-40" />)}</div>
        : certs.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="check" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhuma certificação disponível ainda.</p></div>
          : <div className="grid sm:grid-cols-2 gap-4">
              {certs.map((c) => { const a = awards[c.id]; const reqs = Array.isArray(c.requirements) ? c.requirements : []; const done = a?.completed; return (
                <div key={c.id} className={`glass rounded-2xl p-5 flex flex-col ${done ? 'ring-1 ring-admin-sage/40' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-admin-sage/15 text-admin-sage' : 'bg-admin-champ/10 text-admin-champ/70'}`}><Icon name={c.badge_icon || 'check'} className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1"><p className="text-admin-text font-medium leading-snug">{c.title}</p>{c.category && <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mt-0.5">{c.category}</p>}</div>
                    {done && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-sage/15 text-admin-sage shrink-0">Certificado</span>}
                  </div>
                  {c.description && <p className="text-admin-muted/55 text-xs mt-2">{c.description}</p>}
                  {reqs.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {reqs.map((r, i) => <p key={i} className="text-[11px] text-admin-muted/60 flex items-start gap-1.5"><Icon name="check" className="w-3 h-3 text-admin-champ/50 shrink-0 mt-0.5" />{r}</p>)}
                    </div>
                  )}
                  <div className="mt-auto pt-4">
                    {!a ? <button onClick={() => start(c)} className="w-full py-2 rounded-xl text-sm bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 transition-colors">Iniciar trilha</button>
                      : (
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-admin-muted/50">{done ? 'Concluída' : 'Progresso'}</span><span className="text-admin-champ">{a.progress}%</span></div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-2"><div className="h-full bg-gradient-to-r from-admin-champ to-admin-copper transition-all" style={{ width: `${a.progress}%` }} /></div>
                          {!done && <div className="flex gap-1.5">{[33, 66, 100].map((p) => <button key={p} onClick={() => setProgress(c, p)} className="flex-1 text-[10px] py-1 rounded-md bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ hover:bg-admin-champ/10 transition-colors">{p === 100 ? '✓ Concluir' : `${p}%`}</button>)}</div>}
                        </div>
                      )}
                  </div>
                </div>
              )})}
            </div>}
    </div>
  )
}
