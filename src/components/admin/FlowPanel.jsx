import { useState, useEffect, useMemo } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { KanbanBoard } from './Kanban'
import { logAudit } from '../../lib/audit'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const KINDS = { quarto: 'Quarto', mesa: 'Mesa', chale: 'Chalé', suite: 'Suíte', loja: 'Loja', setor: 'Setor', geladeira: 'Frigobar', adega: 'Adega', prateleira: 'Prateleira', expositor: 'Expositor', evento: 'Evento', piscina: 'Piscina', spa: 'Spa', mercado: 'Mercado autônomo' }
const flowUrl = (code) => `${window.location.origin}/#flow/${code}`

function QRThumb({ code, size = 120 }) {
  const [url, setUrl] = useState('')
  useEffect(() => { QRCode.toDataURL(flowUrl(code), { margin: 1, width: 360, color: { dark: '#14160f', light: '#f4f0e6' } }).then(setUrl).catch(() => {}) }, [code])
  if (!url) return <div className="rounded-xl bg-white/[0.05]" style={{ width: size, height: size }} />
  return <img src={url} alt="QR" width={size} height={size} className="rounded-xl bg-[#f4f0e6] p-1" />
}

// ---------- Pontos (QR) ----------
function PointsTab({ notify }) {
  const { profile, canEdit, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('flow') : true
  const mayDelete = canManage ? canManage('flow') : true
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [qrView, setQrView] = useState(null)

  const load = async () => { setLoading(true); const { data } = await supabase.from('flow_points').select('*').order('created_at', { ascending: false }); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ name: '', kind: 'mesa', branch: '', description: '', cover_url: '', active: true }); setModal(true) }
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setModal(true) }
  const save = async () => {
    if (!form.name?.trim()) return notify('Informe o nome do ponto', 'error')
    const payload = { name: form.name, kind: form.kind, branch: form.branch || null, description: form.description || null, cover_url: form.cover_url || null, active: form.active !== false }
    let error, id
    if (editing) { const r = await supabase.from('flow_points').update(payload).eq('id', editing.id); error = r.error; id = editing.id }
    else { const r = await supabase.from('flow_points').insert({ ...payload, tenant_id: tenantId }).select('id').single(); error = r.error; id = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: 'flow_points', resource_id: id, new_data: payload }, tenantId)
    setModal(false); load()
  }
  const remove = async (r) => {
    if (!confirm(`Remover o ponto "${r.name}"? Os QR Codes dele deixarão de funcionar.`)) return
    const { error } = await supabase.from('flow_points').delete().eq('id', r.id)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'flow_points', resource_id: r.id, old_data: r }, tenantId); notify('Ponto removido', 'success'); load()
  }
  const copyLink = (code) => { navigator.clipboard?.writeText(flowUrl(code)); notify('Link copiado', 'success') }
  const downloadQR = async (r) => {
    const data = await QRCode.toDataURL(flowUrl(r.code), { margin: 2, width: 900, color: { dark: '#14160f', light: '#ffffff' } })
    const a = document.createElement('a'); a.href = data; a.download = `qr-${r.name.replace(/\s+/g, '-').toLowerCase()}.png`; a.click()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">{rows.length} pontos de venda</p>
        {mayEdit && <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo ponto</button>}
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : rows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhum ponto ainda.</p><p className="text-admin-muted/30 text-xs mt-1">Crie um ponto (quarto, mesa, frigobar…) e gere o QR Code para colar no ambiente.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex gap-4">
              <button onClick={() => setQrView(r)} className="shrink-0"><QRThumb code={r.code} size={96} /></button>
              <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-admin-text text-sm font-medium truncate">{r.name}</p><p className="text-admin-muted/40 text-[11px]">{KINDS[r.kind] || r.kind}{r.branch ? ` · ${r.branch}` : ''}</p></div>
                  {!r.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-admin-muted/50">inativo</span>}
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <button onClick={() => copyLink(r.code)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Copiar link</button>
                  <button onClick={() => downloadQR(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Baixar QR</button>
                  {mayEdit && <button onClick={() => openEdit(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Editar</button>}
                  {mayDelete && <button onClick={() => remove(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-rose">Excluir</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setQrView(null)}>
          <div className="glass-pop rounded-2xl p-7 text-center" onClick={(e) => e.stopPropagation()}>
            <QRThumb code={qrView.code} size={240} />
            <p className="text-admin-text font-medium mt-4">{qrView.name}</p>
            <p className="text-admin-muted/40 text-xs break-all mt-1 max-w-xs">{flowUrl(qrView.code)}</p>
            <div className="flex gap-2 mt-5 justify-center"><button onClick={() => downloadQR(qrView)} className="bg-admin-champ/15 text-admin-champ px-4 py-2 rounded-xl text-sm">Baixar PNG</button><button onClick={() => copyLink(qrView.code)} className="bg-white/[0.05] text-admin-muted/70 px-4 py-2 rounded-xl text-sm">Copiar link</button></div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar ponto' : 'Novo ponto'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Quarto 204 · Mesa 7 · Frigobar Suíte" /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Filial (opcional)</label><input value={form.branch || ''} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} className={inputCls} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Imagem de capa (URL)</label><input value={form.cover_url || ''} onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))} className={inputCls} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-admin-muted/70"><input type="checkbox" checked={form.active !== false} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="accent-admin-champ" />Ponto ativo (QR funcionando)</label>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{editing ? 'Salvar' : 'Criar ponto'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Catálogo ----------
function CatalogTab({ notify }) {
  return (
    <ResourcePanel notify={notify} module="flow" table="flow_products" embedded exportName="flow-catalogo" newLabel="Novo produto"
      orderBy={{ column: 'sort_order', ascending: true }}
      fields={[
        { key: 'name', label: 'Produto', type: 'text', primary: true, required: true, full: true, search: true },
        { key: 'point_id', label: 'Ponto (vazio = todos)', type: 'ref', refTable: 'flow_points', refLabel: 'name', chip: true, filter: true, placeholder: '— todos os pontos —' },
        { key: 'category', label: 'Categoria', type: 'text', chip: true, filter: false },
        { key: 'price', label: 'Preço', type: 'currency', required: true },
        { key: 'promo_price', label: 'Preço promocional', type: 'currency' },
        { key: 'stock', label: 'Estoque (vazio = ilimitado)', type: 'int' },
        { key: 'min_stock', label: 'Estoque mínimo', type: 'int' },
        { key: 'image_url', label: 'Imagem (URL)', type: 'text', full: true },
        { key: 'video_url', label: 'Vídeo (URL)', type: 'text', full: true },
        { key: 'sort_order', label: 'Ordem', type: 'int' },
        { key: 'active', label: 'Ativo', type: 'bool', default: true },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Produtos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativos', calc: (r) => r.filter((x) => x.active).length, fmt: 'int' },
        { label: 'Em promoção', calc: (r) => r.filter((x) => x.promo_price > 0).length, fmt: 'int' },
        { label: 'Estoque baixo', calc: (r) => r.filter((x) => x.stock != null && x.min_stock != null && x.stock <= x.min_stock).length, fmt: 'int' },
      ]}
    />
  )
}

// ---------- Pedidos ----------
function OrdersTab({ notify }) {
  return (
    <KanbanBoard notify={notify} module="flow" table="flow_orders" title="" subtitle="pedidos recebidos pelos QR Codes" icon="cart"
      stageField="status" stageLabel="Status" primary="point_name" valueField="total"
      stages={[
        ['pending', 'Recebido', 'border-admin-champ/40'],
        ['paid', 'Pago', 'border-admin-sage/40'],
        ['preparing', 'Preparando', 'border-admin-gold/40'],
        ['delivered', 'Entregue', 'border-admin-sage/50'],
        ['cancelled', 'Cancelado', 'border-admin-rose/40'],
      ]}
      chips={['reference', 'customer_name', 'payment_method']}
      fields={[
        { key: 'point_name', label: 'Ponto', type: 'text', primary: true, full: true },
        { key: 'reference', label: 'Nº quarto/mesa', type: 'text' },
        { key: 'customer_name', label: 'Cliente', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'payment_method', label: 'Pagamento', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Pedidos', fmt: 'int', calc: (r) => r.length },
        { label: 'Recebidos', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'pending').length },
        { label: 'Faturamento', fmt: 'currency', calc: (r) => r.filter((x) => !['cancelled'].includes(x.status)).reduce((s, x) => s + Number(x.total || 0), 0) },
      ]}
    />
  )
}

// ---------- Painel (dashboard em tempo real) ----------
function DashboardTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); const { data } = await supabase.from('flow_orders').select('*').order('created_at', { ascending: false }).limit(1000); setOrders(data || []); setLoading(false) }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== 'cancelled')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const revToday = valid.filter((o) => new Date(o.created_at) >= today).reduce((s, o) => s + Number(o.total || 0), 0)
    const revMonth = valid.filter((o) => new Date(o.created_at) >= monthStart).reduce((s, o) => s + Number(o.total || 0), 0)
    const ticket = valid.length ? valid.reduce((s, o) => s + Number(o.total || 0), 0) / valid.length : 0
    const byProduct = {}; const byPoint = {}; const byHour = Array(24).fill(0)
    valid.forEach((o) => {
      byPoint[o.point_name || '—'] = (byPoint[o.point_name || '—'] || 0) + Number(o.total || 0)
      byHour[new Date(o.created_at).getHours()] += Number(o.total || 0)
        ; (o.items || []).forEach((it) => { byProduct[it.name] = (byProduct[it.name] || 0) + (it.qty || 0) })
    })
    const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const topPoints = Object.entries(byPoint).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const peakHour = byHour.indexOf(Math.max(...byHour))
    return { revToday, revMonth, ticket, count: valid.length, topProducts, topPoints, byHour, peakHour }
  }, [orders])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
  const maxHour = Math.max(1, ...stats.byHour)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Faturamento hoje', brl(stats.revToday), 'text-admin-champ'], ['Faturamento no mês', brl(stats.revMonth), 'text-admin-sage'], ['Ticket médio', brl(stats.ticket), 'text-admin-gold'], ['Pedidos', String(stats.count), 'text-admin-text']].map(([l, v, c]) => (
          <div key={l} className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{l}</p><p className={`text-2xl font-medium ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Mais vendidos</p>
          {stats.topProducts.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas ainda.</p> : stats.topProducts.map(([name, qty]) => (
            <div key={name} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0"><span className="text-admin-text text-sm truncate">{name}</span><span className="text-admin-champ text-sm">{qty}</span></div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Vendas por ponto</p>
          {stats.topPoints.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas ainda.</p> : stats.topPoints.map(([name, val]) => (
            <div key={name} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0"><span className="text-admin-text text-sm truncate">{name}</span><span className="text-admin-gold text-sm">{brl(val)}</span></div>
          ))}
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Faturamento por hora</p>{stats.count > 0 && <p className="text-admin-muted/40 text-xs">Pico às {String(stats.peakHour).padStart(2, '0')}h</p>}</div>
        <div className="flex items-end gap-1 h-32">
          {stats.byHour.map((v, h) => (
            <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}h · ${brl(v)}`}>
              <div className="w-full rounded-t bg-admin-champ/50" style={{ height: `${(v / maxHour) * 100}%`, minHeight: v > 0 ? 3 : 0 }} />
              {h % 6 === 0 && <span className="text-[8px] text-admin-muted/30 mt-1">{h}h</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FlowPanel({ notify }) {
  return (
    <ResourceTabs title="Seravie Flow" subtitle="vendas autônomas por QR Code — transforme qualquer espaço em ponto de venda"
      tabs={[
        { key: 'points', label: 'Pontos & QR', render: () => <PointsTab notify={notify} /> },
        { key: 'catalog', label: 'Catálogo', render: () => <CatalogTab notify={notify} /> },
        { key: 'orders', label: 'Pedidos', render: () => <OrdersTab notify={notify} /> },
        { key: 'dash', label: 'Painel', render: () => <DashboardTab /> },
      ]}
    />
  )
}
