import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassMulti, GlassDate } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, brl } from '../../../lib/suppliersMarket'

// RFQ Center — Solicitação de Cotação a vários fornecedores:
// criar RFQ → convidar fornecedores → registrar respostas → comparar →
// aprovar vencedor → converter em pedido de compra.

const RFQ_STATUS = {
  draft: { label: 'Rascunho', style: 'bg-white/[0.06] text-admin-muted/70' },
  open: { label: 'Aberta', style: 'bg-admin-champ/15 text-admin-champ' },
  negotiating: { label: 'Negociando', style: 'bg-admin-gold/15 text-admin-gold' },
  awarded: { label: 'Aprovada', style: 'bg-admin-sage/15 text-admin-sage' },
  closed: { label: 'Encerrada', style: 'bg-white/[0.06] text-admin-muted/50' },
  cancelled: { label: 'Cancelada', style: 'bg-admin-rose/15 text-admin-rose' },
}
const RESP_STATUS = {
  invited: { label: 'Aguardando', style: 'text-admin-muted/50' },
  quoted: { label: 'Respondeu', style: 'text-admin-champ' },
  declined: { label: 'Recusou', style: 'text-admin-rose/70' },
  awarded: { label: 'Vencedor', style: 'text-admin-sage' },
  rejected: { label: 'Não escolhido', style: 'text-admin-muted/40' },
}

