import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { PERSON_TYPES, timeAgo } from '../../../lib/networkSocial'
import { usePersonTypes } from '../../../lib/personTypes'
import { uploadTo } from '../../../lib/storage'

const MAX_FILES = 10
const fileKind = (f) => { const t = f.type || ''; const n = (f.name || '').toLowerCase(); if (t.startsWith('image/')) return 'image'; if (t.startsWith('video/')) return 'video'; if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'; return 'file' }
const KIND_ICON = { image: 'image', video: 'play', pdf: 'book', file: 'folder' }

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const REQ_STATUS = { open: { label: 'Aberto', s: 'bg-admin-champ/15 text-admin-champ' }, in_review: { label: 'Em análise', s: 'bg-admin-gold/15 text-admin-gold' }, awarded: { label: 'Contratado', s: 'bg-admin-sage/15 text-admin-sage' }, closed: { label: 'Encerrado', s: 'bg-white/[0.06] text-admin-muted/50' } }

// Marketplace de Serviços — publique um briefing (preciso de arquiteto/fotógrafo…),
// receba propostas, selecione e contrate.
export function ServiceMarketplace({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const personTypes = usePersonTypes()
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)   // briefing sendo editado
  const [confirmDel, setConfirmDel] = useState(null)
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
  const update = async (id, payload) => {
    const { data, error } = await supabase.from('service_requests').update(payload).eq('id', id).select('*, service_proposals(*)').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setReqs((r) => r.map((x) => (x.id === id ? data : x))); setEditing(null); notify?.('Briefing atualizado', 'success')
  }
  const remove = async (req) => {
    await supabase.from('service_proposals').delete().eq('request_id', req.id)
    const { error } = await supabase.from('service_requests').delete().eq('id', req.id)
    if (error) return notify?.('Erro ao excluir: ' + error.message, 'error')
    setReqs((r) => r.filter((x) => x.id !== req.id)); setConfirmDel(null); setOpen(null); notify?.('Briefing excluído', 'success')
  }

  if (open) {
    const fresh = reqs.find((r) => r.id === open.id) || open
    return <RequestDetail request={fresh} tenantId={tenantId} me={me} onBack={() => { setOpen(null); load() }} reload={load} notify={notify} onEdit={() => { setOpen(null); setEditing(fresh) }} onDelete={() => { setOpen(null); setConfirmDel(fresh) }} />
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
                <div key={r.id} className="group glass rounded-2xl p-5 hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <button onClick={() => setOpen(r)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap"><p className="text-admin-text font-medium">{r.title}</p>{r.role && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{r.role}</span>}<span className={`text-[10px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span>{mine && <span className="text-[10px] text-admin-champ/60">seu</span>}</div>
                        {r.description && <p className="text-admin-muted/55 text-sm mt-2 line-clamp-2">{r.description}</p>}
                        <p className="text-admin-muted/40 text-[11px] mt-2">{props.length} proposta{props.length === 1 ? '' : 's'}{r.location ? ` · ${r.location}` : ''}{Array.isArray(r.attachments) && r.attachments.length ? ` · ${r.attachments.length} anexo${r.attachments.length === 1 ? '' : 's'}` : ''} · {timeAgo(r.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">{r.budget ? <p className="text-admin-champ text-sm">{brl(r.budget)}</p> : null}{r.deadline && <p className="text-admin-muted/40 text-[11px] mt-0.5">até {new Date(r.deadline).toLocaleDateString('pt-BR')}</p>}</div>
                    </div>
                  </button>
                  {mine && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.05]">
                      <button onClick={() => setEditing(r)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-[#1c1c1c] backdrop-blur-md shadow-sm transition-colors" title="Editar briefing"><Icon name="pen" className="w-3.5 h-3.5" />Editar</button>
                      <button onClick={() => setConfirmDel(r)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-admin-rose backdrop-blur-md shadow-sm transition-colors" title="Excluir briefing"><Icon name="trash" className="w-3.5 h-3.5" />Excluir</button>
                    </div>
                  )}
                </div>
              )})}
            </div>}

      {creating && <CreateRequest onClose={() => setCreating(false)} onCreate={create} personTypes={personTypes} notify={notify} />}
      {editing && <CreateRequest initial={editing} onClose={() => setEditing(null)} onCreate={(payload) => update(editing.id, payload)} personTypes={personTypes} notify={notify} />}
      {confirmDel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg text-admin-text mb-2">Excluir briefing?</h2>
            <p className="text-admin-muted/60 text-sm mb-5">O briefing <span className="text-admin-text">"{confirmDel.title}"</span> e todas as propostas recebidas serão removidos. Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2"><button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => remove(confirmDel)} className="px-4 py-2 rounded-xl text-sm bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose">Excluir briefing</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

const MODALITY = [{ value: '', label: 'Modalidade' }, { value: 'presencial', label: 'Presencial' }, { value: 'remoto', label: 'Remoto' }, { value: 'hibrido', label: 'Híbrido' }]
const URGENCY = [{ value: '', label: 'Urgência' }, { value: 'baixa', label: 'Sem pressa' }, { value: 'media', label: 'Nas próximas semanas' }, { value: 'alta', label: 'Urgente' }]

function CreateRequest({ onClose, onCreate, personTypes, initial, notify }) {
  const [f, setF] = useState({
    title: initial?.title || '', role: initial?.role || '', description: initial?.description || '',
    budget: initial?.budget ?? '', budget_max: initial?.budget_max ?? '', deadline: initial?.deadline || '',
    location: initial?.location || '', modality: initial?.modality || '', urgency: initial?.urgency || '',
    quantity: initial?.quantity || '', requirements: initial?.requirements || '', references: initial?.references || '',
  })
  const [attachments, setAttachments] = useState(Array.isArray(initial?.attachments) ? initial.attachments : [])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const roleOpts = [{ value: '', label: 'Tipo de profissional' }, ...(personTypes || PERSON_TYPES).map((t) => ({ value: t, label: t }))]
  const editing = !!initial

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    const room = MAX_FILES - attachments.length
    if (room <= 0) { notify?.(`Limite de ${MAX_FILES} arquivos atingido.`, 'error'); return }
    const take = files.slice(0, room)
    if (files.length > room) notify?.(`Enviando ${room} de ${files.length} — limite de ${MAX_FILES}.`, 'info')
    setUploading(true)
    const added = []
    for (const file of take) {
      const r = await uploadTo(file, { folder: 'network/briefings', accept: 'any', maxMB: 50 })
      if (r.error) { notify?.(r.error, 'error'); continue }
      added.push({ url: r.url, name: file.name, kind: fileKind(file) })
    }
    setUploading(false); if (fileRef.current) fileRef.current.value = ''
    if (added.length) setAttachments((a) => [...a, ...added])
  }
  const rmFile = (i) => setAttachments((a) => a.filter((_, j) => j !== i))
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">{editing ? 'Editar briefing' : 'Publicar briefing'}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className={lbl}>O que você precisa? *</label><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Projeto de arquitetura para cafeteria" className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tipo de profissional</label><GlassSelect value={f.role} onChange={(v) => set('role', v)} options={roleOpts} /></div>
            <div><label className={lbl}>Modalidade</label><GlassSelect value={f.modality} onChange={(v) => set('modality', v)} options={MODALITY} /></div>
          </div>
          <div><label className={lbl}>Descrição do projeto</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Escopo, contexto, objetivo…" className={`${cls} resize-none`} /></div>
          <div><label className={lbl}>Requisitos / qualificações desejadas</label><textarea value={f.requirements} onChange={(e) => set('requirements', e.target.value)} rows={2} placeholder="Ex.: portfólio em hospitalidade, experiência com aprovação em prefeitura…" className={`${cls} resize-none`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Orçamento mín. (R$)</label><input type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder="0" className={cls} /></div>
            <div><label className={lbl}>Orçamento máx. (R$)</label><input type="number" value={f.budget_max} onChange={(e) => set('budget_max', e.target.value)} placeholder="opcional" className={cls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Prazo desejado</label><GlassDate value={f.deadline} onChange={(v) => set('deadline', v)} placeholder="dd/mm/aaaa" /></div>
            <div><label className={lbl}>Urgência</label><GlassSelect value={f.urgency} onChange={(v) => set('urgency', v)} options={URGENCY} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Localização / remoto</label><input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Ex.: São Paulo/SP" className={cls} /></div>
            <div><label className={lbl}>Quantidade / volume</label><input value={f.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="Ex.: 1 projeto, 200 un" className={cls} /></div>
          </div>
          <div><label className={lbl}>Links de referência (opcional)</label><input value={f.references} onChange={(e) => set('references', e.target.value)} placeholder="Cole links de inspiração, Pinterest, drive…" className={cls} /></div>

          {/* Anexos: imagens, PDF e vídeos (até 10) */}
          <div>
            <div className="flex items-center justify-between mb-1.5"><label className="text-[10px] uppercase tracking-wider text-admin-muted/50">Anexos ({attachments.length}/{MAX_FILES})</label><span className="text-[10px] text-admin-muted/35">imagens, PDF, vídeos</span></div>
            <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" multiple onChange={onFiles} className="hidden" />
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative group glass-input rounded-xl overflow-hidden">
                    {a.kind === 'image' ? <img src={a.url} alt={a.name} className="w-full h-20 object-cover" />
                      : <div className="w-full h-20 flex flex-col items-center justify-center gap-1 text-admin-champ/60"><Icon name={KIND_ICON[a.kind] || 'folder'} className="w-5 h-5" /><span className="text-[9px] text-admin-muted/50 px-2 truncate max-w-full">{a.name}</span></div>}
                    <button onClick={() => rmFile(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white/80 hover:text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length < MAX_FILES && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-muted/60 hover:text-admin-champ flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Icon name={uploading ? 'clock' : 'upload'} className="w-4 h-4" />{uploading ? 'Enviando…' : 'Adicionar arquivos'}</button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.title.trim() && onCreate({ title: f.title, role: f.role || null, description: f.description || null, requirements: f.requirements || null, budget: f.budget ? Number(f.budget) : null, budget_max: f.budget_max ? Number(f.budget_max) : null, deadline: f.deadline || null, location: f.location || null, modality: f.modality || null, urgency: f.urgency || null, quantity: f.quantity || null, references: f.references || null, attachments })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">{editing ? 'Salvar' : 'Publicar'}</button></div>
      </div>
    </div>
  )
}

function RequestDetail({ request, tenantId, me, onBack, reload, notify, onEdit, onDelete }) {
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
            <div className="flex items-center gap-2 flex-wrap"><h1 className="font-serif text-2xl text-admin-text">{request.title}</h1>{request.role && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{request.role}</span>}{request.modality && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-admin-sage/12 text-admin-sage">{MODALITY.find((x) => x.value === request.modality)?.label || request.modality}</span>}{request.urgency && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-admin-gold/12 text-admin-gold">{URGENCY.find((x) => x.value === request.urgency)?.label || request.urgency}</span>}</div>
            {request.description && <p className="text-admin-muted/65 text-sm mt-3 max-w-2xl leading-relaxed whitespace-pre-wrap">{request.description}</p>}
            {request.requirements && <div className="mt-3"><p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-1">Requisitos</p><p className="text-admin-muted/60 text-sm max-w-2xl leading-relaxed whitespace-pre-wrap">{request.requirements}</p></div>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[11px] text-admin-muted/50">
              {request.location && <span className="flex items-center gap-1"><Icon name="map" className="w-3.5 h-3.5" />{request.location}</span>}
              {request.quantity && <span className="flex items-center gap-1"><Icon name="box" className="w-3.5 h-3.5" />{request.quantity}</span>}
              {request.references && <a href={request.references.startsWith('http') ? request.references : `https://${request.references}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-admin-champ/70 hover:underline"><Icon name="link" className="w-3.5 h-3.5" />Referências</a>}
            </div>
          </div>
          <div className="text-right shrink-0">
            {request.budget ? <p className="text-admin-champ text-lg font-serif">{brl(request.budget)}{request.budget_max ? ` – ${brl(request.budget_max)}` : ''}</p> : null}
            {request.deadline && <p className="text-admin-muted/40 text-xs mt-0.5">Prazo: {new Date(request.deadline).toLocaleDateString('pt-BR')}</p>}
            {isOwner && (
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={onEdit} className="text-xs px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-[#1c1c1c] backdrop-blur-md shadow-sm transition-colors flex items-center gap-1.5"><Icon name="pen" className="w-3.5 h-3.5" />Editar</button>
                <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-admin-rose backdrop-blur-md shadow-sm transition-colors flex items-center gap-1.5"><Icon name="trash" className="w-3.5 h-3.5" />Excluir</button>
              </div>
            )}
          </div>
        </div>
        {Array.isArray(request.attachments) && request.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-2">Anexos ({request.attachments.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {request.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="group glass-input rounded-xl overflow-hidden block" title={a.name}>
                  {a.kind === 'image' ? <img src={a.url} alt={a.name} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                    : <div className="w-full h-20 flex flex-col items-center justify-center gap-1 text-admin-champ/60"><Icon name={KIND_ICON[a.kind] || 'folder'} className="w-5 h-5" /><span className="text-[9px] text-admin-muted/50 px-2 truncate max-w-full">{a.name}</span></div>}
                </a>
              ))}
            </div>
          </div>
        )}
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
