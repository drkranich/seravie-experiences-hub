import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from '../ui'
import { brl } from '../../../lib/suppliersMarket'

// Compras — pedidos do comprador ao fornecedor. Cria pedido (manual ou a partir
// de um fornecedor), acompanha status, histórico. Grava em buyer_orders.

const STATUS = {
  rascunho: { label: 'Rascunho', s: 'bg-white/[0.06] text-admin-muted/60' },
  enviado: { label: 'Enviado', s: 'bg-admin-champ/15 text-admin-champ' },
  confirmado: { label: 'Confirmado', s: 'bg-admin-sage/15 text-admin-sage' },
  producao: { label: 'Em produção', s: 'bg-admin-gold/15 text-admin-gold' },
  enviado_entrega: { label: 'A caminho', s: 'bg-admin-gold/15 text-admin-gold' },
  concluido: { label: 'Concluído', s: 'bg-admin-sage/15 text-admin-sage' },
  cancelado: { label: 'Cancelado', s: 'bg-admin-rose/15 text-admin-rose' },
}
const FLOW = ['rascunho', 'enviado', 'confirmado', 'producao', 'enviado_entrega', 'concluido']

export function BuyerOrders({ suppliers = [], notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { const { data } = await supabase.from('buyer_orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }); setOrders(data || []) }
    catch { /* noop */ } finally { setLoading(false) }
  }, [tenantId])
  useEffect(() => { load() }, [load])

  const create = async (payload) => {
    const code = 'PC-' + String(orders.length + 1).padStart(4, '0')
    const { data, error } = await supabase.from('buyer_orders').insert({ ...payload, tenant_id: tenantId, code, status: 'rascunho' }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setOrders((o) => [data, ...o]); setCreating(false); setOpen(data); notify?.('Pedido criado', 'success')
  }
  const patch = async (id, p) => {
    setOrders((o) => o.map((x) => x.id === id ? { ...x, ...p } : x))
    if (open?.id === id) setOpen((x) => ({ ...x, ...p }))
    await supabase.from('buyer_orders').update(p).eq('id', id)
  }
  const remove = async (id) => {
    setOrders((o) => o.filter((x) => x.id !== id)); setOpen(null)
    await supabase.from('buyer_orders').delete().eq('id', id); notify?.('Pedido excluído', 'success')
  }

  if (open) return <OrderDetail order={orders.find((o) => o.id === open.id) || open} onBack={() => setOpen(null)} onPatch={patch} onDelete={remove} notify={notify} />

  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const totalOpen = orders.filter((o) => !['concluido', 'cancelado'].includes(o.status)).reduce((s, o) => s + (Number(o.total) || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Compras</h1><p className="text-admin-muted/50 text-sm mt-1">Pedidos aos fornecedores — do rascunho à entrega.</p></div>
        <div className="flex items-center gap-2">
          <GlassSelect value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos os status' }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]} className="w-44" />
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Novo pedido</button>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5 max-w-md">
          <Stat label="Pedidos" value={orders.length} />
          <Stat label="Em aberto" value={orders.filter((o) => !['concluido', 'cancelado'].includes(o.status)).length} />
          <Stat label="Valor em aberto" value={brl(totalOpen)} small />
        </div>
      )}

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-24 animate-pulse opacity-40" />)}</div>
        : shown.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="cart" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum pedido {filter !== 'all' ? 'neste status' : 'ainda'}.</p></div>
          : <div className="space-y-3">
              {shown.map((o) => { const st = STATUS[o.status] || STATUS.rascunho; return (
                <button key={o.id} onClick={() => setOpen(o)} className="w-full text-left glass rounded-2xl p-5 hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><span className="text-admin-champ/70 text-xs">{o.code}</span><p className="text-admin-text font-medium">{o.supplier_name || 'Fornecedor'}</p><span className={`text-[10px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span></div>
                      <p className="text-admin-muted/45 text-xs mt-1">{(o.items || []).length} item(ns){o.expected_at ? ` · entrega ${new Date(o.expected_at).toLocaleDateString('pt-BR')}` : ''}</p>
                    </div>
                    <p className="text-admin-champ text-sm shrink-0">{brl(o.total)}</p>
                  </div>
                </button>
              )})}
            </div>}

      {creating && <CreateOrder suppliers={suppliers} onClose={() => setCreating(false)} onCreate={create} notify={notify} />}
    </div>
  )
}

