import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { brl } from '../../../lib/commerceTypes'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

// Status de envio com rótulo/cor.
const SHIP_STATUS = {
  pending: { label: 'Pendente', chip: 'bg-admin-gold/15 text-admin-gold' },
  paid: { label: 'Pago', chip: 'bg-admin-champ/15 text-admin-champ' },
  generated: { label: 'Etiqueta gerada', chip: 'bg-admin-champ/15 text-admin-champ' },
  posted: { label: 'Postado', chip: 'bg-admin-sage/15 text-admin-sage' },
  in_transit: { label: 'Em trânsito', chip: 'bg-admin-sage/15 text-admin-sage' },
  delivered: { label: 'Entregue', chip: 'bg-admin-sage/20 text-admin-sage' },
  cancelled: { label: 'Cancelado', chip: 'bg-admin-rose/15 text-admin-rose' },
}
const stMeta = (s) => SHIP_STATUS[s] || { label: s || '—', chip: 'bg-white/[0.05] text-admin-muted/60' }

// ---------- Config dos serviços logísticos ----------
function ConfigTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [form, setForm] = useState(null)
  const [account, setAccount] = useState(null)
  const [busy, setBusy] = useState('')

  const load = async () => {
    const { data } = await supabase.from('store_settings').select('*').maybeSingle()
    const dp = data?.default_package || { width: 16, height: 6, length: 20, weight: 0.5 }
    setForm({ shipping_provider: data?.shipping_provider || 'melhor_envio', melhor_envio_token: data?.melhor_envio_token || '', melhor_envio_sandbox: data?.melhor_envio_sandbox ?? true, origin_postal_code: data?.origin_postal_code || '', shipping_flat: data?.shipping_flat ?? 0, free_shipping_min: data?.free_shipping_min ?? '', default_package: dp })
  }
  useEffect(() => { load() }, [])
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setPkg = (k, v) => setForm((f) => ({ ...f, default_package: { ...f.default_package, [k]: Number(v) || 0 } }))
  const save = async () => {
    setBusy('save')
    const payload = { tenant_id: tenantId, shipping_provider: form.shipping_provider, melhor_envio_token: form.melhor_envio_token || null, melhor_envio_sandbox: !!form.melhor_envio_sandbox, origin_postal_code: form.origin_postal_code || null, shipping_flat: Number(form.shipping_flat) || 0, free_shipping_min: form.free_shipping_min === '' ? null : Number(form.free_shipping_min), default_package: form.default_package, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('store_settings').upsert(payload, { onConflict: 'tenant_id' })
    setBusy('')
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error'); notify?.('Configuração salva', 'success')
  }
  const test = async () => {
    if (!form.melhor_envio_token) return notify?.('Cole o token do Melhor Envio', 'error')
    setBusy('test')
    const { data, error } = await supabase.functions.invoke('melhor-envio', { body: { action: 'test', token: form.melhor_envio_token, sandbox: form.melhor_envio_sandbox } })
    setBusy('')
    if (error || !data?.ok) return notify?.('Falha: ' + (data?.error || 'erro'), 'error')
    setAccount(data.account); notify?.('Conta conectada: ' + (data.account?.name || ''), 'success')
  }
  if (!form) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>

  return (
    <div className="max-w-2xl space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div><p className="text-admin-text font-medium">Melhor Envio</p><p className="text-admin-muted/50 text-xs">Cotação, etiquetas e rastreamento de PAC, SEDEX, Jadlog, Loggi e mais — numa conta só.</p></div>
          {account && <span className="text-[11px] px-2 py-1 rounded-lg bg-admin-sage/15 text-admin-sage">✓ {account.name}</span>}
        </div>
        <div className="space-y-3">
          <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Token de acesso</label><input value={form.melhor_envio_token} onChange={(e) => set('melhor_envio_token', e.target.value)} className={`${inputCls} font-mono`} placeholder="cole o token do Melhor Envio" /></div>
          <label className="flex items-center gap-2 text-sm text-admin-muted/70"><input type="checkbox" checked={form.melhor_envio_sandbox} onChange={(e) => set('melhor_envio_sandbox', e.target.checked)} className="accent-admin-champ" />Ambiente de testes (sandbox)</label>
          <div className="flex gap-2"><button onClick={test} disabled={busy === 'test'} className="bg-white/[0.05] text-admin-champ px-4 py-2 rounded-xl text-sm hover:bg-white/[0.08]">{busy === 'test' ? 'Testando…' : 'Testar conexão'}</button></div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-admin-text font-medium mb-3">Origem e pacote padrão</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">CEP de origem</label><input value={form.origin_postal_code} onChange={(e) => set('origin_postal_code', e.target.value)} className={inputCls} placeholder="00000-000" /></div>
          <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Frete fixo (R$) · fallback</label><input type="number" value={form.shipping_flat} onChange={(e) => set('shipping_flat', e.target.value)} className={inputCls} /></div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[['width', 'Larg. (cm)'], ['height', 'Alt. (cm)'], ['length', 'Comp. (cm)'], ['weight', 'Peso (kg)']].map(([k, l]) => (
            <div key={k}><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">{l}</label><input type="number" step="0.01" value={form.default_package[k]} onChange={(e) => setPkg(k, e.target.value)} className={inputCls} /></div>
          ))}
        </div>
        <div><label className="text-[10px] uppercase text-admin-muted/60 block mt-3 mb-1">Frete grátis acima de (R$)</label><input type="number" value={form.free_shipping_min} onChange={(e) => set('free_shipping_min', e.target.value)} className={inputCls} placeholder="opcional" /></div>
      </div>

      <button onClick={save} disabled={busy === 'save'} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-6 py-2.5 rounded-xl text-sm disabled:opacity-50">{busy === 'save' ? 'Salvando…' : 'Salvar configuração'}</button>
    </div>
  )
}

