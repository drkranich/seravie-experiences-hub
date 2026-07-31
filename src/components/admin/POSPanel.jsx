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
]
const PM_LABEL = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]))
const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2)}`

export function POSPanel({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()

  const [session, setSession] = useState(null)
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState('dinheiro')
  const [received, setReceived] = useState('')

  const [openingAmount, setOpeningAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const [moveModal, setMoveModal] = useState(null) // 'deposit' | 'withdrawal'
  const [moveForm, setMoveForm] = useState({ amount: '', description: '' })
  const [closeModal, setCloseModal] = useState(false)
  const [countedAmount, setCountedAmount] = useState('')
  const [lastSale, setLastSale] = useState(null)

  const tenantId = profile?.tenant_id

  const loadSession = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cash_sessions').select('*').eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle()
    setSession(data || null)
    if (data) {
      const { data: mv } = await supabase
        .from('cash_movements').select('*').eq('session_id', data.id)
        .order('created_at', { ascending: false })
      setMovements(mv || [])
    } else {
      setMovements([])
    }
    setLoading(false)
  }

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('status', 'active').order('name')
    setProducts(data || [])
  }

  useEffect(() => { loadSession(); loadProducts() }, [])

  // ---------- Caixa ----------
  const openCash = async () => {
    setBusy(true)
    const { data, error } = await supabase.from('cash_sessions').insert({
      tenant_id: tenantId,
      unit_id: profile?.unit_id || null,
      opening_amount: parseFloat(openingAmount) || 0,
      opened_by: user?.id || null,
      status: 'open',
    }).select().single()
    setBusy(false)
    if (error) { notify('Erro ao abrir caixa', 'error'); return }
    setOpeningAmount(''); setSession(data); setMovements([])
    notify('Caixa aberto', 'success')
  }

  const saveMovement = async () => {
    const amount = parseFloat(moveForm.amount)
    if (!amount || amount <= 0) { notify('Informe um valor', 'error'); return }
    setBusy(true)
    const { data, error } = await supabase.from('cash_movements').insert({
      tenant_id: tenantId,
      session_id: session.id,
      type: moveModal,
      amount,
      payment_method: 'dinheiro',
      description: moveForm.description || (moveModal === 'deposit' ? 'Suprimento' : 'Sangria'),
      created_by: user?.id || null,
    }).select().single()
    setBusy(false)
    if (error) { notify('Erro no movimento', 'error'); return }
    setMovements((m) => [data, ...m])
    setMoveModal(null); setMoveForm({ amount: '', description: '' })
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
    const expectedCash = (Number(session?.opening_amount) || 0) + cashSales + deposits - withdrawals
    return { salesTotal, salesCount, cashSales, deposits, withdrawals, byMethod, expectedCash }
  }, [movements, session])

  const closeCash = async () => {
    setBusy(true)
    const counted = parseFloat(countedAmount) || 0
    const expected = summary.expectedCash
    const { error } = await supabase.from('cash_sessions').update({
      status: 'closed',
      closing_amount: counted,
      expected_amount: expected,
      difference: counted - expected,
      closed_by: user?.id || null,
      closed_at: new Date().toISOString(),
    }).eq('id', session.id)
    setBusy(false)
    if (error) { notify('Erro ao fechar caixa', 'error'); return }
    setCloseModal(false); setCountedAmount(''); setCart([]); setLastSale(null)
    notify('Caixa fechado', 'success')
    loadSession()
  }

  // ---------- Carrinho ----------
  const addToCart = (p) => {
    setCart((c) => {
      const found = c.find((i) => i.product_id === p.id)
      if (found) {
        if (p.stock != null && found.qty >= p.stock) { notify('Estoque insuficiente', 'error'); return c }
        return c.map((i) => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), qty: 1, stock: p.stock }]
    })
  }
  const setQty = (id, qty) => setCart((c) => c.flatMap((i) => {
    if (i.product_id !== id) return [i]
    const q = Math.max(0, qty)
    if (q === 0) return []
    if (i.stock != null && q > i.stock) { notify('Estoque insuficiente', 'error'); return [{ ...i, qty: i.stock }] }
    return [{ ...i, qty: q }]
  }))
  const removeItem = (id) => setCart((c) => c.filter((i) => i.product_id !== id))

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountValue = Math.min(parseFloat(discount) || 0, subtotal)
  const total = Math.max(0, subtotal - discountValue)
  const receivedValue = parseFloat(received) || 0
  const change = payment === 'dinheiro' ? Math.max(0, receivedValue - total) : 0
  const canFinalize = cart.length > 0 && (payment !== 'dinheiro' || receivedValue >= total)

  const finalizeSale = async () => {
    if (!canFinalize) { notify('Verifique itens e pagamento', 'error'); return }
    setBusy(true)
    const items = cart.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.qty, subtotal: i.price * i.qty }))
    const { data: order, error } = await supabase.from('orders').insert({
      tenant_id: tenantId,
      unit_id: profile?.unit_id || null,
      status: 'delivered',
      payment_status: 'paid',
      payment_method: payment,
      total,
      discount: discountValue,
      items,
      paid_amount: payment === 'dinheiro' ? receivedValue : total,
      change_amount: change,
      cash_session_id: session.id,
      created_by: user?.id || null,
    }).select().single()
    if (error || !order) { setBusy(false); notify('Erro ao registrar venda', 'error'); return }

    const { data: mv } = await supabase.from('cash_movements').insert({
      tenant_id: tenantId,
      session_id: session.id,
      type: 'sale',
      amount: total,
      payment_method: payment,
      description: `Venda #${order.number}`,
      reference_id: order.id,
      created_by: user?.id || null,
    }).select().single()

    await supabase.from('financial_entries').insert({
      tenant_id: tenantId,
      unit_id: profile?.unit_id || null,
      type: 'revenue',
      category: 'venda',
      description: `Venda PDV #${order.number}`,
      amount: total,
      date: new Date().toISOString().slice(0, 10),
      payment_method: payment,
      reference_id: order.id,
      reference_type: 'order',
      created_by: user?.id || null,
    })

    // Baixa de estoque
    for (const i of cart) {
      if (i.stock != null) {
        await supabase.from('products').update({ stock: Math.max(0, i.stock - i.qty) }).eq('id', i.product_id)
      }
    }

    setBusy(false)
    if (mv) setMovements((m) => [mv, ...m])
    setLastSale({ number: order.number, total, payment, change, items })
    setCart([]); setDiscount(''); setReceived('')
    loadProducts()
    notify(`Venda #${order.number} registrada`, 'success')
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()))

  // ---------- Render ----------
  if (loading) return <div className="p-10 text-admin-muted/40 text-sm">Carregando caixa…</div>

  // Caixa fechado → abertura
  if (!session) return (
    <div className="p-6 lg:p-10 max-w-md">
      <h1 className="font-serif text-4xl text-admin-text mb-1">PDV</h1>
      <p className="text-admin-muted/60 text-sm mb-8">Nenhum caixa aberto. Abra o caixa para iniciar as vendas.</p>
      <div className="glass rounded-2xl p-7">
        <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor de abertura (troco inicial)</label>
        <div className="relative mb-5">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
          <input type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0,00"
            className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-lg text-admin-text outline-none" />
        </div>
        <button onClick={openCash} disabled={busy}
          className="w-full btn-gradient rounded-xl py-3 text-sm font-medium disabled:opacity-50">Abrir caixa</button>
      </div>
    </div>
  )

  // Caixa aberto → PDV
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Barra do caixa */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/[0.06] bg-admin-side/30 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-admin-sage animate-pulse" />
          <div>
            <p className="text-admin-text text-sm font-medium">Caixa aberto</p>
            <p className="text-admin-muted/40 text-[11px]">
              {summary.salesCount} vendas · {brl(summary.salesTotal)} · em caixa {brl(summary.expectedCash)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMoveModal('deposit'); setMoveForm({ amount: '', description: '' }) }}
            className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Suprimento</button>
          <button onClick={() => { setMoveModal('withdrawal'); setMoveForm({ amount: '', description: '' }) }}
            className="px-3 py-2 rounded-xl text-xs text-admin-champ bg-admin-champ/10 hover:bg-admin-champ/20 transition-colors">Sangria</button>
          <button onClick={() => { setCountedAmount(''); setCloseModal(true) }}
            className="px-3 py-2 rounded-xl text-xs text-admin-rose border border-admin-rose/30 hover:bg-admin-rose/10 transition-colors">Fechar caixa</button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Produtos */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou SKU…"
                className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum produto ativo. Cadastre em Catálogo.</p></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((p) => {
                  const out = p.stock != null && p.stock <= 0
                  return (
                    <button key={p.id} onClick={() => !out && addToCart(p)} disabled={out}
                      className={`glass rounded-xl p-4 text-left transition-all ${out ? 'opacity-40 cursor-not-allowed' : 'hover:border-admin-champ/30 border border-transparent lift'}`}>
                      <p className="text-admin-text text-sm font-medium line-clamp-2 mb-2">{p.name}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-admin-gold text-sm font-medium">{brl(p.price)}</p>
                        {p.stock != null && <p className="text-admin-muted/40 text-[11px]">{out ? 'sem estoque' : `${p.stock} un`}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrinho */}
        <div className="w-[360px] shrink-0 flex flex-col bg-admin-side/20">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-admin-text font-medium text-sm">Carrinho</p>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-admin-muted/50 hover:text-admin-rose text-[11px] transition-colors">limpar</button>}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 && !lastSale && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <Icon name="tag" className="w-8 h-8 text-admin-champ/20 mb-2" />
                <p className="text-admin-muted/40 text-sm">Toque nos produtos para adicionar</p>
              </div>
            )}
            {cart.length === 0 && lastSale && (
              <div className="glass rounded-xl p-4 text-center">
                <Icon name="check" className="w-7 h-7 text-admin-sage mx-auto mb-2" />
                <p className="text-admin-text text-sm font-medium">Venda #{lastSale.number} concluída</p>
                <p className="text-admin-gold text-sm mt-1">{brl(lastSale.total)} · {PM_LABEL[lastSale.payment]}</p>
                {lastSale.payment === 'dinheiro' && lastSale.change > 0 && <p className="text-admin-muted/50 text-xs mt-1">Troco: {brl(lastSale.change)}</p>}
              </div>
            )}
            {cart.map((i) => (
              <div key={i.product_id} className="glass rounded-xl px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-admin-text text-sm flex-1 min-w-0">{i.name}</p>
                  <button onClick={() => removeItem(i.product_id)} className="text-admin-muted/40 hover:text-admin-rose shrink-0"><Icon name="x" className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(i.product_id, i.qty - 1)} className="w-6 h-6 rounded-lg bg-white/[0.05] text-admin-text hover:bg-white/[0.1] flex items-center justify-center text-sm">−</button>
                    <span className="text-admin-text text-sm w-6 text-center">{i.qty}</span>
                    <button onClick={() => setQty(i.product_id, i.qty + 1)} className="w-6 h-6 rounded-lg bg-white/[0.05] text-admin-text hover:bg-white/[0.1] flex items-center justify-center text-sm">+</button>
                  </div>
                  <p className="text-admin-gold text-sm">{brl(i.price * i.qty)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagamento */}
          <div className="border-t border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-admin-muted/60">Subtotal</span><span className="text-admin-text">{brl(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-admin-muted/60 text-sm">Desconto</span>
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-admin-muted/40 text-xs">R$</span>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00"
                  className="w-full glass-input rounded-lg pl-7 pr-2 py-1.5 text-sm text-admin-text outline-none text-right" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-admin-text font-medium">Total</span>
              <span className="text-admin-champ text-xl font-medium">{brl(total)}</span>
            </div>

            <GlassSelect value={payment} onChange={setPayment} options={PAYMENT_METHODS} />

            {payment === 'dinheiro' && (
              <div className="grid grid-cols-2 gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-admin-muted/40 text-xs">R$</span>
                  <input type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="Recebido"
                    className="w-full glass-input rounded-lg pl-7 pr-2 py-2 text-sm text-admin-text outline-none" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-admin-muted/50">Troco</p>
                  <p className="text-admin-text text-sm">{brl(change)}</p>
                </div>
              </div>
            )}

            <button onClick={finalizeSale} disabled={!canFinalize || busy}
              className="w-full btn-gradient rounded-xl py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
              Finalizar venda {cart.length > 0 && `· ${brl(total)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Modal movimento */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">{moveModal === 'deposit' ? 'Suprimento' : 'Sangria'}</h2>
              <button onClick={() => setMoveModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
                  <input type="number" value={moveForm.amount} onChange={(e) => setMoveForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Motivo</label>
                <input value={moveForm.description} onChange={(e) => setMoveForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={moveModal === 'deposit' ? 'Ex: reforço de troco' : 'Ex: retirada para banco'}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveMovement} disabled={busy} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">Confirmar</button>
              <button onClick={() => setMoveModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fechamento */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Fechar caixa</h2>
              <button onClick={() => setCloseModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="glass-soft rounded-xl p-4 space-y-1.5 mb-5 text-sm">
              <div className="flex justify-between"><span className="text-admin-muted/60">Abertura</span><span className="text-admin-text">{brl(session.opening_amount)}</span></div>
              <div className="flex justify-between"><span className="text-admin-muted/60">Vendas em dinheiro</span><span className="text-admin-text">{brl(summary.cashSales)}</span></div>
              <div className="flex justify-between"><span className="text-admin-muted/60">Suprimentos</span><span className="text-admin-text">{brl(summary.deposits)}</span></div>
              <div className="flex justify-between"><span className="text-admin-muted/60">Sangrias</span><span className="text-admin-text">− {brl(summary.withdrawals)}</span></div>
              <div className="flex justify-between border-t border-white/[0.06] pt-1.5 mt-1.5"><span className="text-admin-champ">Esperado em caixa</span><span className="text-admin-champ font-medium">{brl(summary.expectedCash)}</span></div>
              <div className="flex justify-between text-[11px] text-admin-muted/40 pt-1"><span>Total de vendas ({summary.salesCount})</span><span>{brl(summary.salesTotal)}</span></div>
            </div>
            <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor contado na gaveta</label>
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted/40 text-sm">R$</span>
              <input type="number" value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} placeholder="0,00"
                className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-lg text-admin-text outline-none" />
            </div>
            {countedAmount !== '' && (
              <p className={`text-sm mb-4 ${Math.abs((parseFloat(countedAmount) || 0) - summary.expectedCash) < 0.005 ? 'text-admin-sage' : 'text-admin-rose'}`}>
                Diferença: {brl((parseFloat(countedAmount) || 0) - summary.expectedCash)}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={closeCash} disabled={busy} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-3 rounded-xl text-sm transition-colors disabled:opacity-50">Confirmar fechamento</button>
              <button onClick={() => setCloseModal(false)} className="px-5 py-3 rounded-xl text-sm text-admin-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
