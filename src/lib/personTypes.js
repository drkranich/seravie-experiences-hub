import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { PERSON_TYPES } from './networkSocial'

// Tipos de profissional do Network. A lista é gerida pelo super admin na
// tabela `network_person_types` (leitura pública). Se o banco não responder,
// cai na lista fixa PERSON_TYPES como fallback.

let _cache = null

export async function fetchPersonTypes() {
  const { data, error } = await supabase
    .from('network_person_types')
    .select('label')
    .eq('active', true)
    .order('sort', { ascending: true })
  if (error || !data || data.length === 0) return PERSON_TYPES
  const list = data.map((r) => r.label).filter(Boolean)
  return list.length ? list : PERSON_TYPES
}

export function usePersonTypes() {
  const [types, setTypes] = useState(_cache || PERSON_TYPES)
  useEffect(() => {
    let alive = true
    fetchPersonTypes().then((list) => { if (alive) { _cache = list; setTypes(list) } })
    return () => { alive = false }
  }, [])
  return types
}
