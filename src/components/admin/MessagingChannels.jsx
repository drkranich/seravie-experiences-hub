import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

// Canais de atendimento. Cada tenant conecta as próprias contas (como no frete/marketplaces).
const CHANNELS = [
  {
    key: 'whatsapp', name: 'WhatsApp Business', color: '#25d366', tint: '#25d36618', letter: 'WA',
    blurb: 'Atenda pelo WhatsApp via API oficial (Cloud API da Meta).',
    help: 'No Meta for Developers, crie um app WhatsApp e gere o token. Cole abaixo.',
    primary: 'access_token',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID' },
      { key: 'business_account_id', label: 'WhatsApp Business Account ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'verify_token', label: 'Verify Token (webhook)', secret: true },
    ],
  },
  {
    key: 'instagram', name: 'Instagram Direct', color: '#e1306c', tint: '#e1306c18', letter: 'IG',
    blurb: 'Receba e responda DMs do Instagram.',
    help: 'Via Meta Business: conta profissional vinculada a uma página + token da Graph API.',
    primary: 'access_token',
    fields: [
      { key: 'ig_account_id', label: 'Instagram Account ID' },
      { key: 'page_id', label: 'Página vinculada (ID)' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    key: 'messenger', name: 'Messenger', color: '#0084ff', tint: '#0084ff18', letter: 'MS',
    blurb: 'Mensagens da sua página do Facebook.',
    help: 'Token de página (Page Access Token) no Meta for Developers.',
    primary: 'page_access_token',
    fields: [
      { key: 'page_id', label: 'Page ID' },
      { key: 'page_access_token', label: 'Page Access Token', secret: true },
      { key: 'verify_token', label: 'Verify Token (webhook)', secret: true },
    ],
  },
  {
    key: 'telegram', name: 'Telegram', color: '#229ed9', tint: '#229ed918', letter: 'TG',
    blurb: 'Bot de atendimento no Telegram.',
    help: 'Crie um bot com o @BotFather e cole o token.',
    primary: 'bot_token',
    fields: [
      { key: 'bot_token', label: 'Bot Token', secret: true },
      { key: 'bot_username', label: 'Username do bot' },
    ],
  },
  {
    key: 'email', name: 'E-mail', color: '#b08d57', tint: '#b08d5718', letter: '@',
    blurb: 'Central de e-mail (SMTP/IMAP) no inbox unificado.',
    help: 'Informe os dados do servidor de e-mail e credenciais.',
    primary: 'imap_host',
    fields: [
      { key: 'address', label: 'Endereço de e-mail' },
      { key: 'imap_host', label: 'Servidor IMAP' },
      { key: 'smtp_host', label: 'Servidor SMTP' },
      { key: 'username', label: 'Usuário' },
      { key: 'password', label: 'Senha', secret: true },
    ],
  },
  {
    key: 'webchat', name: 'Chat do site', color: '#c8a96a', tint: '#c8a96a18', letter: 'WC',
    blurb: 'Widget de chat no seu site/loja — sem credenciais externas.',
    help: 'Ative e use o identificador abaixo para embutir o widget no site.',
    primary: 'widget_id',
    fields: [
      { key: 'widget_id', label: 'ID do widget', placeholder: 'gerado ao ativar' },
      { key: 'welcome', label: 'Mensagem de boas-vindas' },
    ],
  },
]

const STATUS_LABEL = { connected: 'Conectado', disconnected: 'Desconectado', error: 'Erro' }
const STATUS_STYLE = { connected: 'bg-admin-sage/10 text-admin-sage', disconnected: 'bg-white/[0.05] text-admin-muted/50', error: 'bg-admin-rose/10 text-admin-rose' }
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}`)

export function MessagingChannels({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ credentials: {}, is_enabled: false })
  const [reveal, setReveal] = useState({})
  const [saving, setSaving] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('messaging_channels').select('*'); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const byKey = (k) => rows.find((r) => r.channel === k)

  const open = (def) => {
    const ex = byKey(def.key)
    const creds = ex?.credentials || {}
    if (def.key === 'webchat' && !creds.widget_id) creds.widget_id = uuid().slice(0, 8)
    setForm({ credentials: creds, is_enabled: ex?.is_enabled ?? false }); setReveal({}); setEditing(def)
  }
  const setCred = (k, v) => setForm((f) => ({ ...f, credentials: { ...f.credentials, [k]: v } }))

  const save = async () => {
    if (!editing || !tenantId) return
    setSaving(true)
    const hasPrimary = !!String(form.credentials[editing.primary] || '').trim()
    const status = form.is_enabled && hasPrimary ? 'connected' : 'disconnected'
    const payload = { tenant_id: tenantId, channel: editing.key, credentials: form.credentials, is_enabled: !!form.is_enabled, status, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('messaging_channels').upsert(payload, { onConflict: 'tenant_id,channel' })
    setSaving(false)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify(`${editing.name} ${status === 'connected' ? 'conectado' : 'salvo'}`, 'success'); setEditing(null); load()
  }
  const disconnect = async (def) => {
    const ex = byKey(def.key); if (!ex) return
    await supabase.from('messaging_channels').update({ is_enabled: false, status: 'disconnected' }).eq('id', ex.id)
    notify(`${def.name} desconectado`, 'success'); load()
  }

  return (
    <div>
      <div className="mb-6"><h1 className="font-serif text-4xl text-admin-text">Canais de Atendimento</h1><p className="text-admin-muted/60 text-sm mt-1">Conecte WhatsApp, Instagram, Messenger, Telegram, e-mail e chat do site</p></div>

      <div className="glass-soft rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <Icon name="mail" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">Cada loja conecta as próprias contas (isoladas por tenant). Aqui você deixa as conexões prontas; o envio/recebimento em tempo real de cada canal é ativado com o app aprovado na plataforma (WhatsApp Cloud API, Meta, etc.), junto da etapa de webhooks.</p>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHANNELS.map((def) => {
            const row = byKey(def.key); const st = row?.status || 'disconnected'
            return (
              <div key={def.key} className="glass rounded-2xl p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-semibold text-sm" style={{ background: def.tint, color: def.color }}>{def.letter}</div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                </div>
                <p className="text-admin-text text-sm font-medium">{def.name}</p>
                <p className="text-admin-muted/50 text-xs mt-1 leading-relaxed flex-1">{def.blurb}</p>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => open(def)} className="flex-1 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-3 py-2 rounded-xl text-xs transition-colors">{row ? 'Configurar' : 'Conectar'}</button>
                  {st === 'connected' && <button onClick={() => disconnect(def)} className="px-3 py-2 rounded-xl text-xs text-admin-muted hover:text-admin-rose border border-white/[0.06] transition-colors">Desconectar</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs" style={{ background: editing.tint, color: editing.color }}>{editing.letter}</div><h2 className="font-serif text-2xl text-admin-text">{editing.name}</h2></div>
              <button onClick={() => setEditing(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <p className="text-admin-muted/50 text-xs mb-5">{editing.help}</p>
            <div className="space-y-3">
              {editing.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{f.label}</label>
                  <div className="relative">
                    <input type={f.secret && !reveal[f.key] ? 'password' : 'text'} value={form.credentials[f.key] || ''} onChange={(e) => setCred(f.key, e.target.value)} placeholder={f.placeholder || ''} className={`w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none ${f.secret ? 'pr-16' : ''}`} />
                    {f.secret && <button onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-admin-champ/70 hover:text-admin-champ px-2 py-1">{reveal[f.key] ? 'ocultar' : 'mostrar'}</button>}
                  </div>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer"><input type="checkbox" checked={!!form.is_enabled} onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))} className="w-4 h-4 rounded" /><span className="text-sm text-admin-muted">Ativar canal</span></label>
            <div className="flex gap-3 mt-6"><button onClick={save} disabled={saving} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar conexão'}</button><button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
