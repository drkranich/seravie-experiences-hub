import { useState, useEffect, useRef } from 'react'
import { listFiles, removeFile, uploadFile } from '../../lib/storage'
import { Card, AdminBtn, Icon, Spinner } from './ui'

export function MediaLibrary({ notify }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  const load = async () => {
    setLoading(true)
    const { files, error } = await listFiles()
    if (error) notify('Erro: ' + error, 'error')
    setFiles(files || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    const r = await uploadFile(file)
    setBusy(false)
    if (r.error) notify('Erro: ' + r.error, 'error')
    else {
      notify('Imagem enviada.', 'success')
      load()
    }
  }

  const copy = (url) => {
    if (navigator.clipboard) navigator.clipboard.writeText(url)
    notify('URL copiada.', 'success')
  }

  const del = async (name) => {
    if (!window.confirm('Excluir esta imagem?')) return
    const { error } = await removeFile(name)
    if (error) notify('Erro: ' + error, 'error')
    else {
      notify('Imagem excluída.', 'success')
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-ivory">Biblioteca de mídia</h1>
          <p className="text-ivory/45 mt-2">Imagens armazenadas no Supabase Storage.</p>
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
        <AdminBtn icon={busy ? undefined : 'upload'} onClick={() => ref.current && ref.current.click()} disabled={busy}>
          {busy ? 'Enviando' : 'Enviar imagem'}
        </AdminBtn>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          upload(e.dataTransfer.files[0])
        }}
        className="border border-dashed border-gold/20 rounded-xl p-6 mb-8 text-center text-ivory/40 text-sm"
      >
        Arraste e solte uma imagem aqui para enviar.
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-ivory/40">
          <Spinner /> Carregando…
        </div>
      ) : files.length === 0 ? (
        <Card className="p-10 text-center text-ivory/40">Nenhuma imagem ainda.</Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((f) => (
            <Card key={f.name} className="overflow-hidden group">
              <div className="aspect-square bg-ink/50">
                <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <p className="text-[11px] text-ivory/50 truncate" title={f.name}>
                  {f.name}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => copy(f.url)}
                    className="flex items-center gap-1.5 text-[10px] tracking-widerx uppercase text-champagne hover:text-gold transition-colors"
                  >
                    <Icon name="copy" className="w-3.5 h-3.5" /> URL
                  </button>
                  <button
                    onClick={() => del(f.name)}
                    className="flex items-center gap-1.5 text-[10px] tracking-widerx uppercase text-ivory/40 hover:text-red-300 transition-colors ml-auto"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
