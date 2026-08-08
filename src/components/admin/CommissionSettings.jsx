import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'
import { CommissionNotice } from './CommissionNotice'

// Ajuste (super admin) da comissão do ecossistema: percentual, ativação e os
// textos que o usuário vê ao contratar/planos. Grava em platform_settings.

export function CommissionSettings({ notify }) {
  const { isSuperAdmin } = useTenant()
  const allowed = isSuperAdmin?.()
  const [f, setF] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      setF(data || { event_fee_percent: 5, commission_enabled: true, commission_title: '', commission_text: '' })
      setLoading(false)
    })
  }, [])

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const save = async () => {
    const pct = Number(f.event_fee_percent)
    if (!(pct >= 0 && pct <= 100)) return notify?.('Percentual inválido (0 a 100).', 'error')
    setSaving(true)
    const { error } = await supabase.from('platform_settings').update({
      event_fee_percent: pct, commission_enabled: !!f.commission_enabled,
      commission_title: f.commission_title || null, commission_text: f.commission_text || null, updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaving(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    notify?.('Configuração de comissão salva', 'success')
  }

  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  if (!allowed) return <div className="glass rounded-2xl p-12 text-center"><Icon name="ghost" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Área exclusiva do super admin.</p></div>
  if (loading || !f) return <p className="text-admin-muted/40 text-sm py-16 text-center">Carregando…</p>

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-admin-text">Comissão do ecossistema</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Percentual retido sobre negócios fechados (eventos pagos, vendas e serviços intermediados) e o texto que os usuários veem ao contratar.</p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="flex items-center gap-2 text-sm text-admin-text/85"><input type="checkbox" checked={!!f.commission_enabled} onChange={(e) => set('commission_enabled', e.target.checked)} className="w-4 h-4 accent-admin-champ" />Comissão ativa no ecossistema</label>

        <div className="max-w-[200px]">
          <label className={lbl}>Percentual da comissão (%)</label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.1" min="0" max="100" value={f.event_fee_percent} onChange={(e) => set('event_fee_percent', e.target.value)} className={cls} />
            <span className="text-admin-champ text-lg">%</span>
          </div>
        </div>

        <div><label className={lbl}>Título (visível ao usuário)</label><input value={f.commission_title || ''} onChange={(e) => set('commission_title', e.target.value)} className={cls} /></div>
        <div><label className={lbl}>Texto explicativo (visível ao usuário)</label><textarea value={f.commission_text || ''} onChange={(e) => set('commission_text', e.target.value)} rows={5} className={`${cls} resize-none`} /></div>

        <div className="flex justify-end"><button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button></div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-2">Prévia (como o usuário vê)</p>
        <CommissionNotice settings={f} />
      </div>
    </div>
  )
}
