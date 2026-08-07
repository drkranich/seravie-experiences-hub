import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'
import { ResourceTabs } from './ResourcePanel'
import { FranchiseStandards } from './FranchiseStandards'

// Gestão dos serviços à parte: Franquias e Assessoria.
// Super admin edita preços (setup, mensal, anual, royalty), visibilidade e status.
// Os valores alimentam a vitrine de investimento vista pelos clientes.
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const inputCls = 'w-24 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none text-right'

const CAT_LABEL = {
  nivel: 'Nível de franquia', implantacao: 'Implantação', consultoria: 'Consultoria recorrente', projeto: 'Projeto sob demanda',
}

function OfferingsTable({ kind, notify }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(null)
  const orig = useRef({})

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('service_offerings').select('*').eq('kind', kind).order('sort_order')
    const list = data || []
    orig.current = Object.fromEntries(list.map((o) => [o.id, { price_setup: Number(o.price_setup) || 0, price_monthly: Number(o.price_monthly) || 0, price_yearly: Number(o.price_yearly) || 0, royalty_pct: Number(o.royalty_pct) || 0 }]))
    setRows(list); setLoading(false)
  }
  useEffect(() => { load() }, [kind])

  const setField = (id, patch) => setRows((rs) => rs.map((o) => o.id === id ? { ...o, ...patch } : o))

  const saveOne = async (o) => {
    const patch = {
      price_setup: Number(o.price_setup) || 0, price_monthly: Number(o.price_monthly) || 0,
      price_yearly: Number(o.price_yearly) || 0, royalty_pct: Number(o.royalty_pct) || 0,
      is_public: o.is_public !== false, is_active: o.is_active !== false,
    }
    const { error } = await supabase.from('service_offerings').update(patch).eq('id', o.id)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')

    // Se algum preço com Stripe mudou, sincroniza gerando novo Price ID.
    const before = orig.current[o.id] || {}
    const recurringChanged = o.billing_model === 'recurring' && (Number(before.price_monthly) !== patch.price_monthly || Number(before.price_yearly) !== patch.price_yearly)
    const setupChanged = ['one_time', 'royalty', 'hourly'].includes(o.billing_model) && Number(before.price_setup) !== patch.price_setup
    if (recurringChanged || setupChanged) {
      setSyncing(o.id)
      try {
        const { data: d, error: fnErr } = await supabase.functions.invoke('sync-service-price', { body: { id: o.id } })
        if (!fnErr && d?.ok) {
          setField(o.id, { stripe_price_monthly: d.stripe_price_monthly || o.stripe_price_monthly, stripe_price_yearly: d.stripe_price_yearly || o.stripe_price_yearly, stripe_price_setup: d.stripe_price_setup || o.stripe_price_setup })
          notify(`${o.name} atualizado e sincronizado com o Stripe`, 'success')
        } else if (d?.error === 'stripe_not_configured') notify(`${o.name} salvo. Stripe não configurado.`, 'info')
        else notify(`${o.name} salvo, mas o Stripe falhou: ${d?.detail || d?.error || fnErr?.message || 'erro'}`, 'error')
      } catch { notify(`${o.name} salvo, mas não sincronizou com o Stripe.`, 'error') }
      setSyncing(null)
    } else {
      notify(`${o.name} atualizado`, 'success')
    }
    orig.current[o.id] = { price_setup: patch.price_setup, price_monthly: patch.price_monthly, price_yearly: patch.price_yearly, royalty_pct: patch.royalty_pct }
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>

  const isFranchise = kind === 'franchise'
  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-4 text-xs text-admin-muted/60 leading-relaxed">
        {isFranchise
          ? 'Defina a taxa de franquia (entrada única) e o percentual de royalty sobre o faturamento de cada nível. Alterações na taxa geram um novo preço no Stripe automaticamente.'
          : 'Defina os valores de implantação (única), consultoria (mensal/anual) e projetos avulsos. Recorrentes e valores únicos sincronizam com o Stripe ao salvar.'}
        {' '}Marque “Público” para o serviço aparecer na vitrine de investimento dos clientes.
      </div>
      <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-admin-muted/50 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left px-4 py-3">Serviço</th>
              <th className="px-3 py-3">{isFranchise ? 'Taxa entrada' : 'Único / setup'}</th>
              {!isFranchise && <th className="px-3 py-3">Mensal</th>}
              {!isFranchise && <th className="px-3 py-3">Anual</th>}
              {isFranchise && <th className="px-3 py-3">Royalty %</th>}
              <th className="px-3 py-3">Público</th>
              <th className="px-3 py-3">Ativo</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-white/[0.03]">
                <td className="px-4 py-2.5 text-admin-text/90">{o.name}
                  <span className="text-admin-muted/30 text-[10px] block">{CAT_LABEL[o.category] || o.category} · {o.unit_label || o.billing_model}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {(o.billing_model === 'recurring') ? <span className="text-admin-muted/25">—</span>
                    : <input type="number" value={o.price_setup ?? ''} onChange={(e) => setField(o.id, { price_setup: e.target.value })} className={inputCls} />}
                </td>
                {!isFranchise && <td className="px-3 py-2.5 text-center">
                  {o.billing_model === 'recurring' ? <input type="number" value={o.price_monthly ?? ''} onChange={(e) => setField(o.id, { price_monthly: e.target.value })} className={inputCls} /> : <span className="text-admin-muted/25">—</span>}
                </td>}
                {!isFranchise && <td className="px-3 py-2.5 text-center">
                  {o.billing_model === 'recurring' ? <input type="number" value={o.price_yearly ?? ''} onChange={(e) => setField(o.id, { price_yearly: e.target.value })} className={inputCls} /> : <span className="text-admin-muted/25">—</span>}
                </td>}
                {isFranchise && <td className="px-3 py-2.5 text-center">
                  <input type="number" value={o.royalty_pct ?? ''} onChange={(e) => setField(o.id, { royalty_pct: e.target.value })} className="w-16 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none text-right" />
                </td>}
                <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={o.is_public !== false} onChange={(e) => setField(o.id, { is_public: e.target.checked })} className="accent-admin-champ" /></td>
                <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={o.is_active !== false} onChange={(e) => setField(o.id, { is_active: e.target.checked })} className="accent-admin-champ" /></td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => saveOne(o)} disabled={syncing === o.id} className="text-[11px] px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 disabled:opacity-50">
                    {syncing === o.id ? 'Sincronizando…' : 'Salvar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ServicesAdmin({ notify }) {
  return (
    <ResourceTabs title="Franquias & Assessoria" subtitle="serviços à parte — gestão de preços e vitrine de investimento"
      tabs={[
        { key: 'franchise', label: 'Franquias', render: () => <OfferingsTable kind="franchise" notify={notify} /> },
        { key: 'advisory', label: 'Assessoria', render: () => <OfferingsTable kind="advisory" notify={notify} /> },
        { key: 'standards', label: 'Padrões Físicos', render: () => <FranchiseStandards mode="admin" notify={notify} /> },
      ]}
    />
  )
}
