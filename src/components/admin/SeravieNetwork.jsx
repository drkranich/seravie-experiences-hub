import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { uploadTo } from '../../lib/storage'
import { POST_KINDS, COMMUNITY_THEMES, VERIF, timeAgo, initials } from '../../lib/networkSocial'
import { Communities } from './network/Communities'
import { People } from './network/People'
import { NetworkProjects } from './network/NetworkProjects'
import { Messages } from './network/Messages'
import { NotificationsBell } from './network/Notifications'
import { NetworkEvents } from './network/NetworkEvents'
import { ServiceMarketplace } from './network/ServiceMarketplace'
import { StoriesStrip } from './network/Stories'
import { TalentPool } from './network/TalentPool'
import { Academy } from './network/Academy'
import { ExperienceMap } from './network/ExperienceMap'
import { SmartNetworking } from './network/SmartNetworking'
import { NetworkDashboard } from './network/NetworkDashboard'
import { Collections } from './network/Collections'
import { NetworkAI } from './network/NetworkAI'
import { TimelineViva } from './network/TimelineViva'
import { ExperienceDNA } from './network/ExperienceDNA'
import { Passport } from './network/Passport'
import { Certifications } from './network/Certifications'
import { ExperienceLab } from './network/ExperienceLab'
import { IdentityVerification } from './network/IdentityVerification'

// ═══════════════════════════════════════════════════════════════════════════
// Seravie Network — plataforma social profissional do ecossistema
// (LinkedIn + Behance + Discord). Onda 1: Feed, Comunidades, Pessoas, Projetos.
// ═══════════════════════════════════════════════════════════════════════════

const NAV = [
  { key: 'dashboard', label: 'Visão geral', icon: 'chart' },
  { key: 'feed', label: 'Feed', icon: 'grid' },
  { key: 'messages', label: 'Mensagens', icon: 'mail' },
  { key: 'communities', label: 'Comunidades', icon: 'users' },
  { key: 'people', label: 'Pessoas & Empresas', icon: 'user' },
  { key: 'ai', label: 'IA Consultora', icon: 'sparkles' },
  { key: 'smart', label: 'Networking', icon: 'spark' },
  { key: 'map', label: 'Mapa do Ecossistema', icon: 'map' },
  { key: 'services', label: 'Marketplace', icon: 'tag' },
  { key: 'talent', label: 'Banco de Talentos', icon: 'star' },
  { key: 'events', label: 'Eventos', icon: 'calendar' },
  { key: 'projects', label: 'Projetos', icon: 'layout' },
  { key: 'academy', label: 'Academy', icon: 'book' },
  { key: 'certifications', label: 'Certificações', icon: 'check' },
  { key: 'collections', label: 'Coleções', icon: 'layers' },
  { key: 'lab', label: 'Experience Lab', icon: 'spark' },
  { key: 'dna', label: 'Experience DNA', icon: 'leaf' },
  { key: 'passport', label: 'Passaporte', icon: 'star' },
  { key: 'verify_identity', label: 'Verificar identidade', icon: 'check' },
  { key: 'timeline', label: 'Timeline Viva', icon: 'clock' },
]

export function Avatar({ name, url, size = 'w-10 h-10', text = 'text-sm' }) {
  return url
    ? <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
    : <div className={`${size} rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center shrink-0 ${text} font-medium`}>{initials(name)}</div>
}

