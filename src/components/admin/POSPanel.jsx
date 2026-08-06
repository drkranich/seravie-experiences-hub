import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { Icon, GlassSelect } from './ui'

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'stripe', label: 'Stripe (online)' },
]
const PM_LABEL = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]))
const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const num = (v) => (parseFloat(v) || 0)

export function POSPanel({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id

  const [session, setSession] = useState(null)
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [contacts, setContacts] = useState([])
  const [holds, setHolds] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [saleNotes, setSaleNotes] = useState('')
  const [customer, setCustomer] = useState(null) // { id, name } | null
  const [custQuery, setCustQuery] = useState('')

  const [payments, setPayments] = useState([]) // [{ method, amount }]
  const [payMethod, setPayMethod] = useState('dinheiro')
  const [payAmount, setPayAmount] = useState('')

  const [openingAmount, setOpeningAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const [moveModal, setMoveModal] = useState(null)
  const [moveForm, setMoveForm] = useState({ amount: '', description: '' })
  const [closeModal, setCloseModal] = useState(false)
  const [countedAmount, setCountedAmount] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [showHolds, setShowHolds] = useState(false)
  const [showDay, setShowDay] = useState(false)
  const [showCustomer, setShowCustomer] = useState(false)
  const [stockModal, setStockModal] = useState(null) // product for entrada de estoque
  const [stockForm, setStockForm] = useState({ quantity: '', notes: '' })
  const [stripeLink, setStripeLink] = useState(null)
  const [manualCode, setManualCode] = useState('')

  const loadSession = async () => {
    setLoading(true)
    const { data } = await supabase.from('cash_sessions').select('*').eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle()
    setSession(data || null)
    if (data) {
      const { data: mv } = await supabase.from('cash_movements').select('*')
        .eq('session_id', data.id).order('created_at', { ascending: false })
      setMovements(mv || [])
      const { data: hd } = await supabase.from('pos_holds').select('*').order('created_at', { ascending: false })
      setHolds(hd || [])
    } else { setMovements([]); setHolds([]) }
    setLoading(false)
  }
  const loadProducts = async () => {
    // Catálogo transversal: produtos + peças de artesanato (estoque de cada um é baixado na sua tabela).
    const [prods, crafts] = await Promise.all([
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('craft_items').select('*').eq('status', 'active').order('name'),
    ])
    const craftMapped = (crafts.data || []).map((c) => ({ id: c.id, name: c.name, price: c.price, cost: c.cost, stock: c.stock, sku: null, barcode: null, status: c.status, category_id: null, _src: 'craft' }))
    setProducts([...(prods.data || []).map((p) => ({ ...p, _src: 'products' })), ...craftMapped])
  }
  const loadAux = async () => {
    const { data: cats } = await supabase.from('product_categories').select('id, name').order('sort_order')
    setCategories(cats || [])
    const { data: cts } = await supabase.from('contacts').select('id, name').order('name').limit(500)
    setContacts(cts || [])
  }
  useEffect(() => { loadSession(); loadProducts(); loadAux() }, [])

  // ---------- Caixa ----------
  const openCash = async () => {
    setBusy(true)
    const { data, error } = await supabase.from('cash_sessions').insert({
      tenant_id: tenantId, unit_id: profile?.unit_id || null,
      opening_amount: num(openingAmount), opened_by: user?.id || null, status: 'open',
    }).select().single()
    setBusy(false)
    if (error) { notify('Erro ao abrir caixa', 'error'); return }
    setOpeningAmount(''); setSession(data); setMovements([]); setHolds([])
    notify('Caixa aberto', 'success')
  }
  const saveMovement = async () => {
    const amount = num(moveForm.amount)
    if (amount <= 0) { notify('Informe um valor', 'error'); return }
    setBusy(true)
    const { data, error } = await supabase.from('cash_movements').insert({
      tenant_id: tenantId, session_id: session.id, type: moveModal, amount, payment_method: 'dinheiro',
      description: moveForm.description || (moveModal === 'deposit' ? 'Suprimento' : 'Sangria'),
      created_by: user?.id || null,
    }).select().single()
    setBusy(false)
    if (error) { notify('Erro no movimento', 'error'); return }
    setMovements((m) => [data, ...m]); setMoveModal(null); setMoveForm({ amount: '', description: '' })
    notify(moveModal === 'deposit' ? 'Suprimento registrado' : 'Sangria registrada', 'success')
  }
  const summary = useMemo(() => {
    let salesTotal = 0, salesCount = 0, cashSales = 0, deposits = 0, withdrawals = 0
    const byMethod = {}
    for (const m of movements) {
      if (m.type === 'sale') {
        salesTotal += Number(m.amount); salesCount += 1
        byMethod[m.payment_method] = (byMethod[m.payment_method] || 0) + Number(m.amount)
        if (m.payment_method === 'dinheiro') cashSales += Number(m.amount)
      } else if (m.type === 'deposit') deposits += Number(m.amount)
      else if (m.type === 'withdrawal') withdrawals += Number(m.amount)
    }
    const expectedCash = num(session?.opening_amount) + cashSales + deposits - withdrawals
    return { salesTotal, salesCount, cashSales, deposits, withdrawals, byMethod, expectedCash }
  }, [movements, session])

  const closeCash = async () => {
    setBusy(true)
    const counted = num(countedAmount), expected = summary.expectedCash
    const { error } = await supabase.from('cash_sessions').update({
      status: 'closed', closing_amount: counted, expected_amount: expected,
      difference: counted - expected, closed_by: user?.id || null, closed_at: new Date().toISOString(),
    }).eq('id', session.id)
    setBusy(false)
    if (error) { notify('Erro ao fechar caixa', 'error'); return }
    setCloseModal(false); setCountedAmount(''); resetSale()
    notify('Caixa fechado', 'success'); loadSession()
  }

  // ---------- Carrinho ----------
  const addToCart = (p) => setCart((c) => {
    const found = c.find((i) => i.product_id === p.id)
    if (found) {
      if (p.stock != null && found.qty >= p.stock) { notify('Estoque insuficiente', 'error'); return c }
      return c.map((i) => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
    }
    return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1, discount: 0, stock: p.stock, source: p._src || 'products' }]
  })
  const setQty = (id, qty) => setCart((c) => c.flatMap((i) => {
    if (i.product_id !== id) return [i]
    const q = Math.max(0, qty)
    if (q === 0) return []
    if (i.stock != null && q > i.stock) { notify('Estoque insuficiente', 'error'); return [{ ...i, qty: i.stock }] }
    return [{ ...i, qty: q }]
  }))
  const setItemDiscount = (id, d) => setCart((c) => c.map((i) => i.product_id === id ? { ...i, discount: Math.max(0, num(d)) } : i))
  const removeItem = (id) => setCart((c) => c.filter((i) => i.product_id !== id))

  // ---------- Leitor de código de barras (HID / keyboard wedge) ----------
  const handleScan = (raw) => {
    const code = String(raw).trim()
    if (!code) return
    const p = products.find((x) => x.barcode && x.barcode === code) || products.find((x) => (x.sku || '') === code)
    if (!p) { notify(`Código ${code} não encontrado`, 'error'); return }
    if (p.stock != null && p.stock <= 0) { notify(`${p.name}: sem estoque`, 'error'); return }
    addToCart(p); notify(`${p.name} · bipado`, 'success')
  }

  useEffect(() => {
    if (!session) return
    let buf = ''; let last = 0
    const onKey = (e) => {
      if (e.target?.dataset?.barcode) return // campo manual trata o próprio Enter
      const t = Date.now()
      if (t - last > 80) buf = '' // reset se digitação humana (lenta)
      last = t
      if (e.key === 'Enter') {
        if (buf.length >= 3) { e.preventDefault(); handleScan(buf); setSearch(''); setManualCode('') }
        buf = ''
        return
      }
      if (e.key.length === 1) buf += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, products])

  const lineTotal = (i) => Math.max(0, i.price * i.qty - (i.discount || 0))
  const subtotal = cart.reduce((s, i) => s + lineTotal(i), 0)
  const couponValue = appliedCoupon
    ? (appliedCoupon.type === 'percent' ? Math.round(subtotal * (Number(appliedCoupon.value) || 0)) / 100 : Math.min(Number(appliedCoupon.value) || 0, subtotal))
    : 0
  const discountValue = Math.min(num(discount) + couponValue, subtotal)
  const total = Math.max(0, subtotal - discountValue)
  const paidTotal = payments.reduce((s, p) => s + num(p.amount), 0)
  const remaining = Math.max(0, total - paidTotal)
  const change = Math.max(0, paidTotal - total)
  const canFinalize = cart.length > 0 && remaining <= 0.001

  const addPayment = () => {
    const amt = payAmount === '' ? remaining : num(payAmount)
    if (amt <= 0) { notify('Valor inválido', 'error'); return }
    setPayments((p) => [...p, { method: payMethod, amount: amt }])
    setPayAmount('')
  }
  const removePayment = (idx) => setPayments((p) => p.filter((_, i) => i !== idx))

  const chargeStripe = async () => {
    const amt = remaining > 0.001 ? remaining : total
    if (amt <= 0) { notify('Nada a cobrar', 'error'); return }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('pos-stripe-link', {
      body: { amount: amt, description: `Venda ${customer?.name || 'PDV'}` },
    })
    setBusy(false)
    if (error || !data?.url) { notify('Stripe indisponível. Configure a chave (STRIPE_SECRET_KEY) nas Edge Functions do Supabase.', 'error'); return }
    setStripeLink({ url: data.url, amount: amt })
  }

  const resetSale = () => { setCart([]); setDiscount(''); setPayments([]); setPayAmount(''); setSaleNotes(''); setCustomer(null); setCouponCode(''); setAppliedCoupon(null) }

  // Aplica um cupom validando código, validade, mínimo e limite de usos.
  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    const { data: c } = await supabase.from('coupons').select('*').eq('code', code).eq('is_active', true).maybeSingle()
    if (!c) return notify('Cupom inválido ou inativo', 'error')
    const now = new Date()
    if (c.valid_from && new Date(c.valid_from) > now) return notify('Cupom ainda não vigente', 'error')
    if (c.valid_until && new Date(c.valid_until) < now) return notify('Cupom expirado', 'error')
    if (c.max_uses != null && (c.used_count || 0) >= c.max_uses) return notify('Cupom esgotado', 'error')
    if (c.min_order != null && subtotal < Number(c.min_order)) return notify(`Pedido mínimo de ${brl(c.min_order)} para este cupom`, 'error')
    setAppliedCoupon(c); notify(`Cupom ${code} aplicado`, 'success')
  }

  const finalizeSale = async () => {
    if (cart.length === 0) { notify('Carrinho vazio', 'error'); return }
    const pays = payments.length ? payments : [{ method: payMethod, amount: total }]
    if (pays.reduce((s, p) => s + num(p.amount), 0) + 0.001 < total) { notify('Pagamento insuficiente', 'error'); return }
    setBusy(true)
    const items = cart.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.qty, discount: i.discount || 0, subtotal: lineTotal(i) }))
    const primary = pays.length === 1 ? pays[0].method : 'multiplo'
    const { data: order, error } = await supabase.from('orders').insert({
      tenant_id: tenantId, unit_id: profile?.unit_id || null,
      status: 'delivered', payment_status: 'paid', payment_method: primary,
      total, discount: discountValue, items, payments: pays,
      contact_id: customer?.id || null, customer_name: customer?.name || null,
      paid_amount: paidTotal || total, change_amount: change, notes: saleNotes || null,
      channel: 'pdv', cash_session_id: session.id, created_by: user?.id || null,
    }).select().single()
    if (error || !order) { setBusy(false); notify('Erro ao registrar venda', 'error'); return }

    // Movimentos de caixa por forma de pagamento
    const newMovs = []
    for (const p of pays) {
      const { data: mv } = await supabase.from('cash_movements').insert({
        tenant_id: tenantId, session_id: session.id, type: 'sale', amount: num(p.amount),
        payment_method: p.method, description: `Venda #${order.number}`, reference_id: order.id, created_by: user?.id || null,
      }).select().single()
      if (mv) newMovs.push(mv)
    }
    await supabase.from('financial_entries').insert({
      tenant_id: tenantId, unit_id: profile?.unit_id || null, type: 'revenue', category: 'venda',
      description: `Venda PDV #${order.number}`, amount: total, date: new Date().toISOString().slice(0, 10),
      payment_method: primary, reference_id: order.id, reference_type: 'order', created_by: user?.id || null,
    })
    // Baixa de estoque + movimento de estoque
    for (const i of cart) {
      if (i.stock != null) {
        const bal = Math.max(0, i.stock - i.qty)
        if (i.source === 'craft') {
          await supabase.from('craft_items').update({ stock: bal }).eq('id', i.product_id)
        } else {
          await supabase.from('products').update({ stock: bal }).eq('id', i.product_id)
          await supabase.from('stock_movements').insert({
            tenant_id: tenantId, product_id: i.product_id, type: 'sale', quantity: -i.qty, balance_after: bal,
            reference_id: order.id, reference_type: 'order', created_by: user?.id || null,
          })
        }
      }
    }

    // ---- Integrações da venda (fidelidade, LTV, cupom, fiscal) ----
    let earnedPoints = 0
    if (customer?.id) {
      // LTV do cliente: acumula o total da venda no contato
      try {
        const { data: c } = await supabase.from('contacts').select('ltv').eq('id', customer.id).maybeSingle()
        await supabase.from('contacts').update({ ltv: Number(c?.ltv || 0) + total }).eq('id', customer.id)
      } catch { /* best-effort */ }
      // Fidelidade: 1 ponto por real (regra padrão); cria conta se não existir
      earnedPoints = Math.floor(total)
      if (earnedPoints > 0) {
        try {
          const { data: acc } = await supabase.from('loyalty_accounts').select('*').eq('contact_id', customer.id).maybeSingle()
          if (acc) {
            await supabase.from('loyalty_accounts').update({ points: (acc.points || 0) + earnedPoints, lifetime_points: (acc.lifetime_points || 0) + earnedPoints }).eq('id', acc.id)
            await supabase.from('loyalty_transactions').insert({ tenant_id: tenantId, account_id: acc.id, type: 'earn', points: earnedPoints, description: `Venda PDV #${order.number}`, reference_id: order.id })
          } else {
            const { data: newAcc } = await supabase.from('loyalty_accounts').insert({ tenant_id: tenantId, contact_id: customer.id, points: earnedPoints, lifetime_points: earnedPoints, tier: 'bronze' }).select('id').single()
            if (newAcc) await supabase.from('loyalty_transactions').insert({ tenant_id: tenantId, account_id: newAcc.id, type: 'earn', points: earnedPoints, description: `Venda PDV #${order.number}`, reference_id: order.id })
          }
        } catch { /* best-effort */ }
      }
    }
    // Cupom aplicado: incrementa uso
    if (appliedCoupon?.id) {
      try { await supabase.from('coupons').update({ used_count: (appliedCoupon.used_count || 0) + 1 }).eq('id', appliedCoupon.id) } catch { /* noop */ }
    }
    // Emissão fiscal (NFC-e) — pronto para plugar: chama a edge function; se o
    // gateway não estiver configurado, registra pendente sem travar a venda.
    let fiscalNote = null
    try {
      const { data: fx } = await supabase.functions.invoke('fiscal-emit', {
        body: { order_id: order.id, doc_type: 'nfce', amount: total, customer: { name: customer?.name || null }, items },
      })
      if (fx?.document?.status === 'authorized') fiscalNote = { status: 'authorized', url: fx.document.danfe_url }
      else fiscalNote = { status: 'pending' }
    } catch { fiscalNote = { status: 'pending' } }

    setBusy(false)
    setMovements((m) => [...newMovs, ...m])
    setReceipt({ number: order.number, items, total, discount: discountValue, payments: pays, change, customer: customer?.name, notes: saleNotes, at: new Date(), points: earnedPoints, fiscal: fiscalNote })
    resetSale(); loadProducts()
    notify(`Venda #${order.number} registrada${earnedPoints ? ` · +${earnedPoints} pts` : ''}`, 'success')
  }

  // ---------- Comandas (holds) ----------
  const holdSale = async () => {
    if (cart.length === 0) { notify('Carrinho vazio', 'error'); return }
    const label = customer?.name || `Comanda ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    setBusy(true)
    const { data, error } = await supabase.from('pos_holds').insert({
      tenant_id: tenantId, session_id: session.id, label, items: cart, discount: num(discount), customer_name: customer?.name || null, created_by: user?.id || null,
    }).select().single()
    setBusy(false)
    if (error) { notify('Erro ao segurar comanda', 'error'); return }
    setHolds((h) => [data, ...h]); resetSale(); notify('Comanda salva', 'success')
  }
  const recallHold = async (h) => {
    setCart(h.items || []); setDiscount(h.discount ? String(h.discount) : ''); setCustomer(h.customer_name ? { id: null, name: h.customer_name } : null)
    await supabase.from('pos_holds').delete().eq('id', h.id)
    setHolds((list) => list.filter((x) => x.id !== h.id)); setShowHolds(false)
  }

  // ---------- Estoque (entrada) ----------
  const saveStockEntry = async () => {
    const q = parseInt(stockForm.quantity)
    if (!q || q === 0) { notify('Quantidade inválida', 'error'); return }
    setBusy(true)
    const bal = (stockModal.stock || 0) + q
    await supabase.from('products').update({ stock: bal }).eq('id', stockModal.id)
    await supabase.from('stock_movements').insert({
      tenant_id: tenantId, product_id: stockModal.id, type: q > 0 ? 'entry' : 'adjustment', quantity: q,
      balance_after: bal, notes: stockForm.notes || null, created_by: user?.id || null,
    })
    setBusy(false); setStockModal(null); setStockForm({ quantity: '', notes: '' }); loadProducts()
    notify('Estoque atualizado', 'success')
  }

  const filtered = products.filter((p) =>
    (!catFilter || p.category_id === catFilter) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())))
  const custResults = custQuery ? contacts.filter((c) => (c.name || '').toLowerCase().includes(custQuery.toLowerCase())).slice(0, 8) : []

  const printReceipt = () => window.print()

  if (loading) return <div className="p-10 text-admin-muted/40 text-sm">Carregando caixa…</div>

  if (!session) return (
    <div className="p-6 lg:p-10 max-w-md">
      <h1 className="font-serif text-4xl text-admin-text mb-1">PDV</h1>
      <p className="text-admin-muted/60 text-sm mb-8">Nenhum caixa aberto. Abra o caixa para iniciar as vendas.</p>
      <div className="glass rounded-2xl p-7">
        <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor de abertura (troco inicial)</label>
        <div className="relative mb-5">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
          <input type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0,00" className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-lg text-admin-text outline-none" />
        </div>
        <button onClick={openCash} disabled={busy} className="w-full btn-gradient rounded-xl py-3 text-sm font-medium disabled:opacity-50">Abrir caixa</button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Barra do caixa */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/[0.06] bg-admin-side/30 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-admin-sage animate-pulse" />
          <div>
            <p className="text-admin-text text-sm font-medium">Caixa aberto</p>
            <p className="text-admin-muted/40 text-[11px]">{summary.salesCount} vendas · {brl(summary.salesTotal)} · em caixa {brl(summary.expectedCash)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowHolds(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Comandas {holds.length > 0 && `(${holds.length})`}</button>
          <button onClick={() => setShowDay(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Resumo do dia</button>
          <button onClick={() => { setMoveModal('deposit'); setMoveForm({ amount: '', description: '' }) }} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Suprimento</button>
          <button onClick={() => { setMoveModal('withdrawal'); setMoveForm({ amount: '', description: '' }) }} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Sangria</button>
          <button onClick={() => { setCountedAmount(''); setCloseModal(true) }} className="px-3 py-2 rounded-xl text-xs text-admin-rose border border-admin-rose/30 hover:bg-admin-rose/10 transition-colors">Fechar caixa</button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Produtos */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou SKU…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Icon name="tag" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-champ/50" />
                <input data-barcode="1" value={manualCode} onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(manualCode); setManualCode('') } }}
                  placeholder="Código de barras — bipe ou digite…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-admin-sage bg-admin-sage/10 px-2.5 py-2 rounded-lg shrink-0" title="Leitor USB detectado como teclado — bipe para adicionar"><span className="w-1.5 h-1.5 rounded-full bg-admin-sage animate-pulse" />Leitor pronto</span>
            </div>
            {categories.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${!catFilter ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>Todos</button>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setCatFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${catFilter === c.id ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum produto. Cadastre em Catálogo.</p></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((p) => {
                  const out = p.stock != null && p.stock <= 0
                  const low = !out && p.stock != null && p.min_stock != null && p.stock <= p.min_stock && p.min_stock > 0
                  return (
                    <div key={p.id} className={`glass rounded-xl p-4 border transition-all ${out ? 'opacity-50 border-transparent' : 'border-transparent hover:border-admin-champ/30 lift'}`}>
                      <button onClick={() => !out && addToCart(p)} disabled={out} className="text-left w-full">
                        <p className="text-admin-text text-sm font-medium line-clamp-2 mb-2">{p.name}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-admin-gold text-sm font-medium">{brl(p.price)}</p>
                          {p.stock != null && <p className={`text-[11px] ${out ? 'text-admin-rose' : low ? 'text-admin-gold' : 'text-admin-muted/40'}`}>{out ? 'sem estoque' : `${p.stock} un`}</p>}
                        </div>
                      </button>
                      <button onClick={() => { setStockModal(p); setStockForm({ quantity: '', notes: '' }) }} className="mt-2 text-[10px] text-admin-muted/40 hover:text-admin-champ transition-colors">+ estoque</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrinho */}
        <div className="w-[380px] shrink-0 flex flex-col bg-admin-side/20">
          {/* Cliente */}
          <button onClick={() => { setShowCustomer(true); setCustQuery('') }} className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left">
            <Icon name="user" className="w-4 h-4 text-admin-champ/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-admin-muted/40">Cliente</p>
              <p className="text-admin-text text-sm truncate">{customer?.name || 'Consumidor final'}</p>
            </div>
            {customer && <button onClick={(e) => { e.stopPropagation(); setCustomer(null) }} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>}
          </button>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <Icon name="tag" className="w-8 h-8 text-admin-champ/20 mb-2" />
                <p className="text-admin-muted/40 text-sm">Toque nos produtos para adicionar</p>
              </div>
            )}
            {cart.map((i) => (
              <div key={i.product_id} className="glass rounded-xl px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-admin-text text-sm flex-1 min-w-0">{i.name}</p>
                  <button onClick={() => removeItem(i.product_id)} className="text-admin-muted/40 hover:text-admin-rose shrink-0"><Icon name="x" className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(i.product_id, i.qty - 1)} className="w-6 h-6 rounded-lg bg-white/[0.05] text-admin-text hover:bg-white/[0.1] flex items-center justify-center text-sm">−</button>
                    <span className="text-admin-text text-sm w-6 text-center">{i.qty}</span>
                    <button onClick={() => setQty(i.product_id, i.qty + 1)} className="w-6 h-6 rounded-lg bg-white/[0.05] text-admin-text hover:bg-white/[0.1] flex items-center justify-center text-sm">+</button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-admin-muted/40 text-[10px]">desc</span>
                    <input type="number" value={i.discount || ''} onChange={(e) => setItemDiscount(i.product_id, e.target.value)} placeholder="0" className="w-14 glass-input rounded-lg px-2 py-1 text-xs text-admin-text outline-none text-right" />
                    <p className="text-admin-gold text-sm w-16 text-right">{brl(lineTotal(i))}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagamento */}
          <div className="border-t border-white/[0.06] p-4 space-y-2.5 max-h-[52vh] overflow-y-auto">
            <div className="flex items-center justify-between text-sm"><span className="text-admin-muted/60">Subtotal</span><span className="text-admin-text">{brl(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-admin-muted/60 text-sm">Desconto geral</span>
              <div className="relative w-28"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-admin-muted/40 text-xs">R$</span>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" className="w-full glass-input rounded-lg pl-7 pr-2 py-1.5 text-sm text-admin-text outline-none text-right" /></div>
            </div>
            {/* Cupom */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-admin-sage">Cupom {appliedCoupon.code} · − {brl(couponValue)}</span>
                <button onClick={() => { setAppliedCoupon(null); setCouponCode('') }} className="text-admin-muted/40 hover:text-admin-rose text-xs">remover</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Cupom" className="flex-1 glass-input rounded-lg px-3 py-1.5 text-sm text-admin-text outline-none uppercase" />
                <button onClick={applyCoupon} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Aplicar</button>
              </div>
            )}
            <div className="flex items-center justify-between"><span className="text-admin-text font-medium">Total</span><span className="text-admin-champ text-xl font-medium">{brl(total)}</span></div>

            {/* Pagamentos adicionados */}
            {payments.length > 0 && (
              <div className="space-y-1">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between glass-soft rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-admin-muted/70">{PM_LABEL[p.method]}</span>
                    <div className="flex items-center gap-2"><span className="text-admin-text">{brl(p.amount)}</span><button onClick={() => removePayment(idx)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button></div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-admin-muted/50">{remaining > 0.001 ? 'Falta' : change > 0 ? 'Troco' : 'Pago'}</span>
                  <span className={remaining > 0.001 ? 'text-admin-gold' : 'text-admin-sage'}>{brl(remaining > 0.001 ? remaining : change)}</span>
                </div>
              </div>
            )}

            {/* Adicionar pagamento */}
            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <GlassSelect value={payMethod} onChange={setPayMethod} options={PAYMENT_METHODS} />
              <div className="relative w-28"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-admin-muted/40 text-xs">R$</span>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={remaining > 0 ? remaining.toFixed(2) : '0,00'} className="w-full glass-input rounded-lg pl-7 pr-2 py-2 text-sm text-admin-text outline-none" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={addPayment} disabled={total <= 0} className="py-2 rounded-lg text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-40">+ pagamento</button>
              <button onClick={chargeStripe} disabled={total <= 0 || busy} className="py-2 rounded-lg text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-40">Cobrar Stripe</button>
            </div>

            <input value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} placeholder="Observações da venda…" className="w-full glass-input rounded-lg px-3 py-2 text-xs text-admin-text outline-none" />

            <div className="flex gap-2">
              <button onClick={holdSale} disabled={busy || cart.length === 0} className="px-4 py-3 rounded-xl text-sm text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-40">Segurar</button>
              <button onClick={finalizeSale} disabled={!canFinalize || busy} className="flex-1 btn-gradient rounded-xl py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">Finalizar {cart.length > 0 && `· ${brl(total)}`}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      {showCustomer && <CustomerModal query={custQuery} setQuery={setCustQuery} results={custResults} onPick={(c) => { setCustomer(c); setShowCustomer(false) }} onFree={(name) => { setCustomer({ id: null, name }); setShowCustomer(false) }} onClose={() => setShowCustomer(false)} />}

      {showHolds && (
        <Modal title="Comandas em espera" onClose={() => setShowHolds(false)}>
          {holds.length === 0 ? <p className="text-admin-muted/40 text-sm text-center py-6">Nenhuma comanda</p> : (
            <div className="space-y-2">{holds.map((h) => (
              <button key={h.id} onClick={() => recallHold(h)} className="w-full glass rounded-xl px-4 py-3 flex items-center justify-between hover:border-admin-champ/25 border border-transparent transition-colors text-left">
                <div><p className="text-admin-text text-sm">{h.label}</p><p className="text-admin-muted/40 text-xs">{(h.items || []).length} itens</p></div>
                <Icon name="external" className="w-4 h-4 text-admin-champ/50" />
              </button>
            ))}</div>
          )}
        </Modal>
      )}

      {showDay && (
        <Modal title="Resumo do dia" onClose={() => setShowDay(false)}>
          <div className="glass-soft rounded-xl p-4 space-y-1.5 text-sm mb-4">
            <div className="flex justify-between"><span className="text-admin-muted/60">Vendas</span><span className="text-admin-text">{summary.salesCount}</span></div>
            <div className="flex justify-between"><span className="text-admin-muted/60">Total vendido</span><span className="text-admin-champ font-medium">{brl(summary.salesTotal)}</span></div>
            <div className="border-t border-white/[0.06] my-1.5" />
            {PAYMENT_METHODS.map((pm) => (
              <div key={pm.value} className="flex justify-between"><span className="text-admin-muted/60">{pm.label}</span><span className="text-admin-text">{brl(summary.byMethod[pm.value] || 0)}</span></div>
            ))}
            <div className="border-t border-white/[0.06] my-1.5" />
            <div className="flex justify-between"><span className="text-admin-muted/60">Abertura</span><span className="text-admin-text">{brl(session.opening_amount)}</span></div>
            <div className="flex justify-between"><span className="text-admin-muted/60">Suprimentos</span><span className="text-admin-text">{brl(summary.deposits)}</span></div>
            <div className="flex justify-between"><span className="text-admin-muted/60">Sangrias</span><span className="text-admin-text">− {brl(summary.withdrawals)}</span></div>
            <div className="flex justify-between border-t border-white/[0.06] pt-1.5 mt-1.5"><span className="text-admin-champ">Esperado em caixa</span><span className="text-admin-champ font-medium">{brl(summary.expectedCash)}</span></div>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {movements.filter((m) => m.type === 'sale').map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs glass-soft rounded-lg px-3 py-2">
                <span className="text-admin-muted/60">{m.description} · {PM_LABEL[m.payment_method] || m.payment_method}</span>
                <span className="text-admin-text">{brl(m.amount)}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {moveModal && (
        <Modal title={moveModal === 'deposit' ? 'Suprimento' : 'Sangria'} onClose={() => setMoveModal(null)}>
          <div className="space-y-4">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor *</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
                <input type="number" value={moveForm.amount} onChange={(e) => setMoveForm((f) => ({ ...f, amount: e.target.value }))} className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-admin-text outline-none" /></div></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Motivo</label>
              <input value={moveForm.description} onChange={(e) => setMoveForm((f) => ({ ...f, description: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={saveMovement} disabled={busy} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">Confirmar</button><button onClick={() => setMoveModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}

      {stockModal && (
        <Modal title={`Estoque · ${stockModal.name}`} onClose={() => setStockModal(null)}>
          <p className="text-admin-muted/50 text-xs mb-4">Estoque atual: {stockModal.stock ?? 0} un. Use negativo para ajuste/perda.</p>
          <div className="space-y-4">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Quantidade (+ entrada / − ajuste)</label>
              <input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((f) => ({ ...f, quantity: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Observação</label>
              <input value={stockForm.notes} onChange={(e) => setStockForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ex: reposição fornecedor" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={saveStockEntry} disabled={busy} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">Salvar</button><button onClick={() => setStockModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}

      {closeModal && (
        <Modal title="Fechar caixa" onClose={() => setCloseModal(false)}>
          <div className="glass-soft rounded-xl p-4 space-y-1.5 mb-5 text-sm">
            <div className="flex justify-between"><span className="text-admin-muted/60">Abertura</span><span className="text-admin-text">{brl(session.opening_amount)}</span></div>
            <div className="flex justify-between"><span className="text-admin-muted/60">Vendas em dinheiro</span><span className="text-admin-text">{brl(summary.cashSales)}</span></div>
            <div className="flex justify-between"><span className="text-admin-muted/60">Suprimentos</span><span className="text-admin-text">{brl(summary.deposits)}</span></div>
            <div className="flex justify-between"><span className="text-admin-muted/60">Sangrias</span><span className="text-admin-text">− {brl(summary.withdrawals)}</span></div>
            <div className="flex justify-between border-t border-white/[0.06] pt-1.5 mt-1.5"><span className="text-admin-champ">Esperado em caixa</span><span className="text-admin-champ font-medium">{brl(summary.expectedCash)}</span></div>
          </div>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor contado na gaveta</label>
          <div className="relative mb-3"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
            <input type="number" value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} placeholder="0,00" className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-lg text-admin-text outline-none" /></div>
          {countedAmount !== '' && <p className={`text-sm mb-4 ${Math.abs(num(countedAmount) - summary.expectedCash) < 0.005 ? 'text-admin-sage' : 'text-admin-rose'}`}>Diferença: {brl(num(countedAmount) - summary.expectedCash)}</p>}
          <div className="flex gap-3"><button onClick={closeCash} disabled={busy} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-3 rounded-xl text-sm transition-colors disabled:opacity-50">Confirmar fechamento</button><button onClick={() => setCloseModal(false)} className="px-5 py-3 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}

      {stripeLink && (
        <Modal title="Cobrança online (Stripe)" onClose={() => setStripeLink(null)}>
          <p className="text-admin-muted/60 text-sm mb-3">Envie o link ao cliente para pagar {brl(stripeLink.amount)}.</p>
          <div className="glass-soft rounded-lg px-3 py-2 text-xs text-admin-text break-all mb-3">{stripeLink.url}</div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => { navigator.clipboard?.writeText(stripeLink.url); notify('Link copiado', 'success') }} className="flex-1 py-2.5 rounded-xl text-sm text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Copiar link</button>
            <a href={stripeLink.url} target="_blank" rel="noreferrer" className="flex-1 text-center py-2.5 rounded-xl text-sm text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Abrir</a>
          </div>
          <button onClick={() => { setPayments((p) => [...p, { method: 'stripe', amount: stripeLink.amount }]); setStripeLink(null); notify('Pagamento Stripe registrado', 'success') }} className="w-full btn-gradient rounded-xl py-2.5 text-sm font-medium">Marcar como pago</button>
        </Modal>
      )}

      {receipt && <ReceiptModal receipt={receipt} tenantName={profile?.tenant_name} onPrint={printReceipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

// ---------- Componentes auxiliares ----------
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  )
}

function CustomerModal({ query, setQuery, results, onPick, onFree, onClose }) {
  return (
    <Modal title="Cliente da venda" onClose={onClose}>
      <div className="relative mb-3">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none" />
      </div>
      <div className="space-y-1 mb-3 max-h-56 overflow-y-auto">
        {results.map((c) => (
          <button key={c.id} onClick={() => onPick({ id: c.id, name: c.name })} className="w-full text-left px-3 py-2 rounded-lg text-sm text-admin-text hover:bg-white/[0.05] transition-colors">{c.name}</button>
        ))}
        {query && results.length === 0 && (
          <button onClick={() => onFree(query)} className="w-full text-left px-3 py-2 rounded-lg text-sm text-admin-champ hover:bg-white/[0.05] transition-colors">Usar "{query}" como nome avulso</button>
        )}
      </div>
      <button onClick={() => onFree(null)} className="text-admin-muted/50 hover:text-admin-text text-xs transition-colors">Consumidor final (sem cliente)</button>
    </Modal>
  )
}

function ReceiptModal({ receipt, tenantName, onPrint, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm">
        <div id="receipt-print" className="bg-white text-black rounded-xl p-5 text-[13px] font-mono">
          <div className="text-center mb-3">
            <p className="font-bold text-base">{tenantName || 'Seravie Experiences'}</p>
            <p className="text-[11px]">Comprovante de venda</p>
          </div>
          <div className="flex justify-between text-[11px] border-b border-black/20 pb-1 mb-2">
            <span>Venda #{receipt.number}</span><span>{receipt.at.toLocaleString('pt-BR')}</span>
          </div>
          {receipt.customer && <p className="text-[11px] mb-1">Cliente: {receipt.customer}</p>}
          <div className="space-y-0.5 mb-2">
            {receipt.items.map((it, i) => (
              <div key={i} className="flex justify-between"><span>{it.qty}x {it.name}</span><span>{brl(it.subtotal)}</span></div>
            ))}
          </div>
          {receipt.discount > 0 && <div className="flex justify-between text-[11px]"><span>Desconto</span><span>− {brl(receipt.discount)}</span></div>}
          <div className="flex justify-between font-bold border-t border-black/20 pt-1 mt-1"><span>TOTAL</span><span>{brl(receipt.total)}</span></div>
          {receipt.payments.map((p, i) => (<div key={i} className="flex justify-between text-[11px]"><span>{PM_LABEL[p.method]}</span><span>{brl(p.amount)}</span></div>))}
          {receipt.change > 0 && <div className="flex justify-between text-[11px]"><span>Troco</span><span>{brl(receipt.change)}</span></div>}
          {receipt.notes && <p className="text-[11px] mt-2 border-t border-black/20 pt-1">Obs: {receipt.notes}</p>}
          {receipt.points > 0 && <p className="text-[11px] mt-1 text-center">★ {receipt.points} pontos de fidelidade acumulados</p>}
          {receipt.fiscal && <p className="text-[10px] mt-1 text-center">{receipt.fiscal.status === 'authorized' ? 'NFC-e autorizada' : 'NFC-e pendente (configurar emissão)'}</p>}
          <p className="text-center text-[10px] mt-3">Obrigado pela preferência!</p>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onPrint} className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-medium">Imprimir</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Nova venda</button>
        </div>
      </div>
    </div>
  )
}
