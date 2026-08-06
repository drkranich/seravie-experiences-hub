import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * useAnchoredPopover — abre um popover em position:fixed via portal no <body>,
 * ancorado ao elemento gatilho. Como é fixo e fora da árvore, NENHUM ancestral
 * com overflow (inclusive o `overflow-x:hidden` do body) consegue recortá-lo.
 * Fecha ao rolar/redimensionar para não "descolar" do gatilho.
 */
function useAnchoredPopover(triggerRef, open, setOpen, { width = 'trigger', ideal = 280, popRef = null } = {}) {
  const [style, setStyle] = useState(null)
  useEffect(() => {
    if (!open) return
    const compute = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth, vh = window.innerHeight
      const below = vh - r.bottom, above = r.top
      const up = below < ideal && above > below
      const maxH = Math.max(160, Math.floor((up ? above : below) - 12))
      const w = width === 'trigger' ? r.width : width
      let left = r.left
      if (left + w > vw - 8) left = Math.max(8, vw - 8 - w)
      setStyle({
        position: 'fixed', left: `${left}px`, width: `${w}px`, maxHeight: `${maxH}px`, zIndex: 100,
        ...(up ? { bottom: `${vh - r.top + 6}px` } : { top: `${r.bottom + 6}px` }),
      })
    }
    compute()
    // Reposiciona o popover ao rolar/redimensionar em vez de fechá-lo.
    // Importante: rolar DENTRO do próprio popover (lista de opções com
    // overflow) não deve fechá-lo — por isso ignoramos scrolls cujo alvo
    // esteja contido no popover. Scrolls de containers externos apenas
    // reancoram o popover ao gatilho (throttle via requestAnimationFrame).
    let raf = 0
    const onScroll = (e) => {
      const pop = popRef && popRef.current
      if (pop && e.target instanceof Node && pop.contains(e.target)) return // scroll interno: manter aberto
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; compute() })
    }
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])
  return style
}

export function Icon({ name, className = 'w-5 h-5' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const s = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    layout: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </>
    ),
    spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </>
    ),
    folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13a1.7 1.7 0 00.1-1l1.9-1.4-2-3.4-2.2 1a1.7 1.7 0 00-1.7-1l-.3-2.4h-4l-.3 2.4a1.7 1.7 0 00-1.7 1l-2.2-1-2 3.4L5 12a1.7 1.7 0 000 2l-1.9 1.4 2 3.4 2.2-1a1.7 1.7 0 001.7 1l.3 2.4h4l.3-2.4a1.7 1.7 0 001.7-1l2.2 1 2-3.4L19.4 13z" />
      </>
    ),
    logout: <path d="M15 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3M10 17l-5-5 5-5M5 12h12" />,
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
    check: <path d="M5 12l4 4 10-11" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </>
    ),
    link: <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />,
    star: <path d="M12 3l2.5 6.5L21 10l-5 4.3L17.5 21 12 17l-5.5 4L7 14.3 2 10l6.5-.5z" />,
    external: <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" />,
    up: <path d="M6 15l6-6 6 6" />,
    down: <path d="M6 9l6 6 6-6" />,
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 012-2h8" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
    tag: (
      <>
        <path d="M3 12l9-9 9 9-9 9z" />
        <circle cx="12" cy="8" r="1.3" />
      </>
    ),
    leaf: <path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16zM4 20c3-6 7-9 12-11" />,
    book: (
      <>
        <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
        <path d="M5 4v13" />
      </>
    ),
    cup: (
      <>
        <path d="M6 8h11v5a5 5 0 01-5 5H11a5 5 0 01-5-5z" />
        <path d="M17 9h2a2 2 0 010 4h-2" />
        <path d="M8 3v2M12 3v2" />
      </>
    ),
    wine: (
      <>
        <path d="M8 3h8s-.5 8-4 8-4-8-4-8z" />
        <path d="M12 11v6M9 21h6" />
      </>
    ),
    building: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="1" />
        <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      </>
    ),
    map: (
      <>
        <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
    heart: <path d="M12 20s-7-4.3-9.3-8.5C1.2 8.6 2.7 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.3 0 4.8 3.1 3.3 6C19 15.7 12 20 12 20z" />,
    gift: (
      <>
        <rect x="4" y="9" width="16" height="11" rx="1" />
        <path d="M4 13h16M12 9v11" />
        <path d="M12 9C11 5 6 5 7 8c.5 1.5 5 1 5 1zM12 9c1-4 6-4 5-1-.5 1.5-5 1-5 1z" />
      </>
    ),
    pen: <path d="M4 20l4-1 10-10-3-3L5 16zM14 6l3 3" />,
    chart: (
      <>
        <path d="M4 20V4M4 20h16" />
        <path d="M8 20v-6M12 20V8M16 20v-9" />
      </>
    ),
    box: (
      <>
        <path d="M3 8l9-4 9 4-9 4z" />
        <path d="M3 8v8l9 4 9-4V8M12 12v8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </>
    ),
    palette: (
      <>
        <path d="M12 3a9 9 0 000 18c1.7 0 2-1.3 1.2-2.2-.8-.9-.5-2.2.8-2.2H17a4 4 0 004-4c0-5-4-9.6-9-9.6z" />
        <circle cx="7.5" cy="10.5" r="1" />
        <circle cx="12" cy="7.5" r="1" />
        <circle cx="16.5" cy="10.5" r="1" />
      </>
    ),
    cart: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
        <path d="M3 4h2l2.2 11.2a1 1 0 001 .8h8.5a1 1 0 001-.8L20.5 8H6.2" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" className={className} {...p}>
      {s[name] || s.spark}
    </svg>
  )
}

