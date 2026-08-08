import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { SEGMENT_FIELDS, FIELD_MAP, evalRules, enrichContacts, SMART_AUDIENCES, MONTH_OPTS } from '../../../lib/segments'
import { exportCsv } from '../../../lib/export'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

// Segmentação visual do CRM — encontra grupos de clientes/leads por regras E/OU e age sobre eles.
export function CRMSegments({ notify, onOpenContact }) {
  const [loading, setLoading] = useState(true)
  const [enriched, setEnriched] = useState([])
  const [ctx, setCtx] = useState({ segments: [], sources: [] })
  const [match, setMatch] = useState('all')
  const [conditions, setConditions] = useState([{ field: 'has_purchased', op: 'true', value: '' }])

  useEffect(() => { (async () => {
    setLoading(true)
    try {
      const [ctRes, ordRes, loyRes] = await Promise.all([
        supabase.from('contacts').select('id, name, email, phone, birthdate, segment, source, ltv, score, tags, city, metadata').limit(6000),
        supabase.from('orders').select('contact_id, total, created_at, items, status').neq('status', 'cancelled').limit(8000),
        supabase.from('loyalty_accounts').select('contact_id, points, tier').limit(6000),
      ])
      const contacts = ctRes.data || []
      setEnriched(enrichContacts(contacts, ordRes.data || [], loyRes.data || []))
      setCtx({
        segments: [...new Set(contacts.map((c) => c.segment).filter(Boolean))].map((s) => ({ value: s, label: s })),
        sources: [...new Set(contacts.map((c) => c.source).filter(Boolean))].map((s) => ({ value: s, label: s === 'pdv' ? 'PDV' : s })),
      })
    } catch (e) { notify && notify('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  })() }, [])

  const rules = useMemo(() => ({ match, conditions }), [match, conditions])
  const matched = useMemo(() => enriched.filter((c) => evalRules(rules, c)), [enriched, rules])

  const fieldOptions = SEGMENT_FIELDS.map((f) => ({ value: f.key, label: f.label }))
  const setCond = (i, patch) => setConditions((cs) => cs.map((c, j) => j === i ? { ...c, ...patch } : c))
  const changeField = (i, key) => { const f = FIELD_MAP[key]; setConditions((cs) => cs.map((c, j) => j === i ? { field: key, op: f.ops[0].value, value: '' } : c)) }
  const addCond = () => setConditions((cs) => [...cs, { field: 'segment', op: 'eq', value: '' }])
  const removeCond = (i) => setConditions((cs) => cs.filter((_, j) => j !== i))

  const applySmart = (tpl) => { setMatch(tpl.rules.match); setConditions(JSON.parse(JSON.stringify(tpl.rules.conditions))) }
  const exportList = () => {
    if (matched.length === 0) return notify('Nenhum contato para exportar', 'info')
    exportCsv('segmento.csv', matched.map((c) => ({ nome: c.name, email: c.email, telefone: c.phone, cidade: c.city, segmento: c.segment, ltv: c.ltv, compras: c._orderCount, total_gasto: c._totalSpent })))
    notify(`${matched.length} contatos exportados`, 'success')
  }

  return (
    <div>
      {/* Públicos inteligentes rápidos */}
      <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">Segmentos rápidos</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {SMART_AUDIENCES.map((tpl) => (
          <button key={tpl.name} onClick={() => applySmart(tpl)} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-admin-muted/70 hover:text-admin-text hover:bg-white/[0.07] transition-colors flex items-center gap-1.5">
            <Icon name={tpl.icon} className="w-3.5 h-3.5" />{tpl.name}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Construtor de regras */}
        <div className="lg:col-span-2 glass-soft rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
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
              const needsValue = !['set', 'unset', 'true', 'false'].includes(cond.op)
              return (
                <div key={i}>
                  {i > 0 && <p className="text-[10px] uppercase tracking-wider text-admin-champ/50 my-1.5 ml-1">{match === 'any' ? 'OU' : 'E'}</p>}
                  <div className="flex items-center gap-2 flex-wrap glass rounded-xl p-2.5">
                    <div className="w-44"><GlassSelect value={cond.field} onChange={(v) => changeField(i, v)} options={fieldOptions} /></div>
                    <div className="w-36"><GlassSelect value={cond.op} onChange={(v) => setCond(i, { op: v })} options={f.ops} /></div>
                    {needsValue && <div className="flex-1 min-w-[7rem]"><CondValue field={f} ctx={ctx} value={cond.value} onChange={(v) => setCond(i, { value: v })} /></div>}
                    <button onClick={() => removeCond(i)} className="text-admin-muted/40 hover:text-admin-rose p-1"><Icon name="x" className="w-4 h-4" /></button>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={addCond} className="mt-3 flex items-center gap-1.5 text-xs text-admin-champ/80 hover:text-admin-champ"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar regra</button>
        </div>

        {/* Resultado */}
        <div className="glass-soft rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Resultado</p>
            <button onClick={exportList} className="text-xs text-admin-champ/70 hover:text-admin-champ flex items-center gap-1"><Icon name="upload" className="w-3.5 h-3.5" />CSV</button>
          </div>
          <div className="text-center py-4 mb-4 rounded-xl bg-admin-sage/[0.06] border border-admin-sage/20">
            <p className="text-admin-sage text-4xl font-serif">{loading ? '…' : matched.length}</p>
            <p className="text-admin-muted/50 text-xs mt-1">contatos correspondem</p>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {matched.slice(0, 40).map((c) => (
              <button key={c.id} onClick={() => onOpenContact && onOpenContact(c)} className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left">
                <span className="text-admin-muted/80 truncate">{c.name || 'Sem nome'}</span>
                <span className="text-admin-muted/40 shrink-0 ml-2">{brl(c.ltv || c._totalSpent || 0)}</span>
              </button>
            ))}
            {!loading && matched.length === 0 && <p className="text-admin-muted/40 text-xs text-center py-4">Nenhum contato corresponde.</p>}
            {matched.length > 40 && <p className="text-admin-muted/40 text-[11px] text-center pt-1">+{matched.length - 40} outros</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function CondValue({ field, ctx, value, onChange }) {
  if (field.kind === 'number') return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" placeholder="valor" />
  if (field.kind === 'select') {
    const opts = field.key === 'birthday_month' ? MONTH_OPTS : (field.options ? field.options(ctx) : [])
    return <GlassSelect value={value} onChange={onChange} options={opts.length ? opts : [{ value: '', label: '—' }]} />
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" placeholder="texto" />
}
