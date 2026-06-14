import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSections(key) {
  const [section, setSection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (key) fetchSection(key)
  }, [key])

  const fetchSection = async (sectionKey) => {
    try {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('key', sectionKey)
        .eq('published', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setSection(data || null)
    } catch (err) {
      console.error(`Erro ao buscar seção ${key}:`, err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { section, loading, error, refetch: () => fetchSection(key) }
}
