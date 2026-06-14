import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSpecialties } from '../hooks/useSpecialties'
import { usePortfolio } from '../hooks/usePortfolio'
import { supabase } from '../lib/supabase'

export function AdminDashboard() {
  const { user, logout } = useAuth()
  const { specialties, refetch: refetchSpecialties } = useSpecialties()
  const { portfolio, refetch: refetchPortfolio } = usePortfolio()
  const [contacts, setContacts] = useState([])
  const [activeTab, setActiveTab] = useState('specialties')
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
    setContacts(data || [])
  }

  // CRUD Especialidades
  const handleAddSpecialty = async () => {
    const newSpecialty = {
      title: 'Nova Especialidade',
      description: 'Descrição...',
      order: specialties.length + 1,
      published: true
    }
    const { data } = await supabase
      .from('specialties')
      .insert([newSpecialty])
    refetchSpecialties()
  }

  const handleUpdateSpecialty = async (id, updates) => {
    await supabase
      .from('specialties')
      .update(updates)
      .eq('id', id)
    refetchSpecialties()
  }

  const handleDeleteSpecialty = async (id) => {
    if (window.confirm('Tem certeza?')) {
      await supabase
        .from('specialties')
        .delete()
        .eq('id', id)
      refetchSpecialties()
    }
  }

  // CRUD Portfólio
  const handleAddPortfolio = async () => {
    const newItem = {
      title: 'Novo Projeto',
      description: 'Descrição...',
      category: 'digital',
      order: portfolio.length + 1,
      published: true
    }
    const { data } = await supabase
      .from('portfolio_items')
      .insert([newItem])
    refetchPortfolio()
  }

  const handleUpdatePortfolio = async (id, updates) => {
    await supabase
      .from('portfolio_items')
      .update(updates)
      .eq('id', id)
    refetchPortfolio()
  }

  const handleDeletePortfolio = async (id) => {
    if (window.confirm('Tem certeza?')) {
      await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id)
      refetchPortfolio()
    }
  }

  const markContactAsRead = async (id) => {
    await supabase
      .from('contact_submissions')
      .update({ read: true })
      .eq('id', id)
    fetchContacts()
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-black text-white p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin - Seravie Experiences</h1>
        <div className="flex items-center space-x-4">
          <span>{user?.email}</span>
          <button
            onClick={logout}
            className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto flex">
          {['specialties', 'portfolio', 'contacts'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold ${
                activeTab === tab
                  ? 'border-b-2 border-black text-black'
                  : 'text-gray-600'
              }`}
            >
              {tab === 'specialties' && '🎯 Especialidades'}
              {tab === 'portfolio' && '📸 Portfólio'}
              {tab === 'contacts' && `💬 Mensagens (${contacts.filter(c => !c.read).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* ESPECIALIDADES */}
        {activeTab === 'specialties' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-3xl font-bold">Especialidades</h2>
              <button
                onClick={handleAddSpecialty}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Nova
              </button>
            </div>

            <div className="space-y-4">
              {specialties.map(specialty => (
                <div key={specialty.id} className="bg-white p-6 rounded shadow hover:shadow-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={editingId === specialty.id ? formData.title : specialty.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      onBlur={() => {
                        if (editingId === specialty.id) {
                          handleUpdateSpecialty(specialty.id, { title: formData.title })
                          setEditingId(null)
                        }
                      }}
                      onFocus={() => {
                        setEditingId(specialty.id)
                        setFormData({ title: specialty.title })
                      }}
                      className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <input
                      type="text"
                      value={editingId === specialty.id ? formData.description : specialty.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      onBlur={() => {
                        if (editingId === specialty.id) {
                          handleUpdateSpecialty(specialty.id, { description: formData.description })
                          setEditingId(null)
                        }
                      }}
                      onFocus={() => {
                        setEditingId(specialty.id)
                        setFormData({ description: specialty.description })
                      }}
                      className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Descrição"
                    />
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={specialty.published}
                        onChange={(e) => handleUpdateSpecialty(specialty.id, { published: e.target.checked })}
                      />
                      <span>Publicado</span>
                    </label>

                    <button
                      onClick={() => handleDeleteSpecialty(specialty.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PORTFÓLIO */}
        {activeTab === 'portfolio' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-3xl font-bold">Portfólio</h2>
              <button
                onClick={handleAddPortfolio}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Novo Projeto
              </button>
            </div>

            <div className="space-y-4">
              {portfolio.map(item => (
                <div key={item.id} className="bg-white p-6 rounded shadow hover:shadow-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={editingId === item.id ? formData.title : item.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      onBlur={() => {
                        if (editingId === item.id) {
                          handleUpdatePortfolio(item.id, { title: formData.title })
                          setEditingId(null)
                        }
                      }}
                      onFocus={() => {
                        setEditingId(item.id)
                        setFormData({ title: item.title })
                      }}
                      className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <input
                      type="text"
                      value={editingId === item.id ? formData.category : item.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      onBlur={() => {
                        if (editingId === item.id) {
                          handleUpdatePortfolio(item.id, { category: formData.category })
                          setEditingId(null)
                        }
                      }}
                      onFocus={() => {
                        setEditingId(item.id)
                        setFormData({ category: item.category })
                      }}
                      className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Categoria"
                    />

                    <input
                      type="text"
                      value={editingId === item.id ? formData.link : item.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      onBlur={() => {
                        if (editingId === item.id) {
                          handleUpdatePortfolio(item.id, { link: formData.link })
                          setEditingId(null)
                        }
                      }}
                      onFocus={() => {
                        setEditingId(item.id)
                        setFormData({ link: item.link })
                      }}
                      className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Link"
                    />
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={item.published}
                        onChange={(e) => handleUpdatePortfolio(item.id, { published: e.target.checked })}
                      />
                      <span>Publicado</span>
                    </label>

                    <button
                      onClick={() => handleDeletePortfolio(item.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MENSAGENS */}
        {activeTab === 'contacts' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Mensagens de Contato</h2>

            <div className="space-y-4">
              {contacts.length === 0 ? (
                <p className="text-gray-600">Nenhuma mensagem recebida</p>
              ) : (
                contacts.map(contact => (
                  <div
                    key={contact.id}
                    className={`p-6 rounded shadow ${
                      contact.read ? 'bg-gray-50' : 'bg-blue-50 border-l-4 border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{contact.name}</h3>
                        <p className="text-gray-600">{contact.email}</p>
                        {contact.phone && <p className="text-gray-600">{contact.phone}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        {!contact.read && (
                          <button
                            onClick={() => markContactAsRead(contact.id)}
                            className="text-blue-600 hover:underline text-sm mt-2"
                          >
                            Marcar como lido
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-800 mt-4 whitespace-pre-wrap">{contact.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
