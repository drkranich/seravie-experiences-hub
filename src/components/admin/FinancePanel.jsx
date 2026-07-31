import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { Icon, GlassSelect, GlassDate } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const METHODS = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', stripe: 'Stripe', boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro' }
const REV_CATS = ['venda', 'serviço', 'assinatura', 'outro']
const EXP_CATS = ['fornecedor', 'aluguel', 'salário', 'marketing', 'imposto', 'operacional', 'outro']
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

function Modal({ title, onClose, children }) {
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible"><div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>{children}</div></div>)
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

export function FinancePanel({ notify }) {
  const { profile, canEdit, canManage } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true
  const mayDelete = canManage ? canManage('finance') : true
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [month, setMonth] = useState(ym(new Date()))

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('financial_entries').select('*').order('date', { ascending: false }).limit(500)
    setEntries(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return notify('Informe um valor', 'error')
    const status = form.status || 'paid'
    const base = {
      type: form.type || 'expense', category: form.category || 'outro', description: form.description,
      amount: Number(form.amount), date: form.date || new Date().toISOString().slice(0, 10),
      payment_method: form.payment_method || 'dinheiro',
      status, due_date: status === 'pending' ? (form.due_date || null) : null,
    }
    const { error } = editing
      ? await supabase.from('financial_entries').update(base).eq('id', editing.id)
      : await supabase.from('financial_entries').insert({ ...base, created_by: user?.id || null, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar', 'error')
    notify(editing ? 'Lançamento atualizado' : 'Lançamento registrado', 'success'); setModal(false); setEditing(null); setForm({}); load()
  }

  const openEdit = (e) => { setEditing(e); setForm({ type: e.type, category: e.category, description: e.description || '', amount: String(e.amount), date: e.date, payment_method: e.payment_method, status: e.status || 'paid', due_date: e.due_date || '' }); setModal(true) }
  const remove = async (e) => {
    const { error } = await supabase.from('financial_entries').delete().eq('id', e.id)
    setConfirmDel(null)
    if (error) return notify('Erro ao excluir', 'error')
    notify('Lançamento excluído', 'success'); load()
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => (e.date || '').slice(0, 7)).filter(Boolean))
    set.add(ym(new Date()))
    return [...set].sort().reverse()
  }, [entries])

  const monthEntries = entries.filter((e) => (e.date || '').slice(0, 7) === month && (e.status || 'paid') === 'paid')
  const revenue = monthEntries.filter((e) => e.type === 'revenue').reduce((s, e) => s + Number(e.amount), 0)
  const expense = monthEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const balance = revenue - expense

  const byCat = (type) => {
    const m = {}
    monthEntries.filter((e) => e.type === type).forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const byMethod = () => {
    const m = {}
    monthEntries.filter((e) => e.type === 'revenue').forEach((e) => { m[e.payment_method || 'outro'] = (m[e.payment_method || 'outro'] || 0) + Number(e.amount) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }

  const openNew = (type) => { setEditing(null); setForm({ type, category: type === 'revenue' ? 'venda' : 'fornecedor', payment_method: 'dinheiro', date: new Date().toISOString().slice(0, 10), status: 'paid', due_date: '' }); setModal(true) }
  const cats = (form.type === 'revenue' ? REV_CATS : EXP_CATS)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Financeiro</h1><p className="text-admin-muted/60 text-sm mt-1">Receitas, despesas e indicadores</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }))} /></div>
          {mayEdit && <button onClick={() => openNew('revenue')} className="px-4 py-2 rounded-xl text-sm text-admin-sage bg-admin-sage/10 hover:bg-admin-sage/20 transition-colors">+ Receita</button>}
          {mayEdit && <button onClick={() => openNew('expense')} className="px-4 py-2 rounded-xl text-sm text-admin-rose bg-admin-rose/10 hover:bg-admin-rose/20 transition-colors">+ Despesa</button>}
          <button onClick={() => exportCsv(`financeiro-${month}.csv`, monthEntries.map((e) => ({ data: e.date, tipo: e.type === 'revenue' ? 'receita' : 'despesa', categoria: e.category, descricao: e.description, valor: e.amount, forma: METHODS[e.payment_method] || e.payment_method }))) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf(`Financeiro ${month}`, monthEntries.map((e) => ({ data: e.date, tipo: e.type === 'revenue' ? 'Receita' : 'Despesa', categoria: e.category, descricao: e.description, valor: brl(e.amount), forma: METHODS[e.payment_method] || e.payment_method })), `Receitas ${brl(revenue)} · Despesas ${brl(expense)} · Saldo ${brl(balance)}`) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Receitas</p><p className="text-admin-sage text-2xl font-medium">{brl(revenue)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Despesas</p><p className="text-admin-rose text-2xl font-medium">{brl(expense)}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Saldo</p><p className={`text-2xl font-medium ${balance >= 0 ? 'text-admin-champ' : 'text-admin-rose'}`}>{brl(balance)}</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Lançamentos */}
        <div className="lg:col-span-2">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Lançamentos do mês</p>
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : monthEntries.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum lançamento neste mês</p></div>
          ) : (
            <div className="space-y-2">{monthEntries.map((e) => (
              <div key={e.id} className="glass rounded-xl px-5 py-3 flex items-center gap-4 group">
                <div className={`w-1.5 h-8 rounded-full shrink-0 ${e.type === 'revenue' ? 'bg-admin-sage/60' : 'bg-admin-rose/60'}`} />
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{e.description || e.category}</p><div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs capitalize">{e.category}</span>{e.date && <span className="text-admin-muted/40 text-xs">{new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}{e.payment_method && <span className="text-admin-muted/40 text-xs">{METHODS[e.payment_method] || e.payment_method}</span>}</div></div>
                <p className={`text-sm font-medium shrink-0 ${e.type === 'revenue' ? 'text-admin-sage' : 'text-admin-rose'}`}>{e.type === 'revenue' ? '+' : '−'} {brl(e.amount)}</p>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {mayEdit && <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05] transition-colors" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>}
                  {mayDelete && <button onClick={() => setConfirmDel(e)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05] transition-colors" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            ))}</div>
          )}
        </div>

        {/* Indicadores */}
        <div className="space-y-5">
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Despesas por categoria</p>
            {byCat('expense').length === 0 ? <p className="text-admin-muted/40 text-xs">Sem despesas</p> : byCat('expense').map(([c, v]) => (
              <div key={c} className="flex items-center justify-between mb-2"><span className="text-admin-text text-sm capitalize">{c}</span><span className="text-admin-muted/60 text-sm">{brl(v)}</span></div>
            ))}
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Receitas por forma</p>
            {byMethod().length === 0 ? <p className="text-admin-muted/40 text-xs">Sem receitas</p> : byMethod().map(([c, v]) => (
              <div key={c} className="flex items-center justify-between mb-2"><span className="text-admin-text text-sm">{METHODS[c] || c}</span><span className="text-admin-muted/60 text-sm">{brl(v)}</span></div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <Modal title={`${editing ? 'Editar' : 'Nova'} ${form.type === 'revenue' ? 'receita' : 'despesa'}`} onClose={() => { setModal(false); setEditing(null) }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v, category: v === 'revenue' ? 'venda' : 'fornecedor' }))} options={[{ value: 'revenue', label: 'Receita' }, { value: 'expense', label: 'Despesa' }]} /></Fld><Fld label="Valor (R$)"><input type="number" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Categoria"><GlassSelect value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={cats.map((c) => ({ value: c, label: c }))} /></Fld><Fld label="Forma"><GlassSelect value={form.payment_method} onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))} options={Object.entries(METHODS).map(([value, label]) => ({ value, label }))} /></Fld></div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Situação"><GlassSelect value={form.status || 'paid'} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={[{ value: 'paid', label: 'Realizado' }, { value: 'pending', label: form.type === 'revenue' ? 'A receber' : 'A pagar' }]} /></Fld>
              {form.status === 'pending'
                ? <Fld label="Vencimento"><GlassDate value={form.due_date || ''} onChange={(v) => setForm((f) => ({ ...f, due_date: v }))} /></Fld>
                : <Fld label="Data"><GlassDate value={form.date || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} /></Fld>}
            </div>
            <Fld label="Descrição"><input value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar alterações' : 'Registrar'}</button><button onClick={() => { setModal(false); setEditing(null) }} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir lançamento</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover “{confirmDel.description || confirmDel.category}” ({brl(confirmDel.amount)})? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3"><button onClick={() => remove(confirmDel)} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm transition-colors">Excluir</button><button onClick={() => setConfirmDel(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
