import { useState, useEffect } from 'react'
import { useSpecialties } from './hooks/useSpecialties'
import { usePortfolio } from './hooks/usePortfolio'
import { useSections } from './hooks/useSections'
import { useAuth } from './hooks/useAuth'
import { ContactForm } from './components/ContactForm'
import { Login } from './pages/Login'
import { AdminDashboard } from './pages/AdminDashboard'
import { ADMIN_EMAIL } from './config'

export default function App() {
  const [page, setPage] = useState('home') // home, admin
  const { specialties, loading: loadingSpecialties } = useSpecialties()
  const { portfolio, loading: loadingPortfolio } = usePortfolio()
  const { section: heroSection } = useSections('hero')
  const { user, loading: authLoading, logout } = useAuth()

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>
  }

  // Admin Panel
  if (page === 'admin') {
    if (!user) {
      return <Login onLoginSuccess={() => setPage('admin')} />
    }
    // Apenas o super admin autorizado acessa o painel
    if (user.email !== ADMIN_EMAIL) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
          <h1 className="text-2xl font-bold mb-2">Acesso não autorizado</h1>
          <p className="text-gray-600 mb-6">
            A conta <strong>{user.email}</strong> não tem permissão de administrador.
          </p>
          <div className="space-x-3">
            <button
              onClick={async () => { await logout() }}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Sair
            </button>
            <button
              onClick={() => setPage('home')}
              className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
            >
              Voltar ao site
            </button>
          </div>
        </div>
      )
    }
    return (
      <AdminDashboard />
    )
  }

  // Home Page
  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="bg-black text-white p-8 sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Seravie Experiences</h1>
          <nav className="space-x-6 hidden md:flex items-center">
            <a href="#especialidades" className="hover:text-gray-300 transition">Serviços</a>
            <a href="#portfolio" className="hover:text-gray-300 transition">Portfólio</a>
            <a href="#contato" className="hover:text-gray-300 transition">Contato</a>
            <button
              onClick={() => setPage('admin')}
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-r from-black via-gray-900 to-black text-white py-32">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <h2 className="text-6xl font-bold mb-4 leading-tight">
            {heroSection?.content?.title || 'Experiências Premium'}
          </h2>
          <p className="text-2xl text-gray-300 mb-8 leading-relaxed">
            {heroSection?.content?.subtitle || 'Transformando visões em realidade'}
          </p>
          <a href="#contato" className="inline-block bg-white text-black px-10 py-4 rounded-lg font-bold hover:bg-gray-100 transition text-lg">
            {heroSection?.content?.cta_text || 'Começar Agora'}
          </a>
        </div>
      </section>

      {/* ESPECIALIDADES */}
      <section id="especialidades" className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-5xl font-bold mb-16 text-center text-black">Nossos Serviços</h3>

          {loadingSpecialties ? (
            <p className="text-center text-gray-600">Carregando...</p>
          ) : specialties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {specialties.map(specialty => (
                <div
                  key={specialty.id}
                  className="border-2 border-gray-200 rounded-lg p-8 hover:shadow-2xl hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2"
                >
                  <div className="text-5xl mb-4">
                    {specialty.icon_name === 'star' && '⭐'}
                    {specialty.icon_name === 'palette' && '🎨'}
                    {specialty.icon_name === 'code' && '💻'}
                    {specialty.icon_name === 'briefcase' && '💼'}
                    {!specialty.icon_name && '🚀'}
                  </div>
                  <h4 className="text-2xl font-bold mb-3">{specialty.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{specialty.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">Nenhuma especialidade encontrada</p>
          )}
        </div>
      </section>

      {/* PORTFÓLIO */}
      <section id="portfolio" className="py-24 px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-5xl font-bold mb-16 text-center text-black">Portfólio</h3>

          {loadingPortfolio ? (
            <p className="text-center text-gray-600">Carregando...</p>
          ) : portfolio.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {portfolio.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                >
                  {item.image_url && (
                    <div className="relative overflow-hidden h-48">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <span className="text-sm text-blue-600 font-semibold uppercase tracking-wide">
                      {item.category}
                    </span>
                    <h4 className="text-2xl font-bold mt-3 mb-3">{item.title}</h4>
                    <p className="text-gray-600 mb-6 leading-relaxed">{item.description}</p>
                    {item.link && (
                      <a
                        href={item.link}
                        className="text-blue-600 font-semibold hover:text-blue-800 inline-flex items-center"
                      >
                        Saiba mais →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">Nenhum projeto encontrado</p>
          )}
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="py-24 px-8 bg-black text-white">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-5xl font-bold mb-4 text-center">Entre em Contato</h3>
          <p className="text-gray-300 text-center mb-12 text-lg">
            Tem uma ideia? Vamos transformá-la em realidade!
          </p>
          <ContactForm />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-12 text-center border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-8">
          <p className="text-gray-400 mb-4">&copy; 2026 Seravie Experiences. Todos os direitos reservados.</p>
          <p className="text-gray-500 text-sm">
            Desenvolvido com React, Vite, Tailwind CSS e Supabase
          </p>
        </div>
      </footer>
    </div>
  )
}
