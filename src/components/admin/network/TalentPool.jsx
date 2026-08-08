import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { PERSON_TYPES, VERIF, initials } from '../../../lib/networkSocial'

// Banco de Talentos & Oportunidades — profissionais abertos a oportunidades.
// O membro marca "aberto a oportunidades" no próprio perfil; aqui empresas descobrem.

function Avatar({ name, url, size = 'w-12 h-12', text = 'text-base' }) {
  return url ? <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
    : <div className={`${size} rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center shrink-0 ${text} font-medium`}>{initials(name)}</div>
}

export function TalentPool({ me, notify, onMessage }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [meMember, setMeMember] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('network_members').select('*').eq('status', 'active').eq('open_to_work', true).order('rating', { ascending: false }).limit(200)
      setMembers(data || [])
      if (me?.id) { const { data: mm } = await supabase.from('network_members').select('*').eq('id', me.id).maybeSingle(); setMeMember(mm) }
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const toggleMine = async () => {
    if (!me?.id) return notify?.('Perfil de membro não encontrado', 'error')
    const next = !meMember?.open_to_work
    const { error } = await supabase.from('network_members').update({ open_to_work: next }).eq('id', me.id)
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setMeMember((m) => ({ ...(m || {}), open_to_work: next })); notify?.(next ? 'Você está aberto a oportunidades.' : 'Removido do banco de talentos.', 'success'); load()
  }

  const filtered = useMemo(() => {
    const nq = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return members.filter((m) => {
      if (type && m.role_title !== type) return false
      if (nq) { const hay = [m.name, m.headline, m.company, ...(Array.isArray(m.specialties) ? m.specialties : []), ...(Array.isArray(m.skills) ? m.skills : [])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (!hay.includes(nq)) return false }
      return true
    })
  }, [members, q, type])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Banco de Talentos</h1><p className="text-admin-muted/50 text-sm mt-1">Profissionais abertos a novas oportunidades no ecossistema.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={type} onChange={setType} options={[{ value: '', label: 'Todos os tipos' }, ...PERSON_TYPES.map((t) => ({ value: t, label: t }))]} /></div>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-48"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar talento…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
        </div>
      </div>

      {/* toggle do próprio membro */}
      {me?.id && (
        <div className="glass-soft rounded-2xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-admin-text/80"><Icon name="spark" className="w-4 h-4 text-admin-champ" />Quer aparecer aqui para empresas que buscam profissionais?</div>
          <button onClick={toggleMine} className={`text-sm px-4 py-2 rounded-xl transition-colors ${meMember?.open_to_work ? 'bg-admin-sage/12 text-admin-sage' : 'bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20'}`}>{meMember?.open_to_work ? '✓ Aberto a oportunidades' : 'Ativar disponibilidade'}</button>
        </div>
      )}

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-36 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Nenhum talento disponível no momento.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((m) => (
                <div key={m.id} className="glass rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} url={m.avatar_url} />
                    <div className="min-w-0 flex-1"><p className="text-admin-text font-medium truncate">{m.name}</p><p className="text-admin-muted/45 text-xs truncate">{m.headline || m.role_title}</p></div>
                    <span className="text-[9px] px-2 py-0.5 rounded-lg bg-admin-sage/15 text-admin-sage shrink-0">disponível</span>
                  </div>
                  {Array.isArray(m.skills) && m.skills.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{m.skills.slice(0, 4).map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-admin-muted/60">{s}</span>)}</div>}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.05]">
                    {m.rating > 0 && <span className="text-admin-gold text-[11px]">★ {Number(m.rating).toFixed(1)}</span>}
                    <button onClick={() => onMessage?.(m.id)} className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 transition-colors flex items-center gap-1.5"><Icon name="mail" className="w-3.5 h-3.5" />Mensagem</button>
                  </div>
                </div>
              ))}
            </div>}
    </div>
  )
}
