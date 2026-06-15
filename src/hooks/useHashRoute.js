import { useState, useEffect } from 'react'

// Roteamento leve por hash: #/sobre -> 'sobre', #contato -> 'contato',
// vazio / #topo / #/ -> 'home', #/pagina/slug -> 'pagina/slug'.
export function useHashRoute() {
  const parse = () => {
    const h = (window.location.hash || '').replace(/^#\/?/, '')
    return h === '' || h === 'topo' ? 'home' : h
  }
  const [route, setRoute] = useState(parse())

  useEffect(() => {
    const onChange = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
