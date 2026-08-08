import { useState, useEffect, useRef } from 'react'
import { supabase, SUPABASE_URL } from '../../../lib/supabase'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { uploadFile } from '../../../lib/storage'

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

// Growth Studio → Conteúdo. Planejador editorial + conexões com redes sociais.
export function ContentTab({ tenantId, createdBy, notify }) {
  const [sub, setSub] = useState('planner')
  return (
    <div>
      <div className="flex gap-1 mb-5 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['planner', 'Planejador', 'grid'], ['connections', 'Conexões', 'link']].map(([k, v, ic]) => (
          <button key={k} onClick={() => setSub(k)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors ${sub === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name={ic} className="w-3.5 h-3.5" />{v}</button>
        ))}
      </div>
      {sub === 'planner' ? <PlannerBoard tenantId={tenantId} createdBy={createdBy} notify={notify} /> : <SocialConnections tenantId={tenantId} notify={notify} />}
    </div>
  )
}

function PlannerBoard({ tenantId, createdBy, notify }) {
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
  const [f, setF] = useState({ title: post.title || '', content: post.content || '', networks: post.networks || [], status: post.status || 'idea', scheduled_at: post.scheduled_at ? String(post.scheduled_at).slice(0, 10) : '', media_url: post.media_url || '' })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const toggleNet = (k) => set({ networks: f.networks.includes(k) ? f.networks.filter((x) => x !== k) : [...f.networks, k] })
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const r = await uploadFile(file)
    setUploading(false)
    if (r.error) return notify(r.error, 'error')
    set({ media_url: r.url })
  }
  const save = async () => {
    if (!f.title.trim()) return notify('Título obrigatório', 'error')
    const payload = { title: f.title.trim(), content: f.content, networks: f.networks, status: f.status, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at + 'T09:00:00').toISOString() : null, media_url: f.media_url || null, updated_at: new Date().toISOString() }
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
            <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Mídia (imagem)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            {f.media_url ? (
              <div className="relative group">
                <img src={f.media_url} alt="mídia" className="rounded-xl max-h-40 w-full object-cover" />
                <button onClick={() => set({ media_url: '' })} className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 text-admin-text flex items-center justify-center hover:bg-admin-rose/60"><Icon name="x" className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full glass-input rounded-xl py-6 flex flex-col items-center gap-2 text-admin-muted/60 hover:text-admin-text transition-colors border border-dashed border-white/10 disabled:opacity-50">
                <Icon name="upload" className="w-5 h-5" />
                <span className="text-xs">{uploading ? 'Enviando…' : 'Enviar imagem'}</span>
              </button>
            )}
          </div>
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

