import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSpecialties() {
  const [specialties, setSpecialties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSpecialties()
  }, [])

  const fetchSpecialties = async () => {
    try {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .eq('published', true)
        .order('order', { ascending: true })

      if (error) throw error
      setSpecialties(data || [])
    } catch (err) {
      console.error('Erro ao buscar especialidades:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { specialties, loading, error, refetch: fetchSpecialties }
}
