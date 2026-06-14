import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const email = localStorage.getItem('admin_email')
      if (token && email) {
        setUser({ email })
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    // Autenticação simples (em produção usar Supabase Auth)
    if (email && password) {
      localStorage.setItem('admin_token', 'token_' + Date.now())
      localStorage.setItem('admin_email', email)
      setUser({ email })
      return { error: null }
    }
    return { error: 'Email e senha inválidos' }
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_email')
    setUser(null)
  }

  return { user, loading, login, logout }
}
