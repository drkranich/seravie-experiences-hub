import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { ResourceTabs } from './ResourcePanel'
import { LegalGate, useLegalGate } from './LegalGate'
import { logAudit } from '../../lib/audit'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return new Date(d).toLocaleDateString('pt-BR')
}

const POST_KINDS = { post: 'Publicação', inauguracao: 'Inauguração', projeto: 'Projeto', reforma: 'Reforma', colecao: 'Coleção', tendencia: 'Tendência', artigo: 'Artigo', vaga: 'Vaga', oportunidade: 'Oportunidade', evento: 'Evento' }
const COMMUNITIES = ['Hospitalidade', 'Retail Design', 'Farmhouse', 'Empórios', 'Turismo', 'Arquitetura Comercial', 'Visual Merchandising', 'Embalagens', 'Branding', 'Marketing', 'Experiência do Cliente', 'Tecnologia', 'Franquias']
const EVENT_KINDS = { feira: 'Feira', workshop: 'Workshop', encontro: 'Encontro', curso: 'Curso', visita: 'Visita técnica', networking: 'Networking' }

// ---------- Feed ----------
function Feed({ notify }) {
  const { user } = useAuth()
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ kind: 'post', title: '', body: '', community: '' })
  const [posting, setPosting] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('network_posts').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(60); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const publish = async () => {
    if (!form.body.trim() && !form.title.trim()) return notify('Escreva algo para publicar', 'error')
    setPosting(true)
    const authorName = user?.user_metadata?.name || user?.email || 'Membro'
    const { error } = await supabase.from('network_posts').insert({
      tenant_id: tenantId, author_id: user?.id, author_name: authorName,
      kind: form.kind, title: form.title || null, body: form.body, community: form.community || null, status: 'published',
    })
    setPosting(false)
    if (error) return notify('Erro ao publicar: ' + error.message, 'error')
    setForm({ kind: 'post', title: '', body: '', community: '' }); load()
  }
  const like = async (p) => { setRows((rs) => rs.map((r) => r.id === p.id ? { ...r, likes: (r.likes || 0) + 1 } : r)); await supabase.from('network_posts').update({ likes: (p.likes || 0) + 1 }).eq('id', p.id) }

  return (
    <div className="max-w-2xl">
      <div className="glass rounded-2xl p-5 mb-5">
        <div className="flex gap-2 mb-3">
          <div className="w-40"><GlassSelect value={form.kind} onChange={(v) => setForm((s) => ({ ...s, kind: v }))} options={Object.entries(POST_KINDS).map(([value, label]) => ({ value, label }))} /></div>
          <div className="flex-1"><GlassSelect value={form.community} onChange={(v) => setForm((s) => ({ ...s, community: v }))} options={[{ value: '', label: 'Comunidade (opcional)' }, ...COMMUNITIES.map((c) => ({ value: c, label: c }))]} /></div>
        </div>
        <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título (opcional)" className={`${inputCls} mb-2`} />
        <textarea value={form.body} onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))} rows={3} placeholder="Compartilhe uma inauguração, projeto, tendência ou oportunidade…" className={`${inputCls} resize-none mb-3`} />
        <div className="flex justify-end"><button onClick={publish} disabled={posting} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2 rounded-xl text-sm transition-colors">{posting ? 'Publicando…' : 'Publicar'}</button></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando feed…</p> : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-admin-muted/50 text-sm">Ainda não há publicações. Seja o primeiro a compartilhar algo com a rede.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full bg-admin-champ/10 flex items-center justify-center text-admin-champ text-sm">{(p.author_name || '?')[0]}</div>
                <div className="min-w-0 flex-1"><p className="text-admin-text text-sm">{p.author_name}</p><p className="text-admin-muted/40 text-[11px]">{timeAgo(p.created_at)}{p.community ? ` · ${p.community}` : ''}</p></div>
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{POST_KINDS[p.kind] || p.kind}</span>
              </div>
              {p.title && <p className="text-admin-text font-medium mb-1">{p.title}</p>}
              {p.body && <p className="text-admin-muted/70 text-sm whitespace-pre-wrap">{p.body}</p>}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.05]">
                <button onClick={() => like(p)} className="flex items-center gap-1.5 text-admin-muted/50 hover:text-admin-rose text-xs transition-colors"><Icon name="heart" className="w-3.5 h-3.5" />{p.likes || 0}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Comunidades ----------
