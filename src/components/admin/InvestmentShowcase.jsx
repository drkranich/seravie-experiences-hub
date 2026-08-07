import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'

// Vitrine de investimento vista pelo CLIENTE: franquias e assessoria.
// Lê apenas ofertas públicas e ativas (RLS service_offerings_public_read).
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const CAT_ORDER = { nivel: 0, implantacao: 1, consultoria: 2, projeto: 3 }
const CAT_TITLE = { nivel: 'Níveis de franquia', implantacao: 'Implantação (pagamento único)', consultoria: 'Consultoria & suporte (mensal)', projeto: 'Projetos sob demanda' }

function priceLine(o) {
  if (o.billing_model === 'recurring') return <>{brl(o.price_monthly)}<span className="text-admin-muted/40 text-xs font-normal"> /mês</span></>
  if (o.billing_model === 'royalty') return <>{brl(o.price_setup)}<span className="text-admin-muted/40 text-xs font-normal"> entrada</span></>
  if (o.billing_model === 'hourly') return <>{brl(o.price_setup)}<span className="text-admin-muted/40 text-xs font-normal"> /hora</span></>
  return <>{brl(o.price_setup)}<span className="text-admin-muted/40 text-xs font-normal"> {o.unit_label || 'único'}</span></>
}

function Card({ o }) {
  const features = Array.isArray(o.features) ? o.features : []
  return (
    <div className="glass rounded-2xl p-5 flex flex-col">
      <p className="text-admin-text font-medium">{o.name}</p>
      {o.description && <p className="text-admin-muted/50 text-[11px] mt-0.5 leading-snug">{o.description}</p>}
      <p className="text-admin-champ text-2xl font-medium mt-3">{priceLine(o)}</p>
      {o.billing_model === 'royalty' && o.royalty_pct > 0 && (
        <p className="text-admin-sage/70 text-xs mt-0.5">+ {Number(o.royalty_pct)}% de royalty sobre o faturamento</p>
      )}
      {o.billing_model === 'recurring' && o.price_yearly > 0 && (
        <p className="text-admin-muted/50 text-xs mt-0.5">{brl(o.price_yearly)} /ano (2 meses grátis)</p>
      )}
      {features.length > 0 && (
        <ul className="mt-3 space-y-1 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-admin-muted/70 text-xs"><Icon name="check" className="w-3 h-3 text-admin-sage mt-0.5 shrink-0" />{f}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Group({ items }) {
  // agrupa por categoria, respeitando ordem
  const cats = [...new Set(items.map((o) => o.category))].sort((a, b) => (CAT_ORDER[a] ?? 9) - (CAT_ORDER[b] ?? 9))
  return (
    <>
      {cats.map((cat) => (
        <div key={cat} className="mb-5">
          {CAT_TITLE[cat] && <p className="text-admin-muted/50 text-xs mb-2">{CAT_TITLE[cat]}</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.filter((o) => o.category === cat).map((o) => <Card key={o.id} o={o} />)}
          </div>
        </div>
      ))}
    </>
  )
}

export function InvestmentShowcase() {
  const [offerings, setOfferings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('service_offerings').select('*').eq('is_active', true).eq('is_public', true).order('sort_order')
      setOfferings(data || []); setLoading(false)
    })()
  }, [])

  if (loading || offerings.length === 0) return null
  const franchise = offerings.filter((o) => o.kind === 'franchise')
  const advisory = offerings.filter((o) => o.kind === 'advisory')

  return (
    <div className="mt-12">
      <div className="border-t border-white/[0.06] pt-8">
        <h2 className="font-serif text-2xl text-admin-text mb-1">Invista e cresça com a Seravie</h2>
        <p className="text-admin-muted/50 text-sm mb-6">Serviços à parte para expandir e potencializar o seu negócio.</p>

        {franchise.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3"><Icon name="leaf" className="w-5 h-5 text-admin-champ" /><h3 className="text-admin-text text-lg font-medium">Seja uma Franquia Seravie</h3></div>
            <Group items={franchise} />
          </div>
        )}

        {advisory.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3"><Icon name="spark" className="w-5 h-5 text-admin-champ" /><h3 className="text-admin-text text-lg font-medium">Assessoria Seravie Experiences</h3></div>
            <Group items={advisory} />
          </div>
        )}

        <p className="text-admin-muted/40 text-xs mt-6">Quer contratar ou saber mais? Fale com nosso time pelo canal de atendimento.</p>
      </div>
    </div>
  )
}
