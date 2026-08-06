import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { logAudit } from '../../lib/audit'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const STAGES = [
  ['new', 'Novo Lead', 'border-admin-champ/40', 'text-admin-champ'],
  ['qualified', 'Qualificado', 'border-admin-gold/40', 'text-admin-gold'],
  ['proposal', 'Proposta', 'border-admin-sage/40', 'text-admin-sage'],
  ['negotiation', 'Negociação', 'border-admin-gold/50', 'text-admin-gold'],
  ['won', 'Fechado', 'border-admin-sage/60', 'text-admin-sage'],
  ['postsale', 'Pós-venda', 'border-admin-champ/30', 'text-admin-champ/80'],
]
const STAGE_LABEL = Object.fromEntries(STAGES.map(([k, l]) => [k, l]))
const ACT_ICON = { form: 'spark', note: 'pen', stage_change: 'external', quote: 'tag', document: 'book', system: 'gear', email: 'mail', call: 'user', file: 'image' }
const timeAgo = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'agora'; if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`
}

export function PipelinePanel({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('crm') : true
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)          // deal aberto
  const [answers, setAnswers] = useState([])           // [{label, value}] da resposta
  const [activities, setActivities] = useState([])
  const [note, setNote] = useState('')
  const [dLoading, setDLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('deals')
      .select('*, contact:contacts(name, email, phone)')
      .neq('status', 'lost')
      .order('created_at', { ascending: false }).limit(500)
    setDeals(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map(([k]) => [k, []]))
    deals.forEach((d) => { if (m[d.stage]) m[d.stage].push(d) })
    return m
  }, [deals])

  const openDetail = async (d) => {
    setDetail(d); setDLoading(true); setAnswers([]); setActivities([]); setNote('')
    // resposta do formulário (mescla labels dos blocos com respostas)
    if (d.response_id) {
      const [{ data: resp }, { data: blocks }] = await Promise.all([
        supabase.from('flow_responses').select('answers').eq('id', d.response_id).maybeSingle(),
        supabase.from('flow_form_blocks').select('id, label, type, maps_to, sort_order').eq('form_id', d.form_id).order('sort_order'),
      ])
      const ans = resp?.answers || {}
      const rows = (blocks || [])
        .filter((b) => !['title', 'text', 'image', 'button'].includes(b.type))
        .map((b) => ({ label: b.label, value: ans[b.id], mapped: b.maps_to }))
        .filter((r) => r.value !== undefined && r.value !== '' && r.value !== null)
      setAnswers(rows)
    }
    const { data: acts } = await supabase.from('deal_activities').select('*').eq('deal_id', d.id).order('created_at', { ascending: false })
    setActivities(acts || []); setDLoading(false)
  }

  const moveStage = async (d, stage) => {
    if (stage === d.stage) return
    const patch = { stage }
    if (stage === 'won') { patch.status = 'won'; patch.closed_at = new Date().toISOString() }
    else if (d.status === 'won') { patch.status = 'open'; patch.closed_at = null }
    const { error } = await supabase.from('deals').update(patch).eq('id', d.id)
    if (error) return notify('Erro ao mover: ' + error.message, 'error')
    await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: d.id, type: 'stage_change', title: `Movido para ${STAGE_LABEL[stage]}`, meta: { from: d.stage, to: stage } })
    logAudit({ action: 'update', resource_type: 'deals', resource_id: d.id, new_data: { stage } }, tenantId)
    setDeals((xs) => xs.map((x) => x.id === d.id ? { ...x, ...patch } : x))
    if (detail?.id === d.id) { setDetail((x) => ({ ...x, ...patch })); openDetail({ ...d, ...patch }) }
  }

  const markLost = async (d) => {
    if (!confirm(`Marcar "${d.title}" como perdido?`)) return
    await supabase.from('deals').update({ status: 'lost', stage: 'lost', closed_at: new Date().toISOString() }).eq('id', d.id)
    await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: d.id, type: 'system', title: 'Negócio perdido' })
    setDeals((xs) => xs.filter((x) => x.id !== d.id)); setDetail(null); notify('Negócio arquivado', 'success')
  }

  const addNote = async () => {
    if (!note.trim() || !detail) return
    const { data, error } = await supabase.from('deal_activities').insert({ tenant_id: tenantId, deal_id: detail.id, type: 'note', body: note, created_by: profile?.user_id }).select('*').single()
    if (error) return notify('Erro ao adicionar nota', 'error')
    setActivities((a) => [data, ...a]); setNote('')
  }

  const totals = useMemo(() => {
    const open = deals.filter((d) => d.status !== 'won')
    const won = deals.filter((d) => d.status === 'won')
    return {
      pipeline: open.reduce((s, d) => s + Number(d.value || 0), 0),
      won: won.reduce((s, d) => s + Number(d.value || 0), 0),
      count: deals.length,
    }
  }, [deals])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Pipeline de Negócios</h1>
          <p className="text-admin-muted/60 text-sm mt-1">{totals.count} negócios · gerados automaticamente pelos formulários do Flow</p>
        </div>
        <div className="flex gap-3">
          <div className="glass rounded-xl px-4 py-2"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Em aberto</p><p className="text-admin-champ text-lg font-medium">{brl(totals.pipeline)}</p></div>
          <div className="glass rounded-xl px-4 py-2"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Fechado</p><p className="text-admin-sage text-lg font-medium">{brl(totals.won)}</p></div>
        </div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p> : deals.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Icon name="spark" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" />
          <p className="text-admin-muted/50 text-sm">Nenhum negócio ainda.</p>
          <p className="text-admin-muted/30 text-xs mt-1">Crie um formulário no Flow Studio com "gerar lead" ativado. Cada resposta vira um negócio aqui, automaticamente.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(([key, label, border, txt]) => {
            const list = byStage[key] || []
            const sum = list.reduce((s, d) => s + Number(d.value || 0), 0)
            return (
              <div key={key} className="shrink-0 w-72">
                <div className={`flex items-center justify-between px-1 mb-2 border-l-2 pl-2 ${border}`}>
                  <span className={`text-xs uppercase tracking-wider ${txt}`}>{label}</span>
                  <span className="text-admin-muted/40 text-[11px]">{list.length}{sum > 0 ? ` · ${brl(sum)}` : ''}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {list.map((d) => (
                    <div key={d.id} className="glass rounded-xl p-3.5 group cursor-pointer hover:bg-white/[0.04] transition-colors" onClick={() => openDetail(d)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-admin-text text-sm font-medium leading-tight">{d.title}</p>
                        {d.source === 'flow' && <span className="shrink-0 text-[8px] uppercase tracking-wider text-admin-champ/60 bg-admin-champ/10 px-1.5 py-0.5 rounded">Flow</span>}
                      </div>
                      {d.contact?.name && <p className="text-admin-muted/50 text-xs mt-1 truncate">{d.contact.name}</p>}
                      <div className="flex items-center justify-between mt-2.5">
                        {d.value > 0 ? <span className="text-admin-gold text-sm">{brl(d.value)}</span> : <span className="text-admin-muted/30 text-xs">sem valor</span>}
                        <span className="text-admin-muted/30 text-[10px]">{timeAgo(d.created_at)}</span>
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <div className="rounded-xl border border-dashed border-white/[0.05] h-14" />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Gaveta de detalhe do negócio */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md h-full glass-pop overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h2 className="font-serif text-2xl text-admin-text leading-tight">{detail.title}</h2>
                {detail.contact?.name && <p className="text-admin-muted/60 text-sm mt-0.5">{detail.contact.name}</p>}
                <p className="text-admin-muted/40 text-xs mt-0.5">{[detail.contact?.email, detail.contact?.phone].filter(Boolean).join(' · ')}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-admin-muted hover:text-admin-text shrink-0"><Icon name="x" className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Valor</p><p className="text-admin-gold text-lg font-medium">{detail.value > 0 ? brl(detail.value) : '—'}</p></div>
              <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Etapa</p>
                {mayEdit ? <GlassSelect value={detail.stage} onChange={(v) => moveStage(detail, v)} options={STAGES.map(([value, label]) => ({ value, label }))} />
                  : <p className="text-admin-text text-sm">{STAGE_LABEL[detail.stage]}</p>}
              </div>
            </div>

            {detail.company && <p className="text-admin-muted/60 text-sm mb-4"><span className="text-admin-muted/40">Empresa:</span> {detail.company}</p>}

            {/* Resposta do formulário */}
            {answers.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Resposta do formulário</p>
                <div className="space-y-2">
                  {answers.map((a, i) => (
                    <div key={i} className="glass-soft rounded-xl px-3.5 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-admin-muted/40">{a.label}</p>
                      <p className="text-admin-text text-sm mt-0.5 whitespace-pre-wrap">{String(a.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Histórico</p>
            {mayEdit && (
              <div className="flex gap-2 mb-3">
                <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Adicionar nota…" className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" />
                <button onClick={addNote} className="bg-admin-champ/15 text-admin-champ px-3 rounded-xl text-sm">Add</button>
              </div>
            )}
            <div className="space-y-2.5 mb-6">
              {dLoading ? <p className="text-admin-muted/30 text-xs py-3 text-center">Carregando…</p> : activities.length === 0 ? <p className="text-admin-muted/30 text-xs">Sem atividades.</p> : activities.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-admin-champ/10 flex items-center justify-center shrink-0 mt-0.5"><Icon name={ACT_ICON[a.type] || 'spark'} className="w-3 h-3 text-admin-champ/70" /></div>
                  <div className="min-w-0 flex-1">
                    {a.title && <p className="text-admin-text text-sm">{a.title}</p>}
                    {a.body && <p className="text-admin-muted/60 text-xs mt-0.5 whitespace-pre-wrap">{a.body}</p>}
                    <p className="text-admin-muted/30 text-[10px] mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>

            {mayEdit && <button onClick={() => markLost(detail)} className="text-admin-rose/70 hover:text-admin-rose text-xs">Marcar como perdido</button>}
          </div>
        </div>
      )}
    </div>
  )
}
