import { useState, useRef } from 'react'
import { uploadTo } from '../../lib/storage'
import { Icon } from './ui'

// Detecta o tipo de arquivo pela URL/extensão
export const fileKind = (url = '') => {
  const u = url.split('?')[0].toLowerCase()
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/.test(u)) return 'image'
  if (/\.(mp4|webm|mov|m4v|ogg)$/.test(u)) return 'video'
  if (/\.(pdf)$/.test(u)) return 'pdf'
  return 'file'
}

// Botão compacto de anexo para compositores de conversa (imagem, vídeo, PDF).
// Faz upload no bucket 'flow' (pasta configurável) e devolve a URL via onAdd.
export function AttachButton({ onAdd, folder = 'tickets', notify }) {
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    const r = await uploadTo(file, { bucket: 'flow', folder, accept: 'any', maxMB: 50 })
    setBusy(false)
    if (r.error) notify?.(r.error, 'error')
    else onAdd({ url: r.url, name: file.name, kind: fileKind(file.name), size: file.size, mime: file.type })
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => { handle(e.target.files[0]); e.target.value = '' }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} title="Anexar imagem, vídeo ou PDF"
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ hover:bg-white/[0.08] transition-colors disabled:opacity-50">
        <Icon name={busy ? 'spark' : 'upload'} className="w-4 h-4" />
      </button>
    </>
  )
}

// Mostra os anexos pendentes (antes de enviar), com chip removível.
export function PendingAttachments({ items = [], onRemove }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {items.map((a, i) => (
        <div key={i} className="flex items-center gap-2 bg-white/[0.05] rounded-lg pl-2 pr-1 py-1">
          <AttChipIcon kind={a.kind} />
          <span className="text-admin-text/80 text-xs max-w-[140px] truncate">{a.name || 'arquivo'}</span>
          <button onClick={() => onRemove(i)} className="text-admin-muted/50 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  )
}

function AttChipIcon({ kind }) {
  const map = { image: 'image', video: 'star', pdf: 'book', file: 'upload' }
  return <Icon name={map[kind] || 'upload'} className="w-3.5 h-3.5 text-admin-champ/70" />
}

// Renderiza anexos DENTRO de uma mensagem/nota (preview por tipo).
export function AttachmentList({ items = [], compact = false }) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return null
  return (
    <div className={`flex flex-col gap-2 ${compact ? 'mt-1.5' : 'mt-2'}`}>
      {list.map((a, i) => {
        const k = a.kind || fileKind(a.url)
        if (k === 'image') return <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name || ''} className="rounded-xl max-h-48 object-cover border border-white/[0.06]" /></a>
        if (k === 'video') return <video key={i} src={a.url} controls className="rounded-xl max-h-56 w-full border border-white/[0.06]" />
        return (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white/[0.05] rounded-lg px-3 py-2 hover:bg-white/[0.08] transition-colors">
            <Icon name={k === 'pdf' ? 'book' : 'upload'} className="w-4 h-4 text-admin-champ/70 shrink-0" />
            <span className="text-admin-text/85 text-xs truncate flex-1">{a.name || (k === 'pdf' ? 'Documento PDF' : 'Arquivo')}</span>
            <span className="text-admin-champ text-[10px] shrink-0">abrir ↗</span>
          </a>
        )
      })}
    </div>
  )
}
