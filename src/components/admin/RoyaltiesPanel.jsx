import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { ResourcePanel, ResourceTabs } from './ResourcePanel'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const CH_STATUS = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido', waived: 'Isento' }

// Níveis de franquia e verticais principais (amarram o contrato ao padrão físico).
const FR_LEVELS = { 'fr-regional': 'Regional (Compacto/Quiosque)', 'fr-master': 'Master (Loja Completa)', 'fr-nacional': 'Nacional (Flagship)' }
const FR_VERTICALS = {
  coffee: 'Coffee Experience', chocolate: 'Chocolate Experience', spa: 'Spa Experience', wine: 'Wine Experience',
  beauty: 'Beauty Experience', bakery: 'Bakery Experience', brewery: 'Brewery Experience', gourmet: 'Gourmet Retail Experience',
  gift: 'Gift Experience', floriculture: 'Floriculture Experience', perfumaria: 'Perfumaria Experience', saboaria: 'Saboaria Experience',
  events: 'Events Experience', tourism: 'Tourism Experience',
}

// ---------- Contratos de franquia ----------
function ContractsTab({ notify }) {
  return (
    <ResourcePanel embedded notify={notify} module="franchise" table="franchise_contracts" title="Contratos" subtitle="contratos de franquia por unidade" icon="check" newLabel="Novo contrato" exportName="contratos-franquia"
      fields={[
        { key: 'unit_name', label: 'Unidade', type: 'text', primary: true, required: true, full: true },
        { key: 'franchisee_name', label: 'Franqueado', type: 'text' },
        { key: 'offering_slug', label: 'Nível da franquia', type: 'select', options: FR_LEVELS, filter: true },
        { key: 'vertical_slug', label: 'Vertical principal', type: 'select', options: FR_VERTICALS, filter: true },
        { key: 'royalty_pct', label: 'Royalty (%)', type: 'number', required: true },
        { key: 'marketing_fund_pct', label: 'Fundo de marketing (%)', type: 'number' },
        { key: 'fixed_fee', label: 'Taxa fixa mensal (R$)', type: 'currency' },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'end_date', label: 'Fim da vigência', type: 'date' },
        { key: 'status', label: 'Status', type: 'status', options: { active: 'Ativo', suspended: 'Suspenso', ended: 'Encerrado' }, default: 'active', filter: true },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Contratos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativos', calc: (r) => r.filter((x) => x.status === 'active').length, fmt: 'int' },
        { label: 'Royalty médio', calc: (r) => r.length ? (r.reduce((s, x) => s + Number(x.royalty_pct || 0), 0) / r.length) : 0, fmt: 'int' },
      ]}
    />
  )
}

// ---------- Faturamento por unidade ----------
function RevenuesTab({ notify }) {
  return (
    <ResourcePanel embedded notify={notify} module="franchise" table="unit_revenues" title="Faturamento das unidades" subtitle="faturamento reportado por período" icon="chart" newLabel="Lançar faturamento" exportName="faturamento-unidades"
      orderBy={{ column: 'period', ascending: false }}
      fields={[
        { key: 'unit_name', label: 'Unidade', type: 'text', primary: true, required: true, full: true },
        { key: 'period', label: 'Período (AAAA-MM)', type: 'text', required: true, chip: true, filter: true, placeholder: '2026-07' },
        { key: 'gross_revenue', label: 'Faturamento bruto (R$)', type: 'currency', required: true },
      ]}
      kpis={[
        { label: 'Lançamentos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Faturamento total', calc: (r) => r.reduce((s, x) => s + Number(x.gross_revenue || 0), 0), fmt: 'currency' },
      ]}
    />
  )
}

// ---------- Cobranças de royalty (com cálculo) ----------
function ChargesTab({ notify }) {
  const [rows, setRows] = useState([])
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('royalty_charges').select('*').order('period', { ascending: false }).order('unit_name'); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const compute = async () => {
    setComputing(true)
    const { data, error } = await supabase.rpc('compute_royalties', { p_period: period })
    setComputing(false)
    if (error) return notify('Erro ao calcular: ' + error.message, 'error')
    notify(`${data} unidade(s) processada(s) para ${period}`, 'success'); load()
  }
  const markPaid = async (r) => { await supabase.from('royalty_charges').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', r.id); load() }

  const totals = useMemo(() => {
    const t = rows.filter((r) => r.status !== 'waived')
    return { due: t.reduce((s, r) => s + Number(r.total_due || 0), 0), paid: t.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.total_due || 0), 0), pending: t.filter((r) => r.status !== 'paid').reduce((s, r) => s + Number(r.total_due || 0), 0) }
  }, [rows])

  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Calcular royalties do período</label>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-07" className="glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none w-40" /></div>
        <button onClick={compute} disabled={computing} className="bg-admin-champ/15 text-admin-champ px-5 py-2.5 rounded-xl text-sm hover:bg-admin-champ/25 disabled:opacity-50">{computing ? 'Calculando…' : 'Calcular / recalcular'}</button>
        <p className="text-admin-muted/40 text-xs ml-auto self-center">Cruza o faturamento lançado com os contratos ativos.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Total devido</p><p className="text-xl font-medium text-admin-champ">{brl(totals.due)}</p></div>
        <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Recebido</p><p className="text-xl font-medium text-admin-sage">{brl(totals.paid)}</p></div>
        <div className="glass rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">A receber</p><p className="text-xl font-medium text-admin-gold">{brl(totals.pending)}</p></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : rows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhuma cobrança calculada.</p><p className="text-admin-muted/30 text-xs mt-1">Lance o faturamento das unidades e clique em "Calcular".</p></div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-admin-muted/50 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left px-4 py-3">Unidade</th><th className="text-left px-4 py-3">Período</th><th className="text-right px-4 py-3">Faturamento</th><th className="text-right px-4 py-3">Royalty</th><th className="text-right px-4 py-3">Total</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3 text-admin-text/90">{r.unit_name}</td>
                  <td className="px-4 py-3 text-admin-muted/60">{r.period}</td>
                  <td className="px-4 py-3 text-right text-admin-muted/70">{brl(r.gross_revenue)}</td>
                  <td className="px-4 py-3 text-right text-admin-muted/70">{brl(r.royalty_amount)}</td>
                  <td className="px-4 py-3 text-right text-admin-champ font-medium">{brl(r.total_due)}</td>
                  <td className="px-4 py-3"><span className={r.status === 'paid' ? 'text-admin-sage' : r.status === 'overdue' ? 'text-admin-rose' : 'text-admin-gold'}>{CH_STATUS[r.status]}</span></td>
                  <td className="px-4 py-3 text-right">{r.status !== 'paid' && <button onClick={() => markPaid(r)} className="text-[11px] px-2 py-1 rounded-lg bg-admin-sage/15 text-admin-sage hover:bg-admin-sage/25">Baixar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function RoyaltiesPanel({ notify }) {
  return (
    <ResourceTabs title="Royalties & Faturamento da Rede" subtitle="contratos, faturamento por unidade e cobrança de royalties"
      tabs={[
        { key: 'charges', label: 'Cobranças', render: () => <ChargesTab notify={notify} /> },
        { key: 'revenues', label: 'Faturamento', render: () => <RevenuesTab notify={notify} /> },
        { key: 'contracts', label: 'Contratos', render: () => <ContractsTab notify={notify} /> },
      ]}
    />
  )
}
