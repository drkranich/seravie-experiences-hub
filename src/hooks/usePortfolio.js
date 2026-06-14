import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPortfolio()
  }, [])

  const fetchPortfolio = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('published', true)
        .order('order', { ascending: true })

      if (error) throw error
      setPortfolio(data || [])
    } catch (err) {
      console.error('Erro ao buscar portfólio:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { portfolio, loading, error, refetch: fetchPortfolio }
}
