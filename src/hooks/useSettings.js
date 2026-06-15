import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULTS = {
  brand: { name: 'Seravie', suffix: 'EXPERIENCES', tagline: 'Transformamos espaços em destinos memoráveis.' },
  social: { instagram: '', pinterest: '' },
  footer_links: ['Política de Privacidade', 'Termos de Uso', 'Cookies', 'Mapa do Site'],
  seo: { title: 'Seravie Experiences', description: 'Transformamos espaços em destinos memoráveis.' },
}

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const fetchSettings = async () => {
    const { data } = await supabase.from('site_settings').select('data').eq('id', 1).single()
    setSettings({ ...DEFAULTS, ...(data?.data || {}) })
    setLoading(false)
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const save = async (newData) => {
    const { error } = await supabase
      .from('site_settings')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (!error) setSettings(newData)
    return { error: error?.message }
  }

  return { settings, loading, save, refetch: fetchSettings }
}
