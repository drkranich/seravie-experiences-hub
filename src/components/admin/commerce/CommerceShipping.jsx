import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { brl } from '../../../lib/commerceTypes'
import { printProductLabels, LABEL_TEMPLATES, LABEL_TEMPLATE_MAP, labelCellHtml } from '../../../lib/labels'

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

// ---------- Políticas de etiqueta por marketplace ----------
const MKT_CHANNELS = [
  { key: 'amazon', name: 'Amazon' }, { key: 'mercado_livre', name: 'Mercado Livre' }, { key: 'shopee', name: 'Shopee' },
  { key: 'magalu', name: 'Magalu' }, { key: 'americanas', name: 'Americanas' }, { key: 'carrefour', name: 'Carrefour' },
  { key: 'casas_bahia', name: 'Casas Bahia' }, { key: 'ifood', name: 'iFood' }, { key: 'tiktok', name: 'TikTok Shop' },
  { key: 'google', name: 'Google Merchant' },
]
const POLICY_OPTS = [
  { value: 'receive_or_generate', label: 'Receber externa, gerar Seravie se faltar' },
  { value: 'receive_only', label: 'Somente etiqueta do marketplace' },
  { value: 'generate_only', label: 'Sempre gerar etiqueta Seravie' },
]
const FMT_OPTS = [{ value: 'a4', label: 'A4' }, { value: 'thermal', label: 'Térmica' }]
const TRACK_OPTS = [{ value: 'marketplace', label: 'Rastreio informado pelo marketplace' }, { value: 'carrier', label: 'Rastreio pela transportadora' }, { value: 'manual', label: 'Rastreio manual' }]
const FILE_TYPES = ['pdf', 'zpl', 'png', 'jpg', 'html']
const TPL_OPTS = LABEL_TEMPLATES.map((t) => ({ value: t.key, label: t.name }))
const defaultPolicy = (channel) => ({ channel, status: 'active', policy: 'receive_or_generate', default_template: 'a4_mixed', received_format: 'a4', tracking_origin: 'marketplace', accepted_files: ['pdf'], fallback_seravie: true, enqueue_external: true, keep_original: true, reprint_original: true, notes: '' })

