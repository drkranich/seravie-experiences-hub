import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { MARKETPLACES, FIELD_LABELS } from '../../../lib/commerceTypes'

const WEBHOOK_URL = 'https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/commerce-webhook'

// Marketplaces do Commerce Hub — conexão real: credenciais no backend + webhook
// de entrada de pedidos + teste. Mesmo padrão robusto do Hub Delivery.
export function CommerceMarketplace({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [testing, setTesting] = useState('')

  const load = async () => { const { data } = await supabase.from('commerce_channels').select('*'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const rec = (c) => rows.find((r) => r.channel === c)

  const toggle = async (c) => {
    const existing = rec(c.key)
    if (existing) await supabase.from('commerce_channels').update({ is_enabled: !existing.is_enabled }).eq('id', existing.id)
    else await supabase.from('commerce_channels').insert({ tenant_id: tenantId, channel: c.key, is_enabled: true, status: 'pending' })
    load(); notify?.('Canal atualizado', 'success')
  }
  const openConfig = async (c) => {
    let r = rec(c.key)
    if (!r) { const { data } = await supabase.from('commerce_channels').insert({ tenant_id: tenantId, channel: c.key, is_enabled: false, status: 'pending' }).select('*').single(); r = data; load() }
    setModal({ def: c, rec: r, creds: { ...(r?.credentials || {}) } })
  }
  const saveConfig = async () => {
    await supabase.from('commerce_channels').update({ credentials: modal.creds, status: 'configured' }).eq('id', modal.rec.id)
    notify?.('Credenciais salvas', 'success'); setModal(null); load()
  }
  const copy = (txt, msg) => { navigator.clipboard?.writeText(txt); notify?.(msg, 'success') }
  const sendTest = async (c) => {
    const r = rec(c.key)
    if (!r?.webhook_token) return notify?.('Ative o canal primeiro', 'error')
    setTesting(c.key)
    try {
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-token': r.webhook_token },
        body: JSON.stringify({ external_id: 'T-' + Math.random().toString(36).slice(2, 8), number: String(9000 + Math.floor(Math.random() * 999)), customer_name: 'Cliente Marketplace', customer_email: 'teste@cliente.com', items: [{ name: 'Produto Teste', qty: 2, price: 39.9 }], subtotal: 79.8, shipping: 12, total: 91.8 }) })
      const d = await res.json(); setTesting('')
      if (d.ok) notify?.(`Pedido de teste recebido de ${c.label}!`, 'success'); else notify?.('Falha: ' + (d.error || 'erro'), 'error')
      load()
    } catch { setTesting(''); notify?.('Erro ao enviar teste', 'error') }
  }

  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 text-[12px] text-admin-muted/70 leading-relaxed">
        Conecte cada marketplace: ative, cadastre as credenciais da API e configure o <b className="text-admin-champ">webhook</b> no painel do canal para a URL abaixo. Os pedidos passam a cair em <b>Pedidos</b> automaticamente. Use <b>Enviar teste</b> para validar antes da homologação.
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MARKETPLACES.map((c) => {
          const r = rec(c.key); const on = r?.is_enabled; const connected = r?.status === 'connected'
          return (
            <div key={c.key} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs" style={{ background: `${c.color}22`, color: c.color }}>{c.label.slice(0, 2).toUpperCase()}</span>
                  <div><p className="text-admin-text text-sm font-medium">{c.label}</p><p className={`text-[10px] ${connected ? 'text-admin-sage' : r ? 'text-admin-gold/70' : 'text-admin-muted/40'}`}>{connected ? '● conectado' : r ? (r.status || 'configurar') : 'não conectado'}</p></div>
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

      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Conectar {modal.def.label}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="glass-soft rounded-xl p-3 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-2">Webhook de entrada (configure no painel do {modal.def.label})</p>
              <div className="flex items-center gap-2 mb-2"><code className="flex-1 min-w-0 truncate text-[11px] text-admin-text bg-white/[0.05] rounded-lg px-2.5 py-1.5">{WEBHOOK_URL}</code><button onClick={() => copy(WEBHOOK_URL, 'URL copiada')} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ shrink-0">Copiar</button></div>
              <div className="flex items-center gap-2"><code className="flex-1 min-w-0 truncate text-[11px] text-admin-muted/70 bg-white/[0.05] rounded-lg px-2.5 py-1.5">token: {modal.rec?.webhook_token}</code><button onClick={() => copy(modal.rec?.webhook_token || '', 'Token copiado')} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted shrink-0">Copiar</button></div>
              <p className="text-admin-muted/40 text-[10px] mt-2">Token no header <code>x-webhook-token</code>. Credenciais ficam no backend, nunca no navegador.</p>
            </div>
            <div className="space-y-3 mb-5">
              {modal.def.fields.map((f) => (
                <div key={f}><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{FIELD_LABELS[f] || f}</label><input value={modal.creds[f] || ''} onChange={(e) => setModal((m) => ({ ...m, creds: { ...m.creds, [f]: e.target.value } }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none font-mono" placeholder={`${FIELD_LABELS[f] || f} do ${modal.def.label}`} /></div>
              ))}
            </div>
            <div className="flex gap-3"><button onClick={saveConfig} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Salvar credenciais</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
