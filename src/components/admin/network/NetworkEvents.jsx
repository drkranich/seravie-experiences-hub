import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { uploadTo } from '../../../lib/storage'

// Eventos do Network — congressos, lives, workshops, webinars, missões técnicas.
// Criar, inscrever-se, ver participantes.

const KINDS = {
  congresso: 'Congresso', live: 'Live', workshop: 'Workshop', webinar: 'Webinar',
  treinamento: 'Treinamento', missao: 'Missão técnica', networking: 'Networking',
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export function NetworkEvents({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [events, setEvents] = useState([])
  const [signups, setSignups] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ev }, { data: su }] = await Promise.all([
        supabase.from('network_events').select('*').order('starts_at', { ascending: true }).limit(100),
        supabase.from('network_event_signups').select('event_id').eq('tenant_id', tenantId),
      ])
      setEvents(ev || []); setSignups(new Set((su || []).map((s) => s.event_id)))
    } catch { /* noop */ } finally { setLoading(false) }
  }, [tenantId])
  useEffect(() => { load() }, [load])

  const create = async (payload) => {
    const { data, error } = await supabase.from('network_events').insert({ ...payload, tenant_id: tenantId, status: 'active' }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setEvents((e) => [data, ...e].sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0))); setCreating(false); notify?.('Evento criado', 'success')
  }
  const toggleSignup = async (ev) => {
    const has = signups.has(ev.id)
    setSignups((p) => { const n = new Set(p); has ? n.delete(ev.id) : n.add(ev.id); return n })
    setEvents((p) => p.map((x) => x.id === ev.id ? { ...x, signups_count: Math.max(0, (x.signups_count || 0) + (has ? -1 : 1)) } : x))
    try {
      if (has) await supabase.from('network_event_signups').delete().eq('event_id', ev.id).eq('tenant_id', tenantId)
      else await supabase.from('network_event_signups').insert({ event_id: ev.id, tenant_id: tenantId, member_id: me?.id, member_name: me?.name })
      await supabase.from('network_events').update({ signups_count: Math.max(0, (ev.signups_count || 0) + (has ? -1 : 1)) }).eq('id', ev.id)
    } catch { /* noop */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Eventos</h1><p className="text-admin-muted/50 text-sm mt-1">Congressos, lives, workshops e missões técnicas do ecossistema.</p></div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Criar evento</button>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-52 animate-pulse opacity-40" />)}</div>
        : events.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="calendar" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum evento ainda.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((ev) => { const joined = signups.has(ev.id); return (
                <div key={ev.id} className="glass rounded-2xl overflow-hidden flex flex-col">
                  <div className="h-28 bg-gradient-to-br from-admin-champ/15 to-admin-copper/10 relative">
                    {ev.cover_url ? <img src={ev.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="calendar" className="w-8 h-8 text-admin-champ/25" /></div>}
                    <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider bg-black/50 backdrop-blur-md text-white px-2 py-0.5 rounded">{KINDS[ev.kind] || ev.kind || 'Evento'}</span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-admin-text font-medium">{ev.title}</p>
                    <p className="text-admin-muted/45 text-xs mt-1 flex items-center gap-1.5"><Icon name="clock" className="w-3.5 h-3.5" />{fmtDate(ev.starts_at)}{ev.city ? ` · ${ev.city}` : ''}</p>
                    {ev.speaker && <p className="text-admin-muted/45 text-xs mt-1 flex items-center gap-1.5"><Icon name="user" className="w-3.5 h-3.5" />{ev.speaker}</p>}
                    {ev.description && <p className="text-admin-muted/50 text-xs mt-2 line-clamp-2 flex-1">{ev.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {ev.price != null && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-champ/12 text-admin-champ">{ev.price > 0 ? `R$ ${Number(ev.price).toLocaleString('pt-BR')}` : 'Gratuito'}</span>}
                      {ev.capacity ? <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/55">{ev.capacity} vagas</span> : null}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
                      <span className="text-admin-muted/40 text-[11px]">{ev.signups_count || 0} inscritos</span>
                      <button onClick={() => toggleSignup(ev)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${joined ? 'bg-admin-sage/12 text-admin-sage' : 'bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20'}`}>{joined ? '✓ Inscrito' : 'Inscrever-se'}</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>}

      {creating && <CreateEvent onClose={() => setCreating(false)} onCreate={create} notify={notify} />}
    </div>
  )
}

const MODALITY = [{ value: '', label: 'Modalidade' }, { value: 'presencial', label: 'Presencial' }, { value: 'online', label: 'Online' }, { value: 'hibrido', label: 'Híbrido' }]

function CreateEvent({ onClose, onCreate, notify }) {
  const [f, setF] = useState({ title: '', kind: 'workshop', description: '', starts_at: '', ends_at: '', city: '', state: '', location: '', modality: '', speaker: '', price: '', capacity: '', url: '', cover_url: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const [uploading, setUploading] = useState(false)
  const coverRef = useRef(null)
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const upCover = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'network/events', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('cover_url', r.url)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Criar evento</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          {/* capa */}
          <div>
            <label className={lbl}>Imagem do evento (capa)</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upCover(e.target.files[0])} className="hidden" />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full h-28 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar imagem'}</span>}
            </button>
          </div>
          <div><label className={lbl}>Título *</label><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Título do evento" className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tipo</label><GlassSelect value={f.kind} onChange={(v) => set('kind', v)} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></div>
            <div><label className={lbl}>Modalidade</label><GlassSelect value={f.modality} onChange={(v) => set('modality', v)} options={MODALITY} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Início (data e hora)</label><GlassDate withTime value={f.starts_at} onChange={(v) => set('starts_at', v)} placeholder="dd/mm/aaaa · hh:mm" /></div>
            <div><label className={lbl}>Término (opcional)</label><GlassDate withTime value={f.ends_at} onChange={(v) => set('ends_at', v)} placeholder="dd/mm/aaaa · hh:mm" /></div>
          </div>
          <div><label className={lbl}>Local / endereço</label><input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Ex.: Auditório Seravie, Av. Paulista 1000" className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Cidade</label><input value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade / Online" className={cls} /></div>
            <div><label className={lbl}>Palestrante / anfitrião</label><input value={f.speaker} onChange={(e) => set('speaker', e.target.value)} placeholder="Nome" className={cls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Valor (R$)</label><input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0 = gratuito" className={cls} /></div>
            <div><label className={lbl}>Vagas</label><input type="number" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="Limite de inscritos" className={cls} /></div>
          </div>
          <div><label className={lbl}>Descrição</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Programação, o que os participantes vão aprender…" className={`${cls} resize-none`} /></div>
          <div><label className={lbl}>Link (inscrição / transmissão)</label><input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" className={cls} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.title.trim() && onCreate({ title: f.title, kind: f.kind, modality: f.modality || null, description: f.description || null, starts_at: f.starts_at || null, ends_at: f.ends_at || null, city: f.city || null, location: f.location || null, speaker: f.speaker || null, price: f.price ? Number(f.price) : null, capacity: f.capacity ? parseInt(f.capacity) : null, url: f.url || null, cover_url: f.cover_url || null })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar</button></div>
      </div>
    </div>
  )
}