function MarketplacePolicies({ tenantId, notify }) {
  const [rows, setRows] = useState({})
  const [busy, setBusy] = useState('')
  const load = async () => {
    const { data } = await supabase.from('marketplace_label_policies').select('*')
    setRows(Object.fromEntries((data || []).map((r) => [r.channel, r])))
  }
  useEffect(() => { load() }, [])
  const get = (ch) => rows[ch] || defaultPolicy(ch)
  const patch = (ch, k, v) => setRows((x) => ({ ...x, [ch]: { ...get(ch), [k]: v } }))
  const toggleFile = (ch, f) => { const cur = get(ch).accepted_files || []; patch(ch, 'accepted_files', cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]) }
  const save = async (ch) => {
    setBusy(ch)
    const p = get(ch)
    const row = { tenant_id: tenantId, channel: ch, status: p.status, policy: p.policy, default_template: p.default_template, received_format: p.received_format, tracking_origin: p.tracking_origin, accepted_files: p.accepted_files, fallback_seravie: p.fallback_seravie, enqueue_external: p.enqueue_external, keep_original: p.keep_original, reprint_original: p.reprint_original, notes: p.notes || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('marketplace_label_policies').upsert(row, { onConflict: 'tenant_id,channel' })
    setBusy('')
    if (error) return notify?.('Erro ao salvar política: ' + error.message, 'error')
    load(); notify?.(`Política de ${MKT_CHANNELS.find((c) => c.key === ch)?.name} salva`, 'success')
  }
  const Flag = ({ ch, k, label }) => {
    const on = !!get(ch)[k]
    return (
      <button onClick={() => patch(ch, k, !on)} className="w-full glass-input rounded-lg px-3 py-2 flex items-center justify-between text-left">
        <span className="text-admin-text text-xs">{label}</span>
        <span className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${on ? 'bg-admin-champ/60' : 'bg-white/[0.1]'}`}><span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} /></span>
      </button>
    )
  }
  const sel = 'w-full'
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Etiquetas de marketplaces</p><p className="text-admin-muted/50 text-xs">Como cada canal trata a etiqueta recebida, rastreio externo, reimpressão e fallback Seravie.</p></div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {MKT_CHANNELS.map((c) => {
          const p = get(c.key)
          const configured = !!rows[c.key]
          return (
            <div key={c.key} className="glass-soft rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-admin-text text-sm font-medium">{c.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded ${configured && p.status === 'active' ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{configured ? (p.status === 'active' ? 'Ativa' : 'Pausada') : 'Não configurada'}</span>
              </div>
              <div className="space-y-2.5">
                <div><label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-1">Política da etiqueta</label><GlassSelect value={p.policy} onChange={(v) => patch(c.key, 'policy', v)} options={POLICY_OPTS} className={sel} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-1">Modelo padrão</label><GlassSelect value={p.default_template} onChange={(v) => patch(c.key, 'default_template', v)} options={TPL_OPTS} className={sel} /></div>
                  <div><label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-1">Formato recebido</label><GlassSelect value={p.received_format} onChange={(v) => patch(c.key, 'received_format', v)} options={FMT_OPTS} className={sel} /></div>
                </div>
                <div><label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-1">Origem do rastreio</label><GlassSelect value={p.tracking_origin} onChange={(v) => patch(c.key, 'tracking_origin', v)} options={TRACK_OPTS} className={sel} /></div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-admin-muted/50 block mb-1">Arquivos aceitos</label>
                  <div className="flex flex-wrap gap-1">
                    {FILE_TYPES.map((f) => { const on = (p.accepted_files || []).includes(f); return <button key={f} onClick={() => toggleFile(c.key, f)} className={`text-[10px] px-2 py-1 rounded-lg uppercase ${on ? 'bg-admin-champ/20 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/50'}`}>{f}</button> })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Flag ch={c.key} k="fallback_seravie" label="Fallback Seravie" />
                  <Flag ch={c.key} k="enqueue_external" label="Enfileirar externa" />
                  <Flag ch={c.key} k="keep_original" label="Guardar original" />
                  <Flag ch={c.key} k="reprint_original" label="Reimprimir original" />
                </div>
                <textarea value={p.notes || ''} onChange={(e) => patch(c.key, 'notes', e.target.value)} rows={2} placeholder="Observações operacionais (ex.: se não vier etiqueta, gerar Seravie 100×150 mm)." className="w-full glass-input rounded-lg px-3 py-2 text-xs text-admin-text outline-none resize-none" />
                <button onClick={() => save(c.key)} disabled={busy === c.key} className="w-full bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ rounded-lg py-2 text-xs disabled:opacity-50">{busy === c.key ? 'Salvando…' : 'Salvar política'}</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Central de Logística & Etiquetas (fila + produto/estoque) ----------
const QF = { queued: { label: 'Na fila', chip: 'bg-admin-gold/15 text-admin-gold' }, printed: { label: 'Impressa', chip: 'bg-admin-sage/15 text-admin-sage' }, failed: { label: 'Falha', chip: 'bg-admin-rose/15 text-admin-rose' } }
function LabelsCenterTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const brand = profile?.tenant_name || ''
  const [queue, setQueue] = useState([])
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [picker, setPicker] = useState(null) // { items } para escolher modelo
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [ql, pr] = await Promise.all([
      supabase.from('label_queue').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('products').select('id, name, sku, barcode, price, stock').eq('status', 'active').order('name').limit(500),
    ])
    setQueue(ql.data || []); setProducts(pr.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const kpis = useMemo(() => ({
    awaiting: queue.filter((r) => r.kind === 'shipment' && r.status === 'queued').length,
    queued: queue.filter((r) => r.status === 'queued').length,
    printed: queue.filter((r) => r.status === 'printed').length,
    failed: queue.filter((r) => r.status === 'failed').length,
    internal: queue.filter((r) => r.kind === 'product').length,
  }), [queue])

  const filtered = queue.filter((r) => {
    if (filter === 'queued' && r.status !== 'queued') return false
    if (filter === 'shipment' && r.kind !== 'shipment') return false
    if (filter === 'product' && r.kind !== 'product') return false
    if (filter === 'thermal' && r.format !== 'thermal') return false
    if (filter === 'a4' && r.format !== 'a4') return false
    return true
  })

  // enfileira etiquetas de um produto e imprime
  const queueAndPrint = async (product, format, copies = 1) => {
    const templateKey = format === 'thermal' ? 'sku_50x30' : 'bc_a4_2x7'
    const payload = { name: product.name, price: product.price, sku: product.sku, barcode: product.barcode }
    const { data } = await supabase.from('label_queue').insert({ tenant_id: tenantId, title: product.name, subtitle: product.sku || product.barcode || '', kind: 'product', format, template_key: templateKey, copies, status: 'queued', payload, created_by: profile?.user_id }).select().single()
    if (data) setQueue((qs) => [data, ...qs])
    printProductLabels([{ ...payload, qty: copies }], { templateKey, brand })
    // marca como impressa
    if (data) { await supabase.from('label_queue').update({ status: 'printed', printed_at: new Date().toISOString() }).eq('id', data.id); setQueue((qs) => qs.map((x) => x.id === data.id ? { ...x, status: 'printed' } : x)) }
    notify?.(`Etiqueta de "${product.name}" enviada para impressão`, 'success')
  }
  const reprint = async (row) => {
    const p = row.payload || {}
    printProductLabels([{ name: p.name, price: p.price, sku: p.sku, barcode: p.barcode, qty: row.copies || 1 }], { templateKey: row.template_key || 'bc_60x40', brand })
    await supabase.from('label_queue').update({ status: 'printed', printed_at: new Date().toISOString() }).eq('id', row.id)
    setQueue((qs) => qs.map((x) => x.id === row.id ? { ...x, status: 'printed' } : x))
  }
  const prodList = products.filter((p) => !q || `${p.name} ${p.sku || ''}`.toLowerCase().includes(q.toLowerCase()))
  const FILTERS = [['all', 'Todas'], ['queued', 'Na fila'], ['shipment', 'Envio'], ['product', 'Produto'], ['thermal', 'Térmica'], ['a4', 'A4']]

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando central de etiquetas…</p>

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Aguardando etiqueta', kpis.awaiting, 'gold'], ['Na fila', kpis.queued, 'champ'], ['Impressas', kpis.printed, 'sage'], ['Falhas', kpis.failed, 'rose'], ['Etiquetas internas', kpis.internal, 'copper']].map(([l, v, c]) => (
          <div key={l} className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{l}</p><p className={`text-2xl font-medium text-admin-${c}`}>{v}</p></div>
        ))}
      </div>

      {/* Fila de impressão */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Fila de impressão</p><p className="text-admin-muted/50 text-xs">Etiquetas de envio e internas enfileiradas para impressão individual, lote ou reimpressão.</p></div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-lg ${filter === k ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{l}</button>)}
          </div>
        </div>
        {filtered.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Nenhuma etiqueta na fila. Gere etiquetas de produto abaixo.</p> : (
          <div className="space-y-1.5">
            {filtered.map((r) => {
              const st = QF[r.status] || QF.queued
              return (
                <div key={r.id} className="glass-soft rounded-xl p-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0 text-admin-champ"><Icon name={r.kind === 'shipment' ? 'truck' : 'tag'} className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{r.title}</p><p className="text-admin-muted/40 text-[11px] truncate">{r.subtitle} · {r.kind === 'shipment' ? 'Envio' : 'Produto'} · {r.format === 'thermal' ? 'Térmica' : 'A4'} · {r.copies}×</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg shrink-0 ${st.chip}`}>{st.label}</span>
                  <button onClick={() => reprint(r)} className="text-admin-champ text-xs shrink-0">reimprimir</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Políticas de etiqueta por marketplace */}
      <MarketplacePolicies tenantId={tenantId} notify={notify} />

      {/* Etiquetas de produto e estoque */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Etiquetas de produto e estoque</p><p className="text-admin-muted/50 text-xs">Geração própria do código de barras para produtos, prateleiras, estoque e impressão A4/térmica.</p></div>
          <div className="relative w-56"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto…" className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-sm text-admin-text outline-none" /></div>
        </div>
        {prodList.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">{products.length === 0 ? 'Cadastre produtos no catálogo para gerar etiquetas.' : 'Nenhum produto encontrado.'}</p> : (
          <div className="space-y-1.5">
            {prodList.map((p) => (
              <ProdLabelRow key={p.id} p={p} onQueue={queueAndPrint} onPick={() => setPicker({ items: [{ name: p.name, price: p.price, sku: p.sku, barcode: p.barcode, qty: 1 }] })} />
            ))}
          </div>
        )}
      </div>

      {picker && <LabelTemplatePicker items={picker.items} brand={brand} onClose={() => setPicker(null)} onPrint={(tk) => { printProductLabels(picker.items, { templateKey: tk, brand }); setPicker(null); notify?.('Etiqueta impressa', 'success') }} />}
    </div>
  )
}

