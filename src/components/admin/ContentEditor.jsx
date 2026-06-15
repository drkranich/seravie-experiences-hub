import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Field, TextInput, TextArea, Toggle, AdminBtn, Spinner } from './ui'
import { ImageUpload } from './ImageUpload'

const isImageKey = (k) => /image|url|background|photo|foto|imagem|fundo/i.test(k)
const isLongKey = (k) => /subtitle|description|texto|paragraph|conteudo|content/i.test(k)

function SectionRow({ section, onChanged, notify }) {
  const [title, setTitle] = useState(section.title || '')
  const [published, setPublished] = useState(!!section.published)
  const [content, setContent] = useState({ ...(section.content || {}) })
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setContent((c) => ({ ...c, [k]: v }))

  const keys = Object.keys(content).filter((k) => typeof content[k] === 'string' && !isImageKey(k))

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('sections')
      .update({ title, published, content })
      .eq('id', section.id)
    setSaving(false)
    if (error) notify('Erro ao salvar: ' + error.message, 'error')
    else {
      notify('Seção salva.', 'success')
      onChanged()
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] tracking-widerx uppercase text-gold">{section.key}</span>
        <label className="flex items-center gap-3 text-sm text-ivory/65">
          <Toggle checked={published} onChange={setPublished} />
          {published ? 'Publicada' : 'Oculta'}
        </label>
      </div>

      <div className="space-y-4">
        <Field label="Identificação (interna)">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        {keys.map((k) => (
          <Field key={k} label={k}>
            {isLongKey(k) ? (
              <TextArea rows="2" value={content[k]} onChange={(e) => setField(k, e.target.value)} />
            ) : (
              <TextInput value={content[k]} onChange={(e) => setField(k, e.target.value)} />
            )}
          </Field>
        ))}

        <ImageUpload
          value={content.background_url || ''}
          onChange={(url) => setField('background_url', url)}
          label="Imagem de fundo (opcional)"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <AdminBtn variant="primary" icon={saving ? undefined : 'check'} onClick={save} disabled={saving}>
          {saving ? 'Salvando' : 'Salvar seção'}
        </AdminBtn>
      </div>
    </Card>
  )
}

export function ContentEditor({ notify }) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('sections').select('*').order('order', { ascending: true })
    setSections(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-ivory">Conteúdo do site</h1>
        <p className="text-ivory/45 mt-2">Textos e imagens das seções editoriais da home.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-ivory/40">
          <Spinner /> Carregando…
        </div>
      ) : sections.length === 0 ? (
        <Card className="p-10 text-center text-ivory/40">Nenhuma seção cadastrada.</Card>
      ) : (
        <div className="space-y-5">
          {sections.map((s) => (
            <SectionRow key={s.id} section={s} onChanged={load} notify={notify} />
          ))}
        </div>
      )}
    </div>
  )
}
