import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const priceOf = (p) => (p.promo_price != null && p.promo_price > 0 ? p.promo_price : p.price)
const KIND_LABEL = { quarto: 'Quarto', mesa: 'Mesa', chale: 'Chalé', suite: 'Suíte', loja: 'Loja', setor: 'Setor', geladeira: 'Frigobar', adega: 'Adega', prateleira: 'Prateleira', expositor: 'Expositor', evento: 'Evento', piscina: 'Piscina', spa: 'Spa', mercado: 'Mercado autônomo' }

export function FlowStore() {
  const code = (window.location.hash.match(/#flow\/([^?]+)/) || [])[1] || ''
  const params = new URLSearchParams((window.location.hash.split('?')[1] || ''))
  const totem = params.get('totem') === '1' // modo autoatendimento (quiosque, tela cheia)
  const [point, setPoint] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState({})
  const [openCart, setOpenCart] = useState(false)
  const [reference, setReference] = useState('')
  const [customer, setCustomer] = useState('')
  const [notes, setNotes] = useState('')
  const [tip, setTip] = useState(0)
  const [method, setMethod] = useState('card')
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState(params.get('paid') === '1' ? 'paid' : null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: pt } = await supabase.from('flow_points').select('*').eq('code', code).eq('active', true).maybeSingle()
      setPoint(pt || null)
      if (pt) {
        const { data: pr } = await supabase.from('flow_products').select('*').eq('tenant_id', pt.tenant_id).eq('active', true).or(`point_id.eq.${pt.id},point_id.is.null`).order('sort_order').order('name')
        setProducts(pr || [])
      }
      setLoading(false)
    })()
  }, [code])

  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const dec = (id) => setCart((c) => { const n = (c[id] || 0) - 1; const cp = { ...c }; if (n <= 0) delete cp[id]; else cp[id] = n; return cp })
  const cartLines = useMemo(() => Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === id), qty })).filter((l) => l.p), [cart, products])
  const subtotal = cartLines.reduce((s, l) => s + priceOf(l.p) * l.qty, 0)
  const total = subtotal + Number(tip || 0)
  const count = cartLines.reduce((s, l) => s + l.qty, 0)

  const categories = useMemo(() => {
    const map = {}
    products.forEach((p) => { const c = p.category || 'Itens'; (map[c] = map[c] || []).push(p) })
    return Object.entries(map)
  }, [products])

  const checkout = async () => {
    if (!cartLines.length) return
    setErr(''); setPlacing(true)
    const { data, error } = await supabase.functions.invoke('flow-order', {
      body: { code, items: cartLines.map((l) => ({ product_id: l.p.id, qty: l.qty })), reference, customer_name: customer, tip: Number(tip || 0), notes, payment_method: method, origin: window.location.origin },
    })
    setPlacing(false)
    if (error || data?.error) return setErr('Não foi possível concluir o pedido. Tente novamente.')
    if (data?.checkout_url) { window.location.href = data.checkout_url; return }
    setDone(method === 'manual' ? 'manual' : 'pending'); setCart({}); setOpenCart(false)
  }

  const bg = { backgroundImage: 'radial-gradient(70% 50% at 80% 0%, rgba(214,196,154,0.14), transparent 60%), linear-gradient(170deg, #14160f 0%, #0b0a08 100%)' }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-ivory/50 font-serif text-xl" style={bg}>Carregando…</div>
  if (!point) return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={bg}><p className="font-serif text-2xl text-ivory">QR não encontrado</p><p className="text-ivory/50 text-sm mt-2">Este código pode ter sido desativado. Fale com o estabelecimento.</p></div>

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={bg}>
      <div className="w-16 h-16 rounded-full border-2 border-gold/60 text-gold flex items-center justify-center mb-6"><svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg></div>
      <h1 className="font-serif text-3xl text-ivory">{done === 'paid' ? 'Pagamento confirmado!' : 'Pedido registrado!'}</h1>
      <p className="text-ivory/60 mt-3 max-w-sm">{done === 'manual' ? 'Seu pedido foi enviado. O pagamento será feito no local.' : done === 'paid' ? 'Recebemos seu pagamento. Seu pedido já está a caminho.' : 'Seu pedido foi enviado ao estabelecimento e será preparado. Se escolheu pagar online, conclua o pagamento.'}</p>
      <button onClick={() => { setDone(null) }} className="mt-8 bg-gold text-ink px-7 py-3 text-[11px] tracking-widerx uppercase">Fazer outro pedido</button>
    </div>
  )

  return (
    <div className={`min-h-screen pb-28 ${totem ? 'text-[1.15rem]' : ''}`} style={bg}>
      {totem && (
        <div className="bg-gold/10 border-b border-gold/20 text-center py-2">
          <p className="text-[11px] tracking-widerx uppercase text-gold/90">Autoatendimento · toque para montar seu pedido</p>
        </div>
      )}
      {/* header */}
      <div className="relative">
        <div className={`${totem ? 'h-56' : 'h-40'} bg-gradient-to-br from-gold/20 to-olive/20`}>{point.cover_url && <img src={point.cover_url} alt="" className="w-full h-full object-cover" />}</div>
        <div className={`${totem ? 'max-w-3xl' : 'max-w-lg'} mx-auto px-5 -mt-10 relative`}>
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] tracking-widerx uppercase text-gold/80">{KIND_LABEL[point.kind] || point.kind}{point.branch ? ` · ${point.branch}` : ''}</p>
            <h1 className={`font-serif ${totem ? 'text-4xl' : 'text-3xl'} text-ivory mt-1`}>{point.name}</h1>
            {point.description && <p className="text-ivory/55 text-sm mt-2">{point.description}</p>}
          </div>
        </div>
      </div>

      {/* catálogo */}
      <div className={`${totem ? 'max-w-3xl' : 'max-w-lg'} mx-auto px-5 mt-6 space-y-7`}>
        {products.length === 0 ? (
          <p className="text-ivory/40 text-center text-sm py-16">Nenhum produto disponível neste ponto ainda.</p>
        ) : categories.map(([cat, list]) => (
          <div key={cat}>
            <p className="text-[10px] tracking-widerx uppercase text-gold/70 mb-3">{cat}</p>
            <div className="space-y-3">
              {list.map((p) => {
                const qty = cart[p.id] || 0
                const out = p.stock != null && p.stock <= 0
                return (
                  <div key={p.id} className={`glass rounded-2xl overflow-hidden flex ${out ? 'opacity-50' : ''}`}>
                    {p.image_url && <img src={p.image_url} alt="" className="w-24 h-24 object-cover shrink-0" />}
                    <div className="p-4 flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <h3 className="font-serif text-lg text-ivory leading-tight">{p.name}</h3>
                      </div>
                      {p.description && <p className="text-ivory/45 text-xs mt-0.5 line-clamp-2">{p.description}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm">
                          {p.promo_price != null && p.promo_price > 0 ? (
                            <span className="text-gold">{brl(p.promo_price)} <span className="text-ivory/30 line-through text-xs">{brl(p.price)}</span></span>
                          ) : <span className="text-gold">{brl(p.price)}</span>}
                        </div>
                        {out ? <span className="text-[10px] text-rose-300/80 uppercase tracking-widerx">Esgotado</span> : qty === 0 ? (
                          <button onClick={() => add(p.id)} className="bg-gold/15 text-gold border border-gold/40 rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none">+</button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button onClick={() => dec(p.id)} className="w-8 h-8 rounded-full border border-gold/30 text-gold flex items-center justify-center">−</button>
                            <span className="text-ivory text-sm w-4 text-center">{qty}</span>
                            <button onClick={() => add(p.id)} className="w-8 h-8 rounded-full bg-gold text-ink flex items-center justify-center">+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* barra do carrinho */}
      {count > 0 && !openCart && (
        <button onClick={() => setOpenCart(true)} className="fixed bottom-4 inset-x-4 max-w-lg mx-auto bg-gold text-ink rounded-2xl py-4 px-6 flex items-center justify-between shadow-2xl">
          <span className="text-[11px] tracking-widerx uppercase">Ver pedido · {count} {count > 1 ? 'itens' : 'item'}</span>
          <span className="font-medium">{brl(total)}</span>
        </button>
      )}

      {/* drawer do carrinho */}
      {openCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setOpenCart(false)}>
          <div className="glass-pop w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-ivory">Seu pedido</h2><button onClick={() => setOpenCart(false)} className="text-ivory/40">✕</button></div>
            {err && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm p-3 rounded-xl mb-4">{err}</div>}
            <div className="space-y-3 mb-4">
              {cartLines.map((l) => (
                <div key={l.p.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0"><p className="text-ivory text-sm truncate">{l.p.name}</p><p className="text-ivory/40 text-xs">{brl(priceOf(l.p))}</p></div>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => dec(l.p.id)} className="w-7 h-7 rounded-full border border-gold/30 text-gold">−</button>
                    <span className="text-ivory text-sm w-4 text-center">{l.qty}</span>
                    <button onClick={() => add(l.p.id)} className="w-7 h-7 rounded-full bg-gold text-ink">+</button>
                  </div>
                  <span className="text-gold text-sm w-20 text-right">{brl(priceOf(l.p) * l.qty)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-gold/10 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={`Nº do ${KIND_LABEL[point.kind]?.toLowerCase() || 'ponto'}`} className="bg-white/[0.04] border border-gold/20 rounded-xl px-3 py-2.5 text-ivory placeholder-ivory/35 text-sm outline-none" />
                <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Seu nome (opcional)" className="bg-white/[0.04] border border-gold/20 rounded-xl px-3 py-2.5 text-ivory placeholder-ivory/35 text-sm outline-none" />
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações (opcional)" className="w-full bg-white/[0.04] border border-gold/20 rounded-xl px-3 py-2.5 text-ivory placeholder-ivory/35 text-sm outline-none resize-none" />
              <div className="flex items-center gap-2">
                <span className="text-ivory/50 text-xs">Gorjeta:</span>
                {[0, 5, 10].map((v) => { const val = v === 0 ? 0 : Math.round(subtotal * v) / 100; return <button key={v} onClick={() => setTip(val)} className={`text-xs px-3 py-1.5 rounded-lg border ${Math.abs(Number(tip) - val) < 0.001 ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 text-ivory/60'}`}>{v === 0 ? 'Nenhuma' : `${v}%`}</button> })}
              </div>
              <div>
                <p className="text-ivory/50 text-xs mb-1.5">Pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['card', 'Cartão'], ['pix', 'PIX'], ['manual', 'No local']].map(([m, label]) => (
                    <button key={m} onClick={() => setMethod(m)} className={`text-xs py-2.5 rounded-xl border transition-colors ${method === m ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 text-ivory/60'}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 mb-3 text-ivory">
              <span className="text-ivory/60">Total</span><span className="font-serif text-2xl text-gold">{brl(total)}</span>
            </div>
            <button onClick={checkout} disabled={placing} className="w-full bg-gold text-ink py-4 rounded-xl text-[12px] tracking-widerx uppercase font-medium disabled:opacity-60">
              {placing ? 'Enviando…' : method === 'card' ? 'Pagar com cartão' : method === 'pix' ? 'Gerar pedido (PIX)' : 'Enviar pedido'}
            </button>
            <p className="text-ivory/30 text-[10px] text-center mt-2">Seravie Flow · transforme qualquer espaço em um ponto de venda</p>
          </div>
        </div>
      )}
    </div>
  )
}
