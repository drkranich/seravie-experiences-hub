import { useState, useEffect } from 'react'
import { getTranslation, detectLanguage, setLanguage, languages } from '../i18n/config'

export function useI18n() {
  const [language, setLanguageState] = useState(() => detectLanguage())

  useEffect(() => {
    setLanguage(language)
  }, [language])

  const t = (key) => getTranslation(language, key)

  return {
    language,
    setLanguage: setLanguageState,
    t,
    languages,
  }
}
