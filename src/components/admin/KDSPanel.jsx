import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { ResourceTabs } from './ResourcePanel'

const STATUS_FLOW = {
  queued: { label: 'Na fila', next: 'preparing', color: 'text-admin-champ', border: 'border-admin-champ/40' },
  preparing: { label: 'Preparando', next: 'ready', color: 'text-admin-gold', border: 'border-admin-gold/50' },
  ready: { label: 'Pronto', next: 'delivered', color: 'text-admin-sage', border: 'border-admin-sage/50' },
  delivered: { label: 'Entregue', next: null, color: 'text-admin-muted', border: 'border-white/10' },
}
const minutesSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))

// ---------- Tela de Cozinha (tempo real) ----------
function KitchenBoard() {
  const [tickets, setTickets] = useState([])
  const [stations, setStations] = useState([])
  const [stationFilter, setStationFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [{ data: tk }, { data: st }] = await Promise.all([
      supabase.from('kds_tickets').select('*').in('status', ['queued', 'preparing', 'ready']).order('priority', { ascending: false }).order('created_at'),
      supabase.from('kds_stations').select('*').eq('active', true).order('sort_order'),
    ])
    setTickets(tk || []); setStations(st || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv) }, [])

  const advance = async (t) => {
    const next = STATUS_FLOW[t.status]?.next
    if (!next) return
    const patch = { status: next }
    if (next === 'preparing') patch.started_at = new Date().toISOString()
    if (next === 'ready') patch.ready_at = new Date().toISOString()
    await supabase.from('kds_tickets').update(patch).eq('id', t.id)
    load()
  }
  const cancel = async (t) => { if (confirm('Cancelar este ticket?')) { await supabase.from('kds_tickets').update({ status: 'cancelled' }).eq('id', t.id); load() } }

  const shown = useMemo(() => stationFilter ? tickets.filter((t) => t.station_id === stationFilter) : tickets, [tickets, stationFilter])
  const cols = ['queued', 'preparing', 'ready']

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando cozinha…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">{shown.length} tickets ativos</p>
        <div className="w-56">
          <GlassSelect value={stationFilter} onChange={setStationFilter} placeholder="Todas as estações"
            options={[{ value: '', label: 'Todas as estações' }, ...stations.map((s) => ({ value: s.id, label: s.name }))]} />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {cols.map((col) => {
          const list = shown.filter((t) => t.status === col)
          const meta = STATUS_FLOW[col]
          return (
            <div key={col} className="glass rounded-2xl p-3">
              <div className="flex items-center justify-between px-1 pb-3">
                <p className={`text-[11px] uppercase tracking-wider ${meta.color}`}>{meta.label}</p>
                <span className="text-admin-muted/40 text-xs">{list.length}</span>
              </div>
              <div className="space-y-3">
                {list.length === 0 && <p className="text-admin-muted/25 text-xs text-center py-8">—</p>}
                {list.map((t) => {
                  const mins = minutesSince(t.created_at)
                  const late = mins >= 15
                  return (
                    <div key={t.id} className={`rounded-xl border ${meta.border} bg-white/[0.03] p-3 ${late ? 'ring-1 ring-admin-rose/40' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-admin-text text-sm font-medium">{t.reference || t.source}</span>
                        <span className={`text-[11px] ${late ? 'text-admin-rose' : 'text-admin-muted/50'}`}>{mins}min</span>
                      </div>
                      <div className="space-y-1 mb-3">
                        {(t.items || []).map((it, i) => (
                          <div key={i} className="text-sm text-admin-text/90 flex justify-between gap-2">
                            <span><span className="text-admin-champ">{it.qty || 1}×</span> {it.name}</span>
                          </div>
                        ))}
                        {(t.items || []).some((it) => it.notes) && (
                          <p className="text-[11px] text-admin-gold/80 mt-1">obs: {(t.items || []).filter((it) => it.notes).map((it) => it.notes).join(' · ')}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => advance(t)} className="flex-1 text-[11px] py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">
                          {col === 'queued' ? 'Iniciar' : col === 'preparing' ? 'Pronto' : 'Entregar'}
                        </button>
                        <button onClick={() => cancel(t)} className="text-[11px] px-2 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose">✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Estações ----------
function StationsTab({ notify }) {
  const { profile } = useTenant()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name: '', color: '#B89C61' })
  const load = async () => { const { data } = await supabase.from('kds_stations').select('*').order('sort_order'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!form.name.trim()) return notify('Informe o nome da estação', 'error')
    const { error } = await supabase.from('kds_stations').insert({ name: form.name, color: form.color, tenant_id: profile?.tenant_id })
    if (error) return notify('Erro ao criar', 'error')
    setForm({ name: '', color: '#B89C61' }); load(); notify('Estação criada', 'success')
  }
  const toggle = async (r) => { await supabase.from('kds_stations').update({ active: !r.active }).eq('id', r.id); load() }
  const remove = async (r) => { if (confirm(`Remover "${r.name}"?`)) { await supabase.from('kds_stations').delete().eq('id', r.id); load() } }
  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nova estação</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Chapa · Bar · Montagem" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
        <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="w-11 h-11 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
        <button onClick={add} className="bg-admin-champ/15 text-admin-champ px-5 py-2.5 rounded-xl text-sm hover:bg-admin-champ/25">Adicionar</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full" style={{ background: r.color }} /><span className="text-admin-text text-sm">{r.name}</span></div>
            <div className="flex gap-2">
              <button onClick={() => toggle(r)} className={`text-[10px] px-2 py-1 rounded-lg ${r.active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{r.active ? 'ativa' : 'inativa'}</button>
              <button onClick={() => remove(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose">excluir</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-8">Nenhuma estação. Crie estações para rotear os pedidos na cozinha.</p>}
      </div>
    </div>
  )
}

export function KDSPanel({ notify }) {
  return (
    <ResourceTabs title="KDS — Cozinha" subtitle="tela de produção em tempo real (Kitchen Display System)"
      tabs={[
        { key: 'board', label: 'Tela de Cozinha', render: () => <KitchenBoard /> },
        { key: 'stations', label: 'Estações', render: () => <StationsTab notify={notify} /> },
      ]}
    />
  )
}
