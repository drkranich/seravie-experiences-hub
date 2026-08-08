import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { uploadTo } from '../../../lib/storage'

// Experience Lab — laboratório de ideias/protótipos de experiência. Membros
// propõem conceitos, a comunidade vota, e a curadoria evolui o status.

const STATUS = {
  aberto: { label: 'Aberto a ideias', s: 'bg-admin-champ/15 text-admin-champ' },
  em_teste: { label: 'Em teste', s: 'bg-admin-gold/15 text-admin-gold' },
  validado: { label: 'Validado', s: 'bg-admin-sage/15 text-admin-sage' },
  arquivado: { label: 'Arquivado', s: 'bg-white/[0.06] text-admin-muted/50' },
}
const CATS = ['Hospitalidade', 'Retail', 'Gastronomia', 'Tecnologia', 'Arquitetura', 'Branding', 'Evento', 'Outro']

export function ExperienceLab({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [ideas, setIdeas] = useState([])
  const [voted, setVoted] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    const [{ data: ls }, { data: vs }] = await Promise.all([
      supabase.from('experience_lab').select('*').neq('status', 'arquivado').order('votes', { ascending: false }).limit(100),
      supabase.from('experience_lab_votes').select('lab_id').eq('tenant_id', tenantId),
    ])
    setIdeas(ls || []); setVoted(new Set((vs || []).map((v) => v.lab_id))); setLoading(false)
  }
  useEffect(() => { if (tenantId) load() }, [tenantId])

  const create = async (payload) => {
    const { data, error } = await supabase.from('experience_lab').insert({ ...payload, tenant_id: tenantId, member_id: me?.id, author_name: me?.name || 'Você', status: 'aberto', votes: 0 }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setIdeas((i) => [data, ...i]); setCreating(false); notify?.('Ideia publicada no Lab', 'success')
  }
  const vote = async (idea) => {
    const has = voted.has(idea.id)
    setVoted((v) => { const n = new Set(v); has ? n.delete(idea.id) : n.add(idea.id); return n })
    setIdeas((is) => is.map((x) => x.id === idea.id ? { ...x, votes: Math.max(0, (x.votes || 0) + (has ? -1 : 1)) } : x))
    try {
      if (has) await supabase.from('experience_lab_votes').delete().eq('lab_id', idea.id).eq('tenant_id', tenantId)
      else await supabase.from('experience_lab_votes').insert({ lab_id: idea.id, tenant_id: tenantId, member_id: me?.id })
      await supabase.from('experience_lab').update({ votes: Math.max(0, (idea.votes || 0) + (has ? -1 : 1)) }).eq('id', idea.id)
    } catch { /* noop */ }
  }

  const shown = filter === 'all' ? ideas : ideas.filter((i) => i.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Experience Lab</h1><p className="text-admin-muted/50 text-sm mt-1">Laboratório de ideias e protótipos de experiência do ecossistema.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas as fases' }, ...Object.entries(STATUS).filter(([k]) => k !== 'arquivado').map(([value, s]) => ({ value, label: s.label }))]} /></div>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Nova ideia</button>
        </div>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-52 animate-pulse opacity-40" />)}</div>
        : shown.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="spark" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhuma ideia nesta fase. Proponha a sua!</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shown.map((idea) => { const st = STATUS[idea.status] || STATUS.aberto; const hasVoted = voted.has(idea.id); return (
                <div key={idea.id} className="glass rounded-2xl overflow-hidden flex flex-col">
                  {idea.cover_url && <div className="h-28 overflow-hidden"><img src={idea.cover_url} alt="" className="w-full h-full object-cover" /></div>}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5"><span className={`text-[9px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span>{idea.category && <span className="text-[9px] text-admin-muted/40">{idea.category}</span>}</div>
                    <p className="text-admin-text font-medium leading-snug">{idea.title}</p>
                    {idea.concept && <p className="text-admin-muted/55 text-xs mt-1 line-clamp-3 flex-1">{idea.concept}</p>}
                    <p className="text-admin-muted/40 text-[11px] mt-2">por {idea.author_name}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
                      <button onClick={() => vote(idea)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${hasVoted ? 'bg-admin-champ/20 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ'}`}><Icon name="spark" className="w-3.5 h-3.5" />{idea.votes || 0}</button>
                      <span className="text-admin-muted/35 text-[11px]">{hasVoted ? 'Você apoiou' : 'Apoiar'}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>}

      {creating && <CreateIdea onClose={() => setCreating(false)} onCreate={create} notify={notify} />}
    </div>
  )
}

function CreateIdea({ onClose, onCreate, notify }) {
  const [f, setF] = useState({ title: '', concept: '', category: '', cover_url: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const [uploading, setUploading] = useState(false)
  const coverRef = useRef(null)
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const upCover = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'network/lab', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('cover_url', r.url)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Nova ideia no Lab</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Imagem (opcional)</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upCover(e.target.files[0])} className="hidden" />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full h-24 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar imagem'}</span>}
            </button>
          </div>
          <div><label className={lbl}>Título *</label><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Cafeteria sensorial" className={cls} /></div>
          <div><label className={lbl}>Categoria</label><GlassSelect value={f.category} onChange={(v) => set('category', v)} options={[{ value: '', label: '—' }, ...CATS.map((c) => ({ value: c, label: c }))]} /></div>
          <div><label className={lbl}>Conceito</label><textarea value={f.concept} onChange={(e) => set('concept', e.target.value)} rows={4} placeholder="Descreva a ideia de experiência…" className={`${cls} resize-none`} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.title.trim() && onCreate({ title: f.title, concept: f.concept || null, category: f.category || null, cover_url: f.cover_url || null })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Publicar</button></div>
      </div>
    </div>
  )
}
