import { useState } from 'react'
import { useContacts } from '../hooks/useContacts'

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [success, setSuccess] = useState(false)
  const { submitContact, loading, error } = useContacts()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccess(false)

    const result = await submitContact(formData)
    if (result.success) {
      setSuccess(true)
      setFormData({ name: '', email: '', phone: '', message: '' })
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
      {success && (
        <div className="bg-green-100 text-green-800 p-4 rounded">
          ✓ Mensagem enviada com sucesso! Entraremos em contato em breve.
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-800 p-4 rounded">
          Erro: {error}
        </div>
      )}

      <input
        type="text"
        name="name"
        placeholder="Seu nome"
        value={formData.name}
        onChange={handleChange}
        required
        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <input
        type="email"
        name="email"
        placeholder="Seu email"
        value={formData.email}
        onChange={handleChange}
        required
        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <input
        type="tel"
        name="phone"
        placeholder="Seu telefone (opcional)"
        value={formData.phone}
        onChange={handleChange}
        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <textarea
        name="message"
        placeholder="Sua mensagem"
        value={formData.message}
        onChange={handleChange}
        required
        rows="5"
        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white p-3 rounded font-bold hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Enviar Mensagem'}
      </button>
    </form>
  )
}
