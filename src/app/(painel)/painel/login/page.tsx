import Image from 'next/image'
import LoginForm from '@/components/painel/LoginForm'
import { loginDisponivel, modoDemoLogin } from '@/lib/painel/auth'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const disponivel = loginDisponivel()
  return (
    <div className="painel-shell" data-tema="escuro" style={{ display: 'block' }}>
      <div className="p-login">
        <div className="p-login-card">
          <Image src="/assets/logo-white.png" alt="Nagamboa Imóveis" width={140} height={35} unoptimized />
          <h1>Painel do Corretor</h1>
          <p style={{ color: 'rgba(255,255,255,.7)', margin: '0 0 22px', fontSize: 14 }}>Área interna com inteligência artificial. Acesso restrito à equipe.</p>
          {disponivel ? (
            <LoginForm demo={modoDemoLogin()} destino={next ?? '/painel'} />
          ) : (
            <div className="p-alert p-alert-warn">
              Login indisponível: configure as variáveis <code>PAINEL_SENHA</code> e <code>PAINEL_SESSION_SECRET</code> no servidor (ver docs/painel/README.md).
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, marginTop: 22 }}>
            Dados de clientes são pessoais (LGPD). Use somente para o atendimento da imobiliária.
          </p>
        </div>
      </div>
    </div>
  )
}
