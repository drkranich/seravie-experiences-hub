import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => localStorage.getItem('locale') || 'pt')
  const [dict, setDict] = useState({})

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('translations')
        .select('key,value')
        .eq('namespace', 'common')
        .eq('locale', locale)
      if (active) {
        const m = {}
        ;(data || []).forEach((r) => {
          m[r.key] = r.value
        })
        setDict(m)
      }
    })()
    return () => {
      active = false
    }
  }, [locale])

  const setLocale = (l) => {
    localStorage.setItem('locale', l)
    setLocaleState(l)
  }
  const t = (key, fallback) => dict[key] || fallback

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx) || { locale: 'pt', setLocale: () => {}, t: (k, f) => f }
}
