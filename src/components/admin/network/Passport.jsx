import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Passaporte Seravie — clube/fidelidade do ecossistema. Selos conquistados,
// níveis por pontos e o catálogo de conquistas disponíveis. Concede selos
// automaticamente com base em ações reais (projeto criado, curso concluído…).

const LEVELS = [
  { min: 0, label: 'Explorador', c: 'text-admin-muted/70', ring: 'ring-white/10' },
  { min: 40, label: 'Membro', c: 'text-admin-champ', ring: 'ring-admin-champ/40' },
  { min: 100, label: 'Conector', c: 'text-admin-sage', ring: 'ring-admin-sage/40' },
  { min: 200, label: 'Embaixador', c: 'text-admin-gold', ring: 'ring-admin-gold/40' },
]
const levelFor = (pts) => [...LEVELS].reverse().find((l) => pts >= l.min) || LEVELS[0]

export function Passport({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [catalog, setCatalog] = useState([])
  const [earned, setEarned] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: cat }, { data: mine }] = await Promise.all([
      supabase.from('passport_badge_catalog').select('*').order('sort'),
      supabase.from('passport_badges').select('*').eq('tenant_id', tenantId),
    ])
    setCatalog(cat || []); setEarned(mine || []); setLoading(false)
    // concede selos com base em ações reais (idempotente por unique)
    autoAward(cat || [], mine || [])
  }
  useEffect(() => { if (tenantId) load() }, [tenantId])

  const autoAward = async (cat, mine) => {
    const has = new Set(mine.map((b) => b.slug))
    const toGrant = []
    const grant = (slug) => { const c = cat.find((x) => x.slug === slug); if (c && !has.has(slug)) toGrant.push({ tenant_id: tenantId, member_id: me?.id || null, slug: c.slug, label: c.label, description: c.description, icon: c.icon, points: c.points }) }
    // sempre: bem-vindo
    grant('bem_vindo')
    // checagens reais
    const [proj, comm, courses, cols, evs, orders] = await Promise.all([
      supabase.from('network_projects').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('network_community_members').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('network_academy_enrollments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('completed', true),
      supabase.from('network_collections').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('network_events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('buyer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'concluido'),
    ])
    if ((proj.count || 0) > 0) grant('primeiro_projeto')
    if ((comm.count || 0) >= 5) grant('conector')
    if ((courses.count || 0) > 0) grant('curioso')
    if ((cols.count || 0) > 0) grant('curador')
    if ((evs.count || 0) > 0) grant('anfitriao')
    if ((orders.count || 0) > 0) grant('comprador')
    if (toGrant.length) {
      const { data } = await supabase.from('passport_badges').upsert(toGrant, { onConflict: 'tenant_id,slug,member_id' }).select('*')
      if (data?.length) { setEarned((e) => { const slugs = new Set(e.map((x) => x.slug)); return [...e, ...data.filter((d) => !slugs.has(d.slug))] }); notify?.(`Você conquistou ${data.length} selo(s)!`, 'success') }
    }
  }

  const earnedSlugs = new Set(earned.map((b) => b.slug))
  const points = earned.reduce((s, b) => s + (b.points || 0), 0)
  const lvl = levelFor(points)
  const nextLvl = LEVELS.find((l) => l.min > points)

  return (
    <div className="max-w-3xl">
      <div className="mb-5"><h1 className="font-serif text-2xl text-admin-text">Passaporte Seravie</h1><p className="text-admin-muted/50 text-sm mt-1">Sua jornada no ecossistema — conquistas, pontos e níveis.</p></div>

      {loading ? <div className="glass rounded-2xl h-40 animate-pulse opacity-40" /> : (
        <>
          <div className="glass rounded-3xl p-6 mb-5 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-admin-champ/[0.06] blur-2xl" />
            <div className="flex items-center gap-5 relative">
              <div className={`w-20 h-20 rounded-2xl bg-admin-champ/10 flex items-center justify-center ring-2 ${lvl.ring}`}><Icon name="spark" className={`w-9 h-9 ${lvl.c}`} /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-admin-champ/60">Nível</p>
                <p className={`font-serif text-2xl ${lvl.c}`}>{lvl.label}</p>
                <p className="text-admin-muted/50 text-sm mt-0.5">{points} pontos · {earned.length} selos</p>
              </div>
            </div>
            {nextLvl && (
              <div className="mt-4 relative">
                <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-admin-muted/50">Próximo: {nextLvl.label}</span><span className="text-admin-champ">{points}/{nextLvl.min}</span></div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-gradient-to-r from-admin-champ to-admin-copper transition-all" style={{ width: `${Math.min(100, (points / nextLvl.min) * 100)}%` }} /></div>
              </div>
            )}
          </div>

          <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Selos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {catalog.map((b) => { const got = earnedSlugs.has(b.slug); return (
              <div key={b.slug} className={`glass rounded-2xl p-4 text-center transition-all ${got ? '' : 'opacity-45 grayscale'}`}>
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-2 ${got ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.05] text-admin-muted/40'}`}><Icon name={b.icon || 'star'} className="w-6 h-6" /></div>
                <p className="text-admin-text text-xs font-medium leading-snug">{b.label}</p>
                <p className="text-admin-muted/40 text-[10px] mt-1">{b.criteria}</p>
                <p className={`text-[10px] mt-1.5 ${got ? 'text-admin-sage' : 'text-admin-muted/40'}`}>{got ? '✓ Conquistado' : `+${b.points} pts`}</p>
              </div>
            )})}
          </div>
        </>
      )}
    </div>
  )
}