// ---- Conexões com redes sociais (credenciais informadas NA TELA, sem Supabase) ----
// Cada rede tem seus campos de credencial. Ficam em social_connections.config
// (tabela protegida por RLS: só o próprio tenant lê/escreve). Campos secret: true
// aparecem mascarados, como no cadastro de canais de mensagem.
const CONN_NETWORKS = [
  { key: 'instagram', label: 'Instagram', color: 'rose', provider: 'meta', help: 'Conta Instagram Business vinculada a uma Página do Facebook (Meta Graph API).',
    fields: [
      { key: 'ig_user_id', label: 'Instagram Business Account ID', placeholder: '1784xxxxxxxxxxx' },
      { key: 'page_id', label: 'Facebook Page ID', placeholder: 'ID da página vinculada' },
      { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'Token de acesso da Meta' },
    ] },
  { key: 'facebook', label: 'Facebook', color: 'champ', provider: 'meta', help: 'Página do Facebook (Meta Graph API).',
    fields: [
      { key: 'page_id', label: 'Page ID', placeholder: 'ID da página' },
      { key: 'page_access_token', label: 'Page Access Token', secret: true, placeholder: 'Token de página' },
    ] },
  { key: 'tiktok', label: 'TikTok', color: 'copper', provider: 'tiktok', help: 'TikTok Content Posting API.',
    fields: [
      { key: 'open_id', label: 'Open ID / conta', placeholder: 'ID da conta business' },
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'refresh_token', label: 'Refresh Token', secret: true },
    ] },
  { key: 'linkedin', label: 'LinkedIn', color: 'sage', provider: 'linkedin', help: 'LinkedIn Marketing API.',
    fields: [
      { key: 'urn', label: 'URN (autor)', placeholder: 'urn:li:organization:xxxx' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ] },
  { key: 'pinterest', label: 'Pinterest', color: 'gold', provider: 'pinterest', help: 'Pinterest API v5.',
    fields: [
      { key: 'board_id', label: 'Board ID (padrão)', placeholder: 'ID do board' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ] },
]
const CONN_COLOR = {
  rose: { bg: 'bg-admin-rose/10', text: 'text-admin-rose', br: 'border-admin-rose/25' },
  champ: { bg: 'bg-admin-champ/10', text: 'text-admin-champ', br: 'border-admin-champ/25' },
  copper: { bg: 'bg-admin-copper/10', text: 'text-admin-copper', br: 'border-admin-copper/25' },
  sage: { bg: 'bg-admin-sage/10', text: 'text-admin-sage', br: 'border-admin-sage/25' },
  gold: { bg: 'bg-admin-gold/10', text: 'text-admin-gold', br: 'border-admin-gold/25' },
}

function SocialConnections({ tenantId, notify }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // network key

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('social_connections').select('*'); setRows(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  // ao voltar do popup de OAuth, recarrega o status
  useEffect(() => {
    const onMsg = (e) => { if (e.data?.seravieSocial) { load(); notify('Conta conectada', 'success') } }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  const rowFor = (k) => rows.find((r) => r.network === k)

  // OAuth real: abre popup para a rede; a Edge Function troca o code por token
  // e grava em social_credentials (protegida). O token nunca vem ao cliente.
  const oauthConnect = (net) => {
    const url = `${SUPABASE_URL}/functions/v1/social-oauth?action=start&network=${net.key}&tenant=${encodeURIComponent(tenantId)}&redirect=${encodeURIComponent(window.location.href)}`
    const w = 620, h = 720
    const left = window.screenX + (window.outerWidth - w) / 2
    const top = window.screenY + (window.outerHeight - h) / 2
    window.open(url, 'seravie_social_oauth', `width=${w},height=${h},left=${left},top=${top}`)
  }
  // conexão NA TELA: guarda as credenciais em social_connections.config (protegida por RLS).
  const connect = async (net, { account_name, config }) => {
    const existing = rowFor(net.key)
    // preserva segredos já salvos quando o campo vier vazio (não sobrescreve com branco)
    const merged = { ...(existing?.config || {}), ...config }
    Object.keys(merged).forEach((k) => { if (merged[k] === '' || merged[k] == null) delete merged[k] })
    const payload = { status: 'connected', connected_at: new Date().toISOString(), provider: net.provider, account_name: account_name || null, config: merged, updated_at: new Date().toISOString() }
    try {
      if (existing) await supabase.from('social_connections').update(payload).eq('id', existing.id)
      else await supabase.from('social_connections').insert({ tenant_id: tenantId, network: net.key, ...payload })
      notify('Conexão salva', 'success'); setEditing(null); load()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
  }
  const disconnect = async (net) => {
    // remove o token via Edge Function (service_role) e marca desconectado
    try { await supabase.functions.invoke('social-oauth', { body: { action: 'disconnect', tenant: tenantId, network: net.key } }) } catch { /* fallback abaixo */ }
    const existing = rowFor(net.key)
    if (existing) { try { await supabase.from('social_connections').update({ status: 'disconnected', connected_at: null, updated_at: new Date().toISOString() }).eq('id', existing.id) } catch { /* noop */ } }
    notify('Rede desconectada', 'info'); load()
  }

  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-5 flex items-start gap-3 bg-admin-champ/[0.04] border border-admin-champ/15">
        <Icon name="link" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">Conecte suas contas para publicar direto pela Seravie. Informe as credenciais de cada rede aqui na tela — <span className="text-admin-champ">elas ficam guardadas com segurança na sua conta</span> (área protegida, visível só para você) e são usadas pelo servidor no momento de publicar. Prefere o jeito automático? Use “Conectar via OAuth” quando disponível.</p>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {CONN_NETWORKS.map((net) => {
            const r = rowFor(net.key)
            const connected = r?.status === 'connected'
            const col = CONN_COLOR[net.color]
            return (
              <div key={net.key} className={`glass rounded-2xl p-5 border ${connected ? col.br : 'border-transparent'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl ${col.bg} flex items-center justify-center shrink-0`}><Icon name="share" className={`w-5 h-5 ${col.text}`} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-admin-text text-sm font-medium">{net.label}</p>
                      <span className={`text-[9px] px-2 py-0.5 rounded ${connected ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/40'}`}>{connected ? 'conectado' : 'não conectado'}</span>
                    </div>
                    <p className="text-admin-muted/50 text-xs mt-0.5 leading-relaxed">{net.help}</p>
                    {connected && r?.account_name && <p className="text-admin-muted/40 text-[11px] mt-1">Conta: {r.account_name}</p>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2 flex-wrap">
                  <span className="text-admin-muted/35 text-[10px]">{net.fields.length} credenciais{connected && r?.config ? ` · ${Object.keys(r.config).length} preenchidas` : ''}</span>
                  {connected
                    ? <>
                        <button onClick={() => setEditing(net.key)} className="ml-auto text-xs bg-admin-champ/12 text-admin-champ px-3 py-1.5 rounded-lg hover:bg-admin-champ/20 transition-colors flex items-center gap-1.5"><Icon name="gear" className="w-3.5 h-3.5" />Editar credenciais</button>
                        <button onClick={() => disconnect(net)} className="text-xs text-admin-rose/80 hover:underline px-1">desconectar</button>
                      </>
                    : <>
                        <button onClick={() => setEditing(net.key)} className="ml-auto text-xs bg-admin-champ/15 text-admin-champ px-3 py-1.5 rounded-lg hover:bg-admin-champ/25 transition-colors flex items-center gap-1.5"><Icon name="link" className="w-3.5 h-3.5" />Conectar</button>
                        <button onClick={() => oauthConnect(net)} className="text-xs text-admin-sage/80 hover:underline px-1">via OAuth</button>
                      </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && <ConnectModal net={CONN_NETWORKS.find((n) => n.key === editing)} row={rowFor(editing)} onClose={() => setEditing(null)} onConnect={connect} />}
    </div>
  )
}

function ConnectModal({ net, row, onClose, onConnect }) {
  const cfg = row?.config || {}
  const [accountName, setAccountName] = useState(row?.account_name || '')
  const [values, setValues] = useState(() => Object.fromEntries(net.fields.map((f) => [f.key, cfg[f.key] || ''])))
  const [show, setShow] = useState({})
  const setV = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  const inp = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2"><h2 className="font-serif text-2xl text-admin-text">Conectar {net.label}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/50 text-xs mb-5">{net.help}</p>
        <div className="space-y-4">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome da conta (exibição)</label><input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inp} placeholder="Ex: @minhaloja" /></div>
          {net.fields.map((fld) => {
            const isSecret = fld.secret && !show[fld.key]
            return (
              <div key={fld.key}>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{fld.label}</label>
                <div className="relative">
                  <input type={isSecret ? 'password' : 'text'} value={values[fld.key]} onChange={(e) => setV(fld.key, e.target.value)} className={inp} placeholder={fld.placeholder || ''} autoComplete="off" />
                  {fld.secret && <button type="button" onClick={() => setShow((s) => ({ ...s, [fld.key]: !s[fld.key] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-admin-muted/50 hover:text-admin-champ">{show[fld.key] ? 'ocultar' : 'mostrar'}</button>}
                </div>
              </div>
            )
          })}
          <div className="glass-soft rounded-xl px-4 py-3 bg-admin-champ/[0.05] border border-admin-champ/15">
            <p className="text-admin-champ/80 text-[11px] leading-relaxed">🔒 Suas credenciais ficam guardadas com segurança na sua conta (área protegida por permissão) e só são usadas pelo servidor no momento de publicar. Deixe um campo secreto em branco para manter o valor já salvo.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => onConnect(net, { account_name: accountName || null, config: values })} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Salvar conexão</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