function Communities({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', theme: '', description: '' })

  const load = async () => { const { data } = await supabase.from('network_communities').select('*').eq('status', 'published').order('members_count', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name.trim()) return notify('Informe o nome da comunidade', 'error')
    const { error } = await supabase.from('network_communities').insert({ tenant_id: tenantId, name: form.name, theme: form.theme, description: form.description, status: 'published', members_count: 1 })
    if (error) return notify('Erro ao criar: ' + error.message, 'error')
    setModal(false); setForm({ name: '', theme: '', description: '' }); load()
  }
  const join = async (c) => { setRows((rs) => rs.map((r) => r.id === c.id ? { ...r, members_count: (r.members_count || 0) + 1 } : r)); await supabase.from('network_communities').update({ members_count: (c.members_count || 0) + 1 }).eq('id', c.id); notify(`Você entrou em ${c.name}`, 'success') }

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><p className="text-admin-muted/50 text-sm">{rows.length} comunidades</p><button onClick={() => setModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Nova comunidade</button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((c) => (
          <div key={c.id} className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 rounded-xl bg-admin-sage/10 flex items-center justify-center text-admin-sage"><Icon name="user" className="w-5 h-5" /></div><div><p className="text-admin-text text-sm font-medium">{c.name}</p>{c.theme && <p className="text-admin-muted/40 text-[11px]">{c.theme}</p>}</div></div>
            {c.description && <p className="text-admin-muted/50 text-xs flex-1">{c.description}</p>}
            <div className="flex items-center justify-between mt-3"><span className="text-admin-muted/40 text-xs">{c.members_count || 0} membros</span><button onClick={() => join(c)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ">Participar</button></div>
          </div>
        ))}
        {COMMUNITIES.filter((name) => !rows.some((r) => r.name === name)).map((name) => (
          <div key={name} className="glass-soft rounded-2xl p-5 flex flex-col opacity-70">
            <div className="flex items-center gap-2 mb-2"><div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-admin-muted/50"><Icon name="user" className="w-5 h-5" /></div><p className="text-admin-text text-sm font-medium">{name}</p></div>
            <p className="text-admin-muted/40 text-xs flex-1">Comunidade sugerida</p>
            <button onClick={() => { setForm({ name, theme: '', description: '' }); setModal(true) }} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 mt-3 self-start">Criar</button>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Nova comunidade</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Nome" className={inputCls} />
              <input value={form.theme} onChange={(e) => setForm((s) => ({ ...s, theme: e.target.value }))} placeholder="Tema" className={inputCls} />
              <textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} rows={3} placeholder="Descrição" className={`${inputCls} resize-none`} />
            </div>
            <div className="flex gap-3 mt-5"><button onClick={create} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Criar</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Eventos ----------
function Events({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title: '', kind: 'encontro', description: '', location: '', city: '', state: '', starts_at: '', url: '' })

  const load = async () => { const { data } = await supabase.from('network_events').select('*').eq('status', 'published').order('starts_at', { ascending: true }); setRows(data || []) }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.title.trim()) return notify('Informe o título do evento', 'error')
    const { error } = await supabase.from('network_events').insert({ tenant_id: tenantId, title: form.title, kind: form.kind, description: form.description, location: form.location, city: form.city, state: form.state, url: form.url, starts_at: form.starts_at ? new Date(form.starts_at + 'T00:00:00').toISOString() : null, status: 'published' })
    if (error) return notify('Erro ao criar: ' + error.message, 'error')
    setModal(false); setForm({ title: '', kind: 'encontro', description: '', location: '', city: '', state: '', starts_at: '', url: '' }); load()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-4"><p className="text-admin-muted/50 text-sm">Agenda nacional · {rows.length} eventos</p><button onClick={() => setModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo evento</button></div>
      {rows.length === 0 ? <div className="glass rounded-2xl p-10 text-center text-admin-muted/50 text-sm">Nenhum evento na agenda ainda.</div> : (
        <div className="space-y-3">
          {rows.map((e) => (
            <div key={e.id} className="glass rounded-2xl p-5 flex gap-4">
              <div className="w-14 text-center shrink-0"><p className="text-admin-champ text-2xl font-medium">{e.starts_at ? new Date(e.starts_at).getDate() : '—'}</p><p className="text-admin-muted/40 text-[10px] uppercase">{e.starts_at ? new Date(e.starts_at).toLocaleDateString('pt-BR', { month: 'short' }) : ''}</p></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-admin-text text-sm font-medium">{e.title}</p><span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{EVENT_KINDS[e.kind] || e.kind}</span></div>
                {e.description && <p className="text-admin-muted/50 text-xs mt-1">{e.description}</p>}
                <p className="text-admin-muted/40 text-[11px] mt-1.5">{[e.location, e.city, e.state].filter(Boolean).join(' · ')}</p>
              </div>
              {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ self-center shrink-0">Detalhes</a>}
            </div>
          ))}
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Novo evento</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título do evento" className={inputCls} /></div>
              <GlassSelect value={form.kind} onChange={(v) => setForm((s) => ({ ...s, kind: v }))} options={Object.entries(EVENT_KINDS).map(([value, label]) => ({ value, label }))} />
              <GlassDate value={form.starts_at} onChange={(v) => setForm((s) => ({ ...s, starts_at: v }))} />
              <input value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} placeholder="Local" className={inputCls} />
              <input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} placeholder="Cidade" className={inputCls} />
              <input value={form.state} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} placeholder="UF" className={inputCls} />
              <input value={form.url} onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))} placeholder="Link (opcional)" className={inputCls} />
              <div className="col-span-2"><textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} rows={2} placeholder="Descrição" className={`${inputCls} resize-none`} /></div>
            </div>
            <div className="flex gap-3 mt-5"><button onClick={create} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Publicar evento</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Oportunidades / Projetos colaborativos ----------
