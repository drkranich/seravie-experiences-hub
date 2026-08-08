import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { VERIF, PERSON_TYPES, initials } from '../../../lib/networkSocial'

// Pessoas & Empresas — diretório de perfis profissionais + perfil rico.

function Avatar({ name, url, size = 'w-12 h-12', text = 'text-base' }) {
  return url ? <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
    : <div className={`${size} rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center shrink-0 ${text} font-medium`}>{initials(name)}</div>
}
function Seal({ level }) { const v = VERIF[level] || VERIF.member; return <span className={`text-[10px] px-2 py-0.5 rounded-lg ${v.style}`}>{v.label}</span> }

export function People({ notify, onMessage }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try { const { data } = await supabase.from('network_members').select('*').eq('status', 'active').order('rating', { ascending: false }).limit(300); if (alive) setMembers(data || []) }
      catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const nq = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return members.filter((m) => {
      if (type && m.role_title !== type) return false
      if (nq) { const hay = [m.name, m.headline, m.company, m.city, ...(Array.isArray(m.specialties) ? m.specialties : [])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (!hay.includes(nq)) return false }
      return true
    })
  }, [members, q, type])

  if (open) return <MemberProfile member={open} onBack={() => setOpen(null)} onMessage={onMessage} />

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Pessoas & Empresas</h1><p className="text-admin-muted/50 text-sm mt-1">Profissionais e empresas do ecossistema Seravie.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={type} onChange={setType} options={[{ value: '', label: 'Todos os tipos' }, ...PERSON_TYPES.map((t) => ({ value: t, label: t }))]} /></div>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-52"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
        </div>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-40 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Nenhum perfil encontrado.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((m) => (
                <button key={m.id} onClick={() => setOpen(m)} className="glass rounded-2xl p-5 text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} url={m.avatar_url} />
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="text-admin-text font-medium truncate">{m.name}</p><Seal level={m.verification_level} /></div><p className="text-admin-muted/45 text-xs truncate">{m.headline || m.role_title || 'Membro'}</p></div>
                  </div>
                  {m.company && <p className="text-admin-muted/50 text-xs mt-3">{m.company}{m.city ? ` · ${m.city}` : ''}</p>}
                  {Array.isArray(m.specialties) && m.specialties.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{m.specialties.slice(0, 3).map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-admin-muted/60">{s}</span>)}</div>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05] text-[11px] text-admin-muted/40">
                    <span>{m.connections || 0} conexões</span>{m.rating > 0 && <span className="text-admin-gold">★ {Number(m.rating).toFixed(1)}</span>}
                  </div>
                </button>
              ))}
            </div>}
    </div>
  )
}

function MemberProfile({ member: m, onBack, onMessage }) {
  const specialties = Array.isArray(m.specialties) ? m.specialties : []
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar</button>
      <div className="relative rounded-3xl overflow-hidden h-40 bg-gradient-to-br from-admin-copper/20 to-admin-champ/10 mb-0"><div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" /></div>
      <div className="px-6 -mt-10 relative z-10">
        <div className="flex items-end gap-4 flex-wrap">
          <Avatar name={m.name} url={m.avatar_url} size="w-24 h-24 ring-4 ring-admin-side" text="text-2xl" />
          <div className="flex-1 min-w-[200px] pb-1">
            <div className="flex items-center gap-2 flex-wrap"><h1 className="font-serif text-2xl text-admin-text">{m.name}</h1><Seal level={m.verification_level} /></div>
            <p className="text-admin-muted/55 text-sm mt-0.5">{m.headline || m.role_title || 'Membro do ecossistema'}</p>
            {m.company && <p className="text-admin-muted/45 text-xs mt-0.5">{m.company}{m.city ? ` · ${m.city}${m.state ? '/' + m.state : ''}` : ''}</p>}
          </div>
          <div className="flex gap-2 pb-1">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 transition-colors"><Icon name="plus" className="w-4 h-4" />Conectar</button>
            <button onClick={() => onMessage?.(m.id)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm glass-input text-admin-muted/70 hover:text-admin-champ transition-colors"><Icon name="mail" className="w-4 h-4" />Mensagem</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6 max-w-md">
          <Stat label="Conexões" value={m.connections || 0} />
          <Stat label="Avaliação" value={m.rating > 0 ? `${Number(m.rating).toFixed(1)} ★` : '—'} />
          <Stat label="Nível" value={(VERIF[m.verification_level] || VERIF.member).label} />
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-6 pb-8">
          <div className="lg:col-span-2 space-y-5">
            {m.bio && <div className="glass rounded-2xl p-5"><h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2">Sobre</h3><p className="text-admin-muted/70 text-sm leading-relaxed whitespace-pre-wrap">{m.bio}</p></div>}
            {specialties.length > 0 && <div className="glass rounded-2xl p-5"><h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Especialidades</h3><div className="flex flex-wrap gap-2">{specialties.map((s, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-admin-muted/70">{s}</span>)}</div></div>}
          </div>
          <div className="glass rounded-2xl p-5 space-y-3 h-fit">
            <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70">Contato</h3>
            {m.website && <a href={m.website.startsWith('http') ? m.website : `https://${m.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-muted/70 hover:text-admin-text"><Icon name="link" className="w-4 h-4" />Site</a>}
            {m.linkedin && <a href={m.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-sage/80 hover:underline"><Icon name="user" className="w-4 h-4" />LinkedIn</a>}
            {m.instagram && <a href={m.instagram.startsWith('http') ? m.instagram : `https://instagram.com/${m.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-champ/80 hover:underline"><Icon name="star" className="w-4 h-4" />Instagram</a>}
            {!m.website && !m.linkedin && !m.instagram && <p className="text-admin-muted/40 text-xs">Sem links públicos.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
function Stat({ label, value }) { return <div className="glass rounded-xl px-4 py-3 text-center"><p className="text-admin-text text-lg font-serif">{value}</p><p className="text-[10px] uppercase tracking-wider text-admin-muted/45 mt-0.5">{label}</p></div> }
