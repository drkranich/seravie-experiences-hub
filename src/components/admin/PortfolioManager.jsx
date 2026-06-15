import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Field, TextInput, TextArea, Toggle, AdminBtn, Spinner } from './ui'
import { ImageUpload } from './ImageUpload'
import { MultiImageUpload } from './MultiImageUpload'

function PortfolioRow({ item, onChanged, notify }) {
  const [d, setD] = useState({
    title: item.title || '',
    description: item.description || '',
    category: item.category || '',
    link: item.link || '',
    image_url: item.image_url || '',
    gallery: Array.isArray(item.gallery) ? item.gallery : [],
    featured: !!item.featured,
    published: !!item.published,
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('portfolio_items').update(d).eq('id', item.id)
    setSaving(false)
    if (error) notify('Erro ao salvar: ' + error.message, 'error')
    else {
      notify('Projeto salvo.', 'success')
      onChanged()
    }
  }

  const del = async () => {
    if (!window.confirm('Excluir este projeto?')) return
    const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id)
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Projeto excluído.', 'success')
      onChanged()
    }
  }

  return (
    <Card className="p-5">
      <div className="grid lg:grid-cols-2 gap-5">
        <ImageUpload value={d.image_url} onChange={(url) => setD({ ...d, image_url: url })} label="Imagem de capa (placeholder)" />
        <div className="space-y-4">
          <Field label="Título">
            <TextInput value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <TextInput value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} />
            </Field>
            <Field label="Link (opcional)">
              <TextInput value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Field label="Descrição">
          <TextArea rows="2" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4">
        <MultiImageUpload
          value={d.gallery}
          onChange={(g) => setD({ ...d, gallery: g })}
          label="Galeria (aparece ao abrir a página do projeto)"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 text-sm text-ivory/65">
            <Toggle checked={d.published} onChange={(v) => setD({ ...d, published: v })} />
            {d.published ? 'Publicado' : 'Rascunho'}
          </label>
          <label className="flex items-center gap-3 text-sm text-ivory/65">
            <Toggle checked={d.featured} onChange={(v) => setD({ ...d, featured: v })} />
            Destaque
          </label>
        </div>
        <div className="flex items-center gap-2">
          <AdminBtn variant="danger" icon="trash" onClick={del}>
            Excluir
          </AdminBtn>
          <AdminBtn variant="primary" icon={saving ? undefined : 'check'} onClick={save} disabled={saving}>
            {saving ? 'Salvando' : 'Salvar'}
          </AdminBtn>
        </div>
      </div>
    </Card>
  )
}

export function PortfolioManager({ notify }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('portfolio_items').select('*').order('order', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    const { error } = await supabase.from('portfolio_items').insert([
      { title: 'Novo projeto', description: 'Descrição...', category: 'Experiência', order: items.length + 1, published: false },
    ])
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Projeto criado.', 'success')
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-ivory">Portfólio</h1>
          <p className="text-ivory/45 mt-2">Projetos exibidos na seção de experiências.</p>
        </div>
        <AdminBtn icon="plus" onClick={add}>
          Novo projeto
        </AdminBtn>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-ivory/40">
          <Spinner /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-ivory/40">Nenhum projeto ainda. Crie o primeiro.</Card>
      ) : (
        <div className="space-y-5">
          {items.map((it) => (
            <PortfolioRow key={it.id} item={it} onChanged={load} notify={notify} />
          ))}
        </div>
      )}
    </div>
  )
}
