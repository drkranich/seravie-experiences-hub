import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, brl } from '../../../lib/suppliersMarket'

// Marketplace de venda direta — produtos marcados como venda direta pelos
// fornecedores. Comprador monta um carrinho e gera um pedido (buyer_orders).

export function DirectMarket({ onOpenSupplier, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [cart, setCart] = useState({}) // product_id -> {product, qty}
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const { data: ps } = await supabase.from('supplier_products').select('*').eq('direct_sale', true).eq('status', 'active').order('created_at', { ascending: false }).limit(300)
        const supIds = [...new Set((ps || []).map((p) => p.supplier_id).filter(Boolean))]
        let supMap = {}
        if (supIds.length) { const { data: ss } = await supabase.from('suppliers').select('id,name,logo_url,city').in('id', supIds); (ss || []).forEach((s) => { supMap[s.id] = s }) }
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
  const setQty = (id, qty) => setCart((c) => { if (qty <= 0) { const n = { ...c }; delete n[id]; return n } return { ...c, [id]: { ...c[id], qty } } })
  const cartItems = Object.values(cart)
  const cartTotal = cartItems.reduce((s, { product, qty }) => s + (Number(product.price) || 0) * qty, 0)
  const cartCount = cartItems.reduce((s, { qty }) => s + qty, 0)

  const checkout = async () => {
    if (!cartItems.length) return
    // agrupa por fornecedor → um pedido por fornecedor
    const bySup = {}
    cartItems.forEach(({ product, qty }) => { const k = product.supplier_id || 'sem'; (bySup[k] ||= []).push({ product, qty }) })
    let count = 0
    for (const [supId, list] of Object.entries(bySup)) {
      const items = list.map(({ product, qty }) => ({ name: product.name, qty, unit_price: Number(product.price) || 0, note: '' }))
      const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0)
      const { error } = await supabase.from('buyer_orders').insert({
        tenant_id: tenantId, supplier_id: supId === 'sem' ? null : supId, supplier_name: suppliers[supId]?.name || 'Fornecedor',
        code: 'PC-' + Date.now().toString(36).slice(-5).toUpperCase(), status: 'enviado', items, subtotal, total: subtotal,
      })
      if (!error) count++
    }
    setCart({}); setCartOpen(false)
    notify?.(count > 1 ? `${count} pedidos enviados aos fornecedores!` : 'Pedido enviado ao fornecedor!', 'success')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Marketplace de venda direta</h1><p className="text-admin-muted/50 text-sm mt-1">Produtos prontos para compra direta dos fornecedores do ecossistema.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={cat} onChange={setCat} options={[{ value: '', label: 'Todas as categorias' }, ...cats.map((c) => ({ value: c, label: SUPPLIER_CATEGORIES[c] || c }))]} /></div>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-40"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
          <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="cart" className="w-4 h-4" />Pedido{cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-admin-champ text-admin-bg text-[10px] flex items-center justify-center">{cartCount}</span>}</button>
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
                    {sup && <button onClick={() => onOpenSupplier?.(sup)} className="text-admin-champ/60 text-[11px] mt-0.5 hover:underline text-left">{sup.name}{sup.city ? ` · ${sup.city}` : ''}</button>}
                    {p.description && <p className="text-admin-muted/50 text-xs mt-1 line-clamp-2 flex-1">{p.description}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
                      <div><p className="text-admin-champ font-serif">{p.price ? brl(p.price) : 'Sob consulta'}</p>{p.unit && <p className="text-admin-muted/40 text-[10px]">por {p.unit}{p.min_qty ? ` · mín. ${p.min_qty}` : ''}</p>}</div>
                      <button onClick={() => addToCart(p)} disabled={p.stock != null && p.stock <= 0} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 disabled:opacity-40 transition-colors flex items-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />Pedir</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>}

      {cartOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Seu pedido</h2><button onClick={() => setCartOpen(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {cartItems.length === 0 ? <p className="text-admin-muted/50 text-sm py-8 text-center">Carrinho vazio.</p>
              : <>
                  <div className="space-y-3">
                    {cartItems.map(({ product: p, qty }) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="box" className="w-4 h-4 text-admin-champ/50" />}</div>
                        <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{p.name}</p><p className="text-admin-champ text-xs">{p.price ? brl(p.price) : 'Sob consulta'}</p></div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setQty(p.id, qty - 1)} className="w-6 h-6 rounded-md glass-input text-admin-muted/70 hover:text-admin-champ flex items-center justify-center">−</button>
                          <span className="text-admin-text text-sm w-6 text-center">{qty}</span>
                          <button onClick={() => setQty(p.id, qty + 1)} className="w-6 h-6 rounded-md glass-input text-admin-muted/70 hover:text-admin-champ flex items-center justify-center">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="glass-soft rounded-xl p-3 flex items-center justify-between text-sm mt-4"><span className="text-admin-muted/60">Total</span><span className="text-admin-champ font-serif">{brl(cartTotal)}</span></div>
                  <button onClick={checkout} className="w-full mt-4 py-2.5 rounded-xl bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ text-sm transition-colors flex items-center justify-center gap-2"><Icon name="check" className="w-4 h-4" />Enviar pedido ao fornecedor</button>
                  <p className="text-admin-muted/40 text-[11px] text-center mt-2">Gera um pedido em Compras para cada fornecedor.</p>
                </>}
          </div>
        </div>
      )}
    </div>
  )
}
