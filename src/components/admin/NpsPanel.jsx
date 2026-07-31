import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

const bucket = (s) => (s >= 9 ? 'promoter' : s >= 7 ? 'passive' : 'detractor')
const BUCKET = { promoter: { label: 'Promotores', tone: 'text-admin-sage', bar: 'bg-admin-sage/70' }, passive: { label: 'Neutros', tone: 'text-admin-gold', bar: 'bg-admin-gold/70' }, detractor: { label: 'Detratores', tone: 'text-admin-rose', bar: 'bg-admin-rose/70' } }

export function NpsPanel({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('helpdesk') : true
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ score: '10', comment: '' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('nps_surveys').select('*').order('created_at', { ascending: false }).limit(1000)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const answered = rows.filter((r) => r.score != null)
  const stats = useMemo(() => {
    const n = answered.length
    const prom = answered.filter((r) => bucket(r.score) === 'promoter').length
    const pass = answered.filter((r) => bucket(r.score) === 'passive').length
    const det = answered.filter((r) => bucket(r.score) === 'detractor').length
    const nps = n ? Math.round((prom / n) * 100 - (det / n) * 100) : 0
    const dist = Array.from({ length: 11 }, (_, i) => answered.filter((r) => r.score === i).length)
    const maxDist = Math.max(1, ...dist)
    return { n, prom, pass, det, nps, dist, maxDist }
  }, [rows])

  const save = async () => {
    const score = parseInt(form.score)
    if (isNaN(score)) return notify('Informe a nota', 'error')
    const { error } = await supabase.from('nps_surveys').insert({ tenant_id: tenantId, score, comment: form.comment || null, responded_at: new Date().toISOString() })
    if (error) return notify('Erro ao registrar: ' + error.message, 'error')
    notify('Resposta registrada', 'success'); setModal(false); setForm({ score: '10', comment: '' }); load()
  }

  const npsColor = stats.nps >= 50 ? 'text-admin-sage' : stats.nps >= 0 ? 'text-admin-gold' : 'text-admin-rose'
  const exportRows = () => answered.map((r) => ({ Nota: r.score, Categoria: BUCKET[bucket(r.score)].label, Comentário: r.comment || '', Data: r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '' }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">NPS</h1><p className="text-admin-muted/60 text-sm mt-1">Satisfação e lealdade dos clientes (Net Promoter Score)</p></div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv('nps.csv', exportRows()) || notify('Sem respostas', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf('NPS', exportRows(), `NPS ${stats.nps}`) || notify('Sem respostas', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
          {mayEdit && <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Registrar resposta</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">NPS</p><p className={`text-3xl font-medium ${npsColor}`}>{stats.nps}</p><p className="text-admin-muted/40 text-xs mt-1">{stats.n} respostas</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Promotores</p><p className="text-admin-sage text-2xl font-medium">{stats.prom}</p><p className="text-admin-muted/40 text-xs mt-1">{stats.n ? Math.round(stats.prom / stats.n * 100) : 0}%</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Neutros</p><p className="text-admin-gold text-2xl font-medium">{stats.pass}</p><p className="text-admin-muted/40 text-xs mt-1">{stats.n ? Math.round(stats.pass / stats.n * 100) : 0}%</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Detratores</p><p className="text-admin-rose text-2xl font-medium">{stats.det}</p><p className="text-admin-muted/40 text-xs mt-1">{stats.n ? Math.round(stats.det / stats.n * 100) : 0}%</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Faixa</p><p className={`text-sm font-medium mt-1 ${npsColor}`}>{stats.nps >= 75 ? 'Excelente' : stats.nps >= 50 ? 'Muito bom' : stats.nps >= 0 ? 'Razoável' : 'Crítico'}</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-5 lg:col-span-1">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Distribuição de notas</p>
          <div className="flex items-end gap-1 h-32">
            {stats.dist.map((c, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className={`w-full rounded-t ${i >= 9 ? 'bg-admin-sage/70' : i >= 7 ? 'bg-admin-gold/70' : 'bg-admin-rose/70'}`} style={{ height: `${Math.max(2, (c / stats.maxDist) * 100)}%` }} title={`${c} resposta(s)`} />
                <span className="text-[9px] text-admin-muted/40">{i}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Comentários recentes</p>
          {loading ? <p className="text-admin-muted/30 text-sm">Carregando…</p> : answered.filter((r) => r.comment).length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhum comentário ainda.</p> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {answered.filter((r) => r.comment).slice(0, 30).map((r) => (
                <div key={r.id} className="glass-soft rounded-xl px-3 py-2.5 flex items-start gap-3">
                  <span className={`text-sm font-medium w-7 text-center shrink-0 ${BUCKET[bucket(r.score)].tone}`}>{r.score}</span>
                  <p className="text-admin-muted/70 text-sm flex-1">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Registrar resposta NPS</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nota (0 a 10)</label><GlassSelect value={form.score} onChange={(v) => setForm((f) => ({ ...f, score: v }))} options={Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: `${i} — ${BUCKET[bucket(i)].label}` }))} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Comentário</label><textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Registrar</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
