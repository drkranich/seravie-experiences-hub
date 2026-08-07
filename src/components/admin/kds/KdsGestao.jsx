import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassMonth } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'porção']
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

// ================= Fornecedores =================
function SuppliersTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([]); const [modal, setModal] = useState(null); const [search, setSearch] = useState('')
  const load = async () => { const { data } = await supabase.from('suppliers').select('*').order('name'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const filtered = rows.filter((r) => !search.trim() || `${r.name} ${r.category} ${r.contact}`.toLowerCase().includes(search.toLowerCase()))
  const openNew = () => setModal({ name: '', category: '', contact: '', phone: '', email: '', notes: '', status: 'active' })
  const save = async () => {
    if (!modal.name.trim()) return notify?.('Informe o nome', 'error')
    const p = { name: modal.name.trim(), category: modal.category || null, contact: modal.contact || null, phone: modal.phone || null, email: modal.email || null, notes: modal.notes || null, status: modal.status || 'active', tenant_id: tenantId }
    const res = modal.id ? await supabase.from('suppliers').update(p).eq('id', modal.id) : await supabase.from('suppliers').insert(p)
    if (res.error) return notify?.('Erro: ' + res.error.message, 'error')
    notify?.(modal.id ? 'Fornecedor atualizado' : 'Fornecedor criado', 'success'); setModal(null); load()
  }
  const remove = async (r) => { if (confirm(`Remover "${r.name}"?`)) { await supabase.from('suppliers').delete().eq('id', r.id); load() } }
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-44"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fornecedor…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text outline-none" /></div>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo fornecedor</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhum fornecedor.</p>}
        {filtered.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4 group">
            <div className="flex items-start justify-between"><div className="min-w-0"><p className="text-admin-text text-sm font-medium truncate">{r.name}</p><p className="text-admin-muted/50 text-[11px]">{r.category || 'sem categoria'}</p></div><Icon name="building" className="w-5 h-5 text-admin-champ/40 shrink-0" /></div>
            {(r.contact || r.phone) && <p className="text-admin-muted/60 text-xs mt-2">{[r.contact, r.phone].filter(Boolean).join(' · ')}</p>}
            {r.email && <p className="text-admin-muted/40 text-[11px] truncate">{r.email}</p>}
            <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setModal(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ"><Icon name="pen" className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose ml-auto"><Icon name="trash" className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      {modal && <Modal title={modal.id ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setModal(null)} onSave={save}>
        <div className="space-y-3">
          <input value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} className={inputCls} placeholder="Nome / razão social" />
          <div className="grid grid-cols-2 gap-3">
            <input value={modal.category || ''} onChange={(e) => setModal((m) => ({ ...m, category: e.target.value }))} className={inputCls} placeholder="Categoria" />
            <input value={modal.contact || ''} onChange={(e) => setModal((m) => ({ ...m, contact: e.target.value }))} className={inputCls} placeholder="Contato" />
            <input value={modal.phone || ''} onChange={(e) => setModal((m) => ({ ...m, phone: e.target.value }))} className={inputCls} placeholder="Telefone" />
            <input value={modal.email || ''} onChange={(e) => setModal((m) => ({ ...m, email: e.target.value }))} className={inputCls} placeholder="E-mail" />
          </div>
          <input value={modal.notes || ''} onChange={(e) => setModal((m) => ({ ...m, notes: e.target.value }))} className={inputCls} placeholder="Observações" />
        </div>
      </Modal>}
    </div>
  )
}

