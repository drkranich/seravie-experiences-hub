import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Resolve o slug da loja a partir da URL (#loja/<slug> ou ?store=<slug>).
function getSlug() {
  const h = window.location.hash || ''
  const m = h.match(/#loja\/?([^/?&]*)/)
  if (m && m[1]) return decodeURIComponent(m[1])
  const p = new URLSearchParams(window.location.search)
  return p.get('store') || p.get('loja') || ''
}

export function Storefront() {
  const slug = getSlug()
  const [store, setStore] = useState(undefined) // undefined=carregando, null=não encontrada
  const [items, setItems] = useState([])
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [stage, setStage] = useState('shop') // shop | checkout | done
  const [placedNumber, setPlacedNumber] = useState(null)

  // frete
  const [cep, setCep] = useState('')
  const [quotes, setQuotes] = useState(null)
  const [ship, setShip] = useState(null)
  const [calcing, setCalcing] = useState(false)
  const [shipErr, setShipErr] = useState('')

  // checkout
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '', address: '', notes: '' })
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    (async () => {
      let q = supabase.from('public_store_settings').select('*')
      q = slug ? q.eq('slug', slug) : q.limit(1)
      const { data: s } = await q.maybeSingle()
      if (!s) { setStore(null); return }
      setStore(s)
      const { data: list } = await supabase.from('store_listings').select('*').eq('tenant_id', s.tenant_id).eq('is_published', true).order('created_at', { ascending: false })
      setItems(list || [])
    })()
  }, [slug])

  const add = (it) => {
    setCart((c) => { const ex = c.find((x) => x.id === it.id); return ex ? c.map((x) => x.id === it.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { id: it.id, title: it.title, price: Number(it.price) || 0, qty: 1, image_url: it.image_url }] })
    setCartOpen(true); setQuotes(null); setShip(null)
  }
  const setQty = (id, d) => setCart((c) => c.map((x) => x.id === id ? { ...x, qty: Math.max(1, x.qty + d) } : x))
  const removeItem = (id) => setCart((c) => c.filter((x) => x.id !== id))
  const subtotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart])
  const totalQty = cart.reduce((s, x) => s + x.qty, 0)
  const freeShip = store?.free_shipping_min != null && subtotal >= Number(store.free_shipping_min)
  const shippingCost = freeShip ? 0 : (ship ? Number(ship.price) : (store?.shipping_provider === 'flat' ? Number(store?.shipping_flat) || 0 : 0))
  const total = subtotal + shippingCost

  const calcShip = async () => {
    if (!cep) { setShipErr('Informe o CEP'); return }
    setCalcing(true); setShipErr(''); setQuotes(null)
    const { data, error } = await supabase.functions.invoke('melhor-envio', { body: { action: 'quote', slug: store.slug, to: cep, quantity: totalQty } })
    setCalcing(false)
    if (error || !data?.ok) { setShipErr(data?.error || 'Não foi possível calcular o frete'); return }
    setQuotes(data.quotes || [])
    if (data.quotes?.length) setShip(data.quotes[0])
  }

  const place = async () => {
    if (!buyer.name.trim()) return
    setPlacing(true)
    const { data, error } = await supabase.from('store_orders').insert({
      tenant_id: store.tenant_id,
      customer_name: buyer.name, customer_email: buyer.email, customer_phone: buyer.phone,
      items: cart.map((x) => ({ id: x.id, title: x.title, price: x.price, qty: x.qty })),
      subtotal, shipping: shippingCost, total,
      status: 'pending', payment_status: 'unpaid',
      shipping_address: [buyer.address, cep && `CEP ${cep}`, ship && `${ship.company} ${ship.service}`].filter(Boolean).join(' · '),
      notes: buyer.notes,
    }).select('number').single()
    setPlacing(false)
    if (error) return
    setPlacedNumber(data?.number || null); setStage('done'); setCart([])
  }

  if (store === undefined) return <div className="min-h-screen flex items-center justify-center bg-ink text-ivory/50 font-serif text-xl tracking-widest">Carregando loja…</div>
  if (store === null) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-ivory p-6 text-center">
      <h1 className="font-serif text-3xl mb-2">Loja indisponível</h1>
      <p className="text-ivory/50">Esta loja não está aberta ou o endereço está incorreto.</p>
    </div>
  )

  const accent = store.primary_color || '#b08d57'

  return (
    <div className="min-h-screen bg-ink text-ivory">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/80 border-b border-gold/10">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {store.logo_url ? <img src={store.logo_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full flex items-center justify-center font-serif text-sm" style={{ background: `${accent}22`, color: accent }}>{(store.store_name || 'L')[0]}</div>}
            <div className="min-w-0"><p className="font-serif text-lg leading-tight truncate">{store.store_name || 'Loja'}</p></div>
          </div>
          <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-2 border border-gold/30 rounded-full px-4 py-2 text-sm hover:bg-gold/10 transition-colors">
            Carrinho
            {totalQty > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-ink font-medium" style={{ background: accent }}>{totalQty}</span>}
          </button>
        </div>
      </header>

      {stage === 'done' ? (
        <div className="max-w-xl mx-auto px-5 py-24 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12l4 4 10-11" /></svg>
          </div>
          <h1 className="font-serif text-3xl mb-2">Pedido recebido!</h1>
          {placedNumber != null && <p className="text-ivory/60 mb-2">Seu pedido <strong>#{placedNumber}</strong> foi registrado.</p>}
          <p className="text-ivory/50 mb-8">Em breve a loja entrará em contato para confirmar pagamento e envio.</p>
          {store.whatsapp && <a href={`https://wa.me/55${(store.whatsapp || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-block text-ink px-6 py-3 rounded-full text-sm font-medium" style={{ background: accent }}>Falar no WhatsApp</a>}
          <div><button onClick={() => setStage('shop')} className="mt-6 text-ivory/50 hover:text-ivory text-sm">Voltar à loja</button></div>
        </div>
      ) : stage === 'checkout' ? (
        <div className="max-w-2xl mx-auto px-5 py-10">
          <button onClick={() => setStage('shop')} className="text-ivory/50 hover:text-ivory text-sm mb-6">← Continuar comprando</button>
          <h1 className="font-serif text-3xl mb-6">Finalizar pedido</h1>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {[['name', 'Nome completo *'], ['email', 'E-mail'], ['phone', 'Telefone / WhatsApp'], ['address', 'Endereço de entrega']].map(([k, l]) => (
              <div key={k} className={k === 'address' ? 'sm:col-span-2' : ''}>
                <label className="block text-[11px] uppercase tracking-wider text-ivory/40 mb-1.5">{l}</label>
                <input value={buyer[k]} onChange={(e) => setBuyer((b) => ({ ...b, [k]: e.target.value }))} className="w-full bg-white/5 border border-gold/15 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gold/40" />
              </div>
            ))}
            <div className="sm:col-span-2"><label className="block text-[11px] uppercase tracking-wider text-ivory/40 mb-1.5">Observações</label><textarea value={buyer.notes} onChange={(e) => setBuyer((b) => ({ ...b, notes: e.target.value }))} rows={2} className="w-full bg-white/5 border border-gold/15 rounded-xl px-4 py-2.5 text-sm outline-none resize-none focus:border-gold/40" /></div>
          </div>
          <div className="border border-gold/10 rounded-2xl p-5 mb-6">
            {cart.map((x) => <div key={x.id} className="flex justify-between text-sm py-1"><span className="text-ivory/70">{x.qty}× {x.title}</span><span>{brl(x.price * x.qty)}</span></div>)}
            <div className="flex justify-between text-sm py-1 border-t border-gold/10 mt-2 pt-2 text-ivory/60"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="flex justify-between text-sm py-1 text-ivory/60"><span>Frete{freeShip ? ' (grátis)' : ''}</span><span>{brl(shippingCost)}</span></div>
            <div className="flex justify-between py-1 font-medium"><span>Total</span><span style={{ color: accent }}>{brl(total)}</span></div>
          </div>
          <p className="text-ivory/40 text-xs mb-4">O pagamento é combinado com a loja após a confirmação do pedido.</p>
          <button onClick={place} disabled={!buyer.name.trim() || placing} className="w-full text-ink py-3.5 rounded-full text-sm font-medium disabled:opacity-40" style={{ background: accent }}>{placing ? 'Enviando…' : 'Confirmar pedido'}</button>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto px-5 py-10">
          {store.about && <p className="text-ivory/50 max-w-2xl mb-8">{store.about}</p>}
          {items.length === 0 ? (
            <div className="text-center py-24 text-ivory/40">Nenhum produto disponível no momento.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((it) => (
                <div key={it.id} className="border border-gold/10 rounded-2xl overflow-hidden bg-white/[0.02] hover:border-gold/25 transition-colors flex flex-col">
                  <button onClick={() => setDetail(it)} className="block aspect-square bg-white/5 w-full">
                    {it.image_url ? <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ivory/20 font-serif text-3xl">{it.title[0]}</div>}
                  </button>
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-sm text-ivory/90 mb-1 line-clamp-2 flex-1">{it.title}</p>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="font-medium" style={{ color: accent }}>{brl(it.price)}</span>
                      {it.compare_at_price > it.price && <span className="text-ivory/30 text-xs line-through">{brl(it.compare_at_price)}</span>}
                    </div>
                    <button onClick={() => add(it)} className="w-full border border-gold/30 rounded-full py-2 text-xs hover:bg-gold/10 transition-colors">Adicionar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <footer className="mt-16 pt-8 border-t border-gold/10 text-ivory/40 text-xs flex flex-wrap gap-4 justify-between">
            <span>{store.store_name}</span>
            <span className="flex gap-4">{store.whatsapp && <span>{store.whatsapp}</span>}{store.email && <span>{store.email}</span>}</span>
            <span>Powered by SERAVIE EXPERIENCES</span>
          </footer>
        </main>
      )}

      {/* Detalhe do produto */}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70" onClick={() => setDetail(null)}>
          <div className="bg-ink border border-gold/20 rounded-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-video bg-white/5">{detail.image_url ? <img src={detail.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ivory/20 font-serif text-5xl">{detail.title[0]}</div>}</div>
            <div className="p-6">
              <h2 className="font-serif text-2xl mb-1">{detail.title}</h2>
              <div className="flex items-baseline gap-2 mb-3"><span className="text-lg font-medium" style={{ color: accent }}>{brl(detail.price)}</span>{detail.compare_at_price > detail.price && <span className="text-ivory/30 text-sm line-through">{brl(detail.compare_at_price)}</span>}</div>
              {detail.description && <p className="text-ivory/60 text-sm mb-5 whitespace-pre-wrap">{detail.description}</p>}
              <button onClick={() => { add(detail); setDetail(null) }} className="w-full text-ink py-3 rounded-full text-sm font-medium" style={{ background: accent }}>Adicionar ao carrinho</button>
            </div>
          </div>
        </div>
      )}

      {/* Carrinho */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={() => setCartOpen(false)}>
          <div className="w-full max-w-md bg-ink border-l border-gold/15 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gold/10"><p className="font-serif text-xl">Carrinho</p><button onClick={() => setCartOpen(false)} className="text-ivory/50 hover:text-ivory">✕</button></div>
            {cart.length === 0 ? <div className="flex-1 flex items-center justify-center text-ivory/40 text-sm">Seu carrinho está vazio</div> : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {cart.map((x) => (
                    <div key={x.id} className="flex gap-3 items-center">
                      <div className="w-14 h-14 rounded-lg bg-white/5 overflow-hidden shrink-0">{x.image_url ? <img src={x.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ivory/20 font-serif">{x.title[0]}</div>}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm truncate">{x.title}</p><p className="text-xs" style={{ color: accent }}>{brl(x.price)}</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQty(x.id, -1)} className="w-6 h-6 rounded border border-gold/20 text-ivory/70">−</button>
                        <span className="text-sm w-5 text-center">{x.qty}</span>
                        <button onClick={() => setQty(x.id, 1)} className="w-6 h-6 rounded border border-gold/20 text-ivory/70">+</button>
                      </div>
                      <button onClick={() => removeItem(x.id)} className="text-ivory/30 hover:text-red-400 text-xs">remover</button>
                    </div>
                  ))}

                  {/* Frete */}
                  {store.shipping_provider === 'melhor_envio' && (
                    <div className="border border-gold/10 rounded-xl p-3 mt-4">
                      <p className="text-xs text-ivory/50 mb-2">Calcular frete</p>
                      <div className="flex gap-2">
                        <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="CEP de entrega" className="flex-1 bg-white/5 border border-gold/15 rounded-lg px-3 py-2 text-sm outline-none" />
                        <button onClick={calcShip} disabled={calcing} className="border border-gold/30 rounded-lg px-3 py-2 text-xs hover:bg-gold/10 disabled:opacity-50">{calcing ? '...' : 'Calcular'}</button>
                      </div>
                      {shipErr && <p className="text-red-400/80 text-xs mt-2">{shipErr}</p>}
                      {quotes && quotes.map((q) => (
                        <button key={q.id} onClick={() => setShip(q)} className={`w-full flex justify-between items-center mt-2 px-3 py-2 rounded-lg border text-sm transition-colors ${ship?.id === q.id ? 'border-gold/50 bg-gold/10' : 'border-gold/10 hover:border-gold/30'}`}>
                          <span className="text-ivory/70 text-xs">{q.company} {q.service}{q.delivery_time != null ? ` · ${q.delivery_time}d` : ''}</span>
                          <span style={{ color: accent }}>{q.price != null ? brl(q.price) : '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-gold/10 px-5 py-4">
                  <div className="flex justify-between text-sm text-ivory/60 mb-1"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-ivory/60 mb-1"><span>Frete{freeShip ? ' (grátis)' : ''}</span><span>{brl(shippingCost)}</span></div>
                  <div className="flex justify-between font-medium mb-4"><span>Total</span><span style={{ color: accent }}>{brl(total)}</span></div>
                  <button onClick={() => { setCartOpen(false); setStage('checkout') }} className="w-full text-ink py-3 rounded-full text-sm font-medium" style={{ background: accent }}>Finalizar pedido</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
