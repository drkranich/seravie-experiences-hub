import { useState, useRef } from 'react'
import { uploadTo } from '../../lib/storage'
import { Icon } from './ui'

// Campo de imagem do Seravie Flow: upload real (bucket 'flow') + alternativa por URL.
// Compacto e on-brand com o admin (glassmorphism champagne).
export function FlowImageField({ value, onChange, label = 'Imagem', folder = 'admin', accept = 'image', maxMB = 8, hint, compact = false }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef(null)

  const handle = async (file) => {
    if (!file) return
    setBusy(true); setErr('')
    const r = await uploadTo(file, { bucket: 'flow', folder, accept, maxMB })
    setBusy(false)
    if (r.error) setErr(r.error); else onChange(r.url)
  }

  const isImg = accept === 'image'

  // Layout compacto: thumbnail em cima, ações embaixo (ideal p/ colunas estreitas, ex. foto de perfil)
  if (compact) {
    return (
      <div>
        {label && <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{label}</label>}
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]) }}
          className="border border-dashed border-admin-champ/25 rounded-xl p-2.5 flex flex-col items-center gap-2">
          <input ref={ref} type="file" accept={isImg ? 'image/*' : undefined} className="hidden" onChange={(e) => handle(e.target.files[0])} />
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}
            className="w-full aspect-square rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:border-admin-champ/40 transition-colors">
            {value ? (isImg ? <img src={value} alt="" className="w-full h-full object-cover" /> : <Icon name="check" className="w-7 h-7 text-admin-sage" />) : <Icon name={busy ? 'spark' : 'image'} className="w-7 h-7 text-admin-muted/30" />}
          </button>
          <div className="flex items-center gap-2 text-[10px]">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-admin-champ hover:underline disabled:opacity-50">{busy ? 'Enviando…' : value ? 'Trocar' : 'Enviar'}</button>
            {value && <button type="button" onClick={() => onChange('')} className="text-admin-muted/50 hover:text-admin-rose">Remover</button>}
          </div>
          {err && <p className="text-admin-rose text-[10px] text-center">{err}</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {label && <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{label}</label>}
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]) }}
        className="border border-dashed border-admin-champ/25 rounded-xl p-3 flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
          {value ? (isImg ? <img src={value} alt="" className="w-full h-full object-cover" /> : <Icon name="check" className="w-6 h-6 text-admin-sage" />) : <Icon name="image" className="w-6 h-6 text-admin-muted/30" />}
        </div>
        <div className="flex-1 min-w-0">
          <input ref={ref} type="file" accept={isImg ? 'image/*' : undefined} className="hidden" onChange={(e) => handle(e.target.files[0])} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-admin-champ/15 text-admin-champ rounded-lg hover:bg-admin-champ/25 disabled:opacity-50">
              <Icon name={busy ? 'spark' : 'upload'} className="w-3.5 h-3.5" />{busy ? 'Enviando…' : 'Enviar arquivo'}
            </button>
            {value && <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] text-admin-muted/60 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" />Remover</button>}
          </div>
          <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="ou cole uma URL"
            className="mt-2 w-full glass-input rounded-lg px-3 py-1.5 text-xs text-admin-text outline-none" />
          {hint && !err && <p className="text-admin-muted/30 text-[10px] mt-1">{hint}</p>}
          {err && <p className="text-admin-rose text-[11px] mt-1">{err}</p>}
        </div>
      </div>
    </div>
  )
}
