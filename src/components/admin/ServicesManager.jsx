import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Field, TextInput, TextArea, Toggle, AdminBtn, Icon, Spinner } from './ui'

const ICONS = ['spark', 'palette', 'tag', 'book', 'leaf', 'compass', 'cup', 'heart', 'map', 'building', 'home', 'wine']

function ServiceRow({ item, onChanged, notify }) {
  const [d, setD] = useState({
    title: item.title || '',
    description: item.description || '',
    icon_name: item.icon_name || 'spark',
    published: !!item.published,
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('specialties').update(d).eq('id', item.id)
    setSaving(false)
    if (error) notify('Erro ao salvar: ' + error.message, 'error')
    else {
      notify('Serviço salvo.', 'success')
      onChanged()
    }
  }

  const del = async () => {
    if (!window.confirm('Excluir este serviço?')) return
    const { error } = await supabase.from('specialties').delete().eq('id', item.id)
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Serviço excluído.', 'success')
      onChanged()
    }
  }

  return (
    <Card className="p-5">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Título">
          <TextInput value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
        <Field label="Ícone">
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setD({ ...d, icon_name: ic })}
                className={`w-9 h-9 rounded-md flex items-center justify-center border transition-colors ${
                  d.icon_name === ic ? 'border-gold bg-gold/15 text-gold' : 'border-gold/15 text-ivory/50 hover:border-gold/40'
                }`}
              >
                <Icon name={ic} className="w-4 h-4" />
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Descrição">
          <TextArea rows="2" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <label className="flex items-center gap-3 text-sm text-ivory/65">
          <Toggle checked={d.published} onChange={(v) => setD({ ...d, published: v })} />
          {d.published ? 'Publicado' : 'Rascunho'}
        </label>
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

export function ServicesManager({ notify }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('specialties').select('*').order('order', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    const { error } = await supabase.from('specialties').insert([
      { title: 'Novo serviço', description: 'Descrição...', icon_name: 'spark', order: items.length + 1, published: false },
    ])
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Serviço criado.', 'success')
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-ivory">Serviços</h1>
          <p className="text-ivory/45 mt-2">Entregáveis exibidos na seção “O que entregamos”.</p>
        </div>
        <AdminBtn icon="plus" onClick={add}>
          Novo serviço
        </AdminBtn>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-ivory/40">
          <Spinner /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-ivory/40">Nenhum serviço ainda. Crie o primeiro.</Card>
      ) : (
        <div className="space-y-5">
          {items.map((it) => (
            <ServiceRow key={it.id} item={it} onChanged={load} notify={notify} />
          ))}
        </div>
      )}
    </div>
  )
}
