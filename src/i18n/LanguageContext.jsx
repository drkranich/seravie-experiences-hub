import { createContext, useContext, useState, useEffect } from 'react'
import { translateMany } from '../lib/translate'

const Ctx = createContext(null)

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'svg', 'SVG', 'TEXTAREA', 'INPUT'])

function collectTextNodes(root) {
  const nodes = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      let p = n.parentElement
      while (p) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT
        if (p.hasAttribute && p.hasAttribute('data-no-translate')) return NodeFilter.FILTER_REJECT
        p = p.parentElement
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let cur
  while ((cur = walker.nextNode())) nodes.push(cur)
  return nodes
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      return localStorage.getItem('locale') || 'pt'
    } catch (e) {
      return 'pt'
    }
  })

  // Troca de idioma recarrega para sempre traduzir a partir do PT original
  const setLocale = (l) => {
    try {
      localStorage.setItem('locale', l)
    } catch (e) {
      /* ignore */
    }
    window.location.reload()
  }

  useEffect(() => {
    if (locale === 'pt') return
    const root = document.getElementById('root')
    if (!root) return

    let cancelled = false
    let timer
    let observer

    const apply = (map) => {
      if (observer) observer.disconnect()
      collectTextNodes(root).forEach((n) => {
        const key = n.nodeValue.trim()
        const tr = map[key]
        if (tr && tr !== key) n.nodeValue = n.nodeValue.replace(key, tr)
      })
      if (observer && !cancelled) {
        observer.observe(root, { childList: true, subtree: true, characterData: true })
      }
    }

    const run = async () => {
      const texts = [
        ...new Set(
          collectTextNodes(root)
            .map((n) => n.nodeValue.trim())
            .filter((t) => t.length > 1 && !/^[\d\W]+$/.test(t))
        ),
      ]
      if (!texts.length) return
      const map = await translateMany(texts, locale)
      if (!cancelled) apply(map)
    }

    timer = setTimeout(run, 500)
    observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(run, 700)
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (observer) observer.disconnect()
    }
  }, [locale])

  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx) || { locale: 'pt', setLocale: () => {} }
}