export function AdminBtn({ children, onClick, variant = 'primary', type = 'button', disabled, className = '', icon }) {
  const styles = {
    primary: 'btn-gradient font-medium',
    ghost: 'border border-admin-champ/20 text-admin-champ hover:bg-white/5',
    danger: 'border border-admin-rose/40 text-admin-rose hover:bg-admin-rose/10',
    subtle: 'text-admin-muted hover:text-admin-champ',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-[11px] tracking-widerx uppercase transition-all duration-300 rounded-xl disabled:opacity-50 ${styles} ${className}`}
    >
      {icon && <Icon name={icon} className="w-4 h-4" />}
      {children}
    </button>
  )
}

const inputCls =
  'w-full glass-input rounded-xl px-3.5 py-2.5 text-admin-text placeholder-admin-muted/40 outline-none text-sm'

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-widerx uppercase text-admin-muted/70 mb-2">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-admin-muted/50 mt-1">{hint}</span>}
    </label>
  )
}

export function TextInput({ className = '', ...rest }) {
  return <input {...rest} className={`${inputCls} ${className}`} />
}

export function TextArea({ className = '', ...rest }) {
  return <textarea {...rest} className={`${inputCls} resize-none ${className}`} />
}

export function Card({ children, className = '' }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>
}

export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-admin-champ' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-admin-bg transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}

/**
 * GlassSelect — dropdown do design system Seravie.
 * Regra geral: todo formulário usa glassmorphism, inclusive a lista de opções
 * (impossível com <select> nativo, que herda a aparência do sistema operacional).
 *
 * options: array de strings OU de { value, label }.
 * onChange: recebe o VALOR selecionado diretamente (não o evento).
 */
export function GlassSelect({ value, onChange, options = [], placeholder = 'Selecione', className = '', disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const popRef = useRef(null)
  const style = useAnchoredPopover(ref, open, setOpen, { width: 'trigger', ideal: 300, popRef })
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find((o) => String(o.value) === String(value))

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none flex items-center justify-between gap-2 text-left disabled:opacity-50"
      >
        <span className={`truncate ${current ? '' : 'text-admin-muted/40'}`}>{current ? current.label : placeholder}</span>
        <Icon name={open ? 'up' : 'down'} className="w-4 h-4 text-admin-champ/60 shrink-0" />
      </button>
      {open && style && createPortal(
        <div ref={popRef} style={style} className="glass-pop rounded-xl p-1 overflow-auto">
          {opts.length === 0 && <p className="px-3.5 py-2 text-sm text-admin-muted/40">Sem opções</p>}
          {opts.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-sm transition-colors ${
                String(o.value) === String(value)
                  ? 'bg-admin-champ/15 text-admin-champ'
                  : 'text-admin-text hover:bg-white/[0.06]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>, document.body
      )}
    </div>
  )
}

/**
 * GlassMulti — seleção múltipla glassmorphism (mesma ancoragem do GlassSelect).
 * value/onChange trabalham com um array de valores.
 */
export function GlassMulti({ value = [], onChange, options = [], placeholder = 'Selecione', className = '', disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const popRef = useRef(null)
  const style = useAnchoredPopover(ref, open, setOpen, { width: 'trigger', ideal: 300, popRef })
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const sel = Array.isArray(value) ? value : []
  const flip = (v) => { onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]) }
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none flex items-center justify-between gap-2 text-left disabled:opacity-50">
        <span className={`truncate ${sel.length ? '' : 'text-admin-muted/40'}`}>{sel.length ? `${sel.length} selecionado${sel.length > 1 ? 's' : ''}: ${sel.slice(0, 6).join(', ')}${sel.length > 6 ? '…' : ''}` : placeholder}</span>
        <Icon name={open ? 'up' : 'down'} className="w-4 h-4 text-admin-champ/60 shrink-0" />
      </button>
      {open && style && createPortal(
        <div ref={popRef} style={style} className="glass-pop rounded-xl p-1 overflow-auto">
          {opts.map((o) => {
            const on = sel.includes(o.value)
            return (
              <button key={String(o.value)} type="button" onClick={() => flip(o.value)}
                className={`w-full text-left px-3.5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${on ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-text hover:bg-white/[0.06]'}`}>
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'border-admin-champ bg-admin-champ/20' : 'border-white/20'}`}>{on && <Icon name="check" className="w-2.5 h-2.5" />}</span>
                {o.label}
              </button>
            )
          })}
        </div>, document.body
      )}
    </div>
  )
}

/**
 * GlassDate — calendário/date picker do design system Seravie.
 * Regra geral: todo calendário usa glassmorphism (glass-pop escuro, não
 * translúcido demais). Substitui o <input type="date"> nativo, cujo popup
 * é desenhado pelo sistema operacional e não pode ser estilizado.
 * value/onChange usam o formato 'YYYY-MM-DD' (compatível com o banco).
 */
const pad2 = (n) => String(n).padStart(2, '0')
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const parseYMD = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }

// Limites do container rolável mais próximo (ex.: o card/modal), para o
// popover abrir para o lado com mais espaço e nunca ser truncado.
function nearestBounds(el) {
  let p = el?.parentElement
  while (p) {
    const s = getComputedStyle(p)
    if (/(auto|scroll|hidden)/.test(s.overflowY + s.overflow)) return p.getBoundingClientRect()
    p = p.parentElement
  }
  return { top: 0, bottom: window.innerHeight }
}
// Decide direção (cima/baixo) e altura máxima do popover dado o espaço disponível.
function popoverPlacement(el, ideal) {
  const r = el.getBoundingClientRect()
  const b = nearestBounds(el)
  const below = b.bottom - r.bottom
  const above = r.top - b.top
  const up = below < ideal && above > below
  return { up, maxH: Math.max(180, Math.floor((up ? above : below) - 14)) }
}

export function GlassDate({ value, onChange, placeholder = 'dd/mm/aaaa', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const popRef = useRef(null)
  const selected = value ? parseYMD(value) : null
  const [view, setView] = useState(selected || new Date())
  const style = useAnchoredPopover(ref, open, setOpen, { width: 256, ideal: 340, popRef })

  const toggle = () => setOpen((o) => { if (!o) setView(selected || new Date()); return !o })

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const y = view.getFullYear(), m = view.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const today = new Date()
  const same = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1))]
  const monthLabel = view.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const pick = (d) => { onChange(toYMD(d)); setOpen(false) }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={toggle}
        className="w-full glass-input rounded-xl px-4 py-2.5 text-sm outline-none flex items-center justify-between gap-2 text-left">
        <span className={selected ? 'text-admin-text' : 'text-admin-muted/40'}>{selected ? `${pad2(selected.getDate())}/${pad2(selected.getMonth() + 1)}/${selected.getFullYear()}` : placeholder}</span>
        <Icon name="calendar" className="w-4 h-4 text-admin-champ/60 shrink-0" />
      </button>
      {open && style && createPortal(
        <div ref={popRef} style={style} className="glass-pop rounded-xl p-2.5 shadow-2xl overflow-auto">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-admin-champ text-xs font-medium capitalize">{monthLabel}</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="up" className="w-3.5 h-3.5 -rotate-90" /></button>
              <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="down" className="w-3.5 h-3.5 -rotate-90" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="text-center text-[9px] text-admin-muted/40 py-0.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => d ? (
              <button key={i} type="button" onClick={() => pick(d)}
                className={`h-6 rounded-md text-[11px] transition-colors ${same(d, selected) ? 'bg-admin-champ text-admin-bg font-medium' : same(d, today) ? 'text-admin-champ ring-1 ring-admin-champ/30' : 'text-admin-text hover:bg-white/[0.06]'}`}>
                {d.getDate()}
              </button>
            ) : <div key={i} />)}
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/[0.06]">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-[11px] text-admin-muted/60 hover:text-admin-rose">Limpar</button>
            <button type="button" onClick={() => pick(new Date())} className="text-[11px] text-admin-champ hover:underline">Hoje</button>
          </div>
        </div>, document.body
      )}
    </div>
  )
}

// Compara a data de um registro (YYYY-MM-DD...) com o filtro selecionado do
// GlassMonth. Se o filtro é por dia (10 chars) compara o dia exato; se por mês
// (7 chars) compara o mês. Retrocompatível com filtros de mês existentes.
export function matchPeriod(recordDate, filter) {
  const d = String(recordDate || '')
  const f = String(filter || '')
  if (!d || !f) return false
  return f.length >= 10 ? d.slice(0, 10) === f : d.slice(0, 7) === f
}

/**
 * GlassMonth — seletor com DUAS opções (glassmorphism): por MÊS (YYYY-MM) e por
 * DIA (YYYY-MM-DD). Um toggle no popover alterna entre os modos.
 * onChange(value, mode): mode é 'month' (value 'YYYY-MM') ou 'day' (value 'YYYY-MM-DD').
 * Painéis que ignoram o 2º argumento seguem funcionando por mês (retrocompatível).
 */
export function GlassMonth({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const labelRef = useRef(null)
  const popRef = useRef(null)
  const style = useAnchoredPopover(labelRef, open, setOpen, { width: 256, ideal: 360, popRef })
  const isDay = String(value || '').length === 10 // 'YYYY-MM-DD'
  const [mode, setMode] = useState(isDay ? 'day' : 'month')
  const parts = String(value || '').split('-').map(Number)
  const cy = parts[0] || new Date().getFullYear()
  const cm = parts[1] || (new Date().getMonth() + 1)
  const cd = parts[2] || null
  const [viewYear, setViewYear] = useState(cy)
  const [viewMonth, setViewMonth] = useState(cm) // para o calendário de dias
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  const shift = (delta) => {
    if (isDay && cd) { const d = new Date(cy, cm - 1, cd + delta); onChange(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, 'day') }
    else { const d = new Date(cy, cm - 1 + delta, 1); onChange(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, 'month') }
  }
  const label = isDay && cd
    ? new Date(cy, cm - 1, cd).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(cy, cm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const pickMonth = (mi) => { onChange(`${viewYear}-${pad2(mi + 1)}`, 'month'); setOpen(false) }
  const pickDay = (d) => { onChange(`${viewYear}-${pad2(viewMonth)}-${pad2(d)}`, 'day'); setOpen(false) }

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  // grade de dias do mês em visualização
  const daysInView = new Date(viewYear, viewMonth, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay()
  const dayCells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInView }, (_, i) => i + 1)]

  return (
    <div ref={ref} className={`relative flex items-center gap-1 ${className}`}>
      <button type="button" onClick={() => shift(-1)} className="w-8 h-8 rounded-lg glass-input hover:bg-white/[0.06] flex items-center justify-center text-admin-muted shrink-0"><Icon name="up" className="w-4 h-4 -rotate-90" /></button>
      <button ref={labelRef} type="button" onClick={() => { setViewYear(cy); setViewMonth(cm); setOpen((o) => !o) }} className="glass-input rounded-xl px-3 py-2 text-sm text-admin-text capitalize min-w-[9rem] text-center">{label}</button>
      <button type="button" onClick={() => shift(1)} className="w-8 h-8 rounded-lg glass-input hover:bg-white/[0.06] flex items-center justify-center text-admin-muted shrink-0"><Icon name="down" className="w-4 h-4 -rotate-90" /></button>
      {open && style && createPortal(
        <div ref={popRef} style={style} className="glass-pop rounded-xl p-2.5 shadow-2xl overflow-auto">
          {/* toggle Mês | Dia */}
          <div className="flex gap-1 mb-2.5 bg-white/[0.04] rounded-lg p-0.5">
            <button type="button" onClick={() => setMode('month')} className={`flex-1 py-1.5 rounded-md text-[11px] transition-colors ${mode === 'month' ? 'bg-admin-champ/20 text-admin-champ' : 'text-admin-muted/60 hover:text-admin-text'}`}>Por mês</button>
            <button type="button" onClick={() => setMode('day')} className={`flex-1 py-1.5 rounded-md text-[11px] transition-colors ${mode === 'day' ? 'bg-admin-champ/20 text-admin-champ' : 'text-admin-muted/60 hover:text-admin-text'}`}>Por data</button>
          </div>

          {mode === 'month' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setViewYear((v) => v - 1)} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="up" className="w-3.5 h-3.5 -rotate-90" /></button>
                <p className="text-admin-champ text-sm font-medium">{viewYear}</p>
                <button type="button" onClick={() => setViewYear((v) => v + 1)} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="down" className="w-3.5 h-3.5 -rotate-90" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((mm, i) => {
                  const sel = !isDay && viewYear === cy && i + 1 === cm
                  return <button key={i} type="button" onClick={() => pickMonth(i)} className={`py-2 rounded-lg text-xs transition-colors ${sel ? 'bg-admin-champ text-admin-bg font-medium' : 'text-admin-text hover:bg-white/[0.06]'}`}>{mm}</button>
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => { const d = new Date(viewYear, viewMonth - 2, 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth() + 1) }} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="up" className="w-3.5 h-3.5 -rotate-90" /></button>
                <p className="text-admin-champ text-sm font-medium capitalize">{new Date(viewYear, viewMonth - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                <button type="button" onClick={() => { const d = new Date(viewYear, viewMonth, 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth() + 1) }} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] text-admin-muted flex items-center justify-center"><Icon name="down" className="w-3.5 h-3.5 -rotate-90" /></button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="text-center text-[9px] text-admin-muted/40 py-0.5">{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-0.5">
                {dayCells.map((d, i) => d ? (
                  <button key={i} type="button" onClick={() => pickDay(d)} className={`h-6 rounded-md text-[11px] transition-colors ${isDay && d === cd && viewMonth === cm && viewYear === cy ? 'bg-admin-champ text-admin-bg font-medium' : 'text-admin-text hover:bg-white/[0.06]'}`}>{d}</button>
                ) : <div key={i} />)}
              </div>
            </>
          )}
        </div>, document.body
      )}
    </div>
  )
}

export function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
