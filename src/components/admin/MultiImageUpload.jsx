import { useState, useRef } from 'react'
import { uploadFile } from '../../lib/storage'
import { Icon, Spinner } from './ui'

export function MultiImageUpload({ value, onChange, label = 'Galeria' }) {
  const images = Array.isArray(value) ? value : []
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef(null)

  const add = async (files) => {
    if (!files || !files.length) return
    setBusy(true)
    setErr('')
    const urls = []
    for (const f of files) {
      const r = await uploadFile(f)
      if (r.error) setErr(r.error)
      else urls.push(r.url)
    }
    setBusy(false)
    onChange([...images, ...urls])
  }
  const remove = (i) => onChange(images.filter((_, idx) => idx !== i))

  return (
    <div>
      <span className="block text-[10px] tracking-widerx uppercase text-admin-muted/70 mb-2">{label}</span>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-admin-champ/15 group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/80 text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="x" className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => ref.current && ref.current.click()}
          disabled={busy}
          className="w-20 h-20 rounded-lg border border-dashed border-admin-champ/30 flex items-center justify-center text-admin-champ hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          {busy ? <Spinner className="w-5 h-5" /> : <Icon name="plus" className="w-5 h-5" />}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => add([...e.target.files])}
        />
      </div>
      {err && <p className="text-xs text-admin-rose mt-1">{err}</p>}
    </div>
  )
}
