import { useSpecialties } from './hooks/useSpecialties'
import { usePortfolio } from './hooks/usePortfolio'
import { useSections } from './hooks/useSections'

export default function App() {
  const { specialties, loading: loadingSpecialties } = useSpecialties()
  const { portfolio, loading: loadingPortfolio } = usePortfolio()
  const { section: heroSection } = useSections('hero')

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="bg-black text-white p-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Seravie Experiences</h1>
          <nav className="space-x-6 hidden md:flex">
            <a href="#especialidades" className="hover:text-gray-300">Serviços</a>
            <a href="#portfolio" className="hover:text-gray-300">Portfólio</a>
            <a href="#contato" className="hover:text-gray-300">Contato</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-r from-black to-gray-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <h2 className="text-5xl font-bold mb-4">
            {heroSection?.content?.title || 'Experiências Premium'}
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            {heroSection?.content?.subtitle || 'Transformando visões em realidade'}
          </p>
          <button className="bg-white text-black px-8 py-3 rounded font-bold hover:bg-gray-100">
            {heroSection?.content?.cta_text || 'Começar Agora'}
          </button>
        </div>
      </section>

      {/* ESPECIALIDADES */}
      <section id="especialidades" className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-bold mb-12 text-center">Nossos Serviços</h3>

          {loadingSpecialties ? (
            <p className="text-center text-gray-600">Carregando...</p>
          ) : specialties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {specialties.map(specialty => (
                <div key={specialty.id} className="border rounded-lg p-6 hover:shadow-lg transition">
                  <div className="text-4xl mb-4">
                    {specialty.icon_name === 'star' && '⭐'}
                    {specialty.icon_name === 'palette' && '🎨'}
                    {specialty.icon_name === 'code' && '💻'}
                    {specialty.icon_name === 'briefcase' && '💼'}
                  </div>
                  <h4 className="text-xl font-bold mb-2">{specialty.title}</h4>
                  <p className="text-gray-600">{specialty.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">Nenhuma especialidade encontrada</p>
          )}
        </div>
      </section>

      {/* PORTFÓLIO */}
      <section id="portfolio" className="py-20 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-bold mb-12 text-center">Portfólio</h3>

          {loadingPortfolio ? (
            <p className="text-center text-gray-600">Carregando...</p>
          ) : portfolio.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {portfolio.map(item => (
                <div key={item.id} className="bg-white rounded-lg overflow-hidden hover:shadow-xl transition">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-6">
                    <span className="text-sm text-blue-600 font-semibold">{item.category}</span>
                    <h4 className="text-xl font-bold mt-2 mb-2">{item.title}</h4>
                    <p className="text-gray-600 mb-4">{item.description}</p>
                    {item.link && (
                      <a href={item.link} className="text-blue-600 font-semibold hover:underline">
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
      <section id="contato" className="py-20 px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-4xl font-bold mb-8">Entre em Contato</h3>
          <form className="space-y-4">
            <input
              type="text"
              placeholder="Seu nome"
              className="w-full p-3 border rounded"
            />
            <input
              type="email"
              placeholder="Seu email"
              className="w-full p-3 border rounded"
            />
            <textarea
              placeholder="Sua mensagem"
              rows="5"
              className="w-full p-3 border rounded"
            ></textarea>
            <button
              type="submit"
              className="w-full bg-black text-white p-3 rounded font-bold hover:bg-gray-800"
            >
              Enviar
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black text-white py-8 text-center">
        <p>&copy; 2026 Seravie Experiences. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