function Opportunities({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', needs: '', city: '', state: '', budget: '', contact: '' })

  const load = async () => { const { data } = await supabase.from('network_opportunities').select('*').eq('status', 'open').order('created_at', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.title.trim()) return notify('Descreva a oportunidade', 'error')
    const { error } = await supabase.from('network_opportunities').insert({ tenant_id: tenantId, title: form.title, description: form.description, city: form.city, state: form.state, contact: form.contact, budget: form.budget ? Number(form.budget) : null, needs: form.needs.split(',').map((x) => x.trim()).filter(Boolean), status: 'open' })
    if (error) return notify('Erro: ' + error.message, 'error')
    setModal(false); setForm({ title: '', description: '', needs: '', city: '', state: '', budget: '', contact: '' }); load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><p className="text-admin-muted/50 text-sm">{rows.length} oportunidades abertas — empresas buscando fornecedores e parceiros</p><button onClick={() => setModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Publicar oportunidade</button></div>
      <div className="grid sm:grid-cols-2 gap-4">
        {rows.map((o) => (
          <div key={o.id} className="glass rounded-2xl p-5 flex flex-col">
            <p className="text-admin-text font-medium">{o.title}</p>
            {o.description && <p className="text-admin-muted/60 text-sm mt-1">{o.description}</p>}
            {(o.needs || []).length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{o.needs.map((n, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-champ/10 text-admin-champ">{n}</span>)}</div>}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
              <span className="text-admin-muted/40 text-xs">{[o.city, o.state].filter(Boolean).join(' · ')}{o.budget ? ` · ${brl(o.budget)}` : ''}</span>
              {o.contact && <a href={o.contact.includes('@') ? `mailto:${o.contact}` : `https://wa.me/${o.contact.replace(/\D/g, '')}`} className="text-xs px-3 py-1.5 rounded-lg bg-admin-sage/15 text-admin-sage">Tenho interesse</a>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-admin-muted/50 text-sm col-span-2">Nenhuma oportunidade aberta. Publique a primeira.</div>}
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Publicar oportunidade</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Ex: Reformando uma cafeteria em Tiradentes" className={inputCls} />
              <textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} rows={2} placeholder="Descrição do projeto" className={`${inputCls} resize-none`} />
              <input value={form.needs} onChange={(e) => setForm((s) => ({ ...s, needs: e.target.value }))} placeholder="Necessidades (separe por vírgula): marcenaria, iluminação, velas…" className={inputCls} />
              <div className="grid grid-cols-3 gap-2">
                <input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} placeholder="Cidade" className={inputCls} />
                <input value={form.state} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} placeholder="UF" className={inputCls} />
                <input type="number" value={form.budget} onChange={(e) => setForm((s) => ({ ...s, budget: e.target.value }))} placeholder="Orçamento" className={inputCls} />
              </div>
              <input value={form.contact} onChange={(e) => setForm((s) => ({ ...s, contact: e.target.value }))} placeholder="Contato (WhatsApp ou e-mail)" className={inputCls} />
            </div>
            <div className="flex gap-3 mt-5"><button onClick={create} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Publicar</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Reputação ----------
const CRIT = [['communication', 'Comunicação'], ['punctuality', 'Pontualidade'], ['professionalism', 'Profissionalismo'], ['quality', 'Qualidade'], ['reliability', 'Confiabilidade']]
function Reputation({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ subject_name: '', subject_type: 'supplier', comment: '', communication: 5, punctuality: 5, professionalism: 5, quality: 5, reliability: 5 })

  const load = async () => { const { data } = await supabase.from('network_ratings').select('*').order('created_at', { ascending: false }).limit(40); setRows(data || []) }
  useEffect(() => { load() }, [])
  const avg = (r) => Math.round((CRIT.reduce((s, [k]) => s + (r[k] || 0), 0) / CRIT.length) * 10) / 10

  const submit = async () => {
    if (!form.subject_name.trim()) return notify('Informe quem está sendo avaliado', 'error')
    const { error } = await supabase.from('network_ratings').insert({ tenant_id: tenantId, ...form })
    if (error) return notify('Erro: ' + error.message, 'error')
    setForm({ subject_name: '', subject_type: 'supplier', comment: '', communication: 5, punctuality: 5, professionalism: 5, quality: 5, reliability: 5 }); load(); notify('Avaliação registrada', 'success')
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="glass rounded-2xl p-6">
        <p className="text-admin-champ text-sm mb-4">Avaliar</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={form.subject_name} onChange={(e) => setForm((s) => ({ ...s, subject_name: e.target.value }))} placeholder="Quem você avalia" className={inputCls} />
          <GlassSelect value={form.subject_type} onChange={(v) => setForm((s) => ({ ...s, subject_type: v }))} options={[{ value: 'supplier', label: 'Fornecedor' }, { value: 'member', label: 'Cliente / Membro' }]} />
        </div>
        <div className="space-y-2.5 mb-3">
          {CRIT.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-3"><span className="text-admin-muted/70 text-sm">{label}</span>
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setForm((s) => ({ ...s, [k]: n }))} className={n <= form[k] ? 'text-admin-gold' : 'text-white/15'}><Icon name="star" className="w-4 h-4" /></button>)}</div>
            </div>
          ))}
        </div>
        <textarea value={form.comment} onChange={(e) => setForm((s) => ({ ...s, comment: e.target.value }))} rows={2} placeholder="Comentário" className={`${inputCls} resize-none mb-3`} />
        <button onClick={submit} className="w-full bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Registrar avaliação</button>
      </div>
      <div>
        <p className="text-admin-muted/50 text-sm mb-3">Avaliações recentes</p>
        <div className="space-y-3">
          {rows.length === 0 ? <div className="glass rounded-2xl p-8 text-center text-admin-muted/50 text-sm">Sem avaliações ainda.</div> : rows.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between"><p className="text-admin-text text-sm font-medium">{r.subject_name}</p><span className="flex items-center gap-1 text-admin-gold text-sm"><Icon name="star" className="w-3.5 h-3.5" />{avg(r)}</span></div>
              <p className="text-admin-muted/40 text-[11px]">{r.subject_type === 'supplier' ? 'Fornecedor' : 'Cliente'} · {timeAgo(r.created_at)}</p>
              {r.comment && <p className="text-admin-muted/60 text-sm mt-1.5">{r.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Meu Perfil profissional ----------
const M_EMPTY = { name: '', headline: '', bio: '', company: '', role_title: '', city: '', state: '', website: '', instagram: '', linkedin: '', specialties: [], status: 'published' }
function MemberProfile({ notify }) {
  const { user } = useAuth()
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const { pending, docs, recheck } = useLegalGate()
  const [gate, setGate] = useState(false)
  const [row, setRow] = useState(null)
  const [form, setForm] = useState(M_EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('network_members').select('*').eq('tenant_id', tenantId).limit(1)
      const r = (data || [])[0] || null; setRow(r)
      if (r) setForm({ ...M_EMPTY, ...r, specialties: r.specialties || [] })
      setLoading(false)
    })()
  }, [tenantId])

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))
  const save = async () => {
    if (!form.name.trim()) return notify('Informe seu nome', 'error')
    const payload = { name: form.name, headline: form.headline, bio: form.bio, company: form.company, role_title: form.role_title, city: form.city, state: form.state, website: form.website, instagram: form.instagram, linkedin: form.linkedin, specialties: form.specialties, status: 'published', user_id: user?.id }
    let error, id
    if (row) { const r = await supabase.from('network_members').update(payload).eq('id', row.id); error = r.error; id = row.id }
    else { const r = await supabase.from('network_members').insert({ ...payload, tenant_id: tenantId }).select('id').single(); error = r.error; id = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: row ? 'update' : 'create', resource_type: 'network_members', resource_id: id, new_data: payload }, tenantId)
    if (!row) setRow({ id, ...payload }); notify('Perfil profissional salvo', 'success')
  }
  const trySave = () => { if (pending.length > 0) setGate(true); else save() }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>

  return (
    <div className="max-w-2xl glass rounded-2xl p-6 space-y-3">
      {gate && <LegalGate docs={docs} notify={notify} onClose={() => setGate(false)} onAccept={async () => { setGate(false); await recheck(); await save() }} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></div>
        <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Headline</label><input value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Ex: Arquiteta especialista em varejo premium" className={inputCls} /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Empresa</label><input value={form.company} onChange={(e) => set('company', e.target.value)} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Cargo</label><input value={form.role_title} onChange={(e) => set('role_title', e.target.value)} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Cidade</label><input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">UF</label><input value={form.state} onChange={(e) => set('state', e.target.value)} className={inputCls} /></div>
        <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Especialidades (separe por vírgula)</label><input value={(form.specialties || []).join(', ')} onChange={(e) => set('specialties', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={inputCls} /></div>
        <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Bio</label><textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={3} className={`${inputCls} resize-none`} /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Site</label><input value={form.website} onChange={(e) => set('website', e.target.value)} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Instagram</label><input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} className={inputCls} /></div>
        <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">LinkedIn</label><input value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} className={inputCls} /></div>
      </div>
      <button onClick={trySave} className="w-full bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Salvar perfil</button>
    </div>
  )
}

// ---------- Mensagens (chat privado entre membros) ----------
const keyFor = (a, b) => [a, b].sort().join('_')
const chatTime = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function Messages({ notify }) {
  const { user } = useAuth()
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const me = user?.id
  const myName = user?.user_metadata?.name || user?.email || 'Você'
  const [threads, setThreads] = useState([])
  const [active, setActive] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [contacts, setContacts] = useState([])
  const [showNew, setShowNew] = useState(false)
  const endRef = useRef(null)

  const loadThreads = async () => {
    const { data } = await supabase.from('network_messages').select('*').order('created_at', { ascending: false })
    const seen = new Map()
    for (const m of (data || [])) {
      if (!seen.has(m.thread_key)) {
        const mine = m.from_user === me
        seen.set(m.thread_key, { key: m.thread_key, otherId: mine ? m.to_user : m.from_user, otherName: (mine ? m.to_name : m.from_name) || 'Contato', last: m.body, at: m.created_at, unread: 0 })
      }
      if (m.to_user === me && !m.read) seen.get(m.thread_key).unread += 1
    }
    setThreads([...seen.values()])
  }
  const loadMsgs = async (key) => {
    const { data } = await supabase.from('network_messages').select('*').eq('thread_key', key).order('created_at', { ascending: true })
    setMsgs(data || [])
    await supabase.from('network_messages').update({ read: true }).eq('thread_key', key).eq('to_user', me).eq('read', false)
  }

  useEffect(() => {
    loadThreads()
    ;(async () => { const { data } = await supabase.from('network_members').select('id,user_id,name,headline').eq('status', 'published').not('user_id', 'is', null); setContacts((data || []).filter((c) => c.user_id && c.user_id !== me)) })()
  }, [])
  useEffect(() => {
    if (!active) return
    loadMsgs(active.key)
    const iv = setInterval(() => loadMsgs(active.key), 7000)
    return () => clearInterval(iv)
  }, [active?.key])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const openThread = (otherId, otherName) => { setShowNew(false); setActive({ key: keyFor(me, otherId), otherId, otherName }) }
  const send = async () => {
    if (!text.trim() || !active) return
    const body = text.trim(); setText('')
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, thread_key: active.key, from_user: me, to_user: active.otherId, body, created_at: new Date().toISOString() }])
    const { error } = await supabase.from('network_messages').insert({ tenant_id: tenantId, thread_key: active.key, from_user: me, to_user: active.otherId, from_name: myName, to_name: active.otherName, body })
    if (error) return notify('Erro ao enviar: ' + error.message, 'error')
    loadMsgs(active.key); loadThreads()
  }

  return (
    <div className="glass rounded-2xl overflow-hidden grid md:grid-cols-[280px_1fr] h-[560px]">
      {/* Lista de conversas */}
      <div className="border-r border-white/[0.06] flex flex-col min-h-0">
        <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-admin-text text-sm font-medium">Conversas</p>
          <button onClick={() => setShowNew(true)} className="w-7 h-7 rounded-lg bg-admin-champ/10 text-admin-champ flex items-center justify-center"><Icon name="plus" className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? <p className="text-admin-muted/40 text-xs p-4 text-center">Nenhuma conversa ainda. Toque em + para iniciar.</p> : threads.map((t) => (
            <button key={t.key} onClick={() => openThread(t.otherId, t.otherName)} className={`w-full text-left px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${active?.key === t.key ? 'bg-admin-champ/[0.06]' : ''}`}>
              <div className="flex items-center justify-between gap-2"><p className="text-admin-text text-sm truncate">{t.otherName}</p>{t.unread > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-admin-champ/20 text-admin-champ shrink-0">{t.unread}</span>}</div>
              <p className="text-admin-muted/40 text-xs truncate mt-0.5">{t.last}</p>
            </button>
          ))}
        </div>
      </div>
      {/* Thread ativa */}
      <div className="flex flex-col min-h-0">
        {active ? (
          <>
            <div className="p-3.5 border-b border-white/[0.06] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-admin-champ/10 flex items-center justify-center text-admin-champ text-sm">{(active.otherName || '?')[0]}</div>
              <p className="text-admin-text text-sm font-medium">{active.otherName}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.map((m) => {
                const mine = m.from_user === me
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-admin-champ/20 text-admin-text rounded-br-md' : 'glass-soft text-admin-muted/80 rounded-bl-md'}`}>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`text-[9px] mt-0.5 ${mine ? 'text-admin-champ/50 text-right' : 'text-admin-muted/30'}`}>{chatTime(m.created_at)}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            <div className="p-3 border-t border-white/[0.06] flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Escreva uma mensagem…" className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              <button onClick={send} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 rounded-xl text-sm"><Icon name="mail" className="w-4 h-4" /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-admin-muted/40 text-sm p-6 text-center">Selecione uma conversa ou inicie uma nova.<br />A comunicação acontece exclusivamente entre as partes.</div>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="glass-pop rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-xl text-admin-text">Nova conversa</h2><button onClick={() => setShowNew(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {contacts.length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhum membro disponível ainda. Os contatos aparecem quando outros membros publicam o perfil no Network.</p> : (
              <div className="space-y-1">
                {contacts.map((c) => (
                  <button key={c.id} onClick={() => openThread(c.user_id, c.name)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] text-left transition-colors">
                    <div className="w-8 h-8 rounded-full bg-admin-sage/10 flex items-center justify-center text-admin-sage text-sm">{(c.name || '?')[0]}</div>
                    <div className="min-w-0"><p className="text-admin-text text-sm truncate">{c.name}</p>{c.headline && <p className="text-admin-muted/40 text-[11px] truncate">{c.headline}</p>}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function NetworkHubPanel({ notify }) {
  return (
    <ResourceTabs title="Seravie Network" subtitle="a rede profissional da hospitalidade, varejo premium e economia criativa"
      tabs={[
        { key: 'feed', label: 'Feed', render: () => <Feed notify={notify} /> },
        { key: 'comm', label: 'Comunidades', render: () => <Communities notify={notify} /> },
        { key: 'events', label: 'Eventos', render: () => <Events notify={notify} /> },
        { key: 'opps', label: 'Oportunidades', render: () => <Opportunities notify={notify} /> },
        { key: 'msgs', label: 'Mensagens', render: () => <Messages notify={notify} /> },
        { key: 'rep', label: 'Reputação', render: () => <Reputation notify={notify} /> },
        { key: 'me', label: 'Meu Perfil', render: () => <MemberProfile notify={notify} /> },
      ]}
    />
  )
}
