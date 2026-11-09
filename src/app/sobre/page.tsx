import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getCorretores, type Corretor } from '@/lib/jetimob'

export const metadata: Metadata = {
  title: 'Sobre a Nagamboa Imóveis | Especialistas na Praia da Gamboa',
  description: 'Conheça a Nagamboa Imóveis: mais de 15 anos ajudando famílias a comprar, vender e alugar imóveis em Garopaba e na Praia da Gamboa, em Santa Catarina.',
  alternates: { canonical: '/sobre' },
}

const valores = [
  { titulo: 'Transparência', desc: 'Informações claras, sem surpresas. Do primeiro contato ao fechamento, você sabe exatamente o que está acontecendo.' },
  { titulo: 'Conhecimento local', desc: 'Somos da Gamboa. Conhecemos cada rua, cada praia, cada maré. Esse conhecimento está a serviço da sua escolha.' },
  { titulo: 'Atendimento próximo', desc: 'Você não é um número. Cada família tem uma história e um sonho, e é isso que guia o nosso trabalho.' },
]

const numeros = [
  { valor: '15+', label: 'Anos de experiência' },
  { valor: '320+', label: 'Imóveis negociados' },
  { valor: '800+', label: 'Famílias atendidas' },
  { valor: '4.9', label: 'Avaliação Google' },
]

// Equipe exibida na página, nesta ordem. Dados ao vivo do painel Jetimob
// (foto, cargo e CRECI); o papel fixo tem prioridade sobre o cargo do painel.
const EQUIPE: { id: number; nome: string; papel?: string }[] = [
  { id: 61012, nome: 'Murilo Narciso da Silva' },
  { id: 77723, nome: 'Lucas Belli da Silva' },
  { id: 62186, nome: 'Edmilson de Araujo' },
  { id: 71664, nome: 'Dara Maiara', papel: 'Gerente administrativa' },
]

type MembroEquipe = { nome: string; papel: string; creci: string | null; avatar: string | null }

function montarEquipe(corretores: Corretor[]): MembroEquipe[] {
  return EQUIPE.map((m) => {
    const c = corretores.find((x) => x.id === m.id)
    const cargoPainel = c?.cargo?.trim()
    const papel = m.papel ?? (cargoPainel && /corretor/i.test(cargoPainel) ? cargoPainel : 'Corretor de imóveis')
    return {
      nome: c?.nome ?? m.nome,
      papel,
      creci: c?.creci?.trim() ? c.creci.trim() : null,
      avatar: c?.avatar ?? null,
    }
  })
}

export default async function SobrePage() {
  let equipe: MembroEquipe[]
  try {
    equipe = montarEquipe(await getCorretores())
  } catch {
    // API indisponível: mostra a equipe sem foto nem CRECI
    equipe = montarEquipe([])
  }
  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
      <Header />

      <section style={{ position: 'relative', minHeight: '52vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 48px', overflow: 'hidden', background: 'url(/assets/sobre-hero.webp) center/cover no-repeat, linear-gradient(160deg,#07112B,#0E1D48 60%,#0B2A3A)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,17,43,.62), rgba(7,17,43,.5) 45%, rgba(10,20,48,.86))' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 20%, rgba(232,178,58,.18), transparent 55%)' }} />
        <div className="grain" />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 22 }}>
            <span style={{ width: 36, height: 1, background: 'rgba(232,178,58,.55)', display: 'block' }} />
            <span style={{ fontSize: 12, letterSpacing: '.34em', textTransform: 'uppercase', color: '#E8B23A' }}>Garopaba · Santa Catarina</span>
            <span style={{ width: 36, height: 1, background: 'rgba(232,178,58,.55)', display: 'block' }} />
          </div>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 58, lineHeight: 1.08, letterSpacing: '-.01em' }}>Somos da Gamboa.<br />Vivemos a Gamboa.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,.75)', maxWidth: 520, margin: '22px auto 0', fontWeight: 300 }}>
            A Nagamboa nasceu do amor por essa região. Uma imobiliária que é parte da comunidade, não apenas um escritório que vende imóveis.
          </p>
        </div>
      </section>

      <section className="sect reveal" style={{ padding: '80px 48px', background: '#0A1430' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="two-col">
          <div>
            <div style={{ fontSize: 12, letterSpacing: '.26em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 12 }}>Nossa história</div>
            <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 38, lineHeight: 1.2, marginBottom: 24 }}>A baleia-franca como símbolo</h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: 'rgba(255,255,255,.72)', marginBottom: 18, fontWeight: 300 }}>
              A Praia da Gamboa é um dos poucos lugares do Brasil onde as baleias-francas chegam todos os anos para parir e criar seus filhotes. Assim como elas, voltamos sempre, porque aqui é onde a vida acontece de verdade.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: 'rgba(255,255,255,.72)', fontWeight: 300 }}>
              Há mais de 15 anos, ajudamos famílias a encontrar seu lugar nesse pedaço especial do litoral catarinense. Conhecemos cada trilha, cada maré, cada vizinho, e esse conhecimento está a serviço de quem confia em nós.
            </p>
          </div>
          <div style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 32 }}>
            {numeros.map((n) => (
              <div key={n.label} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span style={{ fontFamily: "'Marcellus',serif", fontSize: 42, color: '#E8B23A', lineHeight: 1 }}>{n.valor}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sect reveal" style={{ padding: '72px 48px', background: '#0B1738' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 12, letterSpacing: '.26em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 12 }}>O que nos guia</div>
            <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 38 }}>Nossos valores</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }} className="three-col">
            {valores.map((v) => (
              <div key={v.titulo} style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '36px 32px' }}>
                <div style={{ width: 40, height: 2, background: '#E8B23A', marginBottom: 22 }} />
                <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 24, marginBottom: 14 }}>{v.titulo}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,.65)', fontWeight: 300 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sect reveal" style={{ padding: '72px 48px 90px', background: '#0A1430' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 12, letterSpacing: '.26em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 12 }}>Quem cuida de você</div>
            <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 38 }}>Nossa equipe</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
            {equipe.map((c) => (
              <div key={c.nome} style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatar}
                    alt={`Foto de ${c.nome}`}
                    style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(232,178,58,.65)', marginBottom: 4 }}
                  />
                ) : (
                  <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'radial-gradient(circle at 50% 125%, #E8B23A 0 52%, transparent 53%), #16265C', border: '2px solid rgba(232,178,58,.35)', marginBottom: 4 }} />
                )}
                <div style={{ fontFamily: "'Marcellus',serif", fontSize: 18, lineHeight: 1.2 }}>{c.nome}</div>
                <div style={{ fontSize: 13, color: '#E8B23A' }}>{c.papel}</div>
                {c.creci && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', letterSpacing: '.06em' }}>CRECI {c.creci}</div>}
                <a
                  href="https://wa.me/5548984727799"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 8, display: 'inline-block', fontSize: 12.5, color: '#fff', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 30, padding: '8px 16px', cursor: 'pointer', textAlign: 'center' }}
                >
                  WhatsApp
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