function Composer({ me, onPost, notify }) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('post')
  const [community, setCommunity] = useState('')
  const [media, setMedia] = useState([])
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const onFile = async (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const r = await uploadTo(file, { folder: 'network', accept: 'any', maxMB: 20 })
      if (r.error) { notify?.(r.error, 'error'); continue }
      setMedia((m) => [...m, { url: r.url, type: file.type.startsWith('image/') ? 'image' : 'file', name: file.name }])
    }
  }
  const submit = async () => {
    if (!body.trim() && media.length === 0) return
    setBusy(true)
    await onPost({ kind, body: body.trim(), community: community || null, media })
    setBody(''); setMedia([]); setKind('post'); setCommunity(''); setExpanded(false); setBusy(false)
  }

  return (
    <div className="glass rounded-2xl p-4 mb-5">
      <div className="flex gap-3">
        <Avatar name={me?.name} url={me?.avatar_url} />
        <div className="flex-1 min-w-0">
          <textarea value={body} onFocus={() => setExpanded(true)} onChange={(e) => setBody(e.target.value)} rows={expanded ? 3 : 1} placeholder="Compartilhe um projeto, lançamento ou novidade…" className="w-full bg-transparent text-sm text-admin-text outline-none resize-none placeholder:text-admin-muted/40 pt-1.5" />
          {media.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {media.map((m, i) => (
                <div key={i} className="relative">
                  {m.type === 'image' ? <img src={m.url} alt="" className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 rounded-lg bg-white/[0.05] flex items-center justify-center"><Icon name="book" className="w-5 h-5 text-admin-champ/50" /></div>}
                  <button onClick={() => setMedia((mm) => mm.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white/80 flex items-center justify-center"><Icon name="x" className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          {expanded && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className="w-40"><GlassSelect value={kind} onChange={setKind} options={Object.entries(POST_KINDS).map(([k, v]) => ({ value: k, label: v.label }))} /></div>
              <div className="w-44"><GlassSelect value={community} onChange={setCommunity} options={[{ value: '', label: 'Sem comunidade' }, ...COMMUNITY_THEMES.map((c) => ({ value: c.name, label: c.name }))]} /></div>
              <label className="cursor-pointer text-admin-muted/60 hover:text-admin-champ transition-colors flex items-center gap-1 text-xs px-2 py-2"><Icon name="image" className="w-4 h-4" />Mídia<input type="file" multiple onChange={onFile} className="hidden" /></label>
              <button onClick={submit} disabled={busy || (!body.trim() && !media.length)} className="ml-auto bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Publicando…' : 'Publicar'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, me, liked, onLike, onComment }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const k = POST_KINDS[post.kind] || POST_KINDS.post
  const media = Array.isArray(post.media) ? post.media : []

  const loadComments = async () => {
    const { data } = await supabase.from('network_post_comments').select('*').eq('post_id', post.id).order('created_at')
    setComments(data || [])
  }
  const toggleComments = () => { const n = !showComments; setShowComments(n); if (n && comments.length === 0) loadComments() }
  const send = async () => {
    if (!text.trim()) return
    await onComment(post, text.trim()); setText(''); loadComments()
  }

  return (
    <div className="glass rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={post.author_name} url={post.author_avatar} />
        <div className="min-w-0 flex-1">
          <p className="text-admin-text text-sm font-medium truncate">{post.author_name || 'Membro'}</p>
          <p className="text-admin-muted/40 text-[11px] flex items-center gap-1.5"><Icon name={k.icon} className="w-3 h-3" />{k.label}{post.community ? ` · ${post.community}` : ''} · {timeAgo(post.created_at)}</p>
        </div>
      </div>
      {post.title && <p className="text-admin-text font-medium mb-1">{post.title}</p>}
      {post.body && <p className="text-admin-text/85 text-sm whitespace-pre-wrap leading-relaxed">{post.body}</p>}
      {media.length > 0 && (
        <div className={`mt-3 grid gap-2 ${media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {media.map((m, i) => m.type === 'image'
            ? <a key={i} href={m.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden"><img src={m.url} alt="" className="w-full max-h-80 object-cover" /></a>
            : <a key={i} href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] text-xs text-admin-champ/80"><Icon name="book" className="w-4 h-4" />{m.name || 'Arquivo'}</a>)}
        </div>
      )}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.05]">
        <button onClick={() => onLike(post)} className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? 'text-admin-champ' : 'text-admin-muted/50 hover:text-admin-champ'}`}><Icon name="star" className="w-4 h-4" filled={liked} />{post.likes || 0}</button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-xs text-admin-muted/50 hover:text-admin-champ transition-colors"><Icon name="mail" className="w-4 h-4" />{post.comments || 0}</button>
      </div>
      {showComments && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.author_name} url={c.author_avatar} size="w-7 h-7" text="text-[10px]" />
              <div className="glass-soft rounded-xl px-3 py-2 flex-1"><p className="text-admin-text/80 text-xs"><span className="text-admin-text font-medium">{c.author_name || 'Membro'}</span> · {timeAgo(c.created_at)}</p><p className="text-admin-text/75 text-sm mt-0.5">{c.body}</p></div>
            </div>
          ))}
          <div className="flex gap-2">
            <Avatar name={me?.name} url={me?.avatar_url} size="w-7 h-7" text="text-[10px]" />
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Comentar…" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
            <button onClick={send} className="text-admin-champ text-xs px-3">Enviar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Feed({ me, notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [posts, setPosts] = useState([])
  const [likes, setLikes] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ps }, { data: ls }] = await Promise.all([
        supabase.from('network_posts').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(100),
        supabase.from('network_post_likes').select('post_id').eq('user_id', user?.id || '00000000-0000-0000-0000-000000000000'),
      ])
      setPosts(ps || []); setLikes(new Set((ls || []).map((l) => l.post_id)))
    } catch { /* noop */ } finally { setLoading(false) }
  }, [user])
  useEffect(() => { load() }, [load])

  const addPost = async (p) => {
    const { data, error } = await supabase.from('network_posts').insert({
      tenant_id: tenantId, author_id: user?.id, author_name: me?.name || 'Membro', author_avatar: me?.avatar_url || null,
      kind: p.kind, body: p.body, community: p.community, media: p.media, status: 'published',
    }).select('*').single()
    if (error) return notify?.('Erro ao publicar: ' + error.message, 'error')
    setPosts((x) => [data, ...x]); notify?.('Publicado no feed', 'success')
  }
  const toggleLike = async (post) => {
    const has = likes.has(post.id)
    setLikes((prev) => { const n = new Set(prev); has ? n.delete(post.id) : n.add(post.id); return n })
    setPosts((prev) => prev.map((x) => x.id === post.id ? { ...x, likes: Math.max(0, (x.likes || 0) + (has ? -1 : 1)) } : x))
    try {
      if (has) await supabase.from('network_post_likes').delete().eq('post_id', post.id).eq('user_id', user?.id)
      else await supabase.from('network_post_likes').insert({ tenant_id: tenantId, post_id: post.id, user_id: user?.id })
      await supabase.from('network_posts').update({ likes: Math.max(0, (post.likes || 0) + (has ? -1 : 1)) }).eq('id', post.id)
    } catch { /* silencioso */ }
  }
  const addComment = async (post, body) => {
    await supabase.from('network_post_comments').insert({ tenant_id: tenantId, post_id: post.id, author_id: user?.id, author_name: me?.name || 'Membro', author_avatar: me?.avatar_url || null, body })
    await supabase.from('network_posts').update({ comments: (post.comments || 0) + 1 }).eq('id', post.id)
    setPosts((prev) => prev.map((x) => x.id === post.id ? { ...x, comments: (x.comments || 0) + 1 } : x))
  }

  const communities = [...new Set(posts.map((p) => p.community).filter(Boolean))]
  const shown = filter ? posts.filter((p) => p.community === filter) : posts

  return (
    <div className="max-w-2xl mx-auto">
      <StoriesStrip me={me} notify={notify} />
      <Composer me={me} onPost={addPost} notify={notify} />
      {communities.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2">
          <button onClick={() => setFilter('')} className={`shrink-0 text-xs px-3 py-1.5 rounded-lg ${!filter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Tudo</button>
          {communities.map((c) => <button key={c} onClick={() => setFilter(filter === c ? '' : c)} className={`shrink-0 text-xs px-3 py-1.5 rounded-lg ${filter === c ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>{c}</button>)}
        </div>
      )}
      {loading ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-40 animate-pulse opacity-40" />)}</div>
        : shown.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="grid" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">O feed está vazio.</p><p className="text-admin-muted/35 text-xs mt-1">Seja o primeiro a publicar algo para a rede.</p></div>
        ) : shown.map((p) => <PostCard key={p.id} post={p} me={me} liked={likes.has(p.id)} onLike={toggleLike} onComment={addComment} />)}
    </div>
  )
}

export function SeravieNetwork({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [view, setView] = useState('dashboard')
  const [me, setMe] = useState(null)
  const [dmTarget, setDmTarget] = useState(null)  // membro para iniciar DM (do "Mensagem" no perfil)

  // Deep-link Suppliers ↔ Network: abre a página pública do fornecedor.
  const openSupplier = (s) => { if (s?.id) window.open(`/fornecedor/${s.id}`, '_blank', 'noopener') }

  // garante um perfil de membro para o usuário atual (auto-provisiona)
  useEffect(() => {
    if (!user?.id || !tenantId) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('network_members').select('*').eq('user_id', user.id).maybeSingle()
      if (!alive) return
      if (data) setMe(data)
      else {
        const name = profile?.full_name || user.email?.split('@')[0] || 'Membro'
        const { data: created } = await supabase.from('network_members').insert({ tenant_id: tenantId, user_id: user.id, name, status: 'active' }).select('*').maybeSingle()
        if (alive) setMe(created || { name })
      }
    })()
    return () => { alive = false }
  }, [user, tenantId, profile])

  return (
    <div className="flex gap-6">
      <nav className="hidden md:block w-52 shrink-0">
        <div className="glass-soft rounded-2xl p-2 sticky top-24">
          <div className="px-3 py-3 mb-1"><p className="font-serif text-lg text-admin-text leading-none">Network</p><p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mt-1">Rede profissional</p></div>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${view === n.key ? 'bg-admin-champ/12 text-admin-champ' : 'text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.03]'}`}>
              <Icon name={n.icon} className="w-4 h-4 shrink-0" /><span className="truncate">{n.label}</span>
            </button>
          ))}
          {me && (
            <div className="mt-2 pt-3 border-t border-white/[0.06] px-3 py-2 flex items-center gap-2">
              <Avatar name={me.name} url={me.avatar_url} size="w-8 h-8" text="text-[11px]" />
              <div className="min-w-0"><p className="text-admin-text text-xs truncate">{me.name}</p><p className="text-admin-muted/40 text-[10px] truncate">{me.headline || 'Meu perfil'}</p></div>
            </div>
          )}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="md:hidden flex-1"><GlassSelect value={view} onChange={setView} options={NAV.map((n) => ({ value: n.key, label: n.label }))} /></div>
          <div className="flex-1 hidden md:block" />
          <NotificationsBell onNavigate={setView} notify={notify} domain="network" />
        </div>
        {view === 'dashboard' && <NetworkDashboard me={me} notify={notify} onNavigate={setView} />}
        {view === 'feed' && <Feed me={me} notify={notify} />}
        {view === 'messages' && <Messages me={me} notify={notify} startWith={dmTarget} />}
        {view === 'communities' && <Communities me={me} notify={notify} />}
        {view === 'people' && <People notify={notify} onMessage={(memberId) => { setDmTarget(memberId); setView('messages') }} />}
        {view === 'ai' && <NetworkAI me={me} notify={notify} />}
        {view === 'smart' && <SmartNetworking me={me} notify={notify} onMessage={(memberId) => { setDmTarget(memberId); setView('messages') }} />}
        {view === 'map' && <ExperienceMap notify={notify} onOpenSupplier={openSupplier} />}
        {view === 'services' && <ServiceMarketplace me={me} notify={notify} />}
        {view === 'talent' && <TalentPool me={me} notify={notify} onMessage={(memberId) => { setDmTarget(memberId); setView('messages') }} />}
        {view === 'events' && <NetworkEvents me={me} notify={notify} />}
        {view === 'projects' && <NetworkProjects me={me} notify={notify} />}
        {view === 'academy' && <Academy me={me} notify={notify} />}
        {view === 'collections' && <Collections me={me} notify={notify} onOpenSupplier={openSupplier} />}
        {view === 'certifications' && <Certifications me={me} notify={notify} />}
        {view === 'lab' && <ExperienceLab me={me} notify={notify} />}
        {view === 'dna' && <ExperienceDNA notify={notify} />}
        {view === 'passport' && <Passport me={me} notify={notify} />}
        {view === 'verify_identity' && <IdentityVerification notify={notify} />}
        {view === 'timeline' && <TimelineViva notify={notify} />}
      </div>
    </div>
  )
}
