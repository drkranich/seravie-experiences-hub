import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { PERSON_TYPES, timeAgo } from '../../../lib/networkSocial'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const REQ_STATUS = { open: { label: 'Aberto', s: 'bg-admin-champ/15 text-admin-champ' }, in_review: { label: 'Em análise', s: 'bg-admin-gold/15 text-admin-gold' }, awarded: { label: 'Contratado', s: 'bg-admin-sage/15 text-admin-sage' }, closed: { label: 'Encerrado', s: 'bg-white/[0.06] text-admin-muted/50' } }

// Marketplace de Serviços — publique um briefing (preciso de arquiteto/fotógrafo…),
// receba propostas, selecione e contrate.
export function ServiceMarketplace({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('all') // all | mine

  const load = useCallback(async () => {
    setLoading(true)
    try { const { data } = await supabase.from('service_requests').select('*, service_proposals(*)').order('created_at', { ascending: false }).limit(100); setReqs(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (payload) => {
    const { data, error } = await supabase.from('service_requests').insert({ ...payload, tenant_id: tenantId, status: 'open' }).select('*, service_proposals(*)').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setReqs((r) => [data, ...r]); setCreating(false); notify?.('Briefing publicado', 'success')
  }

  if (open) {
    const fresh = reqs.find((r) => r.id === open.id) || open
    return <RequestDetail request={fresh} tenantId={tenantId} me={me} onBack={() => { setOpen(null); load() }} reload={load} notify={notify} />
  }

  const shown = filter === 'mine' ? reqs.filter((r) => r.tenant_id === tenantId) : reqs

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Marketplace de Serviços</h1><p className="text-admin-muted/50 text-sm mt-1">Publique o que precisa e receba propostas de profissionais da rede.</p></div>
        <div className="flex items-center gap-2">
          <GlassSelect value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos os briefings' }, { value: 'mine', label: 'Meus briefings' }]} className="w-44" />
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Publicar briefing</button>
        </div>
      </div>

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-28 animate-pulse opacity-40" />)}</div>
        : shown.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="mail" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum briefing ainda.</p><p className="text-admin-muted/35 text-xs mt-1">Publique o que precisa (arquiteto, fotógrafo, fornecedor…) e receba propostas.</p></div>
          : <div className="space-y-3">
              {shown.map((r) => { const st = REQ_STATUS[r.status] || REQ_STATUS.open; const props = r.service_proposals || []; const mine = r.tenant_id === tenantId; return (
                <button key={r.id} onClick={() => setOpen(r)} className="w-full text-left glass rounded-2xl p-5 hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><p className="text-admin-text font-medium">{r.title}</p>{r.role && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{r.role}</span>}<span className={`text-[10px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span>{mine && <span className="text-[10px] text-admin-champ/60">seu</span>}</div>
                      {r.description && <p className="text-admin-muted/55 text-sm mt-2 line-clamp-2">{r.description}</p>}
                      <p className="text-admin-muted/40 text-[11px] mt-2">{props.length} proposta{props.length === 1 ? '' : 's'}{r.location ? ` · ${r.location}` : ''} · {timeAgo(r.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">{r.budget ? <p className="text-admin-champ text-sm">{brl(r.budget)}</p> : null}{r.deadline && <p className="text-admin-muted/40 text-[11px] mt-0.5">até {new Date(r.deadline).toLocaleDateString('pt-BR')}</p>}</div>
                  </div>
                </button>
              )})}
            </div>}

      {creating && <CreateRequest onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  )
}

function CreateRequest({ onClose, onCreate }) {
  const [f, setF] = useState({ title: '', role: '', description: '', budget: '', deadline: '', location: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Publicar briefing</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="O que você precisa? *" className={cls} />
          <GlassSelect value={f.role} onChange={(v) => set('role', v)} options={[{ value: '', label: 'Tipo de profissional' }, ...PERSON_TYPES.map((t) => ({ value: t, label: t }))]} />
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Descreva o projeto, escopo, referências…" className={`${cls} resize-none`} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder="Orçamento (R$)" className={cls} />
            <input type="date" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} className={cls} />
          </div>
          <input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Localização / remoto" className={cls} />
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.title.trim() && onCreate({ title: f.title, role: f.role || null, description: f.description || null, budget: f.budget ? Number(f.budget) : null, deadline: f.deadline || null, location: f.location || null })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Publicar</button></div>
      </div>
    </div>
  )
}

function RequestDetail({ request, tenantId, me, onBack, reload, notify }) {
  const [proposeOpen, setProposeOpen] = useState(false)
  const isOwner = request.tenant_id === tenantId
  const props = request.service_proposals || []
  const myProposal = props.find((p) => p.tenant_id === tenantId)

  const award = async (p) => {
    await supabase.from('service_proposals').update({ status: 'rejected' }).eq('request_id', request.id).neq('id', p.id)
    await supabase.from('service_proposals').update({ status: 'awarded' }).eq('id', p.id)
    await supabase.from('service_requests').update({ status: 'awarded' }).eq('id', request.id)
    // notifica o profissional escolhido
    supabase.from('notifications').insert({ tenant_id: p.tenant_id, kind: 'system', title: 'Sua proposta foi aceita!', body: request.title, icon: 'check', link_route: 'network_hub' })
    notify?.('Profissional contratado.', 'success'); reload()
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar</button>
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap"><h1 className="font-serif text-2xl text-admin-text">{request.title}</h1>{request.role && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{request.role}</span>}</div>
            {request.description && <p className="text-admin-muted/65 text-sm mt-3 max-w-2xl leading-relaxed">{request.description}</p>}
          </div>
          <div className="text-right shrink-0">{request.budget ? <p className="text-admin-champ text-lg font-serif">{brl(request.budget)}</p> : null}{request.deadline && <p className="text-admin-muted/40 text-xs mt-0.5">Prazo: {new Date(request.deadline).toLocaleDateString('pt-BR')}</p>}</div>
        </div>
        {!isOwner && request.status === 'open' && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            {myProposal ? <p className="text-admin-sage text-sm flex items-center gap-2"><Icon name="check" className="w-4 h-4" />Você já enviou uma proposta.</p>
              : <button onClick={() => setProposeOpen(true)} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">Enviar proposta</button>}
          </div>
        )}
      </div>

      {/* propostas — só o dono do briefing vê todas; o profissional vê a sua */}
      <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Propostas {isOwner ? `(${props.length})` : ''}</h3>
      {props.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><p className="text-admin-muted/50 text-sm">{isOwner ? 'Nenhuma proposta ainda.' : 'Envie sua proposta acima.'}</p></div>
        : <div className="space-y-3">
            {(isOwner ? props : props.filter((p) => p.tenant_id === tenantId)).map((p) => (
              <div key={p.id} className={`glass rounded-2xl p-4 ${p.status === 'awarded' ? 'ring-1 ring-admin-sage/40' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.author_avatar ? <img src={p.author_avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center text-xs">{(p.author_name || '?').slice(0, 2).toUpperCase()}</div>}
                    <div className="min-w-0"><p className="text-admin-text text-sm">{p.author_name || 'Profissional'}</p><p className="text-admin-muted/40 text-[11px]">{timeAgo(p.created_at)}{p.status === 'awarded' ? ' · Contratado' : ''}</p></div>
                  </div>
                  <div className="text-right shrink-0">{p.price ? <p className="text-admin-champ text-sm">{brl(p.price)}</p> : null}{p.lead_time && <p className="text-admin-muted/40 text-[11px]">{p.lead_time}</p>}</div>
                </div>
                {p.message && <p className="text-admin-muted/70 text-sm mt-2">{p.message}</p>}
                {isOwner && request.status === 'open' && <div className="mt-3"><button onClick={() => award(p)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-sage/12 text-admin-sage hover:bg-admin-sage/20 transition-colors">Contratar este</button></div>}
              </div>
            ))}
          </div>}

      {proposeOpen && <ProposeModal request={request} tenantId={tenantId} me={me} onClose={() => setProposeOpen(false)} onDone={() => { setProposeOpen(false); reload() }} notify={notify} />}
    </div>
  )
}

function ProposeModal({ request, tenantId, me, onClose, onDone, notify }) {
  const [f, setF] = useState({ message: '', price: '', lead_time: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const send = async () => {
    if (!f.message.trim()) return notify?.('Escreva sua proposta', 'error')
    const { error } = await supabase.from('service_proposals').insert({ request_id: request.id, tenant_id: tenantId, member_id: me?.id, author_name: me?.name || 'Você', author_avatar: me?.avatar_url || null, message: f.message, price: f.price ? Number(f.price) : null, lead_time: f.lead_time || null })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    await supabase.from('service_requests').update({ proposals_count: (request.proposals_count || 0) + 1 }).eq('id', request.id)
    supabase.from('notifications').insert({ tenant_id: request.tenant_id, kind: 'system', title: `Nova proposta para "${request.title}"`, body: (me?.name || 'Um profissional') + ' enviou uma proposta.', icon: 'mail', link_route: 'network_hub', actor_name: me?.name })
    notify?.('Proposta enviada', 'success'); onDone()
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Enviar proposta</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <textarea value={f.message} onChange={(e) => set('message', e.target.value)} rows={4} placeholder="Sua proposta, abordagem e diferenciais…" className={`${cls} resize-none`} />
          <div className="grid grid-cols-2 gap-3"><input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="Valor (R$)" className={cls} /><input value={f.lead_time} onChange={(e) => set('lead_time', e.target.value)} placeholder="Prazo (ex.: 20 dias)" className={cls} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={send} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Enviar proposta</button></div>
      </div>
    </div>
  )
}
