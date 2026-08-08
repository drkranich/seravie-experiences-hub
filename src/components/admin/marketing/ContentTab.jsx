import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect, GlassDate } from '../ui'

const NETWORKS = [
  { key: 'instagram', label: 'Instagram', color: 'rose' },
  { key: 'facebook', label: 'Facebook', color: 'champ' },
  { key: 'tiktok', label: 'TikTok', color: 'copper' },
  { key: 'linkedin', label: 'LinkedIn', color: 'sage' },
  { key: 'pinterest', label: 'Pinterest', color: 'gold' },
]
const NET_MAP = Object.fromEntries(NETWORKS.map((n) => [n.key, n]))
const NCOLOR = { rose: 'bg-admin-rose/15 text-admin-rose', champ: 'bg-admin-champ/15 text-admin-champ', copper: 'bg-admin-copper/15 text-admin-copper', sage: 'bg-admin-sage/15 text-admin-sage', gold: 'bg-admin-gold/15 text-admin-gold' }
const STATUS = [
  { key: 'idea', label: 'Ideia', cls: 'bg-white/[0.06] text-admin-muted/60' },
  { key: 'draft', label: 'Rascunho', cls: 'bg-admin-gold/15 text-admin-gold' },
  { key: 'scheduled', label: 'Agendado', cls: 'bg-admin-champ/15 text-admin-champ' },
  { key: 'published', label: 'Publicado', cls: 'bg-admin-sage/15 text-admin-sage' },
]
const STATUS_MAP = Object.fromEntries(STATUS.map((s) => [s.key, s]))

// Growth Studio → Conteúdo. Planejador editorial de redes sociais (kanban por status).
export function ContentTab({ tenantId, createdBy, notify }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // post em edição ou {} novo

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false }); setPosts(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (p) => { try { await supabase.from('social_posts').delete().eq('id', p.id) } catch { /* noop */ } notify('Post removido', 'success'); load() }
  const setStatus = async (p, status) => { try { await supabase.from('social_posts').update({ status, updated_at: new Date().toISOString() }).eq('id', p.id) } catch { /* noop */ } load() }

  const byStatus = (k) => posts.filter((p) => (p.status || 'idea') === k)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-admin-muted/50 text-xs max-w-lg leading-relaxed">Planeje e agende conteúdo para Instagram, Facebook, TikTok, LinkedIn e Pinterest. Organize por etapa: ideia → rascunho → agendado → publicado.</p>
        <button onClick={() => setModal({ networks: [], status: 'idea', title: '', content: '' })} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Novo post</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STATUS.map((col) => (
            <div key={col.key} className="glass-soft rounded-2xl p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={`text-[10px] px-2 py-0.5 rounded ${col.cls}`}>{col.label}</span>
                <span className="text-admin-muted/40 text-xs">{byStatus(col.key).length}</span>
              </div>
              <div className="space-y-2 min-h-[4rem]">
                {byStatus(col.key).map((p) => (
                  <div key={p.id} className="glass rounded-xl p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-admin-text text-sm font-medium leading-tight">{p.title || 'Sem título'}</p>
                      <button onClick={() => remove(p)} className="text-admin-muted/30 hover:text-admin-rose opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Icon name="trash" className="w-3 h-3" /></button>
                    </div>
                    {p.content && <p className="text-admin-muted/50 text-[11px] mt-1 line-clamp-2">{p.content}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(p.networks || []).map((n) => <span key={n} className={`text-[9px] px-1.5 py-0.5 rounded ${NCOLOR[NET_MAP[n]?.color] || 'bg-white/[0.05] text-admin-muted/50'}`}>{NET_MAP[n]?.label || n}</span>)}
                    </div>
                    {p.scheduled_at && <p className="text-admin-muted/40 text-[10px] mt-1.5">📅 {new Date(p.scheduled_at).toLocaleDateString('pt-BR')}</p>}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.05]">
                      <button onClick={() => setModal(p)} className="text-[11px] text-admin-champ/70 hover:text-admin-champ">editar</button>
                      {col.key !== 'published' && <button onClick={() => setStatus(p, STATUS[Math.min(STATUS.findIndex((s) => s.key === col.key) + 1, 3)].key)} className="text-[11px] text-admin-muted/50 hover:text-admin-text ml-auto">avançar →</button>}
                    </div>
                  </div>
                ))}
                {byStatus(col.key).length === 0 && <p className="text-admin-muted/25 text-[11px] text-center py-3">—</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <PostModal post={modal} tenantId={tenantId} createdBy={createdBy} notify={notify} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

function PostModal({ post, tenantId, createdBy, notify, onClose, onSaved }) {
  const [f, setF] = useState({ title: post.title || '', content: post.content || '', networks: post.networks || [], status: post.status || 'idea', scheduled_at: post.scheduled_at ? String(post.scheduled_at).slice(0, 10) : '' })
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const toggleNet = (k) => set({ networks: f.networks.includes(k) ? f.networks.filter((x) => x !== k) : [...f.networks, k] })
  const save = async () => {
    if (!f.title.trim()) return notify('Título obrigatório', 'error')
    const payload = { title: f.title.trim(), content: f.content, networks: f.networks, status: f.status, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at + 'T09:00:00').toISOString() : null, updated_at: new Date().toISOString() }
    try {
      let error
      if (post.id) { const r = await supabase.from('social_posts').update(payload).eq('id', post.id); error = r.error }
      else { const r = await supabase.from('social_posts').insert({ ...payload, tenant_id: tenantId, created_by: createdBy }); error = r.error }
      if (error) throw error
      notify('Post salvo', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{post.id ? 'Editar post' : 'Novo post'}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Conteúdo / legenda</label><textarea value={f.content} onChange={(e) => set({ content: e.target.value })} rows={4} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
          <div>
            <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Redes</label>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map((n) => (
                <button key={n.key} onClick={() => toggleNet(n.key)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${f.networks.includes(n.key) ? NCOLOR[n.color] : 'bg-white/[0.04] text-admin-muted/50 hover:text-admin-text'}`}>{n.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Etapa</label><GlassSelect value={f.status} onChange={(v) => set({ status: v })} options={STATUS.map((s) => ({ value: s.key, label: s.label }))} /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Agendar para</label><GlassDate value={f.scheduled_at} onChange={(v) => set({ scheduled_at: v })} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Salvar</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
