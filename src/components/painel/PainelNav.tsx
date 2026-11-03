'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { CorretorLogado } from '@/lib/painel/tipos'
import { IconeAnalisar, IconeClientes, IconeConfig, IconeImoveis, IconeInicio, IconeLembretes } from './Icones'

const LINKS = [
  { href: '/painel', rotulo: 'Início', Icone: IconeInicio },
  { href: '/painel/analisar', rotulo: 'Analisar conversa', Icone: IconeAnalisar },
  { href: '/painel/clientes', rotulo: 'Clientes', Icone: IconeClientes },
  { href: '/painel/lembretes', rotulo: 'Lembretes', Icone: IconeLembretes },
  { href: '/painel/imoveis', rotulo: 'Meus imóveis', Icone: IconeImoveis },
  { href: '/painel/configuracoes', rotulo: 'Configurações', Icone: IconeConfig },
]

type Tema = 'auto' | 'claro' | 'escuro'

// Barra lateral (desktop) e barra superior com menu (mobile). O tema fica em
// localStorage e é aplicado no atributo data-tema do .painel-shell.
export default function PainelNav({ corretor, modoDados, demoIa }: { corretor: CorretorLogado; modoDados: string; demoIa: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [tema, setTema] = useState<Tema>('auto')

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('painel-tema') as Tema | null
      if (salvo) aplicarTema(salvo)
    } catch {
      // localStorage indisponível
    }
  }, [])

  function aplicarTema(t: Tema) {
    setTema(t)
    document.querySelectorAll<HTMLElement>('.painel-shell').forEach((el) => (el.dataset.tema = t))
    try {
      localStorage.setItem('painel-tema', t)
    } catch {
      // ignora
    }
  }

  function proximoTema() {
    aplicarTema(tema === 'auto' ? 'escuro' : tema === 'escuro' ? 'claro' : 'auto')
  }

  async function sair() {
    await fetch('/api/painel/logout', { method: 'POST' })
    router.push('/painel/login')
    router.refresh()
  }

  const ativo = (href: string) => (href === '/painel' ? pathname === '/painel' : pathname.startsWith(href))

  const itens = LINKS.map(({ href, rotulo, Icone }) => (
    <Link key={href} href={href} aria-current={ativo(href) ? 'page' : undefined} onClick={() => setAberto(false)}>
      <Icone /> {rotulo}
    </Link>
  ))

  const rodape = (
    <div className="p-side-foot">
      <div>
        <strong>{corretor.nome}</strong>
        <div>Corretor Jetimob #{corretor.id}</div>
      </div>
      <div className="p-row" style={{ gap: 6 }}>
        <span className="p-badge p-badge-demo">{modoDados === 'supabase' ? 'Supabase' : 'Dados demo'}</span>
        {demoIa && <span className="p-badge p-badge-demo">I.A. demo</span>}
      </div>
      <div className="p-row" style={{ gap: 6 }}>
        <button type="button" className="p-btn p-btn-sm p-btn-ghost" style={{ color: 'inherit', borderColor: 'rgba(255,255,255,.25)' }} onClick={proximoTema}>
          Tema: {tema === 'auto' ? 'automático' : tema}
        </button>
        <button type="button" className="p-btn p-btn-sm p-btn-ghost" style={{ color: 'inherit', borderColor: 'rgba(255,255,255,.25)' }} onClick={sair}>
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="p-side">
        <div className="p-brand">
          <Image src="/assets/logo-white.png" alt="Nagamboa Imóveis" width={120} height={30} unoptimized />
          <div>
            <small>Painel do corretor</small>
          </div>
        </div>
        <nav className="p-nav" style={{ display: 'grid', gap: 2 }}>{itens}</nav>
        {rodape}
      </aside>

      <header className="p-topbar">
        <div className="p-brand">
          <Image src="/assets/logo-white.png" alt="Nagamboa Imóveis" width={104} height={26} unoptimized />
          <small style={{ color: '#E8B23A', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' }}>Painel</small>
        </div>
        <button type="button" className="p-burger" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-label="Menu">
          {aberto ? 'Fechar' : 'Menu'}
        </button>
      </header>
      {aberto && (
        <nav className="p-mobile-nav">
          {itens}
          {rodape}
        </nav>
      )}
    </>
  )
}
