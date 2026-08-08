import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'

const FORM_KINDS = [
  { value: 'lead', label: 'Captura de lead', icon: 'user' },
  { value: 'quiz', label: 'Quiz', icon: 'spark' },
  { value: 'survey', label: 'Pesquisa', icon: 'check' },
  { value: 'nps', label: 'NPS', icon: 'star' },
  { value: 'signup', label: 'Cadastro', icon: 'plus' },
  { value: 'event', label: 'Inscrição em evento', icon: 'calendar' },
]
const KIND_MAP = Object.fromEntries(FORM_KINDS.map((k) => [k.value, k]))
const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Escolha única' },
  { value: 'rating', label: 'Nota (0–10)' },
]
let _fieldSeq = 0
const newField = (type = 'text') => ({ id: `f_${_fieldSeq++}_${type}`, type, label: '', required: false, options: [] })

// Growth Studio → Formulários. Construtor + respostas.
export function FormsTab({ tenantId, notify }) {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // form em edição
  const [viewing, setViewing] = useState(null)    // form cujas respostas ver

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('marketing_forms').select('*').order('created_at', { ascending: false }); setForms(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const startNew = (kind) => setEditing({
    id: null, name: '', kind: kind.value, description: '', is_active: true, success_message: 'Obrigado pelo envio!',
    fields: defaultFields(kind.value),
  })
  const remove = async (f) => { try { await supabase.from('marketing_forms').delete().eq('id', f.id) } catch { /* noop */ } notify('Formulário removido', 'success'); load() }

  if (editing) return <FormBuilder form={editing} tenantId={tenantId} notify={notify} onBack={() => { setEditing(null); load() }} onSaved={() => { setEditing(null); load() }} />
  if (viewing) return <FormResponses form={viewing} onBack={() => setViewing(null)} notify={notify} />

  return (
    <div>
      <p className="text-admin-muted/50 text-xs mb-4 leading-relaxed">Crie formulários de captura, quizzes, pesquisas e NPS. As respostas viram contatos no CRM automaticamente.</p>

      {/* tipos para criar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {FORM_KINDS.map((k) => (
          <button key={k.value} onClick={() => startNew(k)} className="glass rounded-xl p-3 text-center hover:bg-white/[0.03] transition-colors border border-transparent hover:border-admin-champ/20">
            <div className="w-8 h-8 rounded-lg bg-admin-champ/10 flex items-center justify-center mx-auto mb-1.5"><Icon name={k.icon} className="w-4 h-4 text-admin-champ/70" /></div>
            <p className="text-admin-text text-xs">{k.label}</p>
          </button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p>
        : forms.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum formulário ainda. Escolha um tipo acima para começar.</p></div>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forms.map((f) => {
              const kind = KIND_MAP[f.kind] || FORM_KINDS[0]
              return (
                <div key={f.id} className="glass rounded-2xl p-4 group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name={kind.icon} className="w-4 h-4 text-admin-champ/70" /></div>
                    <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{f.name || 'Sem nome'}</p><p className="text-admin-muted/40 text-xs">{kind.label} · {(f.fields || []).length} campos</p></div>
                    <span className={`text-[9px] px-2 py-0.5 rounded shrink-0 ${f.is_active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/40'}`}>{f.is_active ? 'ativo' : 'inativo'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05] text-xs">
                    <button onClick={() => setViewing(f)} className="text-admin-muted/60 hover:text-admin-text">{f.submissions_count || 0} respostas</button>
                    <button onClick={() => setEditing(f)} className="ml-auto text-admin-champ/80 hover:underline">editar</button>
                    <button onClick={() => remove(f)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

function defaultFields(kind) {
  if (kind === 'nps') return [newField('rating')].map((f) => ({ ...f, label: 'De 0 a 10, o quanto você nos recomendaria?', required: true }))
  if (kind === 'lead' || kind === 'signup') return [
    { ...newField('text'), label: 'Nome', required: true },
    { ...newField('email'), label: 'E-mail', required: true },
    { ...newField('phone'), label: 'Telefone' },
  ]
  return [{ ...newField('text'), label: 'Nome', required: true }]
}

// ---- Construtor ----
function FormBuilder({ form, tenantId, notify, onBack, onSaved }) {
  const [name, setName] = useState(form.name || '')
  const [description, setDescription] = useState(form.description || '')
  const [isActive, setIsActive] = useState(form.is_active ?? true)
  const [successMsg, setSuccessMsg] = useState(form.success_message || 'Obrigado!')
  const [fields, setFields] = useState(form.fields?.length ? form.fields : defaultFields(form.kind))
  const [busy, setBusy] = useState(false)

  const setField = (i, patch) => setFields((fs) => fs.map((f, j) => j === i ? { ...f, ...patch } : f))
  const addField = () => setFields((fs) => [...fs, newField('text')])
  const removeField = (i) => setFields((fs) => fs.filter((_, j) => j !== i))
  const move = (i, dir) => setFields((fs) => { const a = [...fs]; const j = i + dir; if (j < 0 || j >= a.length) return fs;[a[i], a[j]] = [a[j], a[i]]; return a })

  const save = async () => {
    if (!name.trim()) return notify('Nome obrigatório', 'error')
    setBusy(true)
    const payload = { name: name.trim(), kind: form.kind, description, is_active: isActive, success_message: successMsg, fields, updated_at: new Date().toISOString() }
    try {
      let error
      if (form.id) { const r = await supabase.from('marketing_forms').update(payload).eq('id', form.id); error = r.error }
      else { const r = await supabase.from('marketing_forms').insert({ ...payload, tenant_id: tenantId }); error = r.error }
      if (error) throw error
      notify('Formulário salvo', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={onBack} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>
        <span className="text-admin-muted/40 text-xs px-2 py-1 rounded bg-white/[0.05]">{KIND_MAP[form.kind]?.label}</span>
        <button onClick={save} disabled={busy} className="ml-auto flex items-center gap-1.5 text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl transition-colors disabled:opacity-50"><Icon name="check" className="w-4 h-4" />{busy ? 'Salvando…' : 'Salvar formulário'}</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* config */}
        <div className="space-y-4">
          <div className="glass-soft rounded-2xl p-5 space-y-4">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={name} onChange={(e) => setName(e.target.value)} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Cadastro newsletter" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Mensagem de sucesso</label><input value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-admin-sage" /><span className="text-admin-muted/70 text-sm">Formulário ativo (aceita respostas)</span></label>
          </div>

          {/* campos */}
          <div className="glass-soft rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Campos</p><button onClick={addField} className="text-xs text-admin-champ/80 hover:text-admin-champ flex items-center gap-1"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar</button></div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="glass rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className="flex-1 glass-input rounded-lg px-3 py-1.5 text-sm text-admin-text outline-none" placeholder="Rótulo do campo" />
                    <button onClick={() => move(i, -1)} className="text-admin-muted/40 hover:text-admin-text"><Icon name="up" className="w-3.5 h-3.5" /></button>
                    <button onClick={() => move(i, 1)} className="text-admin-muted/40 hover:text-admin-text"><Icon name="down" className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeField(i)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-40"><GlassSelect value={f.type} onChange={(v) => setField(i, { type: v })} options={FIELD_TYPES} /></div>
                    {f.type === 'select' && <input value={(f.options || []).join(', ')} onChange={(e) => setField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="flex-1 glass-input rounded-lg px-3 py-1.5 text-xs text-admin-text outline-none" placeholder="opções separadas por vírgula" />}
                    <label className="flex items-center gap-1.5 text-xs text-admin-muted/60 cursor-pointer ml-auto"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} className="accent-admin-champ" />obrigatório</label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* preview */}
        <div className="glass-soft rounded-2xl p-6">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Prévia</p>
          <div className="glass rounded-2xl p-6 max-w-sm mx-auto">
            <h3 className="font-serif text-xl text-admin-text mb-1">{name || 'Título do formulário'}</h3>
            {description && <p className="text-admin-muted/60 text-sm mb-4">{description}</p>}
            <div className="space-y-3 mt-4">
              {fields.map((f) => (
                <div key={f.id}>
                  <label className="text-xs text-admin-muted/70 block mb-1">{f.label || 'Campo'}{f.required && <span className="text-admin-rose"> *</span>}</label>
                  {f.type === 'textarea' ? <div className="glass-input rounded-lg h-16" />
                    : f.type === 'select' ? <div className="glass-input rounded-lg h-9 px-3 flex items-center text-admin-muted/40 text-xs">{(f.options || [])[0] || 'Selecione…'}</div>
                    : f.type === 'rating' ? <div className="flex gap-1">{Array.from({ length: 11 }).map((_, n) => <div key={n} className="w-6 h-6 rounded bg-white/[0.05] text-admin-muted/40 text-[10px] flex items-center justify-center">{n}</div>)}</div>
                    : <div className="glass-input rounded-lg h-9" />}
                </div>
              ))}
              <button className="w-full bg-admin-champ/15 text-admin-champ py-2 rounded-lg text-sm mt-2">Enviar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Respostas ----
function FormResponses({ form, onBack, notify }) {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => {
    setLoading(true)
    try { const { data } = await supabase.from('form_submissions').select('*').eq('form_id', form.id).order('created_at', { ascending: false }).limit(500); setSubs(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  })() }, [form.id])
  const fields = form.fields || []
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>
        <h3 className="text-admin-text text-lg">{form.name} · respostas</h3>
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p>
        : subs.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Ainda sem respostas.</p></div>
        : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/[0.06]">{fields.map((f) => <th key={f.id} className="text-left text-admin-muted/50 text-xs font-normal px-4 py-2.5">{f.label}</th>)}<th className="text-left text-admin-muted/50 text-xs font-normal px-4 py-2.5">Data</th></tr></thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.03]">
                      {fields.map((f) => <td key={f.id} className="px-4 py-2.5 text-admin-text/80 text-xs">{String(s.answers?.[f.id] ?? '—')}</td>)}
                      <td className="px-4 py-2.5 text-admin-muted/40 text-xs">{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )
}
