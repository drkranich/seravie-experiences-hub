import { useState, useRef } from 'react'
import { uploadFile } from '../../lib/storage'
import { Icon, Spinner } from './ui'

export function ImageUpload({ value, onChange, label = 'Imagem' }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef(null)

  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    setErr('')
    const r = await uploadFile(file)
    setBusy(false)
    if (r.error) setErr(r.error)
    else onChange(r.url)
  }

  return (
    <div>
      <span className="block text-[10px] tracking-widerx uppercase text-ivory/45 mb-2">{label}</span>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handle(e.dataTransfer.files[0])
        }}
        className="border border-dashed border-gold/25 rounded-xl p-4 flex items-center gap-4"
      >
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-ink/50 border border-gold/10 flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon name="image" className="w-7 h-7 text-ivory/25" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files[0])} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => ref.current && ref.current.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 text-[11px] tracking-widerx uppercase bg-gold/15 text-champagne border border-gold/30 rounded-md hover:bg-gold/25 transition-colors disabled:opacity-50"
            >
              {busy ? <Spinner className="w-4 h-4" /> : <Icon name="upload" className="w-4 h-4" />}
              {busy ? 'Enviando' : 'Enviar imagem'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-2 px-3 py-2 text-[11px] tracking-widerx uppercase text-ivory/50 hover:text-red-300 transition-colors"
              >
                <Icon name="x" className="w-4 h-4" />
                Remover
              </button>
            )}
          </div>
          <input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ou cole uma URL de imagem"
            className="mt-2 w-full bg-ink/50 border border-gold/15 focus:border-gold/50 rounded-md px-3 py-2 text-ivory placeholder-ivory/25 outline-none text-xs transition-colors"
          />
          {err && <p className="text-xs text-red-300 mt-1">{err}</p>}
        </div>
      </div>
    </div>
  )
}
