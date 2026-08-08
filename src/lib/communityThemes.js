import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { COMMUNITY_THEMES } from './networkSocial'

// Catálogo de temas de comunidade. Gerido pelo super admin em
// network_community_themes (leitura pública). Fallback: COMMUNITY_THEMES fixo.

let _cache = null

export async function fetchCommunityThemes() {
  const { data, error } = await supabase
    .from('network_community_themes')
    .select('slug, name, description, category, sort')
    .eq('active', true)
    .order('sort', { ascending: true })
  if (error || !data || data.length === 0) return COMMUNITY_THEMES
  return data
}

export function useCommunityThemes() {
  const [themes, setThemes] = useState(_cache || COMMUNITY_THEMES)
  useEffect(() => {
    let alive = true
    fetchCommunityThemes().then((list) => { if (alive) { _cache = list; setThemes(list) } })
    return () => { alive = false }
  }, [])
  return themes
}
