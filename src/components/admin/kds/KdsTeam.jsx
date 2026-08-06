import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { fmtMin } from '../../../lib/flowEngine'

const PERIODS = [{ value: '1', label: 'Hoje' }, { value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }]
const PALETTE = ['#C1835B', '#B89C61', '#55634D', '#B7745E', '#DCCBA7', '#D08A3E']

// Dashboard + cadastro de Equipe do KDS. Os operadores são cadastrados em
// kds_operators (podem vir do RH) e cruzados com a performance dos tickets.
export function KdsTeam({ kind = 'kitchen', notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [days, setDays] = useState('7')
  const [rows, setRows] = useState([])          // tickets do período
  const [operators, setOperators] = useState([]) // cadastro
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)       // operador em edição/criação
  const [importOpen, setImportOpen] = useState(false)
  const [employees, setEmployees] = useState([])

  const load = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - (Number(days) - 1)); since.setHours(0, 0, 0, 0)
    const [{ data: tk }, { data: ops }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('assignee, status, created_at, ready_at, delivered_at').eq('kind', kind).gte('created_at', since.toISOString()),
      supabase.from('kds_operators').select('*').eq('kind', kind).order('sort_order'),
      supabase.from('kds_stations').select('id, name').eq('active', true).order('sort_order'),
    ])
    setRows(tk || []); setOperators(ops || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load() }, [days, kind])

  // performance agregada por nome de operador
  const perf = useMemo(() => {
    const byOp = {}
    rows.forEach((t) => {
      const op = t.assignee || 'Sem responsável'
      byOp[op] = byOp[op] || { done: 0, cancelled: 0, active: 0, durSum: 0, durN: 0 }
      const b = byOp[op]
      if (t.status === 'delivered') b.done++
      else if (t.status === 'cancelled') b.cancelled++
      else b.active++
      const end = t.delivered_at || t.ready_at
      if (end) { b.durSum += (new Date(end).getTime() - new Date(t.created_at).getTime()) / 1000; b.durN++ }
    })
    Object.values(byOp).forEach((b) => { b.avg = b.durN ? b.durSum / b.durN : 0; b.eff = (b.done + b.cancelled) ? Math.round((b.done / (b.done + b.cancelled)) * 100) : 100 })
    return byOp
  }, [rows])

  // une cadastro + performance (operadores cadastrados primeiro; extras do assignee no fim)
  const cards = useMemo(() => {
    const named = operators.map((o) => ({ ...o, p: perf[o.name] || { done: 0, active: 0, avg: 0, eff: 100 } }))
    const known = new Set(operators.map((o) => o.name))
    const extras = Object.keys(perf).filter((n) => !known.has(n) && n !== 'Sem responsável').map((n) => ({ id: `x-${n}`, name: n, role: null, unregistered: true, p: perf[n] }))
    return [...named, ...extras]
  }, [operators, perf])
  const maxDone = Math.max(1, ...cards.map((c) => c.p.done))

  // CRUD operador
  const openNew = () => setModal({ name: '', role: '', station_id: '', color: PALETTE[0], active: true, kind })
  const saveOp = async () => {
    if (!modal.name.trim()) return notify?.('Informe o nome', 'error')
    const payload = { name: modal.name.trim(), role: modal.role?.trim() || null, station_id: modal.station_id || null, color: modal.color, active: modal.active, kind, tenant_id: tenantId }
    const res = modal.id ? await supabase.from('kds_operators').update(payload).eq('id', modal.id) : await supabase.from('kds_operators').insert(payload)
    if (res.error) return notify?.('Erro ao salvar: ' + res.error.message, 'error')
    notify?.(modal.id ? 'Operador atualizado' : 'Operador cadastrado', 'success'); setModal(null); load()
  }
  const removeOp = async (o) => { if (confirm(`Remover "${o.name}" da equipe?`)) { await supabase.from('kds_operators').delete().eq('id', o.id); load() } }
  const promote = (extra) => setModal({ name: extra.name, role: '', station_id: '', color: PALETTE[0], active: true, kind })

  // importar do RH (employees)
  const openImport = async () => {
    const { data } = await supabase.from('employees').select('id, name, role, avatar_url').order('name')
    setEmployees(data || []); setImportOpen(true)
  }
  const importEmp = async (e) => {
    const { error } = await supabase.from('kds_operators').insert({ name: e.name, role: e.role || null, employee_id: e.id, avatar_url: e.avatar_url || null, color: PALETTE[Math.floor(Math.random() * PALETTE.length)] || '#B89C61', kind, tenant_id: tenantId })
    if (error) return notify?.('Erro ao importar', 'error')
    notify?.(`${e.name} adicionado à equipe`, 'success'); load()
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando equipe…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">{operators.length} operador(es) · performance</p>
        <div className="flex items-center gap-2">
          <div className="w-36"><GlassSelect value={days} onChange={setDays} options={PERIODS} /></div>
          <button onClick={openImport} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04]"><Icon name="download" className="w-4 h-4" />Importar do RH</button>
          <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo operador</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhum operador. Cadastre a equipe ou importe do RH.</p>}
        {cards.map((m) => (
          <div key={m.id} className="glass rounded-2xl p-5 group relative animate-[fadeUp_0.4s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: `${m.color || '#B89C61'}22` }}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <Icon name="user" className="w-5 h-5" style={{ color: m.color || '#B89C61' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-admin-text font-medium truncate">{m.name}</p>
                <p className="text-admin-muted/50 text-[11px]">{m.role || (m.unregistered ? 'não cadastrado' : 'operador')} · {m.p.active} na fila</p>
              </div>
              {!m.unregistered && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal({ ...m })} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeOp(m)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose" title="Remover"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {m.unregistered && <button onClick={() => promote(m)} className="text-[10px] px-2 py-1 rounded-lg bg-admin-champ/15 text-admin-champ shrink-0">cadastrar</button>}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Finalizados</p><p className="text-admin-sage text-lg font-medium tabular-nums">{m.p.done}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Tempo médio</p><p className="text-admin-gold text-lg font-medium tabular-nums">{m.p.avg ? fmtMin(m.p.avg) : '—'}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Eficiência</p><p className="text-admin-champ text-lg font-medium tabular-nums">{m.p.eff}%</p></div>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full rounded-full bg-admin-champ/50 transition-[width] duration-700" style={{ width: `${(m.p.done / maxDone) * 100}%` }} /></div>
          </div>
        ))}
      </div>

      {/* Modal criar/editar operador */}
      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{modal.id ? 'Editar operador' : 'Novo operador'}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome</label><input value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Carlos" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Função</label><input value={modal.role || ''} onChange={(e) => setModal((m) => ({ ...m, role: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Chapeiro" /></div>
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Estação</label><GlassSelect value={modal.station_id || ''} onChange={(v) => setModal((m) => ({ ...m, station_id: v }))} options={[{ value: '', label: '— nenhuma —' }, ...stations.map((s) => ({ value: s.id, label: s.name }))]} /></div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => <button key={c} onClick={() => setModal((m) => ({ ...m, color: c }))} className={`w-8 h-8 rounded-lg transition-transform ${modal.color === c ? 'ring-2 ring-white/60 scale-110' : ''}`} style={{ background: c }} />)}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={saveOp} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{modal.id ? 'Salvar' : 'Cadastrar'}</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {/* Modal importar do RH */}
      {importOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setImportOpen(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-xl text-admin-text">Importar do RH</h2><button onClick={() => setImportOpen(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {employees.length === 0 ? <p className="text-admin-muted/40 text-sm py-8 text-center">Nenhum colaborador no RH.</p> : (
              <div className="space-y-2">
                {employees.map((e) => {
                  const already = operators.some((o) => o.employee_id === e.id || o.name === e.name)
                  return (
                    <div key={e.id} className="flex items-center gap-3 glass-soft rounded-xl p-2.5">
                      <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center overflow-hidden shrink-0">{e.avatar_url ? <img src={e.avatar_url} alt="" className="w-full h-full object-cover" /> : <Icon name="user" className="w-4 h-4 text-admin-champ" />}</div>
                      <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{e.name}</p>{e.role && <p className="text-admin-muted/50 text-[11px]">{e.role}</p>}</div>
                      {already ? <span className="text-[10px] text-admin-sage px-2">✓ na equipe</span> : <button onClick={() => importEmp(e)} className="text-[11px] px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Adicionar</button>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
