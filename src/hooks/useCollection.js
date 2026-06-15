import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Lê uma coleção pública (published = true) ordenada por sort_order.
export function useCollection(table, orderColumn = 'sort_order') {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('published', true)
        .order(orderColumn, { ascending: true })
      if (active) {
        setItems(data || [])
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [table, orderColumn])

  return { items, loading }
}
