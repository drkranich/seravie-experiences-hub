import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { initials } from '../../../lib/networkSocial'

// Networking Inteligente — sugere conexões relevantes com base em afinidade:
// especialidades/skills em comum, mesma praça, complementaridade de papéis.
// Heurística transparente (mostra o "porquê" de cada sugestão). Pronta para
// receber, no futuro, um reforço de IA (BYO) via Edge Function.

const arr = (x) => (Array.isArray(x) ? x : [])
const lc = (s) => String(s || '').toLowerCase().trim()

// papéis que se complementam (ex.: arquiteto ↔ fornecedor/marceneiro)
const COMPLEMENT = {
  Arquiteto: ['Designer', 'Fornecedor', 'Fotógrafo', 'Consultor'],
  Designer: ['Arquiteto', 'Fotógrafo', 'Fornecedor'],
  Consultor: ['Arquiteto', 'Franqueado', 'Parceiro'],
  Fotógrafo: ['Arquiteto', 'Designer'],
  Artesão: ['Designer', 'Consultor'],
  Franqueado: ['Consultor', 'Parceiro', 'Fornecedor'],
}

function scoreMatch(me, other) {
  let score = 0
  const reasons = []
  const mySpecs = arr(me?.specialties).map(lc)
  const otherSpecs = arr(other.specialties).map(lc)
  const sharedSpecs = otherSpecs.filter((s) => mySpecs.includes(s))
  if (sharedSpecs.length) { score += sharedSpecs.length * 25; reasons.push(`${sharedSpecs.length} especialidade(s) em comum`) }

  const mySkills = arr(me?.skills).map(lc)
  const otherSkills = arr(other.skills).map(lc)
  const sharedSkills = otherSkills.filter((s) => mySkills.includes(s))
  if (sharedSkills.length) { score += sharedSkills.length * 15; reasons.push(`skills afins: ${arr(other.skills).filter((s) => mySkills.includes(lc(s))).slice(0, 2).join(', ')}`) }

  if (me?.city && other.city && lc(me.city) === lc(other.city)) { score += 20; reasons.push(`mesma cidade (${other.city})`) }
  else if (me?.state && other.state && lc(me.state) === lc(other.state)) { score += 8; reasons.push(`mesma UF (${other.state})`) }

  const comp = COMPLEMENT[me?.role_title] || []
  if (other.role_title && comp.includes(other.role_title)) { score += 18; reasons.push(`perfil complementar (${other.role_title})`) }
  else if (me?.role_title && other.role_title && me.role_title === other.role_title) { score += 6; reasons.push('mesma área de atuação') }

  if (other.open_to_work) { score += 6; reasons.push('aberto a oportunidades') }
  if ((other.rating || 0) >= 4) { score += 6 }

  return { score, reasons: reasons.slice(0, 3) }
}

export function SmartNetworking({ me, notify, onMessage }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [meMember, setMeMember] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('network_members').select('*').eq('status', 'active').limit(500)
        const all = data || []
        if (!alive) return
        setMembers(all)
        const mine = me?.id ? all.find((m) => m.id === me.id) : all.find((m) => m.tenant_id === tenantId)
        setMeMember(mine || null)
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [me, tenantId])

  const suggestions = useMemo(() => {
    if (!meMember) return []
    return members
      .filter((m) => m.id !== meMember.id && m.tenant_id !== meMember.tenant_id)
      .map((m) => ({ member: m, ...scoreMatch(meMember, m) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
  }, [meMember, members])

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-admin-text flex items-center gap-2"><Icon name="sparkles" className="w-6 h-6 text-admin-champ" />Networking Inteligente</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Conexões sugeridas por afinidade real: especialidades, praça e complementaridade de perfil.</p>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-44 animate-pulse opacity-40" />)}</div>
        : !meMember ? <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Complete seu perfil no Network para receber sugestões personalizadas.</p></div>
          : suggestions.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="sparkles" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Ainda não há conexões sugeridas.</p><p className="text-admin-muted/35 text-xs mt-1">Adicione especialidades e skills ao seu perfil para melhorar as recomendações.</p></div>
            : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map(({ member: m, score, reasons }) => (
                  <div key={m.id} className="glass rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" /> : <div className="w-12 h-12 rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center shrink-0">{initials(m.name)}</div>}
                      <div className="min-w-0 flex-1"><p className="text-admin-text font-medium truncate">{m.name}</p><p className="text-admin-muted/45 text-xs truncate">{m.headline || m.role_title || 'Membro'}</p></div>
                      <div className="text-right shrink-0"><div className="text-admin-champ text-sm font-serif">{Math.min(99, score)}%</div><p className="text-[9px] uppercase tracking-wider text-admin-muted/40">afinidade</p></div>
                    </div>
                    {reasons.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {reasons.map((r, i) => <p key={i} className="text-[11px] text-admin-muted/55 flex items-center gap-1.5"><Icon name="check" className="w-3 h-3 text-admin-sage shrink-0" />{r}</p>)}
                      </div>
                    )}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.05]">
                      <button className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 transition-colors flex items-center justify-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />Conectar</button>
                      <button onClick={() => onMessage?.(m.id)} className="text-xs px-3 py-1.5 rounded-lg glass-input text-admin-muted/70 hover:text-admin-champ transition-colors flex items-center gap-1.5"><Icon name="mail" className="w-3.5 h-3.5" />Mensagem</button>
                    </div>
                  </div>
                ))}
              </div>}
    </div>
  )
}
