import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, Field, TextInput, TextArea, Toggle, AdminBtn, Icon, Spinner } from './ui'
import { ImageUpload } from './ImageUpload'

const ICONS = [
  'spark', 'palette', 'tag', 'book', 'leaf', 'compass', 'cup', 'heart',
  'map', 'building', 'home', 'wine', 'star', 'user', 'gift', 'search', 'pen', 'check',
]

function FieldInput({ field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return <TextArea rows={field.rows || 3} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    case 'toggle':
      return <Toggle checked={!!value} onChange={onChange} />
    case 'number':
      return (
        <TextInput
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'icon':
      return (
        <div className="flex flex-wrap gap-2">
          {ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => onChange(ic)}
              className={`w-9 h-9 rounded-md flex items-center justify-center border transition-colors ${
                value === ic
                  ? 'border-admin-champ bg-admin-champ/15 text-admin-champ'
                  : 'border-admin-champ/15 text-admin-muted hover:border-admin-champ/40'
              }`}
            >
              <Icon name={ic} className="w-4 h-4" />
            </button>
          ))}
        </div>
      )
    case 'tags':
      return (
        <TextInput
          value={Array.isArray(value) ? value.join(', ') : value || ''}
          onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="separe por vírgulas"
        />
      )
    case 'select':
      return (
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                value === o
                  ? 'border-admin-champ bg-admin-champ/15 text-admin-champ'
                  : 'border-admin-champ/15 text-admin-muted hover:border-admin-champ/40'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )
    default:
      return <TextInput value={value || ''} onChange={(e) => onChange(e.target.value)} />
  }
}

function Row({ table, item, fields, onChanged, notify }) {
  const init = {}
  fields.forEach((f) => {
    init[f.key] = item[f.key]
  })
  const [d, setD] = useState(init)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setD((s) => ({ ...s, [k]: v }))
  const toggleField = fields.find((f) => f.type === 'toggle')

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from(table).update(d).eq('id', item.id)
    setSaving(false)
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Salvo.', 'success')
      onChanged()
    }
  }

  const del = async () => {
    if (!window.confirm('Excluir este item?')) return
    const { error } = await supabase.from(table).delete().eq('id', item.id)
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Excluído.', 'success')
      onChanged()
    }
  }

  return (
    <Card className="p-5">
      <div className="grid md:grid-cols-2 gap-4">
        {fields
          .filter((f) => f.type !== 'toggle')
          .map((f) => (
            <div key={f.key} className={f.full || f.type === 'image' || f.type === 'textarea' ? 'md:col-span-2' : ''}>
              {f.type === 'image' ? (
                <ImageUpload label={f.label} value={d[f.key] || ''} onChange={(v) => set(f.key, v)} />
              ) : (
                <Field label={f.label}>
                  <FieldInput field={f} value={d[f.key]} onChange={(v) => set(f.key, v)} />
                </Field>
              )}
            </div>
          ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        {toggleField ? (
          <label className="flex items-center gap-3 text-sm text-admin-muted">
            <Toggle checked={!!d[toggleField.key]} onChange={(v) => set(toggleField.key, v)} />
            {d[toggleField.key] ? 'Publicado' : 'Rascunho'}
          </label>
        ) : (
          <span />
        )}
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

export function CollectionManager({ table, title, subtitle, fields, orderColumn = 'sort_order', newDefault, notify }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from(table).select('*').order(orderColumn, { ascending: true })
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => {
    setLoading(true)
    load()
  }, [table])

  const add = async () => {
    const base = typeof newDefault === 'function' ? newDefault() : { ...(newDefault || {}) }
    if (fields.some((f) => f.key === 'sort_order') && base.sort_order == null) base.sort_order = items.length + 1
    const { error } = await supabase.from(table).insert([base])
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Item criado.', 'success')
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">{title}</h1>
          {subtitle && <p className="text-admin-muted/70 mt-2">{subtitle}</p>}
        </div>
        <AdminBtn icon="plus" onClick={add}>
          Novo
        </AdminBtn>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-admin-muted">
          <Spinner /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-admin-muted">Nenhum item ainda. Crie o primeiro.</Card>
      ) : (
        <div className="space-y-5">
          {items.map((it) => (
            <Row key={it.id} table={table} item={it} fields={fields} onChanged={load} notify={notify} />
          ))}
        </div>
      )}
    </div>
  )
}