export function RfqCenter({ suppliers, presetSupplierIds, onConsumePreset, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rfqs, setRfqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('rfqs').select('*, rfq_suppliers(*)').order('created_at', { ascending: false })
      setRfqs(data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // se veio do Comparador com fornecedores pré-selecionados, abre o criar já preenchido
  useEffect(() => {
    if (presetSupplierIds && presetSupplierIds.length) { setCreating(true) }
  }, [presetSupplierIds])

  if (open) {
    const fresh = rfqs.find((r) => r.id === open.id) || open
    return <RfqDetail rfq={fresh} suppliers={suppliers} tenantId={tenantId} onBack={() => { setOpen(null); load() }} reload={load} notify={notify} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl text-admin-text">Cotações (RFQ)</h1>
          <p className="text-admin-muted/50 text-sm mt-1">Peça orçamento a vários fornecedores, compare as respostas e aprove o melhor.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Nova cotação</button>
      </div>

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-24 animate-pulse opacity-40" />)}</div>
        : rfqs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Icon name="mail" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" />
            <p className="text-admin-muted/60 text-sm">Nenhuma cotação ainda.</p>
            <p className="text-admin-muted/35 text-xs mt-1">Crie uma RFQ e convide fornecedores para comparar propostas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rfqs.map((r) => {
              const invited = r.rfq_suppliers || []
              const quoted = invited.filter((x) => x.status === 'quoted' || x.status === 'awarded')
              const st = RFQ_STATUS[r.status] || RFQ_STATUS.open
              return (
                <button key={r.id} onClick={() => setOpen(r)} className="w-full text-left glass rounded-2xl p-5 hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><p className="text-admin-text font-medium">{r.title}</p><span className={`text-[10px] px-2 py-0.5 rounded-lg ${st.style}`}>{st.label}</span></div>
                      <p className="text-admin-muted/45 text-xs mt-1">{r.category ? (SUPPLIER_CATEGORIES[r.category] || r.category) + ' · ' : ''}{invited.length} convidados · {quoted.length} responderam</p>
                      {r.description && <p className="text-admin-muted/55 text-sm mt-2 line-clamp-1">{r.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {r.budget ? <p className="text-admin-champ text-sm">{brl(r.budget)}</p> : null}
                      {r.deadline && <p className="text-admin-muted/40 text-[11px] mt-0.5">até {new Date(r.deadline).toLocaleDateString('pt-BR')}</p>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

      {creating && <CreateRfq suppliers={suppliers} tenantId={tenantId} presetSupplierIds={presetSupplierIds} onClose={() => { setCreating(false); onConsumePreset?.() }} onCreated={() => { setCreating(false); onConsumePreset?.(); load() }} notify={notify} />}
    </div>
  )
}

function CreateRfq({ suppliers, tenantId, presetSupplierIds, onClose, onCreated, notify }) {
  const [f, setF] = useState({ title: '', category: '', description: '', quantity: '', budget: '', deadline: '' })
  const [picked, setPicked] = useState(presetSupplierIds || [])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

  const create = async () => {
    if (!f.title.trim()) return notify?.('Informe o título da cotação', 'error')
    if (picked.length === 0) return notify?.('Selecione ao menos um fornecedor', 'error')
    setSaving(true)
    const { data: rfq, error } = await supabase.from('rfqs').insert({
      tenant_id: tenantId, title: f.title, category: f.category || null, description: f.description || null,
      quantity: f.quantity || null, budget: f.budget ? Number(f.budget) : null, deadline: f.deadline || null, status: 'open',
    }).select('id').single()
    if (error) { setSaving(false); return notify?.('Erro ao criar RFQ: ' + error.message, 'error') }
    const rows = picked.map((sid) => ({ tenant_id: tenantId, rfq_id: rfq.id, supplier_id: sid, status: 'invited' }))
    const { error: e2 } = await supabase.from('rfq_suppliers').insert(rows)
    setSaving(false)
    if (e2) return notify?.('RFQ criada, mas falhou ao convidar: ' + e2.message, 'error')
    notify?.(`Cotação criada e enviada a ${picked.length} fornecedor(es).`, 'success'); onCreated()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Nova cotação (RFQ)</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Título (ex.: Mobiliário para cafeteria) *" className={cls} />
          <div className="grid grid-cols-2 gap-3">
            <GlassSelect value={f.category} onChange={(v) => set('category', v)} options={[{ value: '', label: 'Categoria' }, ...Object.entries(SUPPLIER_CATEGORIES).map(([value, label]) => ({ value, label }))]} />
            <input value={f.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="Quantidade" className={cls} />
          </div>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Descreva o que precisa…" className={`${cls} resize-none`} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder="Orçamento (R$)" className={cls} />
            <GlassDate value={f.deadline} onChange={(v) => set('deadline', v)} placeholder="Prazo (dd/mm/aaaa)" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Convidar fornecedores *</label>
            <GlassMulti value={picked} onChange={setPicked} options={suppliers.map((s) => ({ value: s.id, label: `${s.name} · ${SUPPLIER_CATEGORIES[s.category] || s.category}` }))} placeholder="Selecione fornecedores" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={create} disabled={saving} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Enviando…' : 'Criar e enviar'}</button>
        </div>
      </div>
    </div>
  )
}

function RfqDetail({ rfq, suppliers, tenantId, onBack, reload, notify }) {
  const [respModal, setRespModal] = useState(null)   // rfq_supplier em edição de resposta
  const invited = rfq.rfq_suppliers || []
  const supplierById = (id) => suppliers.find((s) => s.id === id)
  const st = RFQ_STATUS[rfq.status] || RFQ_STATUS.open

  // melhor preço entre os que responderam (destaque)
  const priced = invited.filter((x) => x.price != null)
  const bestPrice = priced.length ? Math.min(...priced.map((x) => Number(x.price))) : null

  const award = async (row) => {
    // marca vencedor, os demais como rejeitados, RFQ como awarded
    await supabase.from('rfq_suppliers').update({ is_winner: false, status: 'rejected' }).eq('rfq_id', rfq.id).neq('id', row.id)
    await supabase.from('rfq_suppliers').update({ is_winner: true, status: 'awarded' }).eq('id', row.id)
    await supabase.from('rfqs').update({ status: 'awarded', updated_at: new Date().toISOString() }).eq('id', rfq.id)
    notify?.('Fornecedor aprovado. Você já pode converter em pedido.', 'success'); reload()
  }
  const convertToOrder = async (row) => {
    const sup = supplierById(row.supplier_id)
    const { error } = await supabase.from('purchase_orders').insert({
      tenant_id: tenantId, supplier_id: row.supplier_id, rfq_id: rfq.id, title: rfq.title,
      amount: row.price ? Number(row.price) : null, lead_time: row.lead_time || null, status: 'placed',
    })
    if (error) return notify?.('Erro ao converter: ' + error.message, 'error')
    await supabase.from('rfqs').update({ status: 'closed' }).eq('id', rfq.id)
    notify?.(`Pedido de compra criado para ${sup?.name || 'fornecedor'}.`, 'success'); reload()
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar às cotações</button>
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap"><h1 className="font-serif text-2xl text-admin-text">{rfq.title}</h1><span className={`text-[11px] px-2 py-0.5 rounded-lg ${st.style}`}>{st.label}</span></div>
            <p className="text-admin-muted/50 text-sm mt-1">{rfq.category ? (SUPPLIER_CATEGORIES[rfq.category] || rfq.category) : 'Sem categoria'}{rfq.quantity ? ` · ${rfq.quantity}` : ''}</p>
            {rfq.description && <p className="text-admin-muted/65 text-sm mt-3 max-w-2xl leading-relaxed">{rfq.description}</p>}
          </div>
          <div className="text-right shrink-0">
            {rfq.budget ? <p className="text-admin-champ text-lg font-serif">{brl(rfq.budget)}</p> : null}
            {rfq.deadline && <p className="text-admin-muted/40 text-xs mt-0.5">Prazo: {new Date(rfq.deadline).toLocaleDateString('pt-BR')}</p>}
          </div>
        </div>
      </div>

      <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Respostas dos fornecedores</h3>
      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="border-b border-white/[0.07] text-admin-muted/45 text-[10px] uppercase tracking-wider">
            <th className="text-left p-4">Fornecedor</th><th className="p-4">Status</th><th className="p-4">Preço</th><th className="p-4">Prazo</th><th className="p-4">Garantia</th><th className="p-4">Frete</th><th className="p-4">Ações</th>
          </tr></thead>
          <tbody>
            {invited.map((row) => {
              const sup = supplierById(row.supplier_id)
              const rs = RESP_STATUS[row.status] || RESP_STATUS.invited
              const isBest = row.price != null && Number(row.price) === bestPrice
              return (
                <tr key={row.id} className={`border-b border-white/[0.04] ${row.is_winner ? 'bg-admin-sage/[0.06]' : ''}`}>
                  <td className="p-4"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center overflow-hidden shrink-0">{sup?.logo_url ? <img src={sup.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={CATEGORY_ICON[sup?.category] || 'box'} className="w-4 h-4 text-admin-champ/60" />}</div><span className="text-admin-text">{sup?.name || 'Fornecedor'}</span></div></td>
                  <td className={`p-4 text-center text-xs ${rs.style}`}>{rs.label}</td>
                  <td className={`p-4 text-center ${isBest ? 'text-admin-champ font-medium' : 'text-admin-text/80'}`}>{row.price != null ? <span className="inline-flex items-center gap-1">{brl(row.price)}{isBest && <Icon name="check" className="w-3.5 h-3.5 text-admin-sage" />}</span> : '—'}</td>
                  <td className="p-4 text-center text-admin-text/70">{row.lead_time || '—'}</td>
                  <td className="p-4 text-center text-admin-text/70">{row.warranty || '—'}</td>
                  <td className="p-4 text-center text-admin-text/70">{row.freight != null ? brl(row.freight) : '—'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-center">
                      <button onClick={() => setRespModal(row)} className="text-[11px] px-2.5 py-1 rounded-lg glass-input text-admin-muted/70 hover:text-admin-champ transition-colors">Registrar resposta</button>
                      {row.status !== 'awarded' && rfq.status !== 'closed' && <button onClick={() => award(row)} className="text-[11px] px-2.5 py-1 rounded-lg bg-admin-sage/12 text-admin-sage hover:bg-admin-sage/20 transition-colors">Aprovar</button>}
                      {row.is_winner && <button onClick={() => convertToOrder(row)} className="text-[11px] px-2.5 py-1 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 transition-colors">Converter em pedido</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-admin-muted/35 text-[11px] mt-3 flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5 text-admin-sage" /> destaca o menor preço. Registre as respostas conforme os fornecedores retornam, aprove o vencedor e converta em pedido de compra.</p>

      {respModal && <ResponseModal row={respModal} supplier={supplierById(respModal.supplier_id)} onClose={() => setRespModal(null)} onSaved={() => { setRespModal(null); reload() }} notify={notify} />}
    </div>
  )
}

function ResponseModal({ row, supplier, onClose, onSaved, notify }) {
  const [f, setF] = useState({ price: row.price ?? '', lead_time: row.lead_time || '', warranty: row.warranty || '', freight: row.freight ?? '', message: row.message || '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('rfq_suppliers').update({
      price: f.price !== '' ? Number(f.price) : null, lead_time: f.lead_time || null, warranty: f.warranty || null,
      freight: f.freight !== '' ? Number(f.freight) : null, message: f.message || null,
      status: 'quoted', responded_at: new Date().toISOString(),
    }).eq('id', row.id)
    setSaving(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    notify?.('Resposta registrada.', 'success'); onSaved()
  }
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h2 className="font-serif text-xl text-admin-text">Resposta do fornecedor</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/50 text-xs mb-4">{supplier?.name}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1">Preço (R$)</label><input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} className={cls} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1">Frete (R$)</label><input type="number" value={f.freight} onChange={(e) => set('freight', e.target.value)} className={cls} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1">Prazo</label><input value={f.lead_time} onChange={(e) => set('lead_time', e.target.value)} placeholder="Ex: 30 dias" className={cls} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1">Garantia</label><input value={f.warranty} onChange={(e) => set('warranty', e.target.value)} placeholder="Ex: 12 meses" className={cls} /></div>
          </div>
          <textarea value={f.message} onChange={(e) => set('message', e.target.value)} rows={3} placeholder="Observações da proposta…" className={`${cls} resize-none`} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar resposta'}</button>
        </div>
      </div>
    </div>
  )
}
