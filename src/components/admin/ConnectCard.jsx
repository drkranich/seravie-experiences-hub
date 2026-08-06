import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'

// Card de recebimentos (Stripe Connect): o tenant conecta a própria conta Stripe
// para receber o dinheiro das vendas (Flow, reservas, clube, propostas).
export function ConnectCard({ notify }) {
  const [status, setStatus] = useState(null)   // {connected, charges_enabled, details_submitted, stripe_not_configured}
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('connect-status', { body: {} })
    if (!error) setStatus(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const connect = async () => {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('connect-onboard', { body: { origin: window.location.origin } })
    setBusy(false)
    if (error || data?.error) {
      if (data?.error === 'stripe_not_configured') return notify('Os recebimentos ainda não foram habilitados na plataforma. Fale com o suporte Seravie.', 'info')
      return notify('Não foi possível iniciar a conexão: ' + (data?.detail || 'erro'), 'error')
    }
    if (data?.onboarding_url) window.location.href = data.onboarding_url
  }

  const ready = status?.charges_enabled
  const started = status?.connected && !ready

  return (
    <div className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name="tag" className="w-5 h-5 text-admin-champ" /></div>
          <div>
            <p className="text-admin-text font-medium">Recebimentos (Stripe)</p>
            <p className="text-admin-muted/50 text-sm mt-0.5 max-w-md">Conecte sua conta Stripe para receber, direto na sua conta, o dinheiro das vendas por QR, reservas, clube e propostas aceitas.</p>
            {loading ? <p className="text-admin-muted/30 text-xs mt-2">Verificando…</p> : (
              <div className="mt-2">
                {ready && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-admin-sage/10 text-admin-sage">✓ Conta ativa — recebendo pagamentos</span>}
                {started && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-admin-gold/10 text-admin-gold">Cadastro incompleto — finalize para receber</span>}
                {!status?.connected && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/50">Ainda não conectada</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!ready && <button onClick={connect} disabled={busy} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Abrindo…' : started ? 'Continuar cadastro' : 'Conectar conta'}</button>}
          {status?.connected && <button onClick={load} className="text-xs px-3 py-2.5 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Atualizar</button>}
        </div>
      </div>
    </div>
  )
}
