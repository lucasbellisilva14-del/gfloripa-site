import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Imóveis excepcionais na<br />
            <span className="text-zinc-400">Grande Florianópolis</span>
          </h1>
          <p className="text-zinc-500 text-lg">Encontre seu próximo imóvel com facilidade.</p>
        </div>

        <form
          action="/imoveis"
          method="get"
          className="flex gap-2 max-w-lg mx-auto"
        >
          <input
            type="text"
            name="q"
            placeholder="Buscar por bairro, tipo, cidade..."
            className="flex-1 px-4 py-3 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors whitespace-nowrap"
          >
            Buscar
          </button>
        </form>

        <Link
          href="/imoveis"
          className="inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Ver todos os imóveis →
        </Link>
      </div>
    </main>
  )
}
