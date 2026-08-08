import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { uploadTo } from '../../../lib/storage'

// Eventos do fornecedor — feiras, showrooms, lançamentos e promoções divulgados
// pelos fornecedores aos compradores. Grava em supplier_events.

const KINDS = { feira: 'Feira', showroom: 'Showroom', lancamento: 'Lançamento', promocao: 'Promoção', webinar: 'Webinar' }
const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export function SupplierEvents({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [events, setEvents] = useState([])
  const [mySupplier, setMySupplier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ev }, { data: sup }] = await Promise.all([
        supabase.from('supplier_events').select('*').eq('status', 'published').order('starts_at', { ascending: true }).limit(200),
        supabase.from('suppliers').select('id,name').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      ])
      setEvents(ev || []); setMySupplier(sup || null)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [tenantId])
  useEffect(() => { load() }, [load])

  const create = async (payload) => {
    const { data, error } = await supabase.from('supplier_events').insert({ ...payload, tenant_id: tenantId, supplier_id: mySupplier?.id || null, supplier_name: mySupplier?.name || null, status: 'published' }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setEvents((e) => [data, ...e]); setCreating(false); notify?.('Evento publicado', 'success')
  }
  const remove = async (id) => {
    setEvents((e) => e.filter((x) => x.id !== id))
    await supabase.from('supplier_events').delete().eq('id', id); notify?.('Evento excluído', 'success')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Eventos dos fornecedores</h1><p className="text-admin-muted/50 text-sm mt-1">Feiras, showrooms e lançamentos do ecossistema de fornecedores.</p></div>
        {mySupplier && <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Divulgar evento</button>}
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-56 animate-pulse opacity-40" />)}</div>
        : events.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="calendar" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum evento divulgado ainda.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((ev) => { const mine = ev.tenant_id === tenantId; return (
                <div key={ev.id} className="glass rounded-2xl overflow-hidden flex flex-col">
                  <div className="h-28 bg-gradient-to-br from-admin-champ/15 to-admin-copper/10 relative">
                    {ev.cover_url ? <img src={ev.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="calendar" className="w-8 h-8 text-admin-champ/25" /></div>}
                    <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider bg-black/50 backdrop-blur-md text-white px-2 py-0.5 rounded">{KINDS[ev.kind] || ev.kind}</span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-admin-text font-medium">{ev.title}</p>
                    {ev.supplier_name && <p className="text-admin-champ/60 text-[11px] mt-0.5">{ev.supplier_name}</p>}
                    <p className="text-admin-muted/45 text-xs mt-1 flex items-center gap-1.5"><Icon name="clock" className="w-3.5 h-3.5" />{fmt(ev.starts_at)}{ev.city ? ` · ${ev.city}` : ''}</p>
                    {ev.description && <p className="text-admin-muted/50 text-xs mt-2 line-clamp-2 flex-1">{ev.description}</p>}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                      {ev.url && <a href={ev.url.startsWith('http') ? ev.url : `https://${ev.url}`} target="_blank" rel="noreferrer" className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 transition-colors flex items-center justify-center gap-1.5"><Icon name="external" className="w-3.5 h-3.5" />Saiba mais</a>}
                      {mine && <button onClick={() => setConfirmDel(ev)} className="text-xs px-3 py-1.5 rounded-lg glass-input text-admin-muted/60 hover:text-admin-rose transition-colors" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                </div>
              )})}
            </div>}

      {creating && <CreateSupEvent onClose={() => setCreating(false)} onCreate={create} notify={notify} />}
      {confirmDel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg text-admin-text mb-2">Excluir evento?</h2>
            <p className="text-admin-muted/60 text-sm mb-5">O evento <span className="text-admin-text">"{confirmDel.title}"</span> será removido.</p>
            <div className="flex justify-end gap-2"><button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => { const e = confirmDel; setConfirmDel(null); remove(e.id) }} className="px-4 py-2 rounded-xl text-sm bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose">Excluir</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateSupEvent({ onClose, onCreate, notify }) {
  const [f, setF] = useState({ title: '', kind: 'showroom', description: '', city: '', location: '', starts_at: '', ends_at: '', url: '', cover_url: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const [uploading, setUploading] = useState(false)
  const coverRef = useRef(null)
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const upCover = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'suppliers/events', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('cover_url', r.url)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Divulgar evento</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Imagem do evento</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upCover(e.target.files[0])} className="hidden" />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full h-28 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar imagem'}</span>}
            </button>
          </div>
          <div><label className={lbl}>Título *</label><input value={f.title} onChange={(e) => set('title', e.target.value)} className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tipo</label><GlassSelect value={f.kind} onChange={(v) => set('kind', v)} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></div>
            <div><label className={lbl}>Cidade</label><input value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade / Online" className={cls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Início</label><GlassDate withTime value={f.starts_at} onChange={(v) => set('starts_at', v)} placeholder="dd/mm/aaaa · hh:mm" /></div>
            <div><label className={lbl}>Término</label><GlassDate withTime value={f.ends_at} onChange={(v) => set('ends_at', v)} placeholder="dd/mm/aaaa · hh:mm" /></div>
          </div>
          <div><label className={lbl}>Local / endereço</label><input value={f.location} onChange={(e) => set('location', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>Descrição</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${cls} resize-none`} /></div>
          <div><label className={lbl}>Link (inscrição / mais informações)</label><input value={f.url} onChange={(e) => set('url', e.target.value)} className={cls} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.title.trim() && onCreate({ title: f.title, kind: f.kind, description: f.description || null, city: f.city || null, location: f.location || null, starts_at: f.starts_at || null, ends_at: f.ends_at || null, url: f.url || null, cover_url: f.cover_url || null })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Publicar</button></div>
      </div>
    </div>
  )
}
