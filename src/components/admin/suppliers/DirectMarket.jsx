import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, AddressAutocomplete } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, brl } from '../../../lib/suppliersMarket'
import { usePlatformSettings } from '../../../lib/platformSettings'
import { OrderReceipt } from './OrderReceipt'

// Marketplace de venda direta — vitrine + checkout COMPLETO. Carrega os dados
// reais dos fornecedores, calcula frete/prazo por fornecedor, comissão da
// plataforma, coleta entrega e pagamento, cria pedidos (buyer_orders) e gera
// um comprovante de compra.

const PAYMENTS = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'faturado', label: 'Faturado (a combinar)' },
]

export function DirectMarket({ onOpenSupplier, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const { settings } = usePlatformSettings()
  const feePct = settings?.commission_enabled === false ? 0 : Number(settings?.event_fee_percent ?? 5)

  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [cart, setCart] = useState({})       // product_id -> {product, qty}
  const [checkout, setCheckout] = useState(false)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const { data: ps } = await supabase.from('supplier_products').select('*').eq('direct_sale', true).eq('status', 'active').order('created_at', { ascending: false }).limit(300)
        const supIds = [...new Set((ps || []).map((p) => p.supplier_id).filter(Boolean))]
        const supMap = {}
        if (supIds.length) {
          const { data: ss } = await supabase.from('suppliers').select('id,name,logo_url,city,state,cep,address,address_number,phone,whatsapp,email,lead_time,min_order,category').in('id', supIds)
          ;(ss || []).forEach((s) => { supMap[s.id] = s })
        }
        if (alive) { setProducts(ps || []); setSuppliers(supMap) }
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products])
  const filtered = useMemo(() => {
    const nq = q.toLowerCase()
    return products.filter((p) => (!cat || p.category === cat) && (!nq || [p.name, p.description, p.category].join(' ').toLowerCase().includes(nq)))
  }, [products, q, cat])

  const addToCart = (p) => { setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty || 0) + 1 } })); notify?.(`${p.name} adicionado`, 'success') }
  const cartItems = Object.values(cart)
  const cartCount = cartItems.reduce((s, { qty }) => s + qty, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Marketplace de venda direta</h1><p className="text-admin-muted/50 text-sm mt-1">Produtos prontos para compra direta dos fornecedores do ecossistema.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={cat} onChange={setCat} options={[{ value: '', label: 'Todas as categorias' }, ...cats.map((c) => ({ value: c, label: SUPPLIER_CATEGORIES[c] || c }))]} /></div>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-40"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
          <button onClick={() => setCheckout(true)} className="relative flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="cart" className="w-4 h-4" />Carrinho{cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-admin-champ text-admin-bg text-[10px] flex items-center justify-center">{cartCount}</span>}</button>
        </div>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-64 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="cart" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum produto de venda direta disponível.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => { const sup = suppliers[p.supplier_id]; return (
                <div key={p.id} className="glass rounded-2xl overflow-hidden flex flex-col">
                  <div className="h-40 bg-white/[0.02] relative">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name={CATEGORY_ICON[p.category] || 'box'} className="w-8 h-8 text-admin-champ/20" /></div>}
                    {p.stock != null && p.stock <= 0 && <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-lg bg-admin-rose/80 text-white">Esgotado</span>}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-admin-text font-medium leading-snug">{p.name}</p>
                    {sup ? (
                      <button onClick={() => onOpenSupplier?.(sup)} className="flex items-center gap-1.5 text-admin-champ/70 text-[11px] mt-1 hover:underline text-left">
                        {sup.logo_url ? <img src={sup.logo_url} alt="" className="w-4 h-4 rounded object-cover" /> : <Icon name="box" className="w-3 h-3" />}
                        {sup.name}{sup.city ? ` · ${sup.city}` : ''}
                      </button>
                    ) : <p className="text-admin-muted/35 text-[11px] mt-1">Fornecedor</p>}
                    {p.description && <p className="text-admin-muted/50 text-xs mt-1.5 line-clamp-2 flex-1">{p.description}</p>}
                    {sup?.lead_time && <p className="text-admin-muted/40 text-[10px] mt-2 flex items-center gap-1"><Icon name="truck" className="w-3 h-3" />Prazo: {sup.lead_time}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
                      <div><p className="text-admin-champ font-serif">{p.price ? brl(p.price) : 'Sob consulta'}</p>{p.unit && <p className="text-admin-muted/40 text-[10px]">por {p.unit}{p.min_qty ? ` · mín. ${p.min_qty}` : ''}</p>}</div>
                      <button onClick={() => addToCart(p)} disabled={p.stock != null && p.stock <= 0} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 disabled:opacity-40 transition-colors flex items-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>}

      {checkout && (
        <Checkout
          cart={cart} setCart={setCart} suppliers={suppliers} tenantId={tenantId} feePct={feePct}
          profile={profile} onClose={() => setCheckout(false)}
          onDone={(orders) => { setCart({}); setCheckout(false); setReceipt(orders) }} notify={notify}
        />
      )}
      {receipt && <OrderReceipt orders={receipt} settings={settings} onClose={() => setReceipt(null)} />}
    </div>
  )
}

