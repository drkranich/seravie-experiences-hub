import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import {
  SEGMENT_FIELDS, FIELD_MAP, evalRules, enrichContacts, SMART_AUDIENCES, MONTH_OPTS,
} from '../../../lib/segments'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const COLOR = {
  champ: { bg: 'bg-admin-champ/10', text: 'text-admin-champ' }, gold: { bg: 'bg-admin-gold/10', text: 'text-admin-gold' },
  sage: { bg: 'bg-admin-sage/10', text: 'text-admin-sage' }, rose: { bg: 'bg-admin-rose/10', text: 'text-admin-rose' },
  copper: { bg: 'bg-admin-copper/10', text: 'text-admin-copper' },
}

// Audience Studio — segmentação visual E/OU + públicos salvos e inteligentes.
export function AudienceStudio({ tenantId, notify }) {
  const [loading, setLoading] = useState(true)
  const [enriched, setEnriched] = useState([])
  const [ctx, setCtx] = useState({ segments: [], sources: [] })
  const [saved, setSaved] = useState([])
  const [editing, setEditing] = useState(null) // {id?, name, rules}

  const loadData = async () => {
    setLoading(true)
    try {
      const [ctRes, ordRes, loyRes, audRes] = await Promise.all([
        supabase.from('contacts').select('id, name, email, phone, birthdate, segment, source, ltv, score, tags, metadata').limit(5000),
        supabase.from('orders').select('contact_id, total, created_at, items, status').neq('status', 'cancelled').limit(8000),
        supabase.from('loyalty_accounts').select('contact_id, points, tier').limit(5000),
        supabase.from('marketing_audiences').select('*').order('created_at', { ascending: false }),
      ])
      const contacts = ctRes.data || []
      const en = enrichContacts(contacts, ordRes.data || [], loyRes.data || [])
      setEnriched(en)
      setCtx({
        segments: [...new Set(contacts.map((c) => c.segment).filter(Boolean))].map((s) => ({ value: s, label: s })),
        sources: [...new Set(contacts.map((c) => c.source).filter(Boolean))].map((s) => ({ value: s, label: s === 'pdv' ? 'PDV (compradores)' : s })),
      })
      setSaved(audRes.data || [])
    } catch (e) { notify && notify('Erro ao carregar: ' + (e.message || e), 'error') } finally { setLoading(false) }
  }
  useEffect(() => { loadData() }, [])

  const countFor = (rules) => enriched.filter((c) => evalRules(rules, c)).length

  const saveAudience = async (aud) => {
    const rules = aud.rules
    const cached = countFor(rules)
    try {
      let error
      if (aud.id) { const r = await supabase.from('marketing_audiences').update({ name: aud.name, rules, cached_count: cached, updated_at: new Date().toISOString() }).eq('id', aud.id); error = r.error }
      else { const r = await supabase.from('marketing_audiences').insert({ tenant_id: tenantId, name: aud.name, icon: aud.icon || 'user', color: aud.color || 'champ', rules, cached_count: cached }); error = r.error }
      if (error) throw error
      notify('Público salvo', 'success'); setEditing(null); loadData()
    } catch (e) { notify('Erro ao salvar: ' + (e.message || e), 'error') }
  }
  const remove = async (a) => { try { await supabase.from('marketing_audiences').delete().eq('id', a.id) } catch { /* noop */ } notify('Público removido', 'success'); loadData() }
  const addSmart = (tpl) => setEditing({ name: tpl.name, icon: tpl.icon, color: tpl.color, rules: JSON.parse(JSON.stringify(tpl.rules)) })

  if (editing) {
    return <AudienceBuilder aud={editing} ctx={ctx} enriched={enriched} onCancel={() => setEditing(null)} onSave={saveAudience} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-admin-muted/50 text-xs max-w-xl leading-relaxed">Crie públicos combinando regras (E / OU) sobre cadastro, valor, comportamento de compra e fidelidade. Públicos salvos alimentam campanhas e jornadas.</p>
        <button onClick={() => setEditing({ name: '', icon: 'user', color: 'champ', rules: { match: 'all', conditions: [] } })} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Novo público</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando base…</p> : (
        <>
          {/* Públicos salvos */}
          {saved.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">Meus públicos</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {saved.map((a) => {
                  const col = COLOR[a.color] || COLOR.champ
                  const live = countFor(a.rules)
                  return (
                    <div key={a.id} className="glass rounded-2xl p-4 group">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${col.bg} flex items-center justify-center shrink-0`}><Icon name={a.icon || 'user'} className={`w-5 h-5 ${col.text}`} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-admin-text text-sm font-medium truncate">{a.name}</p>
                          <p className="text-admin-muted/50 text-xs">{(a.rules?.conditions || []).length} regra(s) · {a.rules?.match === 'any' ? 'qualquer' : 'todas'}</p>
                        </div>
                        <p className={`text-2xl font-serif ${col.text}`}>{live}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05] text-xs">
                        <span className="text-admin-muted/40">{live} contatos</span>
                        <button onClick={() => setEditing({ id: a.id, name: a.name, icon: a.icon, color: a.color, rules: a.rules })} className="ml-auto text-admin-champ/80 hover:underline">editar</button>
                        <button onClick={() => remove(a)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Públicos inteligentes */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">Públicos inteligentes (prontos)</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SMART_AUDIENCES.map((tpl) => {
                const col = COLOR[tpl.color] || COLOR.champ
                const n = countFor(tpl.rules)
                return (
                  <button key={tpl.name} onClick={() => addSmart(tpl)} className="glass rounded-xl p-4 text-left hover:bg-white/[0.03] transition-colors border border-transparent hover:border-admin-champ/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 rounded-lg ${col.bg} flex items-center justify-center`}><Icon name={tpl.icon} className={`w-4 h-4 ${col.text}`} /></div>
                      <span className={`text-xl font-serif ${col.text}`}>{n}</span>
                    </div>
                    <p className="text-admin-text text-sm font-medium leading-tight">{tpl.name}</p>
                    <p className="text-admin-champ/50 text-[10px] mt-1">tocar para personalizar →</p>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Construtor de regras ----
function AudienceBuilder({ aud, ctx, enriched, onCancel, onSave }) {
  const [name, setName] = useState(aud.name || '')
  const [match, setMatch] = useState(aud.rules?.match || 'all')
  const [conditions, setConditions] = useState(aud.rules?.conditions?.length ? aud.rules.conditions : [{ field: 'ltv', op: 'gte', value: '' }])

  const rules = useMemo(() => ({ match, conditions }), [match, conditions])
  const matched = useMemo(() => enriched.filter((c) => evalRules(rules, c)), [enriched, rules])

  const fieldsByGroup = useMemo(() => {
    const g = {}
    SEGMENT_FIELDS.forEach((f) => { (g[f.group] = g[f.group] || []).push(f) })
    return g
  }, [])
  const fieldOptions = Object.entries(fieldsByGroup).flatMap(([grp, fs]) => fs.map((f) => ({ value: f.key, label: `${f.label}` })))

  const setCond = (i, patch) => setConditions((cs) => cs.map((c, j) => j === i ? { ...c, ...patch } : c))
  const changeField = (i, key) => {
    const f = FIELD_MAP[key]
    const firstOp = f.ops[0].value
    setConditions((cs) => cs.map((c, j) => j === i ? { field: key, op: firstOp, value: '' } : c))
  }
  const addCond = () => setConditions((cs) => [...cs, { field: 'segment', op: 'eq', value: '' }])
  const removeCond = (i) => setConditions((cs) => cs.filter((_, j) => j !== i))

  const save = () => {
    if (!name.trim()) return
    onSave({ ...aud, name: name.trim(), rules })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={onCancel} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do público" className="glass-input rounded-xl px-4 py-2 text-sm text-admin-text outline-none flex-1 min-w-[12rem] max-w-md" />
        <button onClick={save} disabled={!name.trim()} className="ml-auto flex items-center gap-1.5 text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl transition-colors disabled:opacity-50"><Icon name="check" className="w-4 h-4" />Salvar público</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-soft rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-admin-muted/60 text-sm">Corresponder a</span>
            <div className="flex gap-1 bg-white/[0.04] p-1 rounded-lg">
              <button onClick={() => setMatch('all')} className={`text-xs px-3 py-1 rounded-md transition-colors ${match === 'all' ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted'}`}>TODAS (E)</button>
              <button onClick={() => setMatch('any')} className={`text-xs px-3 py-1 rounded-md transition-colors ${match === 'any' ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted'}`}>QUALQUER (OU)</button>
            </div>
            <span className="text-admin-muted/60 text-sm">das regras:</span>
          </div>

          <div className="space-y-2">
            {conditions.map((cond, i) => {
              const f = FIELD_MAP[cond.field] || SEGMENT_FIELDS[0]
              return (
                <div key={i}>
                  {i > 0 && <p className="text-[10px] uppercase tracking-wider text-admin-champ/50 my-1.5 ml-1">{match === 'any' ? 'OU' : 'E'}</p>}
                  <div className="flex items-center gap-2 flex-wrap glass rounded-xl p-2.5">
                    <div className="w-48"><GlassSelect value={cond.field} onChange={(v) => changeField(i, v)} options={fieldOptions} /></div>
                    <div className="w-40"><GlassSelect value={cond.op} onChange={(v) => setCond(i, { op: v })} options={f.ops} /></div>
                    {needsValue(f, cond.op) && <div className="flex-1 min-w-[8rem]"><CondValue field={f} ctx={ctx} value={cond.value} onChange={(v) => setCond(i, { value: v })} /></div>}
                    <button onClick={() => removeCond(i)} className="text-admin-muted/40 hover:text-admin-rose p-1"><Icon name="x" className="w-4 h-4" /></button>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={addCond} className="mt-3 flex items-center gap-1.5 text-xs text-admin-champ/80 hover:text-admin-champ"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar regra</button>
        </div>

        {/* Preview ao vivo */}
        <div className="glass-soft rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Prévia do público</p>
          <div className="text-center py-4 mb-4 rounded-xl bg-admin-sage/[0.06] border border-admin-sage/20">
            <p className="text-admin-sage text-4xl font-serif">{matched.length}</p>
            <p className="text-admin-muted/50 text-xs mt-1">contatos correspondem</p>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {matched.slice(0, 30).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-admin-muted/70 truncate">{c.name || 'Sem nome'}</span>
                <span className="text-admin-muted/40 shrink-0 ml-2">{brl(c.ltv || c._totalSpent || 0)}</span>
              </div>
            ))}
            {matched.length === 0 && <p className="text-admin-muted/40 text-xs text-center py-4">Nenhum contato corresponde ainda.</p>}
            {matched.length > 30 && <p className="text-admin-muted/40 text-[11px] text-center pt-1">+{matched.length - 30} outros</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// operadores 'set'/'unset'/'true'/'false' não precisam de valor
function needsValue(field, op) {
  if (['set', 'unset', 'true', 'false'].includes(op)) return false
  return true
}
function CondValue({ field, ctx, value, onChange }) {
  if (field.kind === 'number') return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" placeholder="valor" />
  if (field.kind === 'select') {
    const opts = field.key === 'birthday_month' ? MONTH_OPTS : (field.options ? field.options(ctx) : [])
    return <GlassSelect value={value} onChange={onChange} options={opts.length ? opts : [{ value: '', label: '—' }]} />
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" placeholder="texto" />
}
