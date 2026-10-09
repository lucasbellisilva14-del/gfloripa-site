import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getEmpreendimentos, type Condominio } from '@/lib/jetimob'

export const metadata: Metadata = {
  title: 'Lançamentos e empreendimentos em Garopaba | Nagamboa Imóveis',
  description:
    'Condomínios em lançamento, na planta e em construção em Garopaba, Praia da Gamboa e região. Conheça os empreendimentos e as unidades disponíveis.',
  alternates: { canonical: 'https://www.nagamboaimoveis.com.br/empreendimentos' },
}

function statusLabel(c: Condominio): string {
  if (c.situacao === 'Na planta') return 'Na planta'
  if (c.situacao === 'Em construção') return 'Em construção'
  if (c.lancamento) return 'Lançamento'
  return c.situacao ?? 'Disponível'
}

function entregaLabel(c: Condominio): string | null {
  if (!c.entrega_ano) return null
  const mes = c.entrega_mes ? String(c.entrega_mes).padStart(2, '0') + '/' : ''
  return `Entrega ${mes}${c.entrega_ano}`
}

export default async function EmpreendimentosPage() {
  let empreendimentos: Condominio[] = []
  let error = false
  try {
    empreendimentos = await getEmpreendimentos()
  } catch {
    error = true
  }

  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
      <Header />

      <div className="sect" style={{ background: '#0B1738', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '30px 48px 26px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 6 }}>Garopaba e região</div>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 36 }}>Lançamentos e empreendimentos</h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', marginTop: 8, maxWidth: 560 }}>
            Condomínios na planta e em construção, selecionados pela Nagamboa. Entre no empreendimento certo antes de todo mundo.
          </p>
        </div>
      </div>

      <div className="sect" style={{ padding: '44px 48px 80px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          {error || empreendimentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 24, marginBottom: 10 }}>
                {error ? 'Não foi possível carregar os empreendimentos' : 'Nenhum empreendimento disponível no momento'}
              </h2>
              <Link href="/imoveis" style={{ color: '#E8B23A', fontSize: 14 }}>Ver todos os imóveis →</Link>
            </div>
          ) : (
            <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 22 }}>
              {empreendimentos.map((c) => {
                const img = c.imagens?.[0]?.link
                const entrega = entregaLabel(c)
                const local = [c.endereco_bairro, c.endereco_cidade].filter(Boolean).join(' · ')
                const unidades = c.total_imoveis_disponiveis ?? 0
                return (
                  <Link
                    key={c.codigo}
                    href={`/empreendimento/${c.codigo}`}
                    className="pcard"
                    style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, overflow: 'hidden', display: 'block', cursor: 'pointer' }}
                  >
                    <div style={{ height: 210, position: 'relative', overflow: 'hidden' }}>
                      {img ? (
                        <Image src={img} alt={c.nome} fill className="pimg" style={{ objectFit: 'cover' }} sizes="(max-width: 860px) 100vw, 33vw" />
                      ) : (
                        <div className="pimg" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#0E1D48,#1B4965 55%,#5FA8A0)' }} />
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 45%,rgba(10,20,48,.85))' }} />
                      <span style={{ position: 'absolute', left: 16, top: 16, background: 'rgba(232,178,58,.95)', color: '#0A1430', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 30, fontWeight: 600 }}>
                        {statusLabel(c)}
                      </span>
                      {entrega && (
                        <span style={{ position: 'absolute', right: 16, top: 16, background: 'rgba(10,20,48,.75)', color: '#fff', fontSize: 11, padding: '6px 12px', borderRadius: 30 }}>
                          {entrega}
                        </span>
                      )}
                      <div style={{ position: 'absolute', left: 18, bottom: 14, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>{local}</div>
                    </div>
                    <div style={{ padding: '18px 22px 22px' }}>
                      <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 21, lineHeight: 1.25 }}>{c.nome}</h3>
                      <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '14px 0 12px' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, color: '#E8B23A' }}>
                          {unidades} {unidades === 1 ? 'unidade disponível' : 'unidades disponíveis'}
                        </span>
                        <span className="parrow" style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>conhecer →</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