// ─────────────────────────── CHECKOUT ───────────────────────────
function Checkout({ cart, setCart, suppliers, tenantId, feePct, profile, onClose, onDone, notify }) {
  const [step, setStep] = useState(1) // 1 revisar · 2 entrega/pagamento · 3 confirmar
  const [delivery, setDelivery] = useState({ name: profile?.full_name || '', contact: '' })
  const [addr, setAddr] = useState({ cep: '', address: '', address_number: '', neighborhood: '', city: '', state: '', country: 'BR', lat: null, lng: null })
  const [payment, setPayment] = useState('pix')
  // frete por fornecedor: { [supId]: { method, value, service, days, quotes, loading } }
  const [freightState, setFreightState] = useState({})
  const [saving, setSaving] = useState(false)

  const fset = (supId, patch) => setFreightState((s) => ({ ...s, [supId]: { ...(s[supId] || {}), ...patch } }))

  const setD = (k, v) => setDelivery((s) => ({ ...s, [k]: v }))
  const setQty = (id, qty) => setCart((c) => { if (qty <= 0) { const n = { ...c }; delete n[id]; return n } return { ...c, [id]: { ...c[id], qty } } })

  // agrupa o carrinho por fornecedor
  const groups = useMemo(() => {
    const g = {}
    Object.values(cart).forEach(({ product, qty }) => { const k = product.supplier_id || 'sem'; (g[k] ||= { supplier: suppliers[k] || null, items: [] }).items.push({ product, qty }) })
    return g
  }, [cart, suppliers])
  const groupKeys = Object.keys(groups)

  const calc = (g, supId) => {
    const subtotal = g.items.reduce((s, { product, qty }) => s + (Number(product.price) || 0) * qty, 0)
    const fr = freightState[supId] || {}
    const ship = fr.method === 'retirada' || fr.method === 'gratis' ? 0 : (Number(fr.value) || 0)
    const commission = subtotal * (feePct / 100)
    return { subtotal, ship, commission, total: subtotal + ship }
  }
  const grand = groupKeys.reduce((acc, k) => { const c = calc(groups[k], k); acc.subtotal += c.subtotal; acc.ship += c.ship; acc.commission += c.commission; acc.total += c.total; return acc }, { subtotal: 0, ship: 0, commission: 0, total: 0 })

  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  // carrinho vazio → estado dedicado (o botão sempre abre o checkout)
  if (groupKeys.length === 0) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="glass-pop rounded-2xl p-8 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
          <Icon name="cart" className="w-12 h-12 text-admin-champ/20 mx-auto mb-4" />
          <h2 className="font-serif text-xl text-admin-text mb-1">Carrinho vazio</h2>
          <p className="text-admin-muted/55 text-sm mb-5">Adicione produtos de venda direta clicando em “Adicionar” nos cards.</p>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Ver produtos</button>
        </div>
      </div>
    )
  }

  const fullAddress = [
    [addr.address, addr.address_number].filter(Boolean).join(', '),
    addr.neighborhood, [addr.city, addr.state].filter(Boolean).join('/'), addr.cep,
  ].filter(Boolean).join(' · ')

  const confirm = async () => {
    if (!delivery.name.trim()) { setStep(2); return notify?.('Informe o responsável pela compra', 'error') }
    if (!addr.address) { setStep(2); return notify?.('Informe o endereço de entrega', 'error') }
    setSaving(true)
    const created = []
    for (const k of groupKeys) {
      const g = groups[k]; const c = calc(g, k); const sup = g.supplier; const fr = freightState[k] || {}
      const items = g.items.map(({ product, qty }) => ({ name: product.name, qty, unit_price: Number(product.price) || 0, note: product.unit || '' }))
      const code = 'PC-' + Date.now().toString(36).slice(-4).toUpperCase() + '-' + created.length
      const snapshot = sup ? { id: sup.id, name: sup.name, city: sup.city, state: sup.state, phone: sup.phone, whatsapp: sup.whatsapp, email: sup.email, address: [sup.address, sup.address_number].filter(Boolean).join(', '), cep: sup.cep, lead_time: sup.lead_time } : null
      const payload = {
        tenant_id: tenantId, supplier_id: k === 'sem' ? null : k, supplier_name: sup?.name || 'Fornecedor',
        code, status: 'enviado', items, subtotal: c.subtotal, shipping: c.ship, total: c.total,
        commission_percent: feePct, commission_amount: c.commission, lead_time: sup?.lead_time || null,
        carrier: fr.service || null, shipping_method: fr.method || 'combinado', shipping_service: fr.service || null,
        shipping_days: fr.days ? parseInt(fr.days) : null,
        payment_method: payment, delivery_address: fullAddress || null,
        buyer_name: delivery.name, buyer_contact: delivery.contact || null, supplier_snapshot: snapshot, paid_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('buyer_orders').insert(payload).select('*').single()
      if (!error && data) created.push({ ...data, _calc: c })
    }
    setSaving(false)
    if (!created.length) return notify?.('Não foi possível concluir a compra.', 'error')
    notify?.(created.length > 1 ? `${created.length} pedidos enviados!` : 'Pedido enviado ao fornecedor!', 'success')
    onDone(created)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* stepper */}
        <div className="p-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-xl text-admin-text">Finalizar compra</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
          <div className="flex items-center gap-2">
            {['Revisar', 'Entrega & pagamento', 'Confirmar'].map((s, i) => { const n = i + 1; const active = n === step; const done = n < step; return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${active ? 'text-admin-champ' : done ? 'text-admin-sage' : 'text-admin-muted/40'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${active ? 'bg-admin-champ/20 ring-1 ring-admin-champ/50' : done ? 'bg-admin-sage/20' : 'bg-white/[0.05]'}`}>{done ? <Icon name="check" className="w-3.5 h-3.5" /> : n}</span>
                  <span className="text-[11px] truncate hidden sm:block">{s}</span>
                </div>
                {i < 2 && <div className={`h-px flex-1 ${done ? 'bg-admin-sage/30' : 'bg-white/[0.06]'}`} />}
              </div>
            )})}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* PASSO 1 — revisar por fornecedor */}
          {step === 1 && groupKeys.map((k) => { const g = groups[k]; const sup = g.supplier; const c = calc(g, k); return (
            <div key={k} className="glass-soft rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/[0.06]">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{sup?.logo_url ? <img src={sup.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name="box" className="w-4 h-4 text-admin-champ/60" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-admin-text text-sm font-medium">{sup?.name || 'Fornecedor'}</p>
                  <p className="text-admin-muted/45 text-[11px]">{[sup?.city, sup?.state].filter(Boolean).join('/')}{sup?.lead_time ? ` · prazo ${sup.lead_time}` : ''}</p>
                </div>
              </div>
              <div className="space-y-2">
                {g.items.map(({ product: p, qty }) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="box" className="w-4 h-4 text-admin-champ/50" />}</div>
                    <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{p.name}</p><p className="text-admin-champ text-xs">{brl(p.price)}{p.unit ? ` / ${p.unit}` : ''}</p></div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setQty(p.id, qty - 1)} className="w-6 h-6 rounded-md glass-input text-admin-muted/70 hover:text-admin-champ flex items-center justify-center">−</button>
                      <span className="text-admin-text text-sm w-6 text-center">{qty}</span>
                      <button onClick={() => setQty(p.id, qty + 1)} className="w-6 h-6 rounded-md glass-input text-admin-muted/70 hover:text-admin-champ flex items-center justify-center">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06] text-sm"><span className="text-admin-muted/55">Subtotal</span><span className="text-admin-text">{brl(c.subtotal)}</span></div>
            </div>
          )})}

          {/* PASSO 2 — entrega, frete por fornecedor, pagamento */}
          {step === 2 && (
            <>
              <div className="glass-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Dados de entrega</p>
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  <div><label className={lbl}>Responsável *</label><input value={delivery.name} onChange={(e) => setD('name', e.target.value)} className={cls} /></div>
                  <div><label className={lbl}>Contato (telefone/e-mail)</label><input value={delivery.contact} onChange={(e) => setD('contact', e.target.value)} className={cls} /></div>
                </div>
                <label className={lbl}>Endereço de entrega * (GPS mundial)</label>
                <AddressAutocomplete value={addr} onChange={setAddr} notify={notify} />
              </div>
              <div className="glass-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Frete por fornecedor</p>
                <div className="space-y-3">
                  {groupKeys.map((k) => (
                    <SupplierFreight key={k} supplierKey={k} group={groups[k]} destCep={addr.cep} state={freightState[k]} onChange={(patch) => fset(k, patch)} notify={notify} />
                  ))}
                </div>
              </div>
              <div className="glass-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Forma de pagamento</p>
                <div className="flex flex-wrap gap-2">
                  {PAYMENTS.map((p) => <button key={p.value} onClick={() => setPayment(p.value)} className={`text-sm px-4 py-2 rounded-xl transition-colors ${payment === p.value ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{p.label}</button>)}
                </div>
              </div>
            </>
          )}

          {/* PASSO 3 — confirmação com totais e comissão */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="glass-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2">Entrega</p>
                <p className="text-admin-text text-sm">{delivery.name}</p>
                <p className="text-admin-muted/55 text-xs">{fullAddress || '—'}</p>
                {addr.lat && addr.lng && <a href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-admin-champ/70 hover:underline mt-1"><Icon name="map" className="w-3.5 h-3.5" />Ver no mapa</a>}
                <p className="text-admin-muted/45 text-xs mt-1">Pagamento: {PAYMENTS.find((p) => p.value === payment)?.label}</p>
              </div>
              {groupKeys.map((k) => { const g = groups[k]; const sup = g.supplier; const c = calc(g, k); return (
                <div key={k} className="glass-soft rounded-2xl p-4">
                  <p className="text-admin-text text-sm font-medium mb-1">{sup?.name || 'Fornecedor'}</p>
                  {sup && <p className="text-admin-muted/45 text-[11px] mb-2">{[sup.whatsapp || sup.phone, sup.email].filter(Boolean).join(' · ')}{sup.lead_time ? ` · prazo ${sup.lead_time}` : ''}</p>}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-admin-muted/55"><span>Subtotal ({g.items.length} item/ns)</span><span>{brl(c.subtotal)}</span></div>
                    {c.ship > 0 && <div className="flex justify-between text-admin-muted/55"><span>Frete</span><span>{brl(c.ship)}</span></div>}
                    <div className="flex justify-between text-admin-text font-medium"><span>Total</span><span className="text-admin-champ">{brl(c.total)}</span></div>
                    {feePct > 0 && <div className="flex justify-between text-admin-muted/35 text-[11px] pt-1"><span>Comissão Seravie ({feePct}%) — retida do fornecedor</span><span>{brl(c.commission)}</span></div>}
                  </div>
                </div>
              )})}
              <div className="glass rounded-2xl p-4 border border-admin-champ/15">
                <div className="flex justify-between text-sm mb-1"><span className="text-admin-muted/60">Total geral</span><span className="text-admin-champ font-serif text-lg">{brl(grand.total)}</span></div>
                {feePct > 0 && <p className="text-admin-muted/40 text-[11px]">Comissão da plataforma no total: {brl(grand.commission)} ({feePct}%). O fornecedor recebe o restante.</p>}
              </div>
            </div>
          )}
        </div>

        {/* footer nav */}
        <div className="p-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <div className="text-sm"><span className="text-admin-muted/50">Total: </span><span className="text-admin-champ font-serif">{brl(grand.total)}</span></div>
          <div className="flex gap-2">
            <button onClick={step === 1 ? onClose : () => setStep((s) => s - 1)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">{step === 1 ? 'Cancelar' : 'Voltar'}</button>
            {step < 3
              ? <button onClick={() => setStep((s) => s + 1)} className="px-5 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ flex items-center gap-2">Continuar<Icon name="down" className="w-4 h-4 -rotate-90" /></button>
              : <button onClick={confirm} disabled={saving} className="px-5 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50 flex items-center gap-2"><Icon name="check" className="w-4 h-4" />{saving ? 'Processando…' : 'Confirmar compra'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────── FRETE POR FORNECEDOR (Melhor Envio + modos manuais) ───────────────
const SHIP_MODES = [
  { value: 'melhor_envio', label: 'Melhor Envio', icon: 'truck' },
  { value: 'combinado', label: 'Combinar com fornecedor', icon: 'mail' },
  { value: 'retirada', label: 'Retirar no fornecedor', icon: 'map' },
  { value: 'gratis', label: 'Frete grátis', icon: 'gift' },
]

function SupplierFreight({ supplierKey, group, destCep, state = {}, onChange, notify }) {
  const sup = group.supplier
  const method = state.method || 'combinado'
  const originCep = sup?.cep
  // frete grátis automático se todos os itens marcam free_shipping
  const allFree = group.items.length > 0 && group.items.every(({ product }) => product.free_shipping)

  // pacote agregado do carrinho deste fornecedor
  const pkg = group.items.reduce((acc, { product, qty }) => ({
    weight: acc.weight + (Number(product.weight_kg) || 1) * qty,
    width: Math.max(acc.width, Number(product.width_cm) || 15),
    height: acc.height + (Number(product.height_cm) || 10) * qty,
    length: Math.max(acc.length, Number(product.length_cm) || 20),
  }), { weight: 0, width: 0, height: 0, length: 0 })

  const quote = async () => {
    if (!originCep) return notify?.('Fornecedor sem CEP de origem cadastrado. Use "combinar com fornecedor".', 'error')
    if (!destCep || String(destCep).replace(/\D/g, '').length !== 8) return notify?.('Preencha o CEP de entrega para cotar o frete.', 'error')
    onChange({ loading: true, quotes: null })
    try {
      const { data, error } = await supabase.functions.invoke('shipping-quote', {
        body: { from_cep: originCep, to_cep: destCep, package: pkg },
      })
      if (error) { onChange({ loading: false }); return notify?.('Erro ao cotar: ' + error.message, 'error') }
      if (data?.error === 'shipping_not_configured') { onChange({ loading: false, method: 'combinado' }); return notify?.('Melhor Envio ainda não configurado. Use "combinar com fornecedor".', 'info') }
      if (data?.error) { onChange({ loading: false }); return notify?.('Cotação: ' + (data.detail || data.error), 'error') }
      const quotes = data?.options || []
      onChange({ loading: false, quotes })
      if (!quotes.length) notify?.('Nenhuma opção de frete retornada para este CEP.', 'info')
    } catch (e) { onChange({ loading: false }); notify?.('Falha: ' + (e?.message || e), 'error') }
  }

  return (
    <div className="glass-input rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-admin-text/85 font-medium truncate">{sup?.name || 'Fornecedor'}</span>
        {allFree && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-sage/15 text-admin-sage">frete grátis disponível</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SHIP_MODES.filter((m) => m.value !== 'gratis' || allFree).map((m) => (
          <button key={m.value} type="button" onClick={() => { onChange({ method: m.value, value: m.value === 'retirada' || m.value === 'gratis' ? 0 : state.value, service: m.value === 'retirada' ? 'Retirada' : m.value === 'gratis' ? 'Grátis' : null, days: null, quotes: m.value === 'melhor_envio' ? state.quotes : null }); if (m.value === 'melhor_envio' && !state.quotes) setTimeout(quote, 0) }}
            className={`text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${method === m.value ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ'}`}>
            <Icon name={m.icon} className="w-3.5 h-3.5" />{m.label}
          </button>
        ))}
      </div>

      {method === 'melhor_envio' && (
        <div>
          {state.loading ? <p className="text-admin-muted/50 text-xs py-2 flex items-center gap-2"><Icon name="clock" className="w-3.5 h-3.5" />Cotando frete…</p>
            : !state.quotes ? <button type="button" onClick={quote} className="text-[11px] text-admin-champ/80 hover:text-admin-champ flex items-center gap-1.5"><Icon name="refresh" className="w-3.5 h-3.5" />Cotar frete no Melhor Envio</button>
              : state.quotes.length === 0 ? <p className="text-admin-muted/40 text-[11px]">Sem opções para este CEP. Escolha outro modo.</p>
                : <div className="space-y-1.5 mt-1">
                    {state.quotes.map((o) => (
                      <button key={o.id} type="button" onClick={() => onChange({ value: o.price, service: `${o.company} ${o.service}`.trim(), days: o.delivery_days })} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${state.service === `${o.company} ${o.service}`.trim() ? 'bg-admin-champ/15 ring-1 ring-admin-champ/40' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                        {o.company_picture ? <img src={o.company_picture} alt="" className="w-6 h-6 rounded object-contain bg-white/5 shrink-0" /> : <Icon name="truck" className="w-4 h-4 text-admin-champ/60 shrink-0" />}
                        <div className="min-w-0 flex-1"><p className="text-admin-text text-xs truncate">{o.company} · {o.service}</p>{o.delivery_days != null && <p className="text-admin-muted/40 text-[10px]">{o.delivery_days} dia(s) úteis</p>}</div>
                        <span className="text-admin-champ text-xs shrink-0">{brl(o.price)}</span>
                      </button>
                    ))}
                  </div>}
        </div>
      )}

      {method === 'combinado' && (
        <div className="flex items-center gap-2">
          <span className="text-admin-muted/45 text-[11px]">Valor combinado:</span>
          <span className="text-admin-muted/40 text-xs">R$</span>
          <input type="number" value={state.value || ''} onChange={(e) => onChange({ value: e.target.value, service: 'Combinado', days: null })} placeholder="0,00" className="glass-input rounded-lg px-3 py-1.5 text-sm text-admin-text outline-none w-28" />
          <span className="text-admin-muted/35 text-[10px]">(ou 0 para acertar depois)</span>
        </div>
      )}
      {method === 'retirada' && <p className="text-admin-muted/50 text-[11px]">Retirada no fornecedor{sup?.city ? ` (${sup.city})` : ''} · sem frete.</p>}
      {method === 'gratis' && <p className="text-admin-sage/70 text-[11px]">Frete grátis oferecido pelo fornecedor.</p>}
    </div>
  )
}
