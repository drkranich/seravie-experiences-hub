import { useState } from 'react'

// Mockup de celular reutilizável (moldura + tela glass). children = conteúdo.
export function PhoneFrame({ children, label }) {
  return (
    <div className="flex flex-col items-center">
      {label && <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">{label}</p>}
      <div className="relative" style={{ width: 300 }}>
        <div className="rounded-[2.2rem] p-2.5" style={{ background: '#0b0a08', border: '1px solid rgba(220,203,167,0.14)', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }}>
          <div className="rounded-[1.7rem] overflow-hidden relative" style={{ height: 560 }}>
            {/* notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl z-20" style={{ background: '#0b0a08' }} />
            <div className="w-full h-full overflow-y-auto">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const isStatic = (t) => ['title', 'text', 'image', 'button'].includes(t)

// Preview ao vivo da experiência de FORMULÁRIO (uma cena por vez, com navegação).
export function FormPreview({ form, blocks }) {
  const [idx, setIdx] = useState(0)
  const theme = { bg1: '#14160f', bg2: '#0b0a08', accent: '#D6C49A', text: '#f4f0e6', glow: 'rgba(214,196,154,0.16)', ...(form?.theme || {}) }
  const total = blocks.length
  const b = blocks[idx]
  const bg = { backgroundImage: `radial-gradient(80% 55% at 75% -5%, ${theme.glow}, transparent 60%), linear-gradient(165deg, ${theme.bg1} 0%, ${theme.bg2} 100%)`, color: theme.text, minHeight: '100%' }
  const glass = { background: 'rgba(255,255,255,0.055)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16 }
  const clamp = (n) => Math.max(0, Math.min(total - 1, n))

  return (
    <div style={bg} className="flex flex-col">
      <div className="h-1 w-full bg-white/[0.06]"><div className="h-full transition-all" style={{ width: `${total ? ((idx + 1) / total) * 100 : 0}%`, background: theme.accent }} /></div>
      <div className="flex-1 flex items-center justify-center px-5 py-8" style={{ minHeight: 480 }}>
        {total === 0 ? (
          <p className="text-center text-sm opacity-40">Adicione blocos para ver o preview.</p>
        ) : (
          <div className="w-full">
            {form?.cover_url && idx === 0 && <img src={form.cover_url} alt="" className="w-full h-24 object-cover mb-4" style={{ borderRadius: 14 }} />}
            {b.help && <p className="text-[10px] tracking-wider uppercase mb-1.5" style={{ color: theme.accent, opacity: 0.85 }}>{b.help}</p>}
            <h2 className="font-serif leading-tight mb-4" style={{ fontSize: b.type === 'title' ? '1.7rem' : '1.35rem' }}>{b.label}{b.required && !isStatic(b.type) ? <span style={{ color: theme.accent }}> *</span> : null}</h2>
            {b.type === 'text' && b.config?.body && <p className="opacity-70 text-sm whitespace-pre-wrap">{b.config.body}</p>}
            {b.type === 'image' && b.config?.media_url && <img src={b.config.media_url} alt="" className="w-full object-cover" style={{ borderRadius: 14 }} />}
            {b.type === 'button' && <span className="inline-block mt-2 px-6 py-2.5 text-[11px] tracking-wider uppercase" style={{ background: theme.accent, color: theme.bg1, borderRadius: 14 }}>{b.config?.button_label || 'Abrir'}</span>}
            {['short_text', 'email', 'phone', 'number', 'url'].includes(b.type) && <div className="px-4 py-3 text-sm opacity-50" style={glass}>{b.placeholder || 'Sua resposta…'}</div>}
            {b.type === 'long_text' && <div className="px-4 py-6 text-sm opacity-50" style={glass}>{b.placeholder || 'Escreva aqui…'}</div>}
            {b.type === 'choice' && <div className="space-y-2">{(b.options || []).map((o, i) => <div key={i} className="px-4 py-2.5 text-sm" style={glass}>{o.label ?? o}</div>)}</div>}
            {b.type === 'nps' && <div className="grid grid-cols-11 gap-1">{Array.from({ length: 11 }, (_, n) => <div key={n} className="aspect-square flex items-center justify-center text-[10px]" style={{ ...glass, borderRadius: 8 }}>{n}</div>)}</div>}
            {b.type === 'rating' && <div className="flex gap-1.5 justify-center text-3xl" style={{ color: theme.accent }}>{Array.from({ length: Number(b.config?.max) || 5 }, (_, i) => <span key={i}>★</span>)}</div>}
          </div>
        )}
      </div>
      <div className="px-5 pb-6 flex items-center justify-between">
        <button onClick={() => setIdx((n) => clamp(n - 1))} disabled={idx === 0} className="text-[10px] uppercase tracking-wider opacity-50 disabled:opacity-0">← Voltar</button>
        <span className="text-[10px] opacity-30">{total ? idx + 1 : 0} / {total}</span>
        <button onClick={() => setIdx((n) => clamp(n + 1))} disabled={idx >= total - 1} className="px-5 py-2 text-[11px] tracking-wider uppercase disabled:opacity-30" style={{ background: theme.accent, color: theme.bg1, borderRadius: 14 }}>Continuar</button>
      </div>
    </div>
  )
}

// Preview da LOJA pública (QR) — espelha a FlowStore de forma compacta.
export function StorePreview({ point, products = [] }) {
  const bg = { backgroundImage: 'radial-gradient(70% 50% at 80% 0%, rgba(214,196,154,0.14), transparent 60%), linear-gradient(170deg, #14160f 0%, #0b0a08 100%)', minHeight: '100%' }
  const glass = { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }
  const KIND = { quarto: 'Quarto', mesa: 'Mesa', chale: 'Chalé', suite: 'Suíte', loja: 'Loja', geladeira: 'Frigobar', adega: 'Adega', mercado: 'Mercado' }
  return (
    <div style={bg}>
      <div className="h-28 bg-gradient-to-br from-[#D6C49A]/25 to-[#8a7a4a]/20">{point?.cover_url && <img src={point.cover_url} alt="" className="w-full h-full object-cover" />}</div>
      <div className="px-4 -mt-8 relative">
        <div className="p-4" style={glass}>
          <p className="text-[9px] tracking-wider uppercase" style={{ color: '#D6C49A' }}>{KIND[point?.kind] || point?.kind || 'Ponto'}</p>
          <h1 className="font-serif text-xl text-[#f4f0e6] mt-0.5">{point?.name || 'Nome do ponto'}</h1>
          {point?.description && <p className="text-[#f4f0e6]/50 text-xs mt-1">{point.description}</p>}
        </div>
      </div>
      <div className="px-4 mt-4 space-y-2.5 pb-6">
        {products.length === 0 ? <p className="text-[#f4f0e6]/40 text-center text-xs py-8">Produtos do ponto aparecem aqui.</p> : products.slice(0, 6).map((p) => (
          <div key={p.id} className="flex overflow-hidden" style={glass}>
            {p.image_url && <img src={p.image_url} alt="" className="w-16 h-16 object-cover" />}
            <div className="p-3 flex-1 min-w-0">
              <h3 className="font-serif text-sm text-[#f4f0e6] truncate">{p.name}</h3>
              <span className="text-[#D6C49A] text-sm">{brl(p.promo_price > 0 ? p.promo_price : p.price)}</span>
            </div>
            <div className="flex items-center pr-3"><span className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgba(214,196,154,0.15)', color: '#D6C49A' }}>+</span></div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 p-3"><div className="py-3 text-center text-[11px] tracking-wider uppercase" style={{ background: '#D6C49A', color: '#14160f', borderRadius: 14 }}>Ver pedido</div></div>
    </div>
  )
}
