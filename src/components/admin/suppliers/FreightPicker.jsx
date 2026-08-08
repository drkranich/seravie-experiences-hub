import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { brl } from '../../../lib/suppliersMarket'

// Seletor de frete reutilizável (checkout e Novo pedido). O comprador NUNCA
// digita o valor do frete: ele vem da cotação do Melhor Envio, ou é 0
// (retirada / grátis), ou fica "a combinar" (0 agora, acertado depois).
//
// state: { method, value, service, days, quotes, loading }
// pkg:   { weight, width, height, length }  (pacote agregado)
// onChange(patch)

const MODES = [
  { value: 'melhor_envio', label: 'Melhor Envio', icon: 'truck' },
  { value: 'combinado', label: 'A combinar', icon: 'mail' },
  { value: 'retirada', label: 'Retirar no fornecedor', icon: 'map' },
  { value: 'gratis', label: 'Frete grátis', icon: 'gift' },
]

export function FreightPicker({ originCep, destCep, pkg, allowFree = true, state = {}, onChange, notify }) {
  const method = state.method || 'combinado'

  const quote = async () => {
    if (!originCep) return notify?.('Fornecedor sem CEP de origem cadastrado. Use "a combinar".', 'error')
    if (!destCep || String(destCep).replace(/\D/g, '').length !== 8) return notify?.('Preencha o CEP de entrega para cotar o frete.', 'error')
    onChange({ loading: true, quotes: null })
    try {
      const { data, error } = await supabase.functions.invoke('shipping-quote', { body: { from_cep: originCep, to_cep: destCep, package: pkg } })
      if (error) { onChange({ loading: false }); return notify?.('Erro ao cotar: ' + error.message, 'error') }
      if (data?.error === 'shipping_not_configured') { onChange({ loading: false, method: 'combinado' }); return notify?.('Melhor Envio ainda não configurado. Use "a combinar".', 'info') }
      if (data?.error) { onChange({ loading: false }); return notify?.('Cotação: ' + (data.detail || data.error), 'error') }
      const quotes = data?.options || []
      onChange({ loading: false, quotes })
      if (!quotes.length) notify?.('Nenhuma opção de frete para este CEP.', 'info')
    } catch (e) { onChange({ loading: false }); notify?.('Falha: ' + (e?.message || e), 'error') }
  }

  const pick = (m) => {
    if (m === 'melhor_envio') { onChange({ method: m, value: 0, service: null, days: null, quotes: state.quotes || null }); if (!state.quotes) setTimeout(quote, 0) }
    else if (m === 'retirada') onChange({ method: m, value: 0, service: 'Retirada', days: null, quotes: null })
    else if (m === 'gratis') onChange({ method: m, value: 0, service: 'Grátis', days: null, quotes: null })
    else onChange({ method: m, value: 0, service: 'Combinado', days: null, quotes: null })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {MODES.filter((m) => m.value !== 'gratis' || allowFree).map((m) => (
          <button key={m.value} type="button" onClick={() => pick(m.value)} className={`text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${method === m.value ? 'bg-admin-champ/20 text-admin-champ ring-1 ring-admin-champ/40' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ'}`}>
            <Icon name={m.icon} className="w-3.5 h-3.5" />{m.label}
          </button>
        ))}
      </div>

      {method === 'melhor_envio' && (
        state.loading ? <p className="text-admin-muted/50 text-xs py-2 flex items-center gap-2"><Icon name="clock" className="w-3.5 h-3.5" />Cotando frete…</p>
          : !state.quotes ? <button type="button" onClick={quote} className="text-[11px] text-admin-champ/80 hover:text-admin-champ flex items-center gap-1.5"><Icon name="refresh" className="w-3.5 h-3.5" />Cotar frete no Melhor Envio</button>
            : state.quotes.length === 0 ? <p className="text-admin-muted/40 text-[11px]">Sem opções para este CEP. Escolha outro modo.</p>
              : <div className="space-y-1.5 mt-1">
                  {state.quotes.map((o) => { const sel = state.service === `${o.company} ${o.service}`.trim(); return (
                    <button key={o.id} type="button" onClick={() => onChange({ value: o.price, service: `${o.company} ${o.service}`.trim(), days: o.delivery_days })} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${sel ? 'bg-admin-champ/15 ring-1 ring-admin-champ/40' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                      {o.company_picture ? <img src={o.company_picture} alt="" className="w-6 h-6 rounded object-contain bg-white/5 shrink-0" /> : <Icon name="truck" className="w-4 h-4 text-admin-champ/60 shrink-0" />}
                      <div className="min-w-0 flex-1"><p className="text-admin-text text-xs truncate">{o.company} · {o.service}</p>{o.delivery_days != null && <p className="text-admin-muted/40 text-[10px]">{o.delivery_days} dia(s) úteis</p>}</div>
                      <span className="text-admin-champ text-xs shrink-0">{brl(o.price)}</span>
                    </button>
                  )})}
                </div>
      )}
      {method === 'combinado' && <p className="text-admin-muted/45 text-[11px]">Frete a combinar com o fornecedor (R$ 0 agora; acertado na conversa).</p>}
      {method === 'retirada' && <p className="text-admin-muted/50 text-[11px]">Retirada no fornecedor · sem frete.</p>}
      {method === 'gratis' && <p className="text-admin-sage/70 text-[11px]">Frete grátis oferecido pelo fornecedor.</p>}
    </div>
  )
}
