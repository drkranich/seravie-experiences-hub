import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useContacts() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submitContact = async (data) => {
    setLoading(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('contact_submissions')
        .insert([
          {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            message: data.message,
          }
        ])

      if (insertError) throw insertError
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const getContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Erro ao buscar contatos:', err)
      return []
    }
  }

  const markAsRead = async (id) => {
    try {
      await supabase
        .from('contact_submissions')
        .update({ read: true })
        .eq('id', id)
    } catch (err) {
      console.error('Erro ao marcar como lido:', err)
    }
  }

  return { submitContact, getContacts, markAsRead, loading, error }
}
