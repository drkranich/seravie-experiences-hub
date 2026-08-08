import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Configurações globais da plataforma (comissão do ecossistema + textos).
// Leitura pública (RLS), escrita só super admin.

const DEFAULTS = {
  event_fee_percent: 5,
  commission_enabled: true,
  commission_title: 'Comissão sobre negócios fechados',
  commission_text: 'A Seravie retém uma comissão sobre transações concluídas dentro do ecossistema.',
}

let _cache = null

export async function fetchPlatformSettings() {
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return DEFAULTS
  return { ...DEFAULTS, ...data }
}

export function usePlatformSettings() {
  const [settings, setSettings] = useState(_cache || DEFAULTS)
  const [loading, setLoading] = useState(!_cache)
  useEffect(() => {
    let alive = true
    fetchPlatformSettings().then((s) => { if (alive) { _cache = s; setSettings(s); setLoading(false) } })
    return () => { alive = false }
  }, [])
  return { settings, loading }
}
