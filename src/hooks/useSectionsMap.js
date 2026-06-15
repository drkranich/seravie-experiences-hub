import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Lê todas as seções publicadas e devolve um mapa { key: content }.
export function useSectionsMap() {
  const [map, setMap] = useState({})

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('sections').select('key,content').eq('published', true)
      if (active) {
        const m = {}
        ;(data || []).forEach((s) => {
          m[s.key] = s.content || {}
        })
        setMap(m)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return map
}
