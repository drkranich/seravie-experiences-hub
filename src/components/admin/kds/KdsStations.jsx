import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { elapsedSeconds, fmtMin } from '../../../lib/flowEngine'

const ICONS = ['flame', 'cup', 'layers', 'cake', 'box', 'grid', 'leaf', 'heart', 'star']
const PALETTE = ['#C1835B', '#B89C61', '#55634D', '#B7745E', '#DCCBA7', '#D08A3E']

// Estações premium em cards, com carga/fila/tempo médio em tempo real (Digital Twin leve).
export function KdsStations({ notify, kind = 'kitchen' }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [tickets, setTickets] = useState([])
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState(null) // estação em edição/criação

  const load = async () => {
    const [{ data: st }, { data: tk }] = await Promise.all([
      supabase.from('kds_stations').select('*').order('sort_order'),
      supabase.from('kds_tickets').select('id, station_id, status, created_at, sla_seconds').eq('kind', kind).not('status', 'in', '("delivered","cancelled")'),
    ])
    setRows(st || []); setTickets(tk || [])
  }
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv) }, [kind])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])

  const statsOf = (st) => {
    const q = tickets.filter((t) => t.station_id === st.id)
    const late = q.filter((t) => t.sla_seconds && elapsedSeconds(t.created_at, now) >= t.sla_seconds).length
    const loadPct = st.capacity ? Math.min(100, Math.round((q.length / st.capacity) * 100)) : 0
    return { queue: q.length, late, loadPct }
  }

  const openNew = () => setModal({ name: '', icon: 'flame', color: PALETTE[0], capacity: 10, assignee: '', active: true, kind })
  const save = async () => {
    if (!modal.name.trim()) return notify('Informe o nome da estação', 'error')
    const payload = { name: modal.name, icon: modal.icon, color: modal.color, capacity: Number(modal.capacity) || null, assignee: modal.assignee || null, active: modal.active, kind, tenant_id: tenantId }
    const res = modal.id ? await supabase.from('kds_stations').update(payload).eq('id', modal.id) : await supabase.from('kds_stations').insert(payload)
    if (res.error) return notify('Erro ao salvar', 'error')
    notify(modal.id ? 'Estação atualizada' : 'Estação criada', 'success'); setModal(null); load()
  }
  const toggle = async (r) => { await supabase.from('kds_stations').update({ active: !r.active }).eq('id', r.id); load() }
  const remove = async (r) => { if (confirm(`Remover "${r.name}"?`)) { await supabase.from('kds_stations').delete().eq('id', r.id); load() } }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-admin-muted/50 text-sm">{rows.length} estações</p>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Nova estação</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => {
          const st = statsOf(r)
          return (
            <div key={r.id} className="glass rounded-2xl p-5 group relative hover:bg-white/[0.03] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${r.color}22` }}><Icon name={r.icon || 'grid'} className="w-5 h-5" /></div>
                  <div>
                    <p className="text-admin-text font-medium">{r.name}</p>
                    <p className="text-admin-muted/50 text-[11px]">{r.assignee || 'sem responsável'}</p>
                  </div>
                </div>
                <button onClick={() => toggle(r)} className={`text-[10px] px-2 py-1 rounded-lg ${r.active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{r.active ? 'ativa' : 'inativa'}</button>
              </div>

              {/* carga */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-admin-muted/60">Carga</span>
                  <span className={`tabular-nums ${st.loadPct >= 90 ? 'text-admin-rose' : st.loadPct >= 60 ? 'text-[#D08A3E]' : 'text-admin-sage'}`}>{st.queue}/{r.capacity || '—'}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${st.loadPct}%`, background: st.loadPct >= 90 ? '#B7745E' : st.loadPct >= 60 ? '#D08A3E' : '#55634D' }} />
                </div>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-admin-muted/60">
                <span>{st.queue} na fila</span>
                {st.late > 0 && <span className="text-admin-rose">{st.late} atrasado(s)</span>}
              </div>

              <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setModal(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05]" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05] ml-auto" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhuma estação. Crie estações para rotear a produção.</p>}
      </div>

      {/* Modal criar/editar estação */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{modal.id ? 'Editar estação' : 'Nova estação'}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome</label><input value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Chapa" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Responsável</label><input value={modal.assignee || ''} onChange={(e) => setModal((m) => ({ ...m, assignee: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Capacidade</label><input type="number" value={modal.capacity} onChange={(e) => setModal((m) => ({ ...m, capacity: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button key={ic} onClick={() => setModal((m) => ({ ...m, icon: ic }))} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${modal.icon === ic ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.05] text-admin-muted/60 hover:text-admin-text'}`}><Icon name={ic} className="w-5 h-5" /></button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => (
                    <button key={c} onClick={() => setModal((m) => ({ ...m, color: c }))} className={`w-8 h-8 rounded-lg transition-transform ${modal.color === c ? 'ring-2 ring-white/60 scale-110' : ''}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{modal.id ? 'Salvar' : 'Criar'}</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
