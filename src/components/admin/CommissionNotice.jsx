import { usePlatformSettings } from '../../lib/platformSettings'
import { Icon } from './ui'

// Aviso de comissão do ecossistema, mostrado ao usuário nas telas de Planos /
// Assinatura. O conteúdo (título, texto e %) é editável pelo super admin em
// platform_settings. Passe `settings` para renderizar sem novo fetch (prévia).

export function CommissionNotice({ settings: override, compact = false }) {
  const { settings: fetched } = usePlatformSettings()
  const s = override || fetched
  if (!s || s.commission_enabled === false) return null
  const pct = Number(s.event_fee_percent ?? 5)

  if (compact) {
    return (
      <p className="text-[11px] text-admin-muted/50 flex items-center gap-1.5">
        <Icon name="tag" className="w-3.5 h-3.5 text-admin-champ/60" />
        {s.commission_title || 'Comissão do ecossistema'}: <span className="text-admin-champ">{pct}%</span> sobre negócios fechados.
      </p>
    )
  }

  return (
    <div className="glass-soft rounded-2xl p-5 border border-admin-champ/10">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="tag" className="w-4 h-4 text-admin-champ/80" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-admin-text text-sm font-medium">{s.commission_title || 'Comissão sobre negócios fechados'}</h4>
            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-admin-champ/15 text-admin-champ">{pct}%</span>
          </div>
          <p className="text-admin-muted/60 text-xs mt-1.5 leading-relaxed">{s.commission_text}</p>
        </div>
      </div>
    </div>
  )
}
