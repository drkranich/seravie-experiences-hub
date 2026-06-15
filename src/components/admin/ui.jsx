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
  }
  return (
    <svg viewBox="0 0 24 24" className={className} {...p}>
      {s[name] || s.spark}
    </svg>
  )
}

export function AdminBtn({ children, onClick, variant = 'primary', type = 'button', disabled, className = '', icon }) {
  const styles = {
    primary: 'bg-gold text-ink hover:bg-champagne',
    ghost: 'border border-gold/30 text-champagne hover:bg-gold/10',
    danger: 'border border-red-500/40 text-red-300 hover:bg-red-500/10',
    subtle: 'text-ivory/55 hover:text-gold',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-widerx uppercase transition-colors rounded-md disabled:opacity-50 ${styles} ${className}`}
    >
      {icon && <Icon name={icon} className="w-4 h-4" />}
      {children}
    </button>
  )
}

const inputCls =
  'w-full bg-ink/50 border border-gold/15 focus:border-gold/50 rounded-md px-3 py-2.5 text-ivory placeholder-ivory/25 outline-none transition-colors text-sm'

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-widerx uppercase text-ivory/45 mb-2">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ivory/30 mt-1">{hint}</span>}
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
  return <div className={`bg-moss/30 border border-gold/10 rounded-xl ${className}`}>{children}</div>
}

export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-gold' : 'bg-ivory/20'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-ink transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
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
