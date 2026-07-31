import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

// Cada canal define os campos de credencial que o lojista cola (as próprias contas).
// `primary` é o campo mínimo para considerar o canal conectado.
export const CHANNELS = [
  {
    key: 'mercado_livre', name: 'Mercado Livre', color: '#ffe600', tint: '#ffe60018', letter: 'ML', orders: true,
    blurb: 'Sincronize anúncios, estoque e pedidos com sua conta do Mercado Livre.',
    help: 'Crie um app em developers.mercadolivre.com.br e gere o Access Token do vendedor.',
    primary: 'access_token',
    fields: [
      { key: 'seller_id', label: 'Seller ID' },
      { key: 'app_id', label: 'App ID (Client ID)' },
      { key: 'secret_key', label: 'Secret Key', secret: true },
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'refresh_token', label: 'Refresh Token', secret: true },
    ],
  },
  {
    key: 'amazon', name: 'Amazon', color: '#ff9900', tint: '#ff990018', letter: 'AZ',
    blurb: 'Integre com a Amazon via SP-API (Seller Central).',
    help: 'Gere as credenciais LWA no Seller Central → Apps e serviços → Desenvolver apps.',
    primary: 'refresh_token',
    fields: [
      { key: 'seller_id', label: 'Seller ID (Merchant Token)' },
      { key: 'marketplace_id', label: 'Marketplace ID', placeholder: 'A2Q3Y263D00KWC (Brasil)' },
      { key: 'lwa_client_id', label: 'LWA Client ID' },
      { key: 'lwa_client_secret', label: 'LWA Client Secret', secret: true },
      { key: 'refresh_token', label: 'Refresh Token', secret: true },
    ],
  },
  {
    key: 'shopee', name: 'Shopee', color: '#ee4d2d', tint: '#ee4d2d18', letter: 'SP',
    blurb: 'Conecte sua loja Shopee para anúncios e pedidos.',
    help: 'Crie um app no Shopee Open Platform e autorize sua loja para obter o Access Token.',
    primary: 'access_token',
    fields: [
      { key: 'partner_id', label: 'Partner ID' },
      { key: 'partner_key', label: 'Partner Key', secret: true },
      { key: 'shop_id', label: 'Shop ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    key: 'tiktok_shop', name: 'TikTok Shop', color: '#25f4ee', tint: '#25f4ee18', letter: 'TT',
    blurb: 'Venda pelo TikTok Shop com sincronização de catálogo e pedidos.',
    help: 'Crie um app no TikTok Shop Partner Center e autorize sua loja.',
    primary: 'access_token',
    fields: [
      { key: 'app_key', label: 'App Key' },
      { key: 'app_secret', label: 'App Secret', secret: true },
      { key: 'shop_id', label: 'Shop ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    key: 'magalu', name: 'Magalu', color: '#0086ff', tint: '#0086ff18', letter: 'MG',
    blurb: 'Venda no marketplace da Magazine Luiza (Magalu).',
    help: 'No Portal do Parceiro Magalu, crie o app/integração e gere o Access Token do vendedor.',
    primary: 'access_token',
    fields: [
      { key: 'seller_id', label: 'Seller ID / Loja' },
      { key: 'client_id', label: 'Client ID' },
      { key: 'client_secret', label: 'Client Secret', secret: true },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    key: 'instagram_shop', name: 'Instagram Shop', color: '#e1306c', tint: '#e1306c18', letter: 'IG',
    blurb: 'Publique produtos no Instagram/Facebook via catálogo da Meta.',
    help: 'Use o Meta Business e um token da Graph API com permissão de catálogo.',
    primary: 'access_token',
    fields: [
      { key: 'business_id', label: 'Meta Business ID' },
      { key: 'catalog_id', label: 'Catalog ID' },
      { key: 'page_id', label: 'Page/IG Account ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
]

const STATUS_LABEL = { connected: 'Conectado', disconnected: 'Desconectado', error: 'Erro' }
const STATUS_STYLE = { connected: 'bg-admin-sage/10 text-admin-sage', disconnected: 'bg-white/[0.05] text-admin-muted/50', error: 'bg-admin-rose/10 text-admin-rose' }

export function ChannelsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // channel def
  const [form, setForm] = useState({ credentials: {}, is_enabled: false })
  const [reveal, setReveal] = useState({})
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)

  const test = async (def) => {
    setBusy(def.key + ':test')
    const { data, error } = await supabase.functions.invoke('channel-sync', { body: { channel: def.key, action: 'test' } })
    setBusy(null)
    if (error) return notify('Falha ao testar conexão', 'error')
    if (data?.ok) notify(`${def.name} conectado${data.account?.name ? ` · ${data.account.name}` : ''}`, 'success')
    else notify(data?.error || 'Conexão falhou', 'error')
    load()
  }
  const pull = async (def) => {
    setBusy(def.key + ':pull')
    const { data, error } = await supabase.functions.invoke('channel-sync', { body: { channel: def.key, action: 'pull_orders' } })
    setBusy(null)
    if (error) return notify('Falha ao sincronizar', 'error')
    if (data?.ok) notify(`${data.imported} pedido(s) importado(s) de ${data.total}`, 'success')
    else notify(data?.error || 'Não foi possível sincronizar', 'error')
    load()
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('store_channels').select('*')
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const byKey = (k) => rows.find((r) => r.channel === k)

  const open = (def) => {
    const existing = byKey(def.key)
    setForm({ credentials: existing?.credentials || {}, is_enabled: existing?.is_enabled ?? false })
    setReveal({}); setEditing(def)
  }
  const setCred = (k, v) => setForm((f) => ({ ...f, credentials: { ...f.credentials, [k]: v } }))

  const save = async () => {
    if (!editing || !tenantId) return
    setSaving(true)
    const hasPrimary = !!String(form.credentials[editing.primary] || '').trim()
    const status = form.is_enabled && hasPrimary ? 'connected' : 'disconnected'
    const payload = { tenant_id: tenantId, channel: editing.key, credentials: form.credentials, is_enabled: !!form.is_enabled, status, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('store_channels').upsert(payload, { onConflict: 'tenant_id,channel' })
    setSaving(false)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify(`${editing.name} ${status === 'connected' ? 'conectado' : 'salvo'}`, 'success')
    setEditing(null); load()
  }

  const disconnect = async (def) => {
    const ex = byKey(def.key)
    if (!ex) return
    await supabase.from('store_channels').update({ is_enabled: false, status: 'disconnected' }).eq('id', ex.id)
    notify(`${def.name} desconectado`, 'success'); load()
  }

  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <Icon name="link" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">Conecte suas contas de marketplace colando as credenciais de cada plataforma — nada de código. Cada loja usa as próprias contas (isoladas por tenant). A sincronização automática de catálogo e pedidos de cada canal é a próxima etapa do roadmap; aqui você já deixa as conexões prontas.</p>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHANNELS.map((def) => {
            const row = byKey(def.key)
            const st = row?.status || 'disconnected'
            return (
              <div key={def.key} className="glass rounded-2xl p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-semibold text-sm" style={{ background: def.tint, color: def.color }}>{def.letter}</div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                </div>
                <p className="text-admin-text text-sm font-medium">{def.name}</p>
                <p className="text-admin-muted/50 text-xs mt-1 leading-relaxed flex-1">{def.blurb}</p>
                {row?.last_sync_at && <p className="text-admin-muted/40 text-[10px] mt-3">Última sincronização: {new Date(row.last_sync_at).toLocaleString('pt-BR')}</p>}
                <div className="flex gap-2 flex-wrap mt-4">
                  <button onClick={() => open(def)} className="flex-1 min-w-[84px] bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-3 py-2 rounded-xl text-xs transition-colors">{row ? 'Configurar' : 'Conectar'}</button>
                  {row && <button onClick={() => test(def)} disabled={busy === def.key + ':test'} className="px-3 py-2 rounded-xl text-xs text-admin-champ/80 border border-admin-champ/20 hover:bg-white/[0.04] transition-colors disabled:opacity-50">{busy === def.key + ':test' ? '…' : 'Testar'}</button>}
                  {def.orders && st === 'connected' && <button onClick={() => pull(def)} disabled={busy === def.key + ':pull'} className="px-3 py-2 rounded-xl text-xs text-admin-sage border border-admin-sage/20 hover:bg-admin-sage/10 transition-colors disabled:opacity-50">{busy === def.key + ':pull' ? '…' : 'Sincronizar pedidos'}</button>}
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
                    <input
                      type={f.secret && !reveal[f.key] ? 'password' : 'text'}
                      value={form.credentials[f.key] || ''}
                      onChange={(e) => setCred(f.key, e.target.value)}
                      placeholder={f.placeholder || ''}
                      className={`w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none ${f.secret ? 'pr-16' : ''}`}
                    />
                    {f.secret && <button onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-admin-champ/70 hover:text-admin-champ px-2 py-1">{reveal[f.key] ? 'ocultar' : 'mostrar'}</button>}
                  </div>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer">
              <input type="checkbox" checked={!!form.is_enabled} onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))} className="w-4 h-4 rounded" />
              <span className="text-sm text-admin-muted">Ativar canal</span>
            </label>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar conexão'}</button>
              <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
