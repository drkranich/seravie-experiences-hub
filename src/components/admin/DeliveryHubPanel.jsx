import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { ResourceTabs } from './ResourcePanel'
import { KanbanBoard } from './Kanban'
import { Icon } from './ui'

const WEBHOOK_URL = 'https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/delivery-webhook'

const CHANNELS = [
  { key: 'ifood', label: 'iFood', color: '#EA1D2C', fields: ['client_id', 'client_secret', 'merchant_id'] },
  { key: 'rappi', label: 'Rappi', color: '#FF5A00', fields: ['client_id', 'client_secret', 'store_id'] },
  { key: '99food', label: '99Food', color: '#FFD400', fields: ['api_key', 'store_id'] },
  { key: 'instagram', label: 'Instagram', color: '#E1306C', fields: ['ig_account_id', 'page_id', 'access_token', 'verify_token'], hint: 'Conecta as DMs do Instagram via Meta (Instagram Messaging API). Cada mensagem/pedido cai aqui.' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', fields: ['phone_number_id', 'access_token', 'verify_token'] },
  { key: 'app', label: 'App próprio', color: '#DCCBA7', fields: ['api_key'] },
]
const FIELD_LABELS = { client_id: 'Client ID', client_secret: 'Client Secret', merchant_id: 'Merchant ID', store_id: 'Store ID', api_key: 'API Key', phone_number_id: 'Phone Number ID', token: 'Token', ig_account_id: 'Instagram Account ID', page_id: 'Facebook Page ID', access_token: 'Access Token', verify_token: 'Verify Token (webhook)' }

// ---------- Pedidos (kanban unificado dos canais, em tempo real) ----------
function OrdersTab({ notify }) {
  return (
    <KanbanBoard notify={notify} module="ecommerce" table="delivery_orders" title="" subtitle="pedidos dos canais de delivery em uma tela" icon="cart"
      stageField="status" stageLabel="Status" primary="customer_name" valueField="total"
      stages={[
        ['new', 'Novo', 'border-admin-champ/40'],
        ['confirmed', 'Confirmado', 'border-admin-sage/40'],
        ['preparing', 'Preparando', 'border-admin-gold/40'],
        ['dispatched', 'Saiu p/ entrega', 'border-admin-champ/50'],
        ['delivered', 'Entregue', 'border-admin-sage/50'],
        ['cancelled', 'Cancelado', 'border-admin-rose/40'],
      ]}
      chips={['channel', 'display_id', 'payment_method']}
      fields={[
        { key: 'customer_name', label: 'Cliente', type: 'text', primary: true, full: true },
        { key: 'channel', label: 'Canal', type: 'text' },
        { key: 'display_id', label: 'Código', type: 'text' },
        { key: 'customer_phone', label: 'Telefone', type: 'text' },
        { key: 'address', label: 'Endereço', type: 'textarea', full: true },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'delivery_fee', label: 'Taxa de entrega', type: 'currency' },
        { key: 'payment_method', label: 'Pagamento', type: 'text' },
        { key: 'eta_minutes', label: 'ETA (min)', type: 'int' },
      ]}
      kpis={[
        { label: 'Pedidos', fmt: 'int', calc: (r) => r.length },
        { label: 'Novos', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'new').length },
        { label: 'Faturamento', fmt: 'currency', calc: (r) => r.filter((x) => x.status !== 'cancelled').reduce((s, x) => s + Number(x.total || 0), 0) },
      ]}
    />
  )
}