function ProdLabelRow({ p, onQueue, onPick }) {
  const [copies, setCopies] = useState(1)
  return (
    <div className="glass-soft rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-admin-text text-sm truncate">{p.name}</p>
        <p className="text-admin-muted/40 text-[11px] truncate font-mono">{p.sku || p.barcode || 'sem código'} · barras:{p.barcode || p.sku || '—'}</p>
      </div>
      <span className="text-admin-muted/50 text-xs shrink-0 hidden sm:block">{p.stock != null ? `${p.stock} em estoque` : '—'}</span>
      <input type="number" value={copies} onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 glass-input rounded-lg px-2 py-1 text-sm text-admin-text outline-none text-center shrink-0" />
      <button onClick={() => onQueue(p, 'thermal', copies)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ shrink-0">Térmica</button>
      <button onClick={() => onQueue(p, 'a4', copies)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-champ shrink-0">A4</button>
      <button onClick={onPick} className="text-[11px] px-2 py-1.5 rounded-lg text-admin-muted/60 hover:text-admin-champ shrink-0" title="Escolher modelo">Modelo…</button>
    </div>
  )
}

// seletor de modelo com prévia (reaproveitado do POS)
function LabelTemplatePicker({ items, brand, onClose, onPrint }) {
  const [tplKey, setTplKey] = useState('bc_60x40')
  const tpl = LABEL_TEMPLATE_MAP[tplKey]
  const previewItem = items[0] || { name: 'Produto', price: 0, sku: 'SKU', barcode: '' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-white/[0.06] flex items-start justify-between">
          <div><p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Formato de impressão</p><h2 className="font-serif text-2xl text-admin-text">Escolha o modelo da etiqueta</h2><p className="text-admin-muted/50 text-sm mt-1">O modelo define tamanho, densidade e leitura do código.</p></div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text">Fechar</button>
        </div>
        <div className="grid lg:grid-cols-[1fr_260px] gap-5 overflow-hidden p-6">
          <div className="overflow-y-auto grid sm:grid-cols-2 gap-2.5 content-start">
            {LABEL_TEMPLATES.map((t) => {
              const on = tplKey === t.key
              return (
                <button key={t.key} onClick={() => setTplKey(t.key)} className={`text-left rounded-2xl p-3.5 border transition-all ${on ? 'border-admin-champ/50 bg-admin-champ/[0.06]' : 'glass-soft border-transparent hover:border-white/10'}`}>
                  <p className={`text-[9px] uppercase tracking-wider mb-1 ${t.recommended ? 'text-admin-gold' : 'text-admin-muted/40'}`}>{t.recommended ? 'Recomendado' : t.group}</p>
                  <p className="text-admin-text text-sm font-medium leading-tight">{t.name}</p>
                  <p className="text-admin-muted/50 text-[11px] leading-snug mt-1 mb-2 min-h-[3em]">{t.desc}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-admin-muted/60">{t.dim}</span>
                </button>
              )
            })}
          </div>
          <div className="glass rounded-2xl p-4 flex flex-col">
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-3">Prévia</p>
            <div className="flex-1 flex items-center justify-center bg-white rounded-xl p-3 overflow-hidden" dangerouslySetInnerHTML={{ __html: `<style>.lbl{font-family:Arial;text-align:center;border:1px solid #ddd;border-radius:4px;padding:4px 6px;transform:scale(${tpl && tpl.w > 70 ? 0.8 : 1});} .brand{font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#888} .lname{font-size:11px;font-weight:600;margin:1px 0} .lprice{font-size:15px;font-weight:700} .bc svg{max-width:100%;height:auto} .nocode{font-size:10px;color:#666;font-family:monospace}</style>` + labelCellHtml(tpl, previewItem, brand || '') }} />
          </div>
        </div>
        <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-end">
          <button onClick={() => onPrint(tplKey)} className="btn-gradient rounded-xl px-5 py-2 text-sm font-medium">Imprimir neste modelo</button>
        </div>
      </div>
    </div>
  )
}

export function CommerceShipping({ notify }) {
  const [sub, setSub] = useState('labels')
  const tabs = [
    { key: 'labels', label: 'Logística & Etiquetas', icon: 'tag' },
    { key: 'shipments', label: 'Envios & Rastreio', icon: 'truck' },
    { key: 'quote', label: 'Cotação', icon: 'tag' },
    { key: 'config', label: 'Configuração', icon: 'gear' },
  ]
  return (
    <div>
      <div className="flex gap-1 mb-5 bg-white/[0.03] p-1 rounded-xl w-fit">
        {tabs.map((t) => <button key={t.key} onClick={() => setSub(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${sub === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name={t.icon} className="w-4 h-4" />{t.label}</button>)}
      </div>
      {sub === 'labels' && <LabelsCenterTab notify={notify} />}
      {sub === 'shipments' && <ShipmentsTab notify={notify} />}
      {sub === 'quote' && <QuoteTab notify={notify} />}
      {sub === 'config' && <ConfigTab notify={notify} />}
    </div>
  )
}
