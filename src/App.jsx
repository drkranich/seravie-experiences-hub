export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-black text-white p-8">
        <h1 className="text-4xl font-bold">Seravie Experiences</h1>
        <p className="text-gray-400 mt-2">Experiências Premium</p>
      </header>

      <main className="p-8 max-w-4xl mx-auto">
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Bem-vindo</h2>
          <p className="text-gray-700 text-lg leading-relaxed">
            Site moderno desenvolvido com React, Vite e Tailwind CSS.
            Pronto para evoluir em um CMS completo.
          </p>
        </section>

        <section className="mb-12">
          <h3 className="text-2xl font-bold mb-4">Características</h3>
          <ul className="space-y-2 text-gray-700">
            <li>✓ Design responsivo e moderno</li>
            <li>✓ Performance otimizada com Vite</li>
            <li>✓ Styling com Tailwind CSS</li>
            <li>✓ Pronto para adicionar mais componentes</li>
          </ul>
        </section>

        <footer className="border-t pt-8 mt-12 text-center text-gray-600">
          <p>&copy; 2026 Seravie Experiences. Todos os direitos reservados.</p>
        </footer>
      </main>
    </div>
  )
}
