import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { JourneyBuilder } from './JourneyBuilder'
import { JOURNEY_TEMPLATES, TRIGGER_OPTIONS, NODE_TYPES } from '../../../lib/journeys'

const triggerLabel = (t) => TRIGGER_OPTIONS.find((o) => o.value === t)?.label || t
const ST = { draft: ['Rascunho', 'bg-white/[0.06] text-admin-muted/50'], active: ['Ativa', 'bg-admin-sage/15 text-admin-sage'], paused: ['Pausada', 'bg-admin-rose/15 text-admin-rose'] }

// Automation Studio → Jornadas. Lista + templates + abre o construtor visual.
export function JourneysTab({ tenantId, coupons = [], notify }) {
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // objeto jornada em edição (ou 'new'-ish)
  const [picker, setPicker] = useState(false)     // modal de templates

  const load = async () => {
    setLoading(true)
    try { const { data } = await supabase.from('marketing_journeys').select('*').order('created_at', { ascending: false }); setJourneys(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const startTemplate = (tpl) => {
    setPicker(false)
    setEditing({ id: null, name: tpl.name === 'Em branco' ? 'Nova jornada' : tpl.name, steps: tpl.build(), status: 'draft' })
  }
  const toggleStatus = async (j) => {
    const next = j.status === 'active' ? 'paused' : 'active'
    try { await supabase.from('marketing_journeys').update({ status: next }).eq('id', j.id) } catch { /* noop */ }
    notify(next === 'active' ? 'Jornada ativada' : 'Jornada pausada', 'success'); load()
  }
  const remove = async (j) => {
    try { await supabase.from('marketing_journeys').delete().eq('id', j.id) } catch { /* noop */ }
    notify('Jornada removida', 'success'); load()
  }

  if (editing) {
    return <JourneyBuilder journey={editing} coupons={coupons} tenantId={tenantId} notify={notify} onBack={() => { setEditing(null); load() }} onSaved={() => { setEditing(null); load() }} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-admin-muted/50 text-xs leading-relaxed max-w-xl">Jornadas reagem aos eventos do ecossistema. Monte um fluxo visual — gatilho, esperas, mensagens, condições e recompensas — arrastando os cards no canvas.</p>
        <button onClick={() => setPicker(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Nova jornada</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : journeys.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-admin-champ/10 flex items-center justify-center mx-auto mb-4"><Icon name="layers" className="w-7 h-7 text-admin-champ/60" /></div>
            <h3 className="font-serif text-2xl text-admin-text mb-2">Crie sua primeira jornada</h3>
            <p className="text-admin-muted/60 text-sm mb-5 max-w-md mx-auto">Comece de um modelo pronto (boas-vindas, reativação, pós-venda, aniversário) e ajuste no canvas.</p>
            <button onClick={() => setPicker(true)} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors">Escolher modelo</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {journeys.map((j) => {
              const steps = Array.isArray(j.steps) ? j.steps : []
              const [stLabel, stCls] = ST[j.status] || ST.draft
              const counts = {}
              steps.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1 })
              return (
                <div key={j.id} className="glass rounded-2xl p-5 group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-admin-text text-sm font-medium">{j.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg shrink-0 ${stCls}`}>{stLabel}</span>
                  </div>
                  <p className="text-admin-muted/50 text-xs mb-3">Gatilho: {triggerLabel(j.trigger_event)}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {Object.entries(counts).map(([type, n]) => (
                      <span key={type} className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60 flex items-center gap-1"><Icon name={NODE_TYPES[type]?.icon || 'spark'} className="w-3 h-3" />{n}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs pt-3 border-t border-white/[0.05]">
                    <span className="text-admin-muted/40">{steps.length} passos</span>
                    {j.enrolled_count > 0 && <span className="text-admin-muted/40">{j.enrolled_count} inscritos</span>}
                    <button onClick={() => toggleStatus(j)} className={`ml-auto ${j.status === 'active' ? 'text-admin-rose/80' : 'text-admin-sage'} hover:underline`}>{j.status === 'active' ? 'pausar' : 'ativar'}</button>
                    <button onClick={() => setEditing(j)} className="text-admin-champ/80 hover:underline">editar</button>
                    <button onClick={() => remove(j)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPicker(false)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Escolha um modelo</h2><button onClick={() => setPicker(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid sm:grid-cols-2 gap-3">
              {JOURNEY_TEMPLATES.map((tpl) => (
                <button key={tpl.key} onClick={() => startTemplate(tpl)} className="glass rounded-xl p-4 text-left hover:bg-white/[0.03] transition-colors border border-transparent hover:border-admin-champ/20">
                  <div className="flex items-center gap-2 mb-1.5"><Icon name={tpl.key === 'blank' ? 'plus' : 'spark'} className="w-4 h-4 text-admin-champ/70" /><p className="text-admin-text text-sm font-medium">{tpl.name}</p></div>
                  <p className="text-admin-muted/50 text-xs leading-relaxed">{tpl.desc}</p>
                  <p className="text-admin-champ/50 text-[10px] mt-2">Gatilho: {triggerLabel(tpl.trigger)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