// ================= Insumos =================
function IngredientsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([]); const [suppliers, setSuppliers] = useState([]); const [modal, setModal] = useState(null)
  const load = async () => {
    const [{ data: i }, { data: s }] = await Promise.all([
      supabase.from('kds_ingredients').select('*').order('name'),
      supabase.from('suppliers').select('id, name').order('name'),
    ])
    setRows(i || []); setSuppliers(s || [])
  }
  useEffect(() => { load() }, [])
  const unitCost = (r) => (Number(r.cost) || 0) / (Number(r.pack_size) || 1)
  const openNew = () => setModal({ name: '', unit: 'un', cost: '', pack_size: 1, supplier_id: '', stock: '', min_stock: '', active: true })
  const save = async () => {
    if (!modal.name.trim()) return notify?.('Informe o nome', 'error')
    const p = { name: modal.name.trim(), unit: modal.unit, cost: Number(modal.cost) || 0, pack_size: Number(modal.pack_size) || 1, supplier_id: modal.supplier_id || null, stock: modal.stock === '' ? null : Number(modal.stock), min_stock: modal.min_stock === '' ? null : Number(modal.min_stock), active: modal.active, tenant_id: tenantId }
    const res = modal.id ? await supabase.from('kds_ingredients').update(p).eq('id', modal.id) : await supabase.from('kds_ingredients').insert(p)
    if (res.error) return notify?.('Erro: ' + res.error.message, 'error')
    notify?.(modal.id ? 'Insumo atualizado' : 'Insumo criado', 'success'); setModal(null); load()
  }
  const remove = async (r) => { if (confirm(`Remover "${r.name}"?`)) { await supabase.from('kds_ingredients').delete().eq('id', r.id); load() } }
  return (
    <div>
      <div className="flex items-center justify-between mb-4"><p className="text-admin-muted/50 text-sm">{rows.length} insumo(s)</p><button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo insumo</button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.length === 0 && <p className="text-admin-muted/30 text-sm col-span-full text-center py-10">Nenhum insumo. Cadastre a matéria-prima para calcular custos.</p>}
        {rows.map((r) => {
          const low = r.stock != null && r.min_stock != null && r.stock <= r.min_stock
          return (
            <div key={r.id} className="glass rounded-2xl p-4 group">
              <div className="flex items-start justify-between"><div className="min-w-0"><p className="text-admin-text text-sm font-medium truncate">{r.name}</p><p className="text-admin-muted/50 text-[11px]">{brl(unitCost(r))} / {r.unit}</p></div>{low && <span className="text-[9px] px-2 py-0.5 rounded-lg bg-admin-rose/15 text-admin-rose shrink-0">estoque baixo</span>}</div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ ...r })} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose ml-auto"><Icon name="trash" className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>
      {modal && <Modal title={modal.id ? 'Editar insumo' : 'Novo insumo'} onClose={() => setModal(null)} onSave={save}>
        <div className="space-y-3">
          <input value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} className={inputCls} placeholder="Nome do insumo" />
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Unidade</label><GlassSelect value={modal.unit} onChange={(v) => setModal((m) => ({ ...m, unit: v }))} options={UNITS.map((u) => ({ value: u, label: u }))} /></div>
            <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Custo compra</label><input type="number" step="0.01" value={modal.cost} onChange={(e) => setModal((m) => ({ ...m, cost: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Qtd/embalagem</label><input type="number" step="0.01" value={modal.pack_size} onChange={(e) => setModal((m) => ({ ...m, pack_size: e.target.value }))} className={inputCls} /></div>
          </div>
          <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Fornecedor</label><GlassSelect value={modal.supplier_id || ''} onChange={(v) => setModal((m) => ({ ...m, supplier_id: v }))} options={[{ value: '', label: '— nenhum —' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} /></div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={modal.stock} onChange={(e) => setModal((m) => ({ ...m, stock: e.target.value }))} className={inputCls} placeholder="Estoque atual" />
            <input type="number" value={modal.min_stock} onChange={(e) => setModal((m) => ({ ...m, min_stock: e.target.value }))} className={inputCls} placeholder="Estoque mínimo" />
          </div>
        </div>
      </Modal>}
    </div>
  )
}

// ================= Precificação (calculadora) =================
function PricingTab({ notify }) {
  const [menu, setMenu] = useState([]); const [ingredients, setIngredients] = useState([]); const [sel, setSel] = useState(null)
  const load = async () => {
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.from('kds_menu').select('*').eq('kind', 'kitchen').order('name'),
      supabase.from('kds_ingredients').select('*').order('name'),
    ])
    setMenu(m || []); setIngredients(i || []); setSel((s) => s ? (m || []).find((x) => x.id === s.id) || null : (m || [])[0] || null)
  }
  useEffect(() => { load() }, [])
  const ing = (id) => ingredients.find((x) => x.id === id)
  const unitCost = (r) => (Number(r?.cost) || 0) / (Number(r?.pack_size) || 1)

  const recipe = sel?.recipe || []
  const ingCost = recipe.reduce((s, r) => s + unitCost(ing(r.ingredient_id)) * (Number(r.qty) || 0), 0)
  const totalCost = ingCost + (Number(sel?.extra_cost) || 0)
  const margin = Number(sel?.target_margin) || 0
  const suggested = margin < 100 ? totalCost / (1 - margin / 100) : totalCost * 2
  const price = Number(sel?.price) || 0
  const realMargin = price > 0 ? ((price - totalCost) / price) * 100 : 0
  const profit = price - totalCost

  const setField = (k, v) => setSel((s) => ({ ...s, [k]: v }))
  const addIng = (id) => setSel((s) => ({ ...s, recipe: [...(s.recipe || []), { ingredient_id: id, qty: 1 }] }))
  const setQty = (i, v) => setSel((s) => ({ ...s, recipe: s.recipe.map((r, idx) => idx === i ? { ...r, qty: v } : r) }))
  const delIng = (i) => setSel((s) => ({ ...s, recipe: s.recipe.filter((_, idx) => idx !== i) }))
  const save = async () => {
    const { error } = await supabase.from('kds_menu').update({ recipe, extra_cost: Number(sel.extra_cost) || 0, target_margin: Number(sel.target_margin) || 0, price: Number(sel.price) || 0 }).eq('id', sel.id)
    if (error) return notify?.('Erro ao salvar', 'error'); notify?.('Ficha técnica salva', 'success'); load()
  }
  const applySuggested = () => setField('price', Math.round(suggested * 100) / 100)

  if (!menu.length) return <p className="text-admin-muted/30 text-sm py-16 text-center">Cadastre itens no Cardápio para precificar.</p>

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-4">
      {/* lista de produtos */}
      <div className="glass rounded-2xl p-2 max-h-[70vh] overflow-y-auto">
        {menu.map((m) => (
          <button key={m.id} onClick={() => setSel(m)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${sel?.id === m.id ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text hover:bg-white/[0.04]'}`}>
            <p className="truncate">{m.name}</p><p className="text-[11px] opacity-60">{brl(m.price)}</p>
          </button>
        ))}
      </div>

      {sel && (
        <div className="space-y-4">
          {/* resumo do cálculo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="Custo total" value={brl(totalCost)} accent="rose" />
            <Card label="Preço sugerido" value={brl(suggested)} accent="champ" hint={`margem ${margin}%`} />
            <Card label="Preço de venda" value={brl(price)} accent="gold" />
            <Card label={profit >= 0 ? 'Lucro / un' : 'Prejuízo / un'} value={brl(profit)} accent={profit >= 0 ? 'sage' : 'rose'} hint={`margem real ${realMargin.toFixed(0)}%`} />
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3"><p className="font-serif text-xl text-admin-text">{sel.name}</p><button onClick={save} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm">Salvar ficha</button></div>

            {/* ingredientes da ficha */}
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2">Ficha técnica (insumos)</p>
            <div className="space-y-2 mb-3">
              {recipe.length === 0 && <p className="text-admin-muted/40 text-sm">Adicione os insumos que compõem este item.</p>}
              {recipe.map((r, i) => {
                const g = ing(r.ingredient_id)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-admin-text">{g?.name || 'insumo removido'}</span>
                    <input type="number" step="0.01" value={r.qty} onChange={(e) => setQty(i, e.target.value)} className="w-20 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none text-center" />
                    <span className="text-admin-muted/50 text-xs w-10">{g?.unit}</span>
                    <span className="text-admin-gold text-xs w-20 text-right">{brl(unitCost(g) * (Number(r.qty) || 0))}</span>
                    <button onClick={() => delIng(i)} className="text-admin-muted/50 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </div>
                )
              })}
            </div>
            <div className="mb-4"><GlassSelect value="" onChange={(v) => v && addIng(v)} options={[{ value: '', label: '+ adicionar insumo' }, ...ingredients.map((g) => ({ value: g.id, label: `${g.name} (${brl(unitCost(g))}/${g.unit})` }))]} /></div>

            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Custo extra (embalagem…)</label><input type="number" step="0.01" value={sel.extra_cost || 0} onChange={(e) => setField('extra_cost', e.target.value)} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Margem desejada (%)</label><input type="number" value={sel.target_margin || 0} onChange={(e) => setField('target_margin', e.target.value)} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Preço de venda</label><div className="flex gap-1.5"><input type="number" step="0.01" value={sel.price || 0} onChange={(e) => setField('price', e.target.value)} className={inputCls} /><button onClick={applySuggested} title="Usar preço sugerido" className="px-2 rounded-xl bg-admin-champ/15 text-admin-champ text-xs shrink-0">usar</button></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ================= Folha de pagamento =================
function PayrollTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([]); const [operators, setOperators] = useState([]); const [modal, setModal] = useState(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const load = async () => {
    const [{ data: p }, { data: ops }] = await Promise.all([
      supabase.from('kds_payroll').select('*').eq('reference_month', month).order('name'),
      supabase.from('kds_operators').select('id, name, role').eq('active', true).order('sort_order'),
    ])
    setRows(p || []); setOperators(ops || [])
  }
  useEffect(() => { load() }, [month])
  const net = (r) => (Number(r.base_salary) || 0) + (Number(r.benefits) || 0) + (Number(r.extra) || 0) - (Number(r.deductions) || 0)
  const totals = useMemo(() => ({ gross: rows.reduce((s, r) => s + net(r), 0), paid: rows.filter((r) => r.status === 'paid').reduce((s, r) => s + net(r), 0), count: rows.length }), [rows])
  const openNew = () => setModal({ name: '', role: '', operator_id: '', base_salary: '', benefits: '', deductions: '', extra: '', status: 'pending', reference_month: month })
  const save = async () => {
    if (!modal.name.trim()) return notify?.('Informe o nome', 'error')
    const p = { name: modal.name.trim(), role: modal.role || null, operator_id: modal.operator_id || null, base_salary: Number(modal.base_salary) || 0, benefits: Number(modal.benefits) || 0, deductions: Number(modal.deductions) || 0, extra: Number(modal.extra) || 0, status: modal.status, reference_month: month, tenant_id: tenantId }
    const res = modal.id ? await supabase.from('kds_payroll').update(p).eq('id', modal.id) : await supabase.from('kds_payroll').insert(p)
    if (res.error) return notify?.('Erro: ' + res.error.message, 'error')
    notify?.('Folha salva', 'success'); setModal(null); load()
  }
  const togglePaid = async (r) => { await supabase.from('kds_payroll').update({ status: r.status === 'paid' ? 'pending' : 'paid' }).eq('id', r.id); load() }
  const remove = async (r) => { if (confirm(`Remover "${r.name}"?`)) { await supabase.from('kds_payroll').delete().eq('id', r.id); load() } }
  const pickOperator = (id) => { const o = operators.find((x) => x.id === id); setModal((m) => ({ ...m, operator_id: id, name: o?.name || m.name, role: o?.role || m.role })) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <GlassMonth value={month} onChange={(v) => setMonth(String(v).slice(0, 7))} />
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Lançar</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card label="Total da folha" value={brl(totals.gross)} accent="champ" />
        <Card label="Já pago" value={brl(totals.paid)} accent="sage" />
        <Card label="Pessoas" value={String(totals.count)} accent="gold" />
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-admin-muted/40 text-sm">Nenhum lançamento para este mês.</div>}
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-xl p-3.5 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><Icon name="user" className="w-4 h-4 text-admin-champ" /></div>
            <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{r.name}</p><p className="text-admin-muted/50 text-[11px]">{r.role || 'operador'} · base {brl(r.base_salary)}{r.extra ? ` · extra ${brl(r.extra)}` : ''}{r.deductions ? ` · desc ${brl(r.deductions)}` : ''}</p></div>
            <span className="text-admin-champ text-sm shrink-0">{brl(net(r))}</span>
            <button onClick={() => togglePaid(r)} className={`text-[10px] px-2.5 py-1 rounded-lg shrink-0 ${r.status === 'paid' ? 'bg-admin-sage/15 text-admin-sage' : 'bg-admin-gold/15 text-admin-gold'}`}>{r.status === 'paid' ? 'pago' : 'pendente'}</button>
            <button onClick={() => setModal({ ...r })} className="p-1.5 rounded-lg text-admin-muted/50 hover:text-admin-champ shrink-0"><Icon name="pen" className="w-3.5 h-3.5" /></button>
            <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-admin-muted/50 hover:text-admin-rose shrink-0"><Icon name="trash" className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      {modal && <Modal title={modal.id ? 'Editar lançamento' : 'Lançar folha'} onClose={() => setModal(null)} onSave={save}>
        <div className="space-y-3">
          <div><label className="text-[10px] uppercase text-admin-muted/60 block mb-1">Operador (opcional)</label><GlassSelect value={modal.operator_id || ''} onChange={pickOperator} options={[{ value: '', label: '— avulso —' }, ...operators.map((o) => ({ value: o.id, label: o.name }))]} /></div>
          <div className="grid grid-cols-2 gap-3">
            <input value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} className={inputCls} placeholder="Nome" />
            <input value={modal.role || ''} onChange={(e) => setModal((m) => ({ ...m, role: e.target.value }))} className={inputCls} placeholder="Função" />
            <input type="number" step="0.01" value={modal.base_salary} onChange={(e) => setModal((m) => ({ ...m, base_salary: e.target.value }))} className={inputCls} placeholder="Salário base" />
            <input type="number" step="0.01" value={modal.benefits} onChange={(e) => setModal((m) => ({ ...m, benefits: e.target.value }))} className={inputCls} placeholder="Benefícios" />
            <input type="number" step="0.01" value={modal.extra} onChange={(e) => setModal((m) => ({ ...m, extra: e.target.value }))} className={inputCls} placeholder="Extra / comissão" />
            <input type="number" step="0.01" value={modal.deductions} onChange={(e) => setModal((m) => ({ ...m, deductions: e.target.value }))} className={inputCls} placeholder="Descontos" />
          </div>
        </div>
      </Modal>}
    </div>
  )
}

// ---------- helpers ----------
function Card({ label, value, accent = 'text', hint }) {
  const tone = { text: 'text-admin-text', champ: 'text-admin-champ', gold: 'text-admin-gold', sage: 'text-admin-sage', rose: 'text-admin-rose' }[accent]
  return <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{label}</p><p className={`text-2xl font-medium tabular-nums ${tone}`}>{value}</p>{hint && <p className="text-admin-muted/40 text-[11px] mt-0.5">{hint}</p>}</div>
}
function Modal({ title, children, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
        <div className="flex gap-3 mt-6"><button onClick={onSave} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Salvar</button><button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
      </div>
    </div>
  )
}

export function KdsGestao({ notify }) {
  const [sub, setSub] = useState('suppliers')
  const tabs = [
    { key: 'suppliers', label: 'Fornecedores', icon: 'building' },
    { key: 'ingredients', label: 'Insumos', icon: 'leaf' },
    { key: 'pricing', label: 'Precificação', icon: 'tag' },
    { key: 'payroll', label: 'Folha', icon: 'users' },
  ]
  return (
    <div>
      <div className="flex gap-1 mb-5 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((t) => <button key={t.key} onClick={() => setSub(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${sub === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name={t.icon} className="w-4 h-4" />{t.label}</button>)}
      </div>
      {sub === 'suppliers' && <SuppliersTab notify={notify} />}
      {sub === 'ingredients' && <IngredientsTab notify={notify} />}
      {sub === 'pricing' && <PricingTab notify={notify} />}
      {sub === 'payroll' && <PayrollTab notify={notify} />}
    </div>
  )
}