// ---------- Cotação de frete ----------
function QuoteTab({ notify }) {
  const [cep, setCep] = useState('')
  const [quotes, setQuotes] = useState(null)
  const [busy, setBusy] = useState(false)
  const quote = async () => {
    if (!cep.trim()) return notify?.('Informe o CEP de destino', 'error')
    setBusy(true); setQuotes(null)
    const { data, error } = await supabase.functions.invoke('melhor-envio', { body: { action: 'quote', to: cep } })
    setBusy(false)
    if (error || !data?.ok) return notify?.('Falha: ' + (data?.error || 'erro'), 'error')
    setQuotes(data.quotes || [])
  }
  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-4">
        <input value={cep} onChange={(e) => setCep(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && quote()} placeholder="CEP de destino" className={inputCls} />
        <button onClick={quote} disabled={busy} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 rounded-xl text-sm whitespace-nowrap disabled:opacity-50">{busy ? 'Cotando…' : 'Cotar frete'}</button>
      </div>
      {quotes && (
        <div className="space-y-2">
          {quotes.length === 0 && <p className="text-admin-muted/40 text-sm">Nenhuma opção para este CEP.</p>}
          {quotes.map((q) => (
            <div key={q.id} className="glass rounded-xl p-3.5 flex items-center gap-3">
              {q.logo ? <img src={q.logo} alt="" className="w-8 h-8 object-contain rounded" /> : <div className="w-8 h-8 rounded bg-admin-champ/15" />}
              <div className="flex-1 min-w-0"><p className="text-admin-text text-sm">{q.company} · {q.service}</p>{q.delivery_time != null && <p className="text-admin-muted/50 text-[11px]">entrega em {q.delivery_time} dia(s)</p>}</div>
              <span className="text-admin-gold text-sm">{q.price != null ? brl(q.price) : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Envios / Etiquetas / Rastreamento ----------
function ShipmentsTab({ notify }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const load = async () => { const { data } = await supabase.from('shipping_labels').select('*').order('created_at', { ascending: false }).limit(200); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const doAction = async (label, action) => {
    if (!label.me_order_id) return notify?.('Etiqueta sem ID do Melhor Envio', 'error')
    setBusy(label.id + action)
    const { data, error } = await supabase.functions.invoke('melhor-envio', { body: { action, me_order_id: label.me_order_id } })
    setBusy('')
    if (error || !data?.ok) return notify?.('Falha: ' + (data?.error || 'erro'), 'error')
    if (action === 'print' && data.url) { window.open(data.url, '_blank'); notify?.('Etiqueta aberta', 'success') }
    else notify?.('Ação concluída', 'success')
    load()
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando envios…</p>

  return (
    <div className="space-y-2">
      {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-admin-muted/40 text-sm">Nenhum envio ainda. As etiquetas geradas a partir dos pedidos aparecem aqui, com rastreamento.</div>}
      {rows.map((l) => {
        const sm = stMeta(l.status)
        return (
          <div key={l.id} className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="truck" className="w-4 h-4 text-admin-champ" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-admin-text text-sm truncate">{l.to_name || 'Destinatário'} · {l.company || l.service || l.provider}</p>
                <p className="text-admin-muted/50 text-[11px]">{l.to_postal_code || ''}{l.tracking_code ? ` · rastreio ${l.tracking_code}` : ''}{l.price ? ` · ${brl(l.price)}` : ''}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-lg shrink-0 ${sm.chip}`}>{sm.label}</span>
            </div>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {['pending'].includes(l.status) && <button onClick={() => doAction(l, 'checkout')} disabled={busy === l.id + 'checkout'} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ">Comprar etiqueta</button>}
              {['paid'].includes(l.status) && <button onClick={() => doAction(l, 'generate')} disabled={busy === l.id + 'generate'} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ">Gerar etiqueta</button>}
              {['generated', 'posted', 'in_transit', 'delivered'].includes(l.status) && <button onClick={() => doAction(l, 'print')} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-champ">Imprimir etiqueta</button>}
              {l.me_order_id && <button onClick={() => doAction(l, 'track')} disabled={busy === l.id + 'track'} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Atualizar rastreio</button>}
            </div>
            {Array.isArray(l.events) && l.events.length > 0 && (
              <div className="mt-2 pl-2 border-l border-white/[0.08] space-y-1">
                {l.events.slice(0, 4).map((e, i) => <p key={i} className="text-[11px] text-admin-muted/60">{e?.status || e?.description || JSON.stringify(e)}</p>)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function CommerceShipping({ notify }) {
  const [sub, setSub] = useState('shipments')
  const tabs = [
    { key: 'shipments', label: 'Envios & Rastreio', icon: 'truck' },
    { key: 'quote', label: 'Cotação', icon: 'tag' },
    { key: 'config', label: 'Configuração', icon: 'gear' },
  ]
  return (
    <div>
      <div className="flex gap-1 mb-5 bg-white/[0.03] p-1 rounded-xl w-fit">
        {tabs.map((t) => <button key={t.key} onClick={() => setSub(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${sub === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name={t.icon} className="w-4 h-4" />{t.label}</button>)}
      </div>
      {sub === 'shipments' && <ShipmentsTab notify={notify} />}
      {sub === 'quote' && <QuoteTab notify={notify} />}
      {sub === 'config' && <ConfigTab notify={notify} />}
    </div>
  )
}