function Stat({ label, value, small }) { return <div className="glass rounded-xl px-4 py-3"><p className={`font-serif text-admin-text ${small ? 'text-base' : 'text-lg'}`}>{value}</p><p className="text-[10px] uppercase tracking-wider text-admin-muted/45 mt-0.5">{label}</p></div> }

function CreateOrder({ suppliers, onClose, onCreate, notify }) {
  const [f, setF] = useState({ supplier_id: '', supplier_name: '', notes: '', delivery_address: '', expected_at: '', shipping: '' })
  const [items, setItems] = useState([{ name: '', qty: 1, unit_price: '', note: '' }])
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const setItem = (i, k, v) => setItems((it) => it.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  const total = subtotal + (Number(f.shipping) || 0)
  const submit = () => {
    if (!f.supplier_id && !f.supplier_name.trim()) return notify?.('Escolha o fornecedor', 'error')
    const clean = items.filter((it) => it.name.trim()).map((it) => ({ name: it.name, qty: Number(it.qty) || 1, unit_price: Number(it.unit_price) || 0, note: it.note || '' }))
    if (!clean.length) return notify?.('Adicione ao menos 1 item', 'error')
    const sup = suppliers.find((s) => s.id === f.supplier_id)
    onCreate({ supplier_id: f.supplier_id || null, supplier_name: sup?.name || f.supplier_name, items: clean, subtotal, shipping: Number(f.shipping) || 0, total, notes: f.notes || null, delivery_address: f.delivery_address || null, expected_at: f.expected_at || null })
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Novo pedido</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className={lbl}>Fornecedor</label>{suppliers.length ? <GlassSelect value={f.supplier_id} onChange={(v) => set('supplier_id', v)} options={[{ value: '', label: 'Selecione…' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} /> : <input value={f.supplier_name} onChange={(e) => set('supplier_name', e.target.value)} placeholder="Nome do fornecedor" className={cls} />}</div>
          <div>
            <label className={lbl}>Itens</label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="Produto / serviço" className={`${cls} flex-1`} />
                  <input type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} placeholder="Qtd" className={`${cls} w-16`} />
                  <input type="number" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} placeholder="R$" className={`${cls} w-24`} />
                  <button onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="text-admin-muted/40 hover:text-admin-rose shrink-0"><Icon name="x" className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setItems((x) => [...x, { name: '', qty: 1, unit_price: '', note: '' }])} className="text-[11px] text-admin-champ/80 hover:text-admin-champ flex items-center gap-1 mt-2"><Icon name="plus" className="w-3.5 h-3.5" />Adicionar item</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Frete (R$)</label><input type="number" value={f.shipping} onChange={(e) => set('shipping', e.target.value)} className={cls} /></div>
            <div><label className={lbl}>Entrega prevista</label><GlassDate value={f.expected_at} onChange={(v) => set('expected_at', v)} placeholder="dd/mm/aaaa" /></div>
          </div>
          <div><label className={lbl}>Endereço de entrega</label><input value={f.delivery_address} onChange={(e) => set('delivery_address', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>Observações</label><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={`${cls} resize-none`} /></div>
          <div className="glass-soft rounded-xl p-3 flex items-center justify-between text-sm"><span className="text-admin-muted/60">Total</span><span className="text-admin-champ font-serif">{brl(total)}</span></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={submit} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar pedido</button></div>
      </div>
    </div>
  )
}

function OrderDetail({ order: o, onBack, onPatch, onDelete, notify }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const st = STATUS[o.status] || STATUS.rascunho
  const stepIdx = FLOW.indexOf(o.status)
  const advance = () => { if (stepIdx >= 0 && stepIdx < FLOW.length - 1) onPatch(o.id, { status: FLOW[stepIdx + 1] }) }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar às compras</button>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-admin-champ/70 text-sm">{o.code}</span><h1 className="font-serif text-2xl text-admin-text">{o.supplier_name || 'Fornecedor'}</h1><span className={`text-[11px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span></div>
          {o.expected_at && <p className="text-admin-muted/45 text-xs mt-1">Entrega prevista: {new Date(o.expected_at).toLocaleDateString('pt-BR')}</p>}
        </div>
        <div className="flex items-center gap-2">
          {stepIdx >= 0 && stepIdx < FLOW.length - 1 && <button onClick={advance} className="text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl transition-colors">Avançar → {STATUS[FLOW[stepIdx + 1]].label}</button>}
          {o.status !== 'cancelado' && o.status !== 'concluido' && <button onClick={() => onPatch(o.id, { status: 'cancelado' })} className="text-sm glass-input text-admin-muted/60 hover:text-admin-rose px-4 py-2 rounded-xl transition-colors">Cancelar</button>}
          <button onClick={() => setConfirmDel(true)} className="glass-input text-admin-muted/60 hover:text-admin-rose px-3 py-2 rounded-xl transition-colors" title="Excluir"><Icon name="trash" className="w-4 h-4" /></button>
        </div>
      </div>

      {/* timeline de status */}
      <div className="glass rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between">
          {FLOW.map((s, i) => { const done = stepIdx >= i; const active = stepIdx === i; return (
            <div key={s} className="flex-1 flex flex-col items-center relative">
              {i > 0 && <div className={`absolute top-3 right-1/2 w-full h-0.5 ${stepIdx >= i ? 'bg-admin-champ/40' : 'bg-white/[0.06]'}`} />}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] z-10 ${active ? 'bg-admin-champ text-admin-bg' : done ? 'bg-admin-champ/30 text-admin-champ' : 'bg-white/[0.05] text-admin-muted/40'}`}>{done ? <Icon name="check" className="w-3 h-3" /> : i + 1}</div>
              <span className={`text-[9px] mt-1.5 text-center ${active ? 'text-admin-champ' : 'text-admin-muted/40'}`}>{STATUS[s].label}</span>
            </div>
          )})}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 mb-5">
        <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Itens do pedido</p>
        <div className="space-y-2">
          {(o.items || []).map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.04] last:border-0">
              <div><span className="text-admin-text">{it.name}</span><span className="text-admin-muted/40 text-xs ml-2">{it.qty} × {brl(it.unit_price)}</span>{it.note && <p className="text-admin-muted/40 text-[11px]">{it.note}</p>}</div>
              <span className="text-admin-muted/70">{brl((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1 text-sm">
          <div className="flex justify-between text-admin-muted/55"><span>Subtotal</span><span>{brl(o.subtotal)}</span></div>
          {o.shipping ? <div className="flex justify-between text-admin-muted/55"><span>Frete</span><span>{brl(o.shipping)}</span></div> : null}
          <div className="flex justify-between text-admin-text font-medium"><span>Total</span><span className="text-admin-champ">{brl(o.total)}</span></div>
        </div>
      </div>

      {(o.delivery_address || o.notes) && (
        <div className="glass rounded-2xl p-5">
          {o.delivery_address && <div className="mb-2"><p className="text-[10px] uppercase tracking-wider text-admin-champ/60">Entrega</p><p className="text-admin-muted/70 text-sm">{o.delivery_address}</p></div>}
          {o.notes && <div><p className="text-[10px] uppercase tracking-wider text-admin-champ/60">Observações</p><p className="text-admin-muted/70 text-sm">{o.notes}</p></div>}
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDel(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg text-admin-text mb-2">Excluir pedido?</h2>
            <p className="text-admin-muted/60 text-sm mb-5">O pedido {o.code} será removido permanentemente.</p>
            <div className="flex justify-end gap-2"><button onClick={() => setConfirmDel(false)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => { setConfirmDel(false); onDelete(o.id) }} className="px-4 py-2 rounded-xl text-sm bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose">Excluir</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