// ---------- Canais (conexão real via API/webhook) ----------
function ChannelsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null) // canal em configuração
  const [testing, setTesting] = useState('')

  const load = async () => { const { data } = await supabase.from('store_channels').select('*'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const rec = (c) => rows.find((r) => r.channel === c)

  const toggle = async (c) => {
    const existing = rec(c.key)
    if (existing) await supabase.from('store_channels').update({ is_enabled: !existing.is_enabled }).eq('id', existing.id)
    else await supabase.from('store_channels').insert({ tenant_id: tenantId, channel: c.key, is_enabled: true, status: 'pending' })
    load(); notify('Canal atualizado', 'success')
  }

  const openConfig = async (c) => {
    let r = rec(c.key)
    if (!r) { const { data } = await supabase.from('store_channels').insert({ tenant_id: tenantId, channel: c.key, is_enabled: false, status: 'pending' }).select('*').single(); r = data; load() }
    setModal({ def: c, rec: r, creds: { ...(r?.credentials || {}) } })
  }

  const saveConfig = async () => {
    await supabase.from('store_channels').update({ credentials: modal.creds, status: 'configured' }).eq('id', modal.rec.id)
    notify('Credenciais salvas', 'success'); setModal(null); load()
  }

  const copyWebhook = (r) => { navigator.clipboard?.writeText(WEBHOOK_URL); notify('URL do webhook copiada', 'success') }
  const copyToken = (r) => { navigator.clipboard?.writeText(r.webhook_token || ''); notify('Token copiado', 'success') }

  // dispara um pedido de teste pelo próprio webhook (prova o fluxo ponta a ponta)
  const sendTest = async (c) => {
    const r = rec(c.key)
    if (!r?.webhook_token) return notify('Ative o canal primeiro', 'error')
    setTesting(c.key)
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-token': r.webhook_token },
        body: JSON.stringify({
          external_id: 'TESTE-' + Math.random().toString(36).slice(2, 8), display_id: String(1000 + Math.floor(Math.random() * 9000)),
          customer_name: 'Cliente Teste', customer_phone: '(11) 99999-0000', address: 'Rua Exemplo, 123',
          items: [{ name: 'Combo Teste', qty: 1 }, { name: 'Refrigerante', qty: 2 }],
          subtotal: 45, delivery_fee: 8, total: 53, payment_method: 'online', eta_minutes: 30,
        }),
      })
      const d = await res.json()
      setTesting('')
      if (d.ok) notify(`Pedido de teste recebido de ${c.label}!`, 'success')
      else notify('Falha no teste: ' + (d.error || 'erro'), 'error')
      load()
    } catch (e) { setTesting(''); notify('Erro ao enviar teste', 'error') }
  }

  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 text-[12px] text-admin-muted/70 leading-relaxed">
        Ative um canal, cadastre as credenciais da API do marketplace e configure o <b className="text-admin-champ">webhook</b> no painel do canal apontando para a URL abaixo (autenticando com o token do canal). Os pedidos passam a cair automaticamente na aba <b>Pedidos</b> e viram comanda na cozinha. Use <b>Enviar teste</b> para validar o fluxo antes da homologação.
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHANNELS.map((c) => {
          const r = rec(c.key)
          const on = r?.is_enabled
          const connected = r?.status === 'connected'
          return (
            <div key={c.key} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}22` }}><Icon name="truck" className="w-4 h-4" style={{ color: c.color }} /></span>
                  <div>
                    <p className="text-admin-text text-sm font-medium">{c.label}</p>
                    <p className={`text-[10px] ${connected ? 'text-admin-sage' : r ? 'text-admin-gold/70' : 'text-admin-muted/40'}`}>{connected ? '● conectado' : r ? (r.status || 'configurar') : 'não conectado'}</p>
                  </div>
                </div>
                <button onClick={() => toggle(c)} className={`text-[10px] px-3 py-1.5 rounded-lg ${on ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/60'}`}>{on ? 'ativo' : 'ativar'}</button>
              </div>
              {r?.last_sync_at && <p className="text-admin-muted/40 text-[10px] mb-2">último pedido: {new Date(r.last_sync_at).toLocaleString('pt-BR')}</p>}
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => openConfig(c)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Configurar</button>
                {r && <button onClick={() => sendTest(c)} disabled={testing === c.key || !on} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ hover:bg-admin-champ/20 disabled:opacity-40">{testing === c.key ? 'enviando…' : 'Enviar teste'}</button>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de configuração do canal */}
      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Conectar {modal.def.label}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {modal.def.hint && <p className="text-[12px] text-admin-muted/70 mb-4 -mt-1">{modal.def.hint}</p>}

            {/* Webhook: URL + token para colar no painel do marketplace */}
            <div className="glass-soft rounded-xl p-3 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-2">Webhook de entrada (configure no painel do {modal.def.label})</p>
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 min-w-0 truncate text-[11px] text-admin-text bg-white/[0.05] rounded-lg px-2.5 py-1.5">{WEBHOOK_URL}</code>
                <button onClick={() => copyWebhook(modal.rec)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ shrink-0">Copiar URL</button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-[11px] text-admin-muted/70 bg-white/[0.05] rounded-lg px-2.5 py-1.5">token: {modal.rec?.webhook_token}</code>
                <button onClick={() => copyToken(modal.rec)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted shrink-0">Copiar token</button>
              </div>
              <p className="text-admin-muted/40 text-[10px] mt-2">Envie o token no header <code>x-webhook-token</code>. As credenciais abaixo ficam guardadas com segurança no backend (nunca no navegador do cliente).</p>
            </div>

            {/* Credenciais da API do marketplace */}
            <div className="space-y-3 mb-5">
              {modal.def.fields.map((f) => (
                <div key={f}>
                  <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{FIELD_LABELS[f] || f}</label>
                  <input value={modal.creds[f] || ''} onChange={(e) => setModal((m) => ({ ...m, creds: { ...m.creds, [f]: e.target.value } }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none font-mono" placeholder={`${FIELD_LABELS[f] || f} do ${modal.def.label}`} />
                </div>
              ))}
            </div>

            <div className="flex gap-3"><button onClick={saveConfig} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Salvar credenciais</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DeliveryHubPanel({ notify }) {
  return (
    <ResourceTabs title="Hub Delivery" subtitle="iFood, Rappi, 99Food e app próprio em uma tela só"
      tabs={[
        { key: 'orders', label: 'Pedidos', render: () => <OrdersTab notify={notify} /> },
        { key: 'channels', label: 'Canais', render: () => <ChannelsTab notify={notify} /> },
      ]}
    />
  )
}
