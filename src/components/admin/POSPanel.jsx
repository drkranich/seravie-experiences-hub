import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { Icon, GlassSelect, GlassDate } from './ui'
import { POS_WIDGETS, POS_WIDGET_MAP, POS_PROFILES, POS_SEGMENTS, POS_SEGMENT_MAP, defaultWidgetsForSegment } from '../../lib/posConfig'
import { uploadTo } from '../../lib/storage'
import { exportPdf, exportCsv } from '../../lib/export'

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'giftcard', label: 'Vale-presente' },
  { value: 'pontos', label: 'Pontos de fidelidade' },
  { value: 'stripe', label: 'Stripe (online)' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'google_pay', label: 'Google Pay' },
]
const PM_LABEL = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]))
// atalhos rápidos por botão (o operador passa horas aqui)
const QUICK_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro', icon: 'tag' },
  { value: 'pix', label: 'PIX', icon: 'spark' },
  { value: 'credito', label: 'Crédito', icon: 'chart' },
  { value: 'debito', label: 'Débito', icon: 'chart' },
]
const genGiftCode = () => 'GIFT-' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`
const brl0 = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const num = (v) => (parseFloat(v) || 0)

export function POSPanel({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id

  const [session, setSession] = useState(null)
  const [movements, setMovements] = useState([])
  const [orders, setOrders] = useState([])
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

  const [payments, setPayments] = useState([]) // [{ method, amount, gift_card_id?, points? }]
  const [payMethod, setPayMethod] = useState('dinheiro')
  const [payAmount, setPayAmount] = useState('')

  // ---- Pagamentos avançados ----
  const [giftModal, setGiftModal] = useState(null) // 'redeem' | 'sell'
  const [loyalty, setLoyalty] = useState(null) // conta de fidelidade do cliente selecionado
  const [pixQr, setPixQr] = useState(null) // { amount }
  const [showReports, setShowReports] = useState(false)
  const [showLeads, setShowLeads] = useState(false)
  const [showDash, setShowDash] = useState(false)

  // ---- Múltiplas vendas abertas (abas) + mesas ----
  const [parked, setParked] = useState([]) // vendas em aberto na memória da sessão
  const [activeTableLabel, setActiveTableLabel] = useState(null)
  const [saleLabel, setSaleLabel] = useState('')
  const [tables, setTables] = useState([])
  const [showTables, setShowTables] = useState(false)
  const POINT_VALUE = 0.05 // R$ por ponto no resgate (5% de volta)

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

  // ---- Motor adaptativo por segmento ----
  const [posProfile, setPosProfile] = useState(null) // linha de pos_profiles
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [productModal, setProductModal] = useState(null) // { ...produto } para editar | {} para novo
  const hasWidget = (key) => !!posProfile?.widgets?.includes(key)

  const loadProfile = async () => {
    const { data } = await supabase.from('pos_profiles').select('*').maybeSingle()
    setPosProfile(data || null)
    setProfileLoaded(true)
    if (!data) setShowOnboarding(true)
  }
  const saveProfile = async (patch) => {
    const base = posProfile || { tenant_id: tenantId, profile: 'retail', widgets: [] }
    const row = { ...base, ...patch, tenant_id: tenantId, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('pos_profiles').upsert(row, { onConflict: 'tenant_id' }).select().single()
    if (error) { notify('Erro ao salvar configuração do POS', 'error'); return }
    setPosProfile(data)
    return data
  }
  const chooseSegment = async (segKey) => {
    const seg = POS_SEGMENT_MAP[segKey]
    await saveProfile({ segment: segKey, profile: seg?.profile || 'retail', widgets: defaultWidgetsForSegment(segKey), onboarded_at: new Date().toISOString() })
    setShowOnboarding(false)
    notify(`Perfil "${seg?.label}" configurado`, 'success')
  }
  const toggleWidget = (key) => {
    // update otimista funcional (evita perder toggles em cliques rápidos) + persiste
    setPosProfile((prev) => {
      const cur = prev?.widgets || []
      const next = cur.includes(key) ? cur.filter((w) => w !== key) : [...cur, key]
      const row = { ...(prev || { tenant_id: tenantId, profile: 'retail' }), widgets: next, tenant_id: tenantId, updated_at: new Date().toISOString() }
      supabase.from('pos_profiles').upsert(row, { onConflict: 'tenant_id' }).then(({ error }) => { if (error) notify('Erro ao salvar widget', 'error') })
      return { ...(prev || {}), widgets: next }
    })
  }

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
      const { data: ord } = await supabase.from('orders').select('id, total, items, contact_id, created_at')
        .eq('cash_session_id', data.id).order('created_at', { ascending: false })
      setOrders(ord || [])
    } else { setMovements([]); setHolds([]); setOrders([]) }
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
    const { data: tbs } = await supabase.from('tables').select('id, label, area, seats, status').eq('active', true).order('sort_order')
    setTables(tbs || [])
  }
  useEffect(() => { loadSession(); loadProducts(); loadAux(); loadProfile() }, [])

  // ---------- Cadastro rápido de produtos (widget product_admin) ----------
  const saveProduct = async (form) => {
    const payload = {
      tenant_id: tenantId, name: (form.name || '').trim(), price: num(form.price), cost: num(form.cost),
      stock: form.stock === '' || form.stock == null ? null : parseInt(form.stock),
      sku: form.sku?.trim() || null, category_id: form.category_id || null,
      images: form.image?.trim() ? [form.image.trim()] : [], status: 'active',
    }
    if (!payload.name) { notify('Informe o nome do produto', 'error'); return }
    setBusy(true)
    let error
    if (form.id) ({ error } = await supabase.from('products').update(payload).eq('id', form.id))
    else ({ error } = await supabase.from('products').insert(payload))
    setBusy(false)
    if (error) { notify('Erro ao salvar produto: ' + error.message, 'error'); return }
    setProductModal(null); loadProducts()
    notify(form.id ? 'Produto atualizado' : 'Produto cadastrado', 'success')
  }
  const deleteProduct = async (p) => {
    setBusy(true)
    const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', p.id)
    setBusy(false)
    if (error) { notify('Erro ao excluir produto', 'error'); return }
    setProductModal(null); removeItem(p.id); loadProducts()
    notify('Produto removido do catálogo', 'success')
  }

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

  // KPIs vivos da barra superior — dados reais da sessão de caixa
  const kpis = useMemo(() => {
    const count = orders.length
    const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    const ticket = count ? revenue / count : 0
    const itemsSold = orders.reduce((s, o) => s + (Array.isArray(o.items) ? o.items.reduce((a, it) => a + (Number(it.qty) || 0), 0) : 0), 0)
    const clients = new Set(orders.map((o) => o.contact_id).filter(Boolean)).size
    // tempo médio entre vendas (minutos), a partir dos horários dos pedidos
    let avgGap = 0
    if (count >= 2) {
      const ts = orders.map((o) => new Date(o.created_at).getTime()).sort((a, b) => a - b)
      let sum = 0; for (let i = 1; i < ts.length; i++) sum += ts[i] - ts[i - 1]
      avgGap = sum / (ts.length - 1) / 60000
    }
    return { count, revenue, ticket, itemsSold, clients, avgGap }
  }, [orders])

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
    return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1, discount: 0, stock: p.stock, source: p._src || 'products', image: (p.images && p.images[0]) || null, note: '' }]
  })
  const setItemNote = (id, note) => setCart((c) => c.map((i) => i.product_id === id ? { ...i, note } : i))
  const setQty = (id, qty) => setCart((c) => c.flatMap((i) => {
    if (i.product_id !== id) return [i]
    const q = Math.max(0, qty)
    if (q === 0) return []
    if (i.stock != null && q > i.stock) { notify('Estoque insuficiente', 'error'); return [{ ...i, qty: i.stock }] }
    return [{ ...i, qty: q }]
  }))
  const setItemDiscount = (id, d) => setCart((c) => c.map((i) => i.product_id === id ? { ...i, discount: Math.max(0, num(d)) } : i))
  const removeItem = (id) => setCart((c) => c.filter((i) => i.product_id !== id))

  // Carrega a conta de fidelidade do cliente selecionado (para resgate de pontos)
  useEffect(() => {
    if (!customer?.id) { setLoyalty(null); return }
    supabase.from('loyalty_accounts').select('*').eq('contact_id', customer.id).maybeSingle().then(({ data }) => setLoyalty(data || null))
  }, [customer?.id])

  // Cadastra um novo cliente durante a venda (remarketing)
  const createCustomer = async (form) => {
    const name = (form.name || '').trim()
    if (!name) { notify('Informe o nome do cliente', 'error'); return }
    setBusy(true)
    const { data, error } = await supabase.from('contacts').insert({
      tenant_id: tenantId, type: 'customer', name, phone: form.phone?.trim() || null, email: form.email?.trim() || null,
      birthdate: form.birthdate || null, notes: form.notes?.trim() || null, source: 'pdv', status: 'active',
      metadata: form.address?.trim() ? { address: form.address.trim() } : {},
    }).select('id, name').single()
    setBusy(false)
    if (error) { notify('Erro ao cadastrar cliente: ' + error.message, 'error'); return }
    setCustomer({ id: data.id, name: data.name }); setShowCustomer(false)
    setContacts((c) => [{ id: data.id, name: data.name }, ...c])
    notify('Cliente cadastrado e vinculado à venda', 'success')
  }

  // ---------- Gift card (vale-presente) ----------
  const redeemGiftCard = async (code) => {
    const c = (code || '').trim().toUpperCase()
    if (!c) return
    const { data: gc } = await supabase.from('gift_cards').select('*').eq('code', c).eq('status', 'active').maybeSingle()
    if (!gc) { notify('Vale-presente inválido ou já usado', 'error'); return }
    if (Number(gc.balance) <= 0) { notify('Vale-presente sem saldo', 'error'); return }
    if (gc.expires_at && new Date(gc.expires_at) < new Date()) { notify('Vale-presente expirado', 'error'); return }
    const use = Math.min(Number(gc.balance), remaining > 0.001 ? remaining : total)
    if (use <= 0) { notify('Nada a pagar', 'error'); return }
    setPayments((p) => [...p, { method: 'giftcard', amount: use, gift_card_id: gc.id, gift_code: gc.code }])
    setGiftModal(null)
    notify(`Vale ${gc.code} aplicado (${brl(use)})`, 'success')
  }
  // adiciona ao carrinho a "venda" de um vale-presente (vira gift card ao finalizar)
  const sellGiftCard = (amount) => {
    const v = num(amount)
    if (v <= 0) { notify('Informe um valor', 'error'); return }
    setCart((c) => [...c, { product_id: 'gift-' + Math.random().toString(36).slice(2, 8), name: `Vale-presente ${brl(v)}`, price: v, qty: 1, discount: 0, stock: null, source: 'giftcard', gift_sale: true, note: '' }])
    setGiftModal(null)
    notify('Vale-presente adicionado à venda', 'success')
  }

  // ---------- Resgate de pontos ----------
  const redeemPoints = (pts) => {
    const available = loyalty?.points || 0
    const useP = Math.min(parseInt(pts) || 0, available)
    if (useP <= 0) { notify('Pontos insuficientes', 'error'); return }
    const value = Math.min(useP * POINT_VALUE, remaining > 0.001 ? remaining : total)
    if (value <= 0) { notify('Nada a pagar', 'error'); return }
    const pointsUsed = Math.ceil(value / POINT_VALUE)
    setPayments((p) => [...p, { method: 'pontos', amount: value, points: pointsUsed }])
    notify(`${pointsUsed} pontos resgatados (${brl(value)})`, 'success')
  }

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
  const willEarnPoints = customer?.id ? Math.floor(total) : 0

  // Cross-sell: produtos das mesmas categorias dos itens do carrinho, ainda não adicionados
  const suggestions = useMemo(() => {
    if (!hasWidget('loyalty') && cart.length === 0) return []
    if (cart.length === 0) return []
    const inCart = new Set(cart.map((i) => i.product_id))
    const cats = new Set(cart.map((i) => products.find((p) => p.id === i.product_id)?.category_id).filter(Boolean))
    let pool = products.filter((p) => !inCart.has(p.id) && p._src !== 'craft' && (p.stock == null || p.stock > 0))
    const sameCat = pool.filter((p) => p.category_id && cats.has(p.category_id))
    const rest = pool.filter((p) => !sameCat.includes(p))
    return [...sameCat, ...rest].slice(0, 3)
  }, [cart, products])

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

  const resetSale = () => { setCart([]); setDiscount(''); setPayments([]); setPayAmount(''); setSaleNotes(''); setCustomer(null); setCouponCode(''); setAppliedCoupon(null); setActiveTableLabel(null); setSaleLabel('') }

  // ---------- Múltiplas vendas abertas (abas) ----------
  const currentLabel = () => saleLabel || activeTableLabel || customer?.name || `Venda ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  const snapshotSale = () => ({
    id: Math.random().toString(36).slice(2, 9), label: currentLabel(), tableLabel: activeTableLabel,
    cart, customer, discount, couponCode, appliedCoupon, saleNotes, payments,
    total: cart.reduce((s, i) => s + lineTotal(i), 0),
  })
  const restoreSale = (s) => {
    setCart(s.cart || []); setCustomer(s.customer || null); setDiscount(s.discount || ''); setCouponCode(s.couponCode || '')
    setAppliedCoupon(s.appliedCoupon || null); setSaleNotes(s.saleNotes || ''); setPayments(s.payments || [])
    setActiveTableLabel(s.tableLabel || null); setSaleLabel(s.label || '')
  }
  const newSale = () => { const snap = cart.length ? snapshotSale() : null; if (snap) setParked((p) => [...p, snap]); resetSale() }
  const switchTo = (id) => {
    const target = parked.find((p) => p.id === id); if (!target) return
    const snap = cart.length ? snapshotSale() : null
    setParked((prev) => [...prev.filter((p) => p.id !== id), ...(snap ? [snap] : [])])
    restoreSale(target)
  }
  const openTable = (t) => {
    setShowTables(false)
    const existing = parked.find((p) => p.tableLabel === t.label)
    if (existing) return switchTo(existing.id)
    const snap = cart.length ? snapshotSale() : null
    if (snap) setParked((p) => [...p, snap])
    resetSale(); setActiveTableLabel(t.label); setSaleLabel(t.label)
  }

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
    const items = cart.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.qty, discount: i.discount || 0, subtotal: lineTotal(i), note: i.note || null }))
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
    const lowStockHits = []
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
        if (i.min_stock != null && bal <= i.min_stock) lowStockHits.push({ name: i.name, stock: bal, min_stock: i.min_stock })
      }
    }
    // Gatilho de automação: estoque baixo
    if (lowStockHits.length) {
      try { supabase.functions.invoke('automation-run', { body: { event: 'low_stock', tenant_id: tenantId, context: { products: lowStockHits } } }) } catch { /* noop */ }
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
    // ---- Vale-presente: emitir os vendidos e debitar os resgatados ----
    try {
      // vendidos (itens do carrinho marcados como gift_sale)
      for (const gi of cart.filter((i) => i.gift_sale)) {
        const code = genGiftCode()
        const { data: gc } = await supabase.from('gift_cards').insert({ tenant_id: tenantId, code, initial_amount: gi.price, balance: gi.price, status: 'active', contact_id: customer?.id || null, issued_order_id: order.id }).select('id').single()
        if (gc) await supabase.from('gift_card_txns').insert({ tenant_id: tenantId, gift_card_id: gc.id, type: 'issue', amount: gi.price, balance_after: gi.price, order_id: order.id })
      }
      // resgatados (pagamentos giftcard)
      for (const gp of pays.filter((p) => p.method === 'giftcard' && p.gift_card_id)) {
        const { data: gc } = await supabase.from('gift_cards').select('balance').eq('id', gp.gift_card_id).maybeSingle()
        const bal = Math.max(0, Number(gc?.balance || 0) - num(gp.amount))
        await supabase.from('gift_cards').update({ balance: bal, status: bal <= 0.001 ? 'used' : 'active', updated_at: new Date().toISOString() }).eq('id', gp.gift_card_id)
        await supabase.from('gift_card_txns').insert({ tenant_id: tenantId, gift_card_id: gp.gift_card_id, type: 'redeem', amount: -num(gp.amount), balance_after: bal, order_id: order.id })
      }
    } catch { /* best-effort */ }
    // ---- Resgate de pontos de fidelidade ----
    const pointsRedeemed = pays.filter((p) => p.method === 'pontos').reduce((s, p) => s + (Number(p.points) || 0), 0)
    if (pointsRedeemed > 0 && customer?.id) {
      try {
        const { data: acc } = await supabase.from('loyalty_accounts').select('*').eq('contact_id', customer.id).maybeSingle()
        if (acc) {
          await supabase.from('loyalty_accounts').update({ points: Math.max(0, (acc.points || 0) - pointsRedeemed) }).eq('id', acc.id)
          await supabase.from('loyalty_transactions').insert({ tenant_id: tenantId, account_id: acc.id, type: 'redeem', points: -pointsRedeemed, description: `Resgate na venda PDV #${order.number}`, reference_id: order.id })
        }
      } catch { /* best-effort */ }
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

    // Dispara o motor de automações (best-effort, não bloqueia a venda)
    try { supabase.functions.invoke('automation-run', { body: { event: 'new_order', tenant_id: tenantId, context: { order_id: order.id, total, customer_name: customer?.name || null } } }) } catch { /* noop */ }

    setBusy(false)
    setMovements((m) => [...newMovs, ...m])
    setOrders((o) => [{ id: order.id, total, items, contact_id: customer?.id || null, created_at: new Date().toISOString() }, ...o])
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

  if (loading || !profileLoaded) return <div className="p-10 text-admin-muted/40 text-sm">Carregando caixa…</div>

  // Primeira configuração: qual é o seu segmento?
  if (showOnboarding) return <PosOnboarding onPick={chooseSegment} />

  if (!session) return (
    <div className="p-6 lg:p-10 max-w-md">
      <p className="text-[11px] tracking-[0.2em] uppercase text-admin-champ/70 mb-1">Seravie POS</p>
      <h1 className="font-serif text-4xl text-admin-text mb-1">Ponto de venda</h1>
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
          {posProfile?.segment && (
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors" title="Configurar segmento e widgets do POS">
              <Icon name={POS_SEGMENT_MAP[posProfile.segment]?.icon || 'grid'} className="w-3.5 h-3.5" />
              {POS_SEGMENT_MAP[posProfile.segment]?.label || 'Segmento'}
            </button>
          )}
          {hasWidget('comandas') && <button onClick={() => setShowHolds(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Comandas {holds.length > 0 && `(${holds.length})`}</button>}
          {hasWidget('kds') && <button onClick={() => { window.location.hash = '#admin'; setTimeout(() => notify('Abra o Seravie Cuisine no menu para acompanhar a cozinha', 'info'), 100) }} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Cozinha (KDS)</button>}
          <button onClick={() => setGiftModal('sell')} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Vender vale</button>
          <button onClick={() => setShowDash(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Dashboard</button>
          <button onClick={() => setShowLeads(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Leads</button>
          <button onClick={() => setShowReports(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Relatórios</button>
          <button onClick={() => setShowDay(true)} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Resumo do dia</button>
          <button onClick={() => { setMoveModal('deposit'); setMoveForm({ amount: '', description: '' }) }} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Suprimento</button>
          <button onClick={() => { setMoveModal('withdrawal'); setMoveForm({ amount: '', description: '' }) }} className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Sangria</button>
          <button onClick={() => { setCountedAmount(''); setCloseModal(true) }} className="px-3 py-2 rounded-xl text-xs text-admin-rose border border-admin-rose/30 hover:bg-admin-rose/10 transition-colors">Fechar caixa</button>
        </div>
      </div>

      {/* Barra viva de KPIs — a tela nunca abre "vazia" */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-px bg-white/[0.05] border-b border-white/[0.06]">
        <PosKpi label="Vendas hoje" value={brl(kpis.revenue)} icon="chart" accent="champ" />
        <PosKpi label="Pedidos" value={String(kpis.count)} icon="tag" accent="gold" />
        <PosKpi label="Ticket médio" value={brl(kpis.ticket)} icon="chart" accent="sage" />
        <PosKpi label="Itens" value={String(kpis.itemsSold)} icon="cart" accent="champ" />
        <PosKpi label="Clientes" value={String(kpis.clients)} icon="user" accent="copper" />
        <PosKpi label="Caixa" value={brl(summary.expectedCash)} icon="check" accent="sage" />
        <PosKpi label="Operador" value={(profile?.full_name || user?.email?.split('@')[0] || 'Operador')} icon="user" accent="champ" small />
        <PosKpi label="Tempo médio" value={kpis.avgGap > 0 ? `${kpis.avgGap.toFixed(0)}min` : '—'} icon="clock" accent="gold" />
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Produtos */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou SKU…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
              </div>
              {hasWidget('product_admin') && (
                <button onClick={() => setProductModal({ name: '', price: '', cost: '', stock: '', sku: '', category_id: catFilter || '', image: '' })} className="flex items-center gap-1.5 shrink-0 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-3.5 py-2.5 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo produto</button>
              )}
            </div>
            {hasWidget('barcode') && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Icon name="tag" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-champ/50" />
                  <input data-barcode="1" value={manualCode} onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(manualCode); setManualCode('') } }}
                    placeholder="Código de barras — bipe ou digite…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-admin-sage bg-admin-sage/10 px-2.5 py-2 rounded-lg shrink-0" title="Leitor USB detectado como teclado — bipe para adicionar"><span className="w-1.5 h-1.5 rounded-full bg-admin-sage animate-pulse" />Leitor pronto</span>
              </div>
            )}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <button onClick={() => setCatFilter('')} className={`shrink-0 px-4 py-2 rounded-xl text-xs transition-all border ${!catFilter ? 'bg-admin-champ/15 text-admin-champ border-admin-champ/30' : 'bg-white/[0.03] text-admin-muted/60 border-transparent hover:text-admin-text hover:border-white/10'}`}>
                  <span className="block font-medium">Todos</span>
                  <span className="block text-[10px] opacity-50">{products.length} itens</span>
                </button>
                {categories.map((c) => {
                  const n = products.filter((p) => p.category_id === c.id).length
                  const active = catFilter === c.id
                  return (
                    <button key={c.id} onClick={() => setCatFilter(active ? '' : c.id)} className={`shrink-0 px-4 py-2 rounded-xl text-xs transition-all border ${active ? 'bg-admin-champ/15 text-admin-champ border-admin-champ/30' : 'bg-white/[0.03] text-admin-muted/60 border-transparent hover:text-admin-text hover:border-white/10'}`}>
                      <span className="block font-medium whitespace-nowrap">{c.name}</span>
                      <span className="block text-[10px] opacity-50">{n} {n === 1 ? 'item' : 'itens'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
                <div className="w-16 h-16 rounded-2xl bg-admin-champ/10 flex items-center justify-center mb-4"><Icon name="cart" className="w-7 h-7 text-admin-champ/50" /></div>
                <p className="text-admin-text text-sm mb-1">{products.length === 0 ? 'Seu catálogo está vazio' : 'Nenhum produto encontrado'}</p>
                <p className="text-admin-muted/40 text-xs max-w-xs">{products.length === 0 ? 'Cadastre produtos no Seravie Commerce Hub para vê-los aqui em cartões, com foto, preço e estoque.' : 'Ajuste a busca ou a categoria selecionada.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((p) => {
                  const out = p.stock != null && p.stock <= 0
                  const low = !out && p.stock != null && p.min_stock != null && p.stock <= p.min_stock && p.min_stock > 0
                  const img = (p.images && p.images[0]) || null
                  return (
                    <div key={p.id} className={`group glass rounded-2xl overflow-hidden border transition-all ${out ? 'opacity-50 border-transparent' : 'border-transparent hover:border-admin-champ/30 lift'}`}>
                      <button onClick={() => !out && addToCart(p)} disabled={out} className="text-left w-full">
                        <div className="aspect-[4/3] bg-white/[0.03] relative overflow-hidden">
                          {img
                            ? <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <div className="w-full h-full flex items-center justify-center"><Icon name="cart" className="w-8 h-8 text-admin-champ/20" /></div>}
                          {p.stock != null && (
                            <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur-sm ${out ? 'bg-admin-rose/25 text-admin-rose' : low ? 'bg-admin-gold/25 text-admin-gold' : 'bg-black/40 text-white/80'}`}>{out ? 'sem estoque' : `${p.stock} un`}</span>
                          )}
                          {!out && <span className="absolute inset-0 bg-admin-champ/0 group-hover:bg-admin-champ/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"><span className="w-9 h-9 rounded-full bg-admin-champ text-admin-bg flex items-center justify-center shadow-lg"><Icon name="plus" className="w-4 h-4" /></span></span>}
                        </div>
                        <div className="p-3">
                          <p className="text-admin-text text-sm font-medium line-clamp-2 leading-tight mb-1 min-h-[2.4em]">{p.name}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-admin-gold text-sm font-medium">{brl(p.price)}</p>
                            {p.sku && <p className="text-[10px] text-admin-muted/30">{p.sku}</p>}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 px-3 pb-2.5 -mt-1">
                        <button onClick={() => { setStockModal(p); setStockForm({ quantity: '', notes: '' }) }} className="text-[10px] text-admin-muted/30 hover:text-admin-champ transition-colors">+ estoque</button>
                        {hasWidget('product_admin') && p._src !== 'craft' && (
                          <button onClick={() => setProductModal({ id: p.id, name: p.name, price: p.price, cost: p.cost, stock: p.stock ?? '', sku: p.sku || '', category_id: p.category_id || '', image: (p.images && p.images[0]) || '' })} className="text-[10px] text-admin-muted/30 hover:text-admin-champ transition-colors">editar</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrinho */}
        <div className="w-[380px] shrink-0 flex flex-col bg-admin-side/20">
          {/* Abas de vendas abertas (múltiplas vendas / mesas) */}
          {hasWidget('comandas') && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
              <div className="shrink-0 flex items-center gap-1.5 rounded-lg pl-2.5 pr-2 py-1.5 bg-admin-champ/15 text-admin-champ text-xs">
                <span className="max-w-[90px] truncate">{currentLabel()}</span>
                {subtotal > 0 && <span className="text-admin-champ/60">{brl0(subtotal)}</span>}
              </div>
              {parked.map((p) => (
                <button key={p.id} onClick={() => switchTo(p.id)} className="shrink-0 flex items-center gap-1.5 rounded-lg pl-2.5 pr-2 py-1.5 bg-white/[0.04] text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.07] text-xs transition-colors">
                  <span className="max-w-[90px] truncate">{p.label}</span>
                  <span className="text-admin-gold/70">{brl0(p.total)}</span>
                </button>
              ))}
              <button onClick={newSale} className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-admin-champ hover:bg-admin-champ/10 text-xs" title="Abrir nova venda"><Icon name="plus" className="w-3 h-3" />Nova</button>
              {tables.length > 0 && <button onClick={() => setShowTables(true)} className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.05] text-xs" title="Mapa de mesas"><Icon name="grid" className="w-3 h-3" />Mesas</button>}
            </div>
          )}
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
              <div key={i.product_id} className="glass rounded-xl p-2.5">
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="w-11 h-11 rounded-lg bg-white/[0.04] overflow-hidden shrink-0 flex items-center justify-center">
                    {i.image ? <img src={i.image} alt="" className="w-full h-full object-cover" /> : <Icon name="cart" className="w-4 h-4 text-admin-champ/25" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-admin-text text-sm leading-tight min-w-0">{i.name}</p>
                      <button onClick={() => removeItem(i.product_id)} className="text-admin-muted/40 hover:text-admin-rose shrink-0"><Icon name="x" className="w-3.5 h-3.5" /></button>
                    </div>
                    <p className="text-admin-muted/40 text-[11px]">{brl(i.price)} un</p>
                  </div>
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
                {hasWidget('item_notes') && <input value={i.note || ''} onChange={(e) => setItemNote(i.product_id, e.target.value)} placeholder="+ observação (ex: sem açúcar, leite vegetal…)" className="w-full mt-2 bg-transparent border-t border-white/[0.05] pt-1.5 text-[11px] text-admin-text placeholder-admin-muted/25 outline-none" />}
              </div>
            ))}

            {/* Cross-sell / upsell */}
            {suggestions.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-1.5 px-1 flex items-center gap-1.5"><Icon name="spark" className="w-3 h-3" />Quem levou isso também levou</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {suggestions.map((p) => (
                    <button key={p.id} onClick={() => addToCart(p)} className="shrink-0 w-24 glass-soft rounded-xl p-2 text-left hover:bg-white/[0.05] transition-colors">
                      <div className="w-full h-14 rounded-lg bg-white/[0.04] overflow-hidden mb-1.5 flex items-center justify-center">
                        {(p.images && p.images[0]) ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Icon name="cart" className="w-4 h-4 text-admin-champ/25" />}
                      </div>
                      <p className="text-admin-text text-[11px] leading-tight line-clamp-2">{p.name}</p>
                      <p className="text-admin-gold text-[11px] mt-0.5">{brl(p.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            {hasWidget('coupon') && (appliedCoupon ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-admin-sage">Cupom {appliedCoupon.code} · − {brl(couponValue)}</span>
                <button onClick={() => { setAppliedCoupon(null); setCouponCode('') }} className="text-admin-muted/40 hover:text-admin-rose text-xs">remover</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Cupom" className="flex-1 glass-input rounded-lg px-3 py-1.5 text-sm text-admin-text outline-none uppercase" />
                <button onClick={applyCoupon} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Aplicar</button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <div><span className="text-admin-text font-medium">Total</span>{willEarnPoints > 0 && hasWidget('loyalty') && <span className="block text-[10px] text-admin-champ/60">★ ganha {willEarnPoints} pontos</span>}</div>
              <span className="text-admin-champ text-xl font-medium">{brl(total)}</span>
            </div>

            {/* Pagamentos adicionados */}
            {payments.length > 0 && (
              <div className="space-y-1">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between glass-soft rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-admin-muted/70">{PM_LABEL[p.method]}{p.gift_code ? ` · ${p.gift_code}` : ''}{p.points ? ` · ${p.points} pts` : ''}</span>
                    <div className="flex items-center gap-2"><span className="text-admin-text">{brl(p.amount)}</span><button onClick={() => removePayment(idx)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button></div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-admin-muted/50">{remaining > 0.001 ? 'Falta' : change > 0 ? 'Troco' : 'Pago'}</span>
                  <span className={remaining > 0.001 ? 'text-admin-gold' : 'text-admin-sage'}>{brl(remaining > 0.001 ? remaining : change)}</span>
                </div>
              </div>
            )}

            {/* Formas rápidas — o operador não perde tempo em menus */}
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_METHODS.map((m) => (
                <button key={m.value} onClick={() => { if (total <= 0) return; setPayments((p) => [...p, { method: m.value, amount: remaining > 0.001 ? remaining : total }]) }} disabled={total <= 0} className="flex flex-col items-center gap-1 py-2 rounded-lg bg-white/[0.03] hover:bg-admin-champ/10 text-admin-muted/70 hover:text-admin-champ transition-colors disabled:opacity-30">
                  <Icon name={m.icon} className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{m.label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => setPixQr({ amount: remaining > 0.001 ? remaining : total })} disabled={total <= 0} className="py-1.5 rounded-lg text-[11px] text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-30">PIX QR</button>
              <button onClick={() => setGiftModal('redeem')} disabled={total <= 0} className="py-1.5 rounded-lg text-[11px] text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-30">Vale-presente</button>
              {hasWidget('loyalty') && <button onClick={() => customer?.id ? redeemPoints((loyalty?.points || 0)) : notify('Selecione um cliente para usar pontos', 'error')} disabled={total <= 0 || !(loyalty?.points > 0)} className="py-1.5 rounded-lg text-[11px] text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-30" title={loyalty?.points ? `${loyalty.points} pontos (vale ${brl((loyalty.points) * POINT_VALUE)})` : 'Sem pontos'}>Pontos {loyalty?.points ? `(${loyalty.points})` : ''}</button>}
            </div>

            {/* Adicionar pagamento manual (misto) */}
            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <GlassSelect value={payMethod} onChange={setPayMethod} options={PAYMENT_METHODS} />
              <div className="relative w-28"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-admin-muted/40 text-xs">R$</span>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={remaining > 0 ? remaining.toFixed(2) : '0,00'} className="w-full glass-input rounded-lg pl-7 pr-2 py-2 text-sm text-admin-text outline-none" /></div>
            </div>
            <div className={`grid ${hasWidget('stripe') ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              <button onClick={addPayment} disabled={total <= 0} className="py-2 rounded-lg text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-40">+ pagamento</button>
              {hasWidget('stripe') && <button onClick={chargeStripe} disabled={total <= 0 || busy} className="py-2 rounded-lg text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-40">Cobrar Stripe</button>}
            </div>

            <input value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} placeholder="Observações da venda…" className="w-full glass-input rounded-lg px-3 py-2 text-xs text-admin-text outline-none" />

            <div className="flex gap-2">
              {hasWidget('comandas') && <button onClick={holdSale} disabled={busy || cart.length === 0} className="px-4 py-3 rounded-xl text-sm text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-40">Segurar</button>}
              <button onClick={finalizeSale} disabled={!canFinalize || busy} className="flex-1 btn-gradient rounded-xl py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">Finalizar {cart.length > 0 && `· ${brl(total)}`}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      {showCustomer && <CustomerModal query={custQuery} setQuery={setCustQuery} results={custResults} busy={busy} onPick={(c) => { setCustomer(c); setShowCustomer(false) }} onFree={(name) => { setCustomer({ id: null, name }); setShowCustomer(false) }} onCreate={createCustomer} onClose={() => setShowCustomer(false)} />}

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

      {showConfig && <PosConfigDrawer profile={posProfile} onToggle={toggleWidget} onReSegment={() => { setShowConfig(false); setShowOnboarding(true) }} onClose={() => setShowConfig(false)} />}

      {productModal && <ProductModal initial={productModal} categories={categories} busy={busy} onSave={saveProduct} onDelete={productModal.id ? () => deleteProduct(productModal) : null} onClose={() => setProductModal(null)} />}

      {giftModal && <GiftCardModal mode={giftModal} onRedeem={redeemGiftCard} onSell={sellGiftCard} onClose={() => setGiftModal(null)} />}

      {pixQr && <PixQrModal amount={pixQr.amount} onConfirm={() => { setPayments((p) => [...p, { method: 'pix', amount: pixQr.amount }]); setPixQr(null); notify('PIX confirmado', 'success') }} onClose={() => setPixQr(null)} />}

      {showReports && <ReportsModal tenantName={profile?.tenant_name} notify={notify} onClose={() => setShowReports(false)} />}

      {showTables && <TableMap tables={tables} parked={parked} activeLabel={activeTableLabel} onOpen={openTable} onClose={() => setShowTables(false)} />}

      {showLeads && <LeadsModal notify={notify} onClose={() => setShowLeads(false)} />}

      {showDash && <ProductDashboard products={products} notify={notify} onClose={() => setShowDash(false)} />}
    </div>
  )
}

// ---------- Dashboard de desempenho de produtos ----------
function ProductDashboard({ products, notify, onClose }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(trintaDias)
  const [to, setTo] = useState(hoje)
  const [data, setData] = useState(null) // { top:[], bottom:[], idle:[], totals:{} }

  const load = async () => {
    setData(null)
    let q = supabase.from('orders').select('items, created_at').eq('channel', 'pdv')
    if (from) q = q.gte('created_at', from + 'T00:00:00')
    if (to) q = q.lte('created_at', to + 'T23:59:59')
    const { data: orders } = await q.limit(5000)
    const agg = {}
    ;(orders || []).forEach((o) => (Array.isArray(o.items) ? o.items : []).forEach((it) => {
      const key = (it.product_id && String(it.product_id).length > 8) ? it.product_id : (it.name || '').trim()
      if (!key) return
      const a = agg[key] || (agg[key] = { name: it.name, qty: 0, revenue: 0, product_id: it.product_id })
      a.qty += Number(it.qty) || 0
      a.revenue += Number(it.subtotal ?? (it.qty * it.price)) || 0
    }))
    // enriquece com custo/estoque do catálogo e calcula lucro
    const prodById = Object.fromEntries(products.map((p) => [p.id, p]))
    const rows = Object.entries(agg).map(([key, a]) => {
      const p = prodById[a.product_id] || products.find((x) => (x.name || '').trim() === a.name)
      const cost = p ? Number(p.cost || 0) : 0
      const profit = a.revenue - cost * a.qty
      return { ...a, cost, profit, stock: p?.stock, catalogo: !!p }
    })
    const sold = rows.sort((x, y) => y.qty - x.qty)
    const top = sold.slice(0, 8)
    const bottom = [...rows].filter((r) => r.qty > 0).sort((x, y) => x.qty - y.qty).slice(0, 8)
    // produtos do catálogo que NÃO venderam no período (parados / possível prejuízo em estoque)
    const soldIds = new Set(rows.map((r) => r.product_id).filter(Boolean))
    const soldNames = new Set(rows.map((r) => (r.name || '').trim()))
    const idle = products.filter((p) => p._src !== 'craft' && !soldIds.has(p.id) && !soldNames.has((p.name || '').trim()))
      .map((p) => ({ name: p.name, stock: p.stock, cost: Number(p.cost || 0), parado: (p.stock || 0) * Number(p.cost || 0) }))
      .sort((a, b) => b.parado - a.parado).slice(0, 8)
    const totals = { receita: rows.reduce((s, r) => s + r.revenue, 0), lucro: rows.reduce((s, r) => s + r.profit, 0), itens: rows.reduce((s, r) => s + r.qty, 0), skusVendidos: rows.length, parados: idle.length }
    setData({ top, bottom, idle, totals })
  }
  useEffect(() => { load() }, [from, to])

  const exportPdfReport = () => {
    if (!data) return
    const rows = [
      ...data.top.map((r, i) => ({ ranking: `#${i + 1} mais vendido`, produto: r.name, qtd: r.qty, receita: brl(r.revenue), lucro: brl(r.profit) })),
      ...data.idle.map((r) => ({ ranking: 'parado (sem venda)', produto: r.name, qtd: 0, receita: brl(0), lucro: `estoque ${r.stock ?? '—'}` })),
    ]
    if (!rows.length) return notify('Sem dados no período', 'error')
    exportPdf('Desempenho de produtos — Seravie POS', rows, `${from} a ${to}`)
  }

  const Bar = ({ value, max, tone }) => <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden"><div className={`h-full rounded-full ${tone}`} style={{ width: `${max > 0 ? Math.max(4, value / max * 100) : 0}%` }} /></div>
  const maxTop = data ? Math.max(1, ...data.top.map((r) => r.qty)) : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-4xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div><p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Desempenho</p><h2 className="font-serif text-2xl text-admin-text">Dashboard de produtos</h2></div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div className="flex items-end gap-3 mb-4 flex-wrap">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">De</label><div className="w-36"><GlassDate value={from} onChange={setFrom} /></div></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Até</label><div className="w-36"><GlassDate value={to} onChange={setTo} /></div></div>
          <div className="mx-auto" />
          <button onClick={exportPdfReport} className="btn-gradient rounded-xl px-4 py-2 text-sm font-medium">Exportar PDF</button>
        </div>

        {!data ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p> : (
          <div className="overflow-y-auto -mx-1 px-1 space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Receita</p><p className="text-admin-gold text-xl font-medium">{brl0(data.totals.receita)}</p></div>
              <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Lucro estimado</p><p className={`text-xl font-medium ${data.totals.lucro >= 0 ? 'text-admin-sage' : 'text-admin-rose'}`}>{brl0(data.totals.lucro)}</p></div>
              <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Itens vendidos</p><p className="text-admin-text text-xl font-medium">{data.totals.itens}</p></div>
              <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Produtos parados</p><p className="text-admin-rose text-xl font-medium">{data.totals.parados}</p></div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Mais vendidos */}
              <div className="glass rounded-2xl p-5">
                <p className="text-[11px] uppercase tracking-wider text-admin-sage/80 mb-3 flex items-center gap-1.5"><Icon name="chart" className="w-3.5 h-3.5" />Campeões de venda</p>
                {data.top.length === 0 ? <p className="text-admin-muted/40 text-sm py-4 text-center">Sem vendas no período.</p> : (
                  <div className="space-y-2.5">
                    {data.top.map((r, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-admin-muted/30 text-xs w-4 tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs mb-0.5"><span className="text-admin-text truncate mr-2">{r.name}</span><span className="text-admin-gold shrink-0">{r.qty}× · {brl0(r.revenue)}</span></div>
                          <Bar value={r.qty} max={maxTop} tone="bg-admin-sage/60" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Menos vendidos / parados */}
              <div className="glass rounded-2xl p-5">
                <p className="text-[11px] uppercase tracking-wider text-admin-rose/80 mb-3 flex items-center gap-1.5"><Icon name="x" className="w-3.5 h-3.5" />Parados / possível prejuízo</p>
                {data.idle.length === 0 && data.bottom.length === 0 ? <p className="text-admin-muted/40 text-sm py-4 text-center">Todos os produtos venderam. 🎉</p> : (
                  <div className="space-y-2">
                    {data.idle.length > 0 ? data.idle.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs glass-soft rounded-lg px-3 py-2">
                        <span className="text-admin-text truncate mr-2">{r.name}</span>
                        <span className="text-admin-rose shrink-0">{r.stock ?? 0} em estoque{r.parado > 0 ? ` · ${brl0(r.parado)} parado` : ''}</span>
                      </div>
                    )) : data.bottom.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs glass-soft rounded-lg px-3 py-2">
                        <span className="text-admin-text truncate mr-2">{r.name}</span>
                        <span className="text-admin-muted/50 shrink-0">só {r.qty}× vendido(s)</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-admin-muted/40 text-[11px] mt-3">"Parado" = produto do catálogo sem nenhuma venda no período. O valor em estoque × custo indica capital parado.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Aba de leads compradores (remarketing) ----------
function LeadsModal({ notify, onClose }) {
  const [leads, setLeads] = useState(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    (async () => {
      // pedidos do PDV com cliente vinculado
      const { data: orders } = await supabase.from('orders').select('contact_id, total, created_at').eq('channel', 'pdv').not('contact_id', 'is', null).limit(4000)
      const byC = {}
      ;(orders || []).forEach((o) => { const a = byC[o.contact_id] || (byC[o.contact_id] = { compras: 0, gasto: 0, ultima: null }); a.compras += 1; a.gasto += Number(o.total) || 0; if (!a.ultima || o.created_at > a.ultima) a.ultima = o.created_at })
      const ids = Object.keys(byC)
      if (!ids.length) { setLeads([]); return }
      const { data: cts } = await supabase.from('contacts').select('id, name, phone, email, birthdate, notes, metadata, ltv').in('id', ids)
      const rows = (cts || []).map((c) => ({ ...c, ...byC[c.id] })).sort((a, b) => (b.ultima || '').localeCompare(a.ultima || ''))
      setLeads(rows)
    })()
  }, [])
  const filtered = (leads || []).filter((l) => !q || `${l.name} ${l.phone || ''} ${l.email || ''}`.toLowerCase().includes(q.toLowerCase()))
  const exportRows = () => filtered.map((l) => ({
    nome: l.name, telefone: l.phone || '', email: l.email || '', endereco: l.metadata?.address || '',
    aniversario: l.birthdate ? new Date(l.birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : '',
    compras: l.compras, gasto: brl(l.gasto), ultima_compra: l.ultima ? new Date(l.ultima).toLocaleDateString('pt-BR') : '',
    observacao: l.notes || '',
  }))
  const genPdf = () => { const rows = exportRows(); if (!rows.length) return notify('Nenhum lead para exportar', 'error'); exportPdf('Leads compradores — Seravie POS', rows, 'Base de remarketing') }
  const genCsv = () => { const rows = exportRows(); if (!rows.length) return notify('Nenhum lead para exportar', 'error'); exportCsv('leads-compradores.csv', rows) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div><p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Remarketing</p><h2 className="font-serif text-2xl text-admin-text">Leads compradores</h2></div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <p className="text-admin-muted/40 text-xs mb-4">Clientes que já compraram no PDV. Use para campanhas, aniversários e ofertas.</p>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou e-mail…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2 text-sm text-admin-text outline-none" />
          </div>
          <button onClick={genPdf} className="shrink-0 btn-gradient rounded-xl px-4 py-2 text-sm font-medium">PDF</button>
          <button onClick={genCsv} className="shrink-0 px-3 py-2 rounded-xl text-sm text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">CSV</button>
        </div>
        <div className="overflow-y-auto -mx-1 px-1">
          {leads === null ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando leads…</p>
            : filtered.length === 0 ? <p className="text-admin-muted/40 text-sm py-10 text-center">{(leads || []).length === 0 ? 'Ainda não há clientes cadastrados em vendas. Cadastre o comprador ao finalizar a venda.' : 'Nenhum lead encontrado.'}</p>
            : (
              <div className="space-y-2">
                {filtered.map((l) => (
                  <div key={l.id} className="glass-soft rounded-xl p-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-admin-champ/10 flex items-center justify-center text-admin-champ shrink-0 text-sm font-medium">{(l.name || '?')[0].toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-admin-text text-sm truncate">{l.name}</p>
                      <p className="text-admin-muted/50 text-[11px] truncate">{[l.phone, l.email].filter(Boolean).join(' · ') || 'sem contato'}{l.birthdate ? ` · 🎂 ${new Date(l.birthdate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-admin-gold text-sm">{brl(l.gasto)}</p>
                      <p className="text-admin-muted/40 text-[10px]">{l.compras} compra(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
        {filtered.length > 0 && <p className="text-admin-muted/40 text-[11px] mt-3">{filtered.length} lead(s)</p>}
      </div>
    </div>
  )
}

// ---------- Mapa visual de mesas / comandas ----------
function TableMap({ tables, parked, activeLabel, onOpen, onClose }) {
  const areas = [...new Set(tables.map((t) => t.area || 'Salão'))]
  const saleFor = (label) => parked.find((p) => p.tableLabel === label)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div><p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Comandas</p><h2 className="font-serif text-2xl text-admin-text">Mapa de mesas</h2></div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        {tables.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Nenhuma mesa cadastrada. Configure em Operações → Mesas.</p> : areas.map((area) => (
          <div key={area} className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">{area}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {tables.filter((t) => (t.area || 'Salão') === area).map((t) => {
                const sale = saleFor(t.label)
                const active = activeLabel === t.label
                const occupied = !!sale
                return (
                  <button key={t.id} onClick={() => onOpen(t)} className={`rounded-2xl p-3 text-left border transition-all ${active ? 'bg-admin-champ/20 border-admin-champ/50' : occupied ? 'bg-admin-gold/10 border-admin-gold/30 hover:border-admin-gold/50' : 'glass-soft border-transparent hover:border-admin-champ/30'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${occupied ? 'text-admin-gold' : 'text-admin-text'}`}>{t.label}</span>
                      <span className={`w-2 h-2 rounded-full ${occupied ? 'bg-admin-gold' : 'bg-admin-sage'}`} />
                    </div>
                    {t.seats > 0 && <p className="text-admin-muted/40 text-[10px]">{t.seats} lugares</p>}
                    <p className={`text-[11px] mt-1 ${occupied ? 'text-admin-gold' : 'text-admin-sage'}`}>{occupied ? brl(sale.total) : 'Livre'}</p>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <p className="text-admin-muted/40 text-[11px] mt-2">Toque numa mesa livre para abrir a comanda, ou numa ocupada para retomar. A venda ativa fica destacada.</p>
      </div>
    </div>
  )
}

// ---------- Central de relatórios (PDF/CSV com filtros) ----------
const REPORT_TYPES = [
  { key: 'vendas', label: 'Vendas detalhadas', desc: 'Cada venda: nº, data, cliente, forma, total' },
  { key: 'produtos', label: 'Produtos mais vendidos', desc: 'Ranking por quantidade e receita' },
  { key: 'formas', label: 'Por forma de pagamento', desc: 'Total recebido por forma' },
  { key: 'dias', label: 'Resumo por dia', desc: 'Vendas, receita e ticket por dia' },
]
// Calendário de vendas (glassmorphism) — mostra os dias com venda e seleciona o período
const fmtYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function SalesCalendar({ from, to, onPick }) {
  const [view, setView] = useState(from ? new Date(from + 'T12:00:00') : new Date())
  const [stats, setStats] = useState({})
  const y = view.getFullYear(), m = view.getMonth()
  useEffect(() => {
    const start = fmtYMD(new Date(y, m, 1)), end = fmtYMD(new Date(y, m + 1, 0))
    supabase.from('orders').select('total,created_at').eq('channel', 'pdv')
      .gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59')
      .then(({ data }) => {
        const agg = {}; (data || []).forEach((o) => { const d = String(o.created_at).slice(0, 10); const a = agg[d] || (agg[d] = { count: 0, revenue: 0 }); a.count += 1; a.revenue += Number(o.total) || 0 })
        setStats(agg)
      })
  }, [y, m])
  const firstDay = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1))]
  const maxRev = Math.max(1, ...Object.values(stats).map((s) => s.revenue))
  const monthTotal = Object.values(stats).reduce((s, x) => s + x.revenue, 0)
  const monthCount = Object.values(stats).reduce((s, x) => s + x.count, 0)
  const clickDay = (d) => { const ds = fmtYMD(d); if (from && to && from === to && ds >= from) onPick(from, ds); else onPick(ds, ds) }
  const setWholeMonth = () => onPick(fmtYMD(new Date(y, m, 1)), fmtYMD(new Date(y, m + 1, 0)))

  return (
    <div className="glass-soft rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={setWholeMonth} className="text-admin-champ text-xs font-medium capitalize hover:underline" title="Selecionar o mês inteiro">{view.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</button>
        <div className="flex gap-1">
          <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center text-sm">‹</button>
          <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center text-sm">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="text-center text-[9px] text-admin-muted/40 py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const ds = fmtYMD(d)
          const st = stats[ds]
          const inRange = from && to && ds >= from && ds <= to
          const edge = ds === from || ds === to
          const intensity = st ? 0.25 + 0.55 * (st.revenue / maxRev) : 0
          return (
            <button key={i} type="button" onClick={() => clickDay(d)} title={st ? `${st.count} venda(s) · ${brl(st.revenue)}` : 'Sem vendas'}
              className={`relative h-9 rounded-lg text-[11px] transition-colors flex flex-col items-center justify-center ${edge ? 'bg-admin-champ text-admin-bg font-medium' : inRange ? 'bg-admin-champ/20 text-admin-text' : 'text-admin-text hover:bg-white/[0.06]'}`}
              style={!edge && !inRange && st ? { background: `rgba(184,156,97,${intensity})` } : undefined}>
              <span>{d.getDate()}</span>
              {st && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${edge ? 'bg-admin-bg' : 'bg-admin-champ'}`} />}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06] text-[11px]">
        <span className="text-admin-muted/50">{monthCount} venda(s) no mês</span>
        <span className="text-admin-champ">{brl(monthTotal)}</span>
      </div>
    </div>
  )
}

function ReportsModal({ tenantName, notify, onClose }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [type, setType] = useState('vendas')
  const [from, setFrom] = useState(trintaDias)
  const [to, setTo] = useState(hoje)
  const [method, setMethod] = useState('')
  const [running, setRunning] = useState(false)
  const inputCls = 'w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none'

  const buildRows = async () => {
    let q = supabase.from('orders').select('number,total,items,payments,payment_method,created_at,customer_name').eq('channel', 'pdv')
    if (from) q = q.gte('created_at', from + 'T00:00:00')
    if (to) q = q.lte('created_at', to + 'T23:59:59')
    const { data } = await q.order('created_at')
    let orders = data || []
    if (method) orders = orders.filter((o) => o.payment_method === method || (o.payments || []).some((p) => p.method === method))
    if (type === 'vendas') {
      return orders.map((o) => ({
        numero: '#' + o.number, data: new Date(o.created_at).toLocaleString('pt-BR'), cliente: o.customer_name || 'Consumidor final',
        forma: (o.payments || []).map((p) => PM_LABEL[p.method] || p.method).join(' + ') || (PM_LABEL[o.payment_method] || o.payment_method || '—'),
        total: brl(o.total),
      }))
    }
    if (type === 'produtos') {
      const agg = {}
      orders.forEach((o) => (Array.isArray(o.items) ? o.items : []).forEach((it) => {
        const k = (it.name || '').trim(); if (!k) return
        const a = agg[k] || (agg[k] = { produto: k, qtd: 0, receita: 0 })
        a.qtd += Number(it.qty) || 0; a.receita += Number(it.subtotal ?? (it.qty * it.price)) || 0
      }))
      return Object.values(agg).sort((x, y) => y.receita - x.receita).map((r) => ({ produto: r.produto, qtd: r.qtd, receita: brl(r.receita) }))
    }
    if (type === 'formas') {
      const agg = {}
      orders.forEach((o) => {
        const pays = (o.payments && o.payments.length) ? o.payments : [{ method: o.payment_method, amount: o.total }]
        pays.forEach((p) => { const k = PM_LABEL[p.method] || p.method || '—'; const a = agg[k] || (agg[k] = { forma: k, qtd: 0, total: 0 }); a.qtd += 1; a.total += Number(p.amount) || 0 })
      })
      return Object.values(agg).sort((x, y) => y.total - x.total).map((r) => ({ forma: r.forma, transacoes: r.qtd, total: brl(r.total) }))
    }
    // dias
    const agg = {}
    orders.forEach((o) => { const d = new Date(o.created_at).toLocaleDateString('pt-BR'); const a = agg[d] || (agg[d] = { data: d, vendas: 0, receita: 0 }); a.vendas += 1; a.receita += Number(o.total) || 0 })
    return Object.values(agg).map((r) => ({ data: r.data, vendas: r.vendas, receita: brl(r.receita), ticket: brl(r.vendas ? r.receita / r.vendas : 0) }))
  }

  const generate = async (format) => {
    setRunning(true)
    const rows = await buildRows()
    setRunning(false)
    if (!rows.length) { notify('Nenhum dado no período/filtro selecionado', 'error'); return }
    const title = REPORT_TYPES.find((t) => t.key === type)?.label || 'Relatório'
    const sub = `Seravie POS · ${from} a ${to}${method ? ' · ' + (PM_LABEL[method] || method) : ''}`
    if (format === 'pdf') exportPdf(title, rows, sub)
    else exportCsv(`${type}-${from}-a-${to}.csv`, rows)
  }

  return (
    <Modal title="Relatórios do Seravie POS" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo de relatório</label>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_TYPES.map((t) => (
              <button key={t.key} onClick={() => setType(t.key)} className={`text-left rounded-xl px-3 py-2.5 border transition-colors ${type === t.key ? 'bg-admin-champ/15 border-admin-champ/30' : 'glass-soft border-transparent hover:bg-white/[0.04]'}`}>
                <p className="text-admin-text text-xs font-medium">{t.label}</p>
                <p className="text-admin-muted/40 text-[10px] leading-tight">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Período — toque num dia ou arraste pelo calendário</label>
          <SalesCalendar from={from} to={to} onPick={(f, t) => { setFrom(f); setTo(t) }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">De</label>
            <GlassDate value={from} onChange={(v) => setFrom(v)} /></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Até</label>
            <GlassDate value={to} onChange={(v) => setTo(v)} /></div>
        </div>
        <div>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Forma de pagamento (opcional)</label>
          <GlassSelect value={method} onChange={setMethod} options={[{ value: '', label: 'Todas as formas' }, ...PAYMENT_METHODS]} />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={() => generate('pdf')} disabled={running} className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">{running ? 'Gerando…' : 'Gerar PDF'}</button>
        <button onClick={() => generate('csv')} disabled={running} className="px-4 py-2.5 rounded-xl text-sm text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors disabled:opacity-50">CSV</button>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-admin-muted">Fechar</button>
      </div>
    </Modal>
  )
}

// ---------- Vale-presente: vender / resgatar ----------
function GiftCardModal({ mode, onRedeem, onSell, onClose }) {
  const [code, setCode] = useState('')
  const [amount, setAmount] = useState('')
  const sell = mode === 'sell'
  return (
    <Modal title={sell ? 'Vender vale-presente' : 'Resgatar vale-presente'} onClose={onClose}>
      {sell ? (
        <>
          <p className="text-admin-muted/50 text-xs mb-4">Escolha o valor. Um código único será gerado ao finalizar a venda e poderá ser usado como pagamento em compras futuras.</p>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor do vale (R$)</label>
          <div className="relative mb-3"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
            <input autoFocus type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-lg text-admin-text outline-none" /></div>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {[50, 100, 150, 200, 300].map((v) => <button key={v} onClick={() => setAmount(String(v))} className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] text-admin-muted/70 hover:text-admin-champ hover:bg-admin-champ/10">R$ {v}</button>)}
          </div>
          <button onClick={() => onSell(amount)} className="w-full btn-gradient rounded-xl py-2.5 text-sm font-medium">Adicionar à venda</button>
        </>
      ) : (
        <>
          <p className="text-admin-muted/50 text-xs mb-4">Digite o código do vale-presente. O saldo disponível será aplicado como pagamento.</p>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Código do vale</label>
          <input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') onRedeem(code) }} placeholder="GIFT-XXXXXXXX" className="w-full glass-input rounded-xl px-4 py-3 text-sm text-admin-text outline-none uppercase mb-5" />
          <button onClick={() => onRedeem(code)} className="w-full btn-gradient rounded-xl py-2.5 text-sm font-medium">Aplicar vale</button>
        </>
      )}
    </Modal>
  )
}

// ---------- PIX com QR na tela ----------
function PixQrModal({ amount, onConfirm, onClose }) {
  // QR de demonstração com o valor; integração com PSP de PIX pluga aqui.
  const payload = `PIX|SERAVIE|${amount.toFixed(2)}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`
  return (
    <Modal title="Pagamento via PIX" onClose={onClose}>
      <p className="text-admin-muted/60 text-sm mb-4 text-center">Aponte a câmera do cliente para o QR e confirme o recebimento de <span className="text-admin-champ font-medium">{brl(amount)}</span>.</p>
      <div className="flex justify-center mb-4"><img src={qrUrl} alt="QR PIX" className="rounded-xl bg-white p-2" width={200} height={200} /></div>
      <p className="text-admin-muted/40 text-[11px] text-center mb-5">Para conciliação automática, conecte um provedor de PIX (Mercado Pago, PagSeguro, Gerencianet) nas configurações. Por ora, confirme manualmente após o cliente pagar.</p>
      <div className="flex gap-3">
        <button onClick={onConfirm} className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-medium">Confirmar recebimento</button>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
      </div>
    </Modal>
  )
}

// ---------- Onboarding: qual é o seu segmento? ----------
function PosOnboarding({ onPick }) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <p className="text-[11px] tracking-[0.2em] uppercase text-admin-champ/70 mb-2">Seravie POS</p>
          <h1 className="font-serif text-4xl text-admin-text mb-2">Qual é o seu segmento?</h1>
          <p className="text-admin-muted/60 text-sm max-w-lg mx-auto">O PDV se adapta ao seu negócio: ligamos só os recursos que fazem sentido para você. Dá para mudar depois a qualquer momento.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {POS_SEGMENTS.map((s) => (
            <button key={s.key} onClick={() => onPick(s.key)} className="glass rounded-2xl p-4 text-left hover:border-admin-champ/30 border border-transparent transition-all lift group">
              <span className="w-10 h-10 rounded-xl bg-admin-champ/10 flex items-center justify-center text-admin-champ mb-3 group-hover:bg-admin-champ/20 transition-colors"><Icon name={s.icon} className="w-5 h-5" /></span>
              <p className="text-admin-text text-sm font-medium leading-tight">{s.label}</p>
              <p className="text-admin-muted/40 text-[10px] mt-0.5">{POS_PROFILES[s.profile]?.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Configuração: widgets liga/desliga ----------
function PosConfigDrawer({ profile, onToggle, onReSegment, onClose }) {
  const groups = [...new Set(POS_WIDGETS.map((w) => w.group))]
  const enabled = profile?.widgets || []
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full glass-pop overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Configurar POS</p>
            <h2 className="font-serif text-2xl text-admin-text">Widgets do módulo</h2>
          </div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <button onClick={onReSegment} className="w-full glass-soft rounded-xl px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] mb-5 mt-3">
          <div className="flex items-center gap-2.5">
            <Icon name={POS_SEGMENT_MAP[profile?.segment]?.icon || 'grid'} className="w-4 h-4 text-admin-champ" />
            <div className="text-left"><p className="text-admin-text text-sm">{POS_SEGMENT_MAP[profile?.segment]?.label || 'Segmento'}</p><p className="text-admin-muted/40 text-[11px]">Trocar de segmento</p></div>
          </div>
          <Icon name="spark" className="w-4 h-4 text-admin-champ/50" />
        </button>
        {groups.map((g) => (
          <div key={g} className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">{g}</p>
            <div className="space-y-2">
              {POS_WIDGETS.filter((w) => w.group === g).map((w) => {
                const on = enabled.includes(w.key)
                return (
                  <button key={w.key} onClick={() => onToggle(w.key)} className="w-full glass-soft rounded-xl px-3.5 py-3 flex items-center gap-3 hover:bg-white/[0.04] text-left">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/40'}`}><Icon name={w.icon} className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0"><p className="text-admin-text text-sm">{w.label}</p><p className="text-admin-muted/40 text-[11px] leading-tight">{w.desc}</p></div>
                    <span className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${on ? 'bg-admin-champ/60' : 'bg-white/[0.08]'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} /></span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <p className="text-admin-muted/40 text-[11px]">Venda, caixa, cliente, produtos e pagamento são o núcleo e estão sempre ativos.</p>
      </div>
    </div>
  )
}

// ---------- Cadastro rápido de produto ----------
function ProductModal({ initial, categories, busy, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [upErr, setUpErr] = useState('')
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const onPickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUpErr('')
    const res = await uploadTo(file, { bucket: 'media', folder: 'produtos', accept: 'image', maxMB: 8 })
    setUploading(false)
    if (res.error) { setUpErr(res.error); return }
    set({ image: res.url })
  }
  return (
    <Modal title={f.id ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label>
          <input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} placeholder="Ex: Café Especial" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Preço (R$)</label>
            <input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} className={inputCls} placeholder="0,00" /></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Custo (R$)</label>
            <input type="number" value={f.cost} onChange={(e) => set({ cost: e.target.value })} className={inputCls} placeholder="0,00" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Estoque</label>
            <input type="number" value={f.stock} onChange={(e) => set({ stock: e.target.value })} className={inputCls} placeholder="deixe vazio p/ ilimitado" /></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">SKU / código</label>
            <input value={f.sku} onChange={(e) => set({ sku: e.target.value })} className={inputCls} placeholder="opcional" /></div>
        </div>
        <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label>
          <GlassSelect value={f.category_id || ''} onChange={(v) => set({ category_id: v })} options={[{ value: '', label: 'Sem categoria' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} /></div>
        <div>
          <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Foto do produto</label>
          {f.image
            ? (
              <div className="relative rounded-xl overflow-hidden group">
                <img src={f.image} alt="" className="w-full h-36 object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                <button onClick={() => set({ image: '' })} className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-admin-rose/70" title="Remover foto"><Icon name="x" className="w-4 h-4" /></button>
              </div>
            )
            : (
              <label className={`flex flex-col items-center justify-center gap-1.5 h-28 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-admin-champ/40 hover:bg-white/[0.02] transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <Icon name="plus" className="w-5 h-5 text-admin-champ/60" />
                <span className="text-admin-muted/50 text-xs">{uploading ? 'Enviando…' : 'Clique para enviar uma foto (JPG/PNG)'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              </label>
            )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-admin-muted/30 text-[10px]">ou cole uma URL</span>
            <input value={f.image || ''} onChange={(e) => set({ image: e.target.value })} className="flex-1 glass-input rounded-lg px-3 py-1.5 text-xs text-admin-text outline-none" placeholder="https://…" />
          </div>
          {upErr && <p className="text-admin-rose text-[11px] mt-1">{upErr}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button onClick={() => onSave(f)} disabled={busy} className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">{f.id ? 'Salvar' : 'Cadastrar'}</button>
        {onDelete && <button onClick={onDelete} disabled={busy} className="px-4 py-2.5 rounded-xl text-sm text-admin-rose border border-admin-rose/30 hover:bg-admin-rose/10 transition-colors">Excluir</button>}
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
      </div>
    </Modal>
  )
}

// ---------- Componentes auxiliares ----------
function PosKpi({ label, value, icon, accent, small }) {
  const tone = { champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage', copper: 'text-admin-copper' }[accent] || 'text-admin-champ'
  return (
    <div className="bg-admin-side/40 px-3 py-2.5 flex items-center gap-2.5 min-w-0">
      <div className={`w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${tone}`}><Icon name={icon} className="w-3.5 h-3.5" /></div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-admin-muted/40 truncate">{label}</p>
        <p className={`${small ? 'text-xs' : 'text-sm'} font-medium text-admin-text tabular-nums truncate leading-tight`}>{value}</p>
      </div>
    </div>
  )
}
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

function CustomerModal({ query, setQuery, results, onPick, onFree, onCreate, busy, onClose }) {
  const [tab, setTab] = useState('search') // search | new
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', birthdate: '', notes: '' })
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <Modal title="Cliente da venda" onClose={onClose}>
      <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl mb-4">
        {[['search', 'Buscar'], ['new', 'Cadastrar novo']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{l}</button>
        ))}
      </div>
      {tab === 'search' ? (
        <>
          <div className="relative mb-3">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none" />
          </div>
          <div className="space-y-1 mb-3 max-h-56 overflow-y-auto">
            {results.map((c) => (
              <button key={c.id} onClick={() => onPick({ id: c.id, name: c.name })} className="w-full text-left px-3 py-2 rounded-lg text-sm text-admin-text hover:bg-white/[0.05] transition-colors">{c.name}</button>
            ))}
            {query && results.length === 0 && (
              <button onClick={() => { setF((x) => ({ ...x, name: query })); setTab('new') }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-admin-champ hover:bg-white/[0.05] transition-colors">Cadastrar "{query}" como novo cliente →</button>
            )}
          </div>
          <button onClick={() => onFree(null)} className="text-admin-muted/50 hover:text-admin-text text-xs transition-colors">Consumidor final (sem cliente)</button>
        </>
      ) : (
        <>
          <p className="text-admin-muted/40 text-xs mb-4">Cadastre o comprador para remarketing. Só o nome é obrigatório.</p>
          <div className="space-y-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label>
              <input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} placeholder="Nome do cliente" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Telefone</label>
                <input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} placeholder="(00) 00000-0000" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">E-mail</label>
                <input value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} placeholder="email@exemplo.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Endereço</label>
                <input value={f.address} onChange={(e) => set({ address: e.target.value })} className={inputCls} placeholder="Rua, nº, bairro" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Aniversário</label>
                <GlassDate value={f.birthdate} onChange={(v) => set({ birthdate: v })} /></div>
            </div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Observação</label>
              <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} placeholder="Preferências, aniversário, como conheceu…" /></div>
          </div>
          <button onClick={() => onCreate(f)} disabled={busy} className="w-full btn-gradient rounded-xl py-2.5 text-sm font-medium mt-5 disabled:opacity-50">{busy ? 'Salvando…' : 'Cadastrar e usar na venda'}</button>
        </>
      )}
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
