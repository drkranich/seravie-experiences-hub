import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { Icon, GlassSelect } from '../../ui'
import { brl, num, money, PAYMENT_METHODS, methodLabel, printReceipt, commitSale } from './pdvLib'

// Tela de venda do PDV: grade de produtos (do cardápio do KDS) + carrinho + pagamento.
export function KdsPDVSale({ session, kind = 'kitchen', notify, onSold }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [menu, setMenu] = useState([])
  const [operators, setOperators] = useState([])
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [cart, setCart] = useState({})           // { menuId: qty }
  const [discount, setDiscount] = useState('')
  const [tip, setTip] = useState('')
  const [operator, setOperator] = useState('')
  const [customer, setCustomer] = useState('')
  const [tableLabel, setTableLabel] = useState('')
  const [sendKitchen, setSendKitchen] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [payments, setPayments] = useState([])    // [{method, amount}]
  const [placing, setPlacing] = useState(false)
  const [lastSale, setLastSale] = useState(null)

  const load = async () => {
    const [{ data: m }, { data: ops }] = await Promise.all([
      supabase.from('kds_menu').select('*').eq('kind', kind).eq('active', true).order('sort_order').order('name'),
      supabase.from('kds_operators').select('name').eq('kind', kind).eq('active', true).order('sort_order'),
    ])
    setMenu(m || []); setOperators(ops || [])
  }
  useEffect(() => { load() }, [kind])

  const categories = useMemo(() => [...new Set(menu.map((m) => m.category).filter(Boolean))], [menu])
  // Busca por nome, categoria OU código de barras.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return menu.filter((m) => (!cat || m.category === cat) && (!q || `${m.name} ${m.category || ''} ${m.barcode || ''}`.toLowerCase().includes(q)))
  }, [menu, cat, search])

  const lines = useMemo(() => Object.entries(cart).map(([id, qty]) => ({ ...menu.find((m) => m.id === id), qty })).filter((l) => l.id), [cart, menu])
  const subtotal = money(lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0))
  const total = money(subtotal - money(num(discount)) + money(num(tip)))
  const count = lines.reduce((s, l) => s + l.qty, 0)

  const add = (m) => setCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))

  // Leitor de código de barras: o scanner "digita" o código e dá Enter.
  // Casa exato pelo barcode; se não achar, tenta por nome. Bipe de erro se nada.
  const [scan, setScan] = useState('')
  const scanRef = useRef(null)
  const onScan = (e) => {
    if (e.key !== 'Enter') return
    const code = scan.trim()
    if (!code) return
    const hit = menu.find((m) => (m.barcode || '') === code) || menu.find((m) => m.name.toLowerCase() === code.toLowerCase())
    if (hit) { if (hit.stock != null && hit.stock <= 0) notify?.(`"${hit.name}" esgotado`, 'error'); else { add(hit); notify?.(`+ ${hit.name}`, 'success') } }
    else notify?.('Código não encontrado no cardápio', 'error')
    setScan('')
  }
  const dec = (id) => setCart((c) => { const n = (c[id] || 0) - 1; const cp = { ...c }; if (n <= 0) delete cp[id]; else cp[id] = n; return cp })
  const clear = () => { setCart({}); setDiscount(''); setTip(''); setCustomer(''); setTableLabel(''); setPayments([]) }

  // pagamento
  const paid = money(payments.reduce((s, p) => s + money(p.amount), 0))
  const remaining = money(Math.max(0, total - paid))
  const change = money(Math.max(0, paid - total))
  const addPayment = (method, amount) => setPayments((p) => [...p, { method, amount: money(amount) }])
  const delPayment = (i) => setPayments((p) => p.filter((_, idx) => idx !== i))

  const openPay = () => { if (!count) return notify?.('Carrinho vazio', 'error'); setPayments([]); setPayOpen(true) }

  const finalize = async () => {
    if (paid + 0.001 < total) return notify?.('Pagamento insuficiente', 'error')
    setPlacing(true)
    const res = await commitSale({ tenantId, session, cart: lines, discount: num(discount), tip: num(tip), payments, sendToKitchen: sendKitchen, operator, customer, tableLabel, kind })
    setPlacing(false)
    if (res.error) return notify?.('Erro ao finalizar: ' + res.error, 'error')
    notify?.(`Venda #${res.sale.number} concluída`, 'success')
    setLastSale(res.sale); setPayOpen(false); clear(); load(); onSold?.()
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      {/* Catálogo */}
      <div>
        {/* Leitor de código de barras — mantenha o foco aqui e escaneie */}
        <div className="relative mb-2">
          <Icon name="grid" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-champ/60" />
          <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={onScan} placeholder="Leitor de código de barras — escaneie ou digite o código + Enter" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none ring-1 ring-admin-champ/20 focus:ring-admin-champ/40 font-mono" autoFocus />
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, categoria ou código…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none" />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setCat('')} className={`text-xs px-3 py-2 rounded-xl ${!cat ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>Todos</button>
            {categories.map((c) => <button key={c} onClick={() => setCat(c)} className={`text-xs px-3 py-2 rounded-xl ${cat === c ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>{c}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {shown.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhum produto. Cadastre itens na aba Cardápios.</p>}
          {shown.map((m) => {
            const out = m.stock != null && m.stock <= 0
            return (
              <button key={m.id} onClick={() => !out && add(m)} disabled={out} className={`glass rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white/[0.05] disabled:opacity-40 ${cart[m.id] ? 'ring-1 ring-admin-champ/40' : ''}`}>
                {m.image_url && <img src={m.image_url} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />}
                <p className="text-admin-text text-sm font-medium leading-tight line-clamp-2">{m.name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-admin-gold text-sm">{brl(m.price)}</span>
                  {cart[m.id] > 0 && <span className="text-[11px] bg-admin-champ/20 text-admin-champ rounded-full w-5 h-5 flex items-center justify-center">{cart[m.id]}</span>}
                </div>
                {out && <span className="text-[9px] text-admin-rose">esgotado</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Carrinho */}
      <div className="glass rounded-2xl p-4 flex flex-col h-fit lg:sticky lg:top-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-admin-text font-medium flex items-center gap-2"><Icon name="cart" className="w-4 h-4 text-admin-champ" />Carrinho</p>
          {count > 0 && <button onClick={clear} className="text-[11px] text-admin-muted/50 hover:text-admin-rose">limpar</button>}
        </div>
        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {lines.length === 0 && <p className="text-admin-muted/30 text-sm text-center py-6">Toque nos produtos para adicionar</p>}
          {lines.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{l.name}</p><p className="text-admin-muted/40 text-[11px]">{brl(l.price)}</p></div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => dec(l.id)} className="w-6 h-6 rounded-lg border border-admin-champ/30 text-admin-champ text-sm">−</button>
                <span className="text-admin-text text-sm w-4 text-center">{l.qty}</span>
                <button onClick={() => add(l)} className="w-6 h-6 rounded-lg bg-admin-champ/20 text-admin-champ text-sm">+</button>
              </div>
              <span className="text-admin-gold text-xs w-16 text-right">{brl(l.price * l.qty)}</span>
            </div>
          ))}
        </div>

        {/* dados rápidos */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Mesa/comanda" className="glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Cliente" className="glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
        </div>
        <div className="mb-2"><GlassSelect value={operator} onChange={setOperator} options={[{ value: '', label: 'Operador (opcional)' }, ...operators.map((o) => ({ value: o.name, label: o.name }))]} /></div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="Desconto" className="glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
          <input value={tip} onChange={(e) => setTip(e.target.value)} inputMode="decimal" placeholder="Gorjeta" className="glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
        </div>
        <label className="flex items-center gap-2 text-xs text-admin-muted/70 mb-3"><input type="checkbox" checked={sendKitchen} onChange={(e) => setSendKitchen(e.target.checked)} className="accent-admin-champ" />Enviar para a cozinha (KDS)</label>

        <div className="border-t border-white/[0.06] pt-3 space-y-1 mb-3 text-sm">
          <div className="flex justify-between text-admin-muted/60"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          {num(discount) > 0 && <div className="flex justify-between text-admin-rose/80"><span>Desconto</span><span>- {brl(num(discount))}</span></div>}
          {num(tip) > 0 && <div className="flex justify-between text-admin-muted/60"><span>Gorjeta</span><span>{brl(num(tip))}</span></div>}
          <div className="flex justify-between text-admin-text font-medium text-lg pt-1"><span>Total</span><span className="text-admin-champ">{brl(total)}</span></div>
        </div>
        <button onClick={openPay} disabled={!count} className="w-full bg-admin-champ/20 hover:bg-admin-champ/30 text-admin-champ py-3 rounded-xl text-sm font-medium disabled:opacity-40">Pagamento · {brl(total)}</button>
        {lastSale && (
          <button onClick={() => printReceipt(lastSale)} className="w-full mt-2 text-xs text-admin-muted/60 hover:text-admin-champ flex items-center justify-center gap-1.5"><Icon name="download" className="w-3.5 h-3.5" />Reimprimir venda #{lastSale.number}</button>
        )}
      </div>

      {/* Modal de pagamento */}
      {payOpen && (
        <PayModal total={total} paid={paid} remaining={remaining} change={change} payments={payments} onAdd={addPayment} onDel={delPayment} onClose={() => setPayOpen(false)} onFinalize={finalize} placing={placing} />
      )}
    </div>
  )
}

function PayModal({ total, paid, remaining, change, payments, onAdd, onDel, onClose, onFinalize, placing }) {
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState('')
  const quick = () => { onAdd(method, remaining); setAmount('') }
  const addCustom = () => { if (num(amount) > 0) { onAdd(method, num(amount)); setAmount('') } }
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-serif text-2xl text-admin-text">Pagamento</h3><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        <div className="glass-soft rounded-xl p-4 mb-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/50">Total</p>
          <p className="text-3xl font-medium text-admin-champ">{brl(total)}</p>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <span className="text-admin-muted/60">Pago: {brl(paid)}</span>
            {remaining > 0 ? <span className="text-admin-rose">Falta: {brl(remaining)}</span> : <span className="text-admin-sage">Troco: {brl(change)}</span>}
          </div>
        </div>

        {/* formas */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {PAYMENT_METHODS.map((pm) => (
            <button key={pm.value} onClick={() => setMethod(pm.value)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] ${method === pm.value ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.04] text-admin-muted/60'}`}><Icon name={pm.icon} className="w-4 h-4" />{pm.label}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Valor (${brl(remaining)})`} className="flex-1 glass-input rounded-xl px-3 py-2.5 text-sm text-admin-text outline-none" />
          <button onClick={addCustom} className="px-3 rounded-xl bg-white/[0.05] text-admin-muted hover:text-admin-champ text-sm">+ add</button>
          <button onClick={quick} className="px-3 rounded-xl bg-admin-champ/15 text-admin-champ text-sm whitespace-nowrap">restante</button>
        </div>

        {payments.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between glass-soft rounded-lg px-3 py-2 text-sm">
                <span className="text-admin-muted/70">{methodLabel(p.method)}</span>
                <div className="flex items-center gap-2"><span className="text-admin-text">{brl(p.amount)}</span><button onClick={() => onDel(i)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button></div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onFinalize} disabled={placing || paid + 0.001 < total} className="w-full bg-admin-sage/20 hover:bg-admin-sage/30 text-admin-sage py-3 rounded-xl text-sm font-medium disabled:opacity-40">
          {placing ? 'Finalizando…' : change > 0 ? `Finalizar · troco ${brl(change)}` : 'Finalizar venda'}
        </button>
      </div>
    </div>
  )
}
