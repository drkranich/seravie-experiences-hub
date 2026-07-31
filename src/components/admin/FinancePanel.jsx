import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { Icon, GlassSelect, GlassDate } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const METHODS = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', stripe: 'Stripe', boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro' }
const REV_CATS = ['venda', 'serviço', 'assinatura', 'outro']
const EXP_CATS = ['fornecedor', 'aluguel', 'salário', 'marketing', 'imposto', 'operacional', 'outro']
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

function Modal({ title, onClose, children }) {
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[88vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{title}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>{children}</div></div>)
}
const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

export function FinancePanel({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [month, setMonth] = useState(ym(new Date()))

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('financial_entries').select('*').order('date', { ascending: false }).limit(500)
    setEntries(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return notify('Informe um valor', 'error')
    const { error } = await supabase.from('financial_entries').insert({
      type: form.type || 'expense', category: form.category || 'outro', description: form.description,
      amount: Number(form.amount), date: form.date || new Date().toISOString().slice(0, 10),
      payment_method: form.payment_method || 'dinheiro', created_by: user?.id || null, tenant_id: tenantId,
    })
    if (error) return notify('Erro ao salvar', 'error')
    notify('Lançamento registrado', 'success'); setModal(false); setForm({}); load()
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => (e.date || '').slice(0, 7)).filter(Boolean))
    set.add(ym(new Date()))
    return [...set].sort().reverse()
  }, [entries])

  const monthEntries = entries.filter((e) => (e.date || '').slice(0, 7) === month)
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

  const openNew = (type) => { setForm({ type, category: type === 'revenue' ? 'venda' : 'fornecedor', payment_method: 'dinheiro', date: new Date().toISOString().slice(0, 10) }); setModal(true) }
  const cats = (form.type === 'revenue' ? REV_CATS : EXP_CATS)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Financeiro</h1><p className="text-admin-muted/60 text-sm mt-1">Receitas, despesas e indicadores</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }))} /></div>
          <button onClick={() => openNew('revenue')} className="px-4 py-2 rounded-xl text-sm text-admin-sage bg-admin-sage/10 hover:bg-admin-sage/20 transition-colors">+ Receita</button>
          <button onClick={() => openNew('expense')} className="px-4 py-2 rounded-xl text-sm text-admin-rose bg-admin-rose/10 hover:bg-admin-rose/20 transition-colors">+ Despesa</button>
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
              <div key={e.id} className="glass rounded-xl px-5 py-3 flex items-center gap-4">
                <div className={`w-1.5 h-8 rounded-full shrink-0 ${e.type === 'revenue' ? 'bg-admin-sage/60' : 'bg-admin-rose/60'}`} />
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{e.description || e.category}</p><div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs capitalize">{e.category}</span>{e.date && <span className="text-admin-muted/40 text-xs">{new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}{e.payment_method && <span className="text-admin-muted/40 text-xs">{METHODS[e.payment_method] || e.payment_method}</span>}</div></div>
                <p className={`text-sm font-medium shrink-0 ${e.type === 'revenue' ? 'text-admin-sage' : 'text-admin-rose'}`}>{e.type === 'revenue' ? '+' : '−'} {brl(e.amount)}</p>
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
        <Modal title={form.type === 'revenue' ? 'Nova receita' : 'Nova despesa'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><Fld label="Tipo"><GlassSelect value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v, category: v === 'revenue' ? 'venda' : 'fornecedor' }))} options={[{ value: 'revenue', label: 'Receita' }, { value: 'expense', label: 'Despesa' }]} /></Fld><Fld label="Valor (R$)"><input type="number" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} /></Fld></div>
            <div className="grid grid-cols-2 gap-3"><Fld label="Categoria"><GlassSelect value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={cats.map((c) => ({ value: c, label: c }))} /></Fld><Fld label="Forma"><GlassSelect value={form.payment_method} onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))} options={Object.entries(METHODS).map(([value, label]) => ({ value, label }))} /></Fld></div>
            <Fld label="Data"><GlassDate value={form.date || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} /></Fld>
            <Fld label="Descrição"><input value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></Fld>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Registrar</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
        </Modal>
      )}
    </div>
  )
}
