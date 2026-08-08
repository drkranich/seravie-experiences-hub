import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { initials } from '../../../lib/networkSocial'

// Experience Map — mapa do ecossistema: membros e fornecedores por cidade e
// categoria. Usa lat/lng quando disponível (link para o mapa). Visão relacional
// que ajuda a descobrir quem está perto e o que existe em cada praça.

function normCity(s) { return (s || '').trim() || 'Sem cidade' }

export function ExperienceMap({ onOpenSupplier, notify }) {
  const [members, setMembers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all') // all | members | suppliers

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [{ data: ms }, { data: ss }] = await Promise.all([
          supabase.from('network_members').select('id,name,avatar_url,city,state,lat,lng,role_title,headline,specialties').eq('status', 'active').limit(500),
          supabase.from('suppliers').select('id,name,logo_url,city,state,lat,lng,category').eq('status', 'published').limit(500),
        ])
        if (alive) { setMembers(ms || []); setSuppliers(ss || []) }
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const cities = useMemo(() => {
    const map = {}
    const add = (city, state, entry) => { const k = normCity(city); (map[k] ||= { city: k, state, members: [], suppliers: [] }); return map[k] }
    if (kind !== 'suppliers') members.forEach((m) => add(m.city, m.state)[Symbol.iterator] || add(m.city, m.state).members.push(m))
    if (kind !== 'members') suppliers.forEach((s) => add(s.city, s.state).suppliers.push(s))
    const nq = q.toLowerCase()
    let arr = Object.values(map).map((c) => ({ ...c, total: c.members.length + c.suppliers.length }))
    if (nq) arr = arr.filter((c) => c.city.toLowerCase().includes(nq) || (c.state || '').toLowerCase().includes(nq))
    return arr.filter((c) => c.total > 0).sort((a, b) => b.total - a.total)
  }, [members, suppliers, q, kind])

  const totals = useMemo(() => ({ cities: cities.length, members: members.length, suppliers: suppliers.length }), [cities, members, suppliers])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Mapa do Ecossistema</h1><p className="text-admin-muted/50 text-sm mt-1">Descubra quem está em cada praça — profissionais e fornecedores por cidade.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={kind} onChange={setKind} options={[{ value: 'all', label: 'Todos' }, { value: 'members', label: 'Profissionais' }, { value: 'suppliers', label: 'Fornecedores' }]} /></div>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-44"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cidade ou UF…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-md">
        <Stat icon="map" label="Praças" value={totals.cities} />
        <Stat icon="user" label="Profissionais" value={totals.members} />
        <Stat icon="box" label="Fornecedores" value={totals.suppliers} />
      </div>

      {loading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass rounded-2xl h-28 animate-pulse opacity-40" />)}</div>
        : cities.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="map" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhuma praça encontrada.</p></div>
          : <div className="space-y-4">
              {cities.map((c) => <CityCard key={c.city} c={c} onOpenSupplier={onOpenSupplier} />)}
            </div>}
    </div>
  )
}

function Stat({ icon, label, value }) {
  return <div className="glass rounded-xl px-4 py-3"><div className="flex items-center gap-2 text-admin-champ/70 mb-1"><Icon name={icon} className="w-4 h-4" /><span className="text-lg font-serif text-admin-text">{value}</span></div><p className="text-[10px] uppercase tracking-wider text-admin-muted/45">{label}</p></div>
}

function CityCard({ c, onOpenSupplier }) {
  const [open, setOpen] = useState(false)
  const anyGeo = [...c.members, ...c.suppliers].find((x) => x.lat && x.lng)
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-12 h-12 rounded-xl bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="map" className="w-5 h-5 text-admin-champ/70" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-admin-text font-medium">{c.city}{c.state ? ` · ${c.state}` : ''}</p>
          <p className="text-admin-muted/45 text-xs mt-0.5">{c.members.length} profissionais · {c.suppliers.length} fornecedores</p>
        </div>
        {anyGeo && <a href={`https://www.google.com/maps/search/${encodeURIComponent(c.city)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-admin-champ/70 hover:underline flex items-center gap-1 shrink-0"><Icon name="external" className="w-3.5 h-3.5" />Mapa</a>}
        <Icon name="down" className={`w-4 h-4 text-admin-muted/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          {c.members.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-2">Profissionais</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {c.members.map((m) => (
                  <div key={m.id} className="glass-soft rounded-xl p-3 flex items-center gap-3">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" /> : <div className="w-9 h-9 rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center text-[11px] shrink-0">{initials(m.name)}</div>}
                    <div className="min-w-0"><p className="text-admin-text text-sm truncate">{m.name}</p><p className="text-admin-muted/40 text-[11px] truncate">{m.headline || m.role_title || 'Membro'}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {c.suppliers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-2">Fornecedores</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {c.suppliers.map((s) => (
                  <button key={s.id} onClick={() => onOpenSupplier?.(s)} className="glass-soft rounded-xl p-3 flex items-center gap-3 text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name="box" className="w-4 h-4 text-admin-champ/60" />}</div>
                    <div className="min-w-0"><p className="text-admin-text text-sm truncate">{s.name}</p><p className="text-admin-muted/40 text-[11px] truncate">{s.category || 'Fornecedor'}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
