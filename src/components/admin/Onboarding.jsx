import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'
import { VERTICAL_CORES } from './navigation.config'

const OPTIONS = Object.entries(VERTICAL_CORES).map(([key, v]) => ({ key, label: v.label, icon: v.icon }))

export function Onboarding({ onDone }) {
  const { profile } = useTenant()
  const [sel, setSel] = useState([])
  const [busy, setBusy] = useState(false)
  const toggle = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const start = async () => {
    if (sel.length === 0 || !profile?.tenant_id) return
    setBusy(true)
    await supabase.from('vertical_configs').insert(sel.map((v) => ({ tenant_id: profile.tenant_id, vertical: v, config: { enabled: true } })))
    setBusy(false)
    onDone?.()
  }

  return (
    <div className="min-h-[72vh] flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 md:p-12 max-w-3xl w-full">
        <p className="text-[11px] tracking-widerx uppercase text-admin-champ/70 mb-3">Bem-vindo à Seravie Experiences</p>
        <h1 className="font-serif text-4xl text-admin-text mb-2">Vamos montar sua operação</h1>
        <p className="text-admin-muted/60 mb-8 max-w-lg">Escolha o tipo do seu negócio (pode marcar mais de um). A plataforma vai ativar as frentes certas e montar seu painel sob medida.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {OPTIONS.map((o) => (
            <button key={o.key} onClick={() => toggle(o.key)}
              className={`glass rounded-2xl p-5 text-left border transition-all ${sel.includes(o.key) ? 'border-admin-champ/50 bg-admin-champ/[0.06]' : 'border-transparent hover:border-admin-champ/25 lift'}`}>
              <Icon name={o.icon} className="w-5 h-5 text-admin-champ/70 mb-3" />
              <p className="text-admin-text text-sm font-medium">{o.label}</p>
              <span className={`text-[10px] ${sel.includes(o.key) ? 'text-admin-champ' : 'text-admin-muted/30'}`}>{sel.includes(o.key) ? 'selecionado ✓' : 'toque para escolher'}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button onClick={start} disabled={sel.length === 0 || busy} className="btn-gradient rounded-xl px-8 py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? 'Ativando…' : `Começar${sel.length ? ` (${sel.length})` : ''}`}
          </button>
          <button onClick={() => onDone?.()} className="text-admin-muted/50 hover:text-admin-text text-sm transition-colors">Pular por agora</button>
        </div>
      </div>
    </div>
  )
}
