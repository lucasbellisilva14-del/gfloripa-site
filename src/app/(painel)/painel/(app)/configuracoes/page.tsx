import PadraoEditor from '@/components/painel/PadraoEditor'
import EquipeEditor from '@/components/painel/EquipeEditor'
import MinhaSenha from '@/components/painel/MinhaSenha'
import { lerPadraoArquivo, obterPadraoAtendimento } from '@/lib/painel/padrao-atendimento'
import { getDb, supabaseConfigurado } from '@/lib/painel/db'
import { iaDisponivel, modeloAnalise } from '@/lib/painel/analise'
import { jetimobConfigurado } from '@/lib/painel/imoveis'
import { envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getCorretores } from '@/lib/jetimob'
import type { Corretor } from '@/lib/painel/tipos'

export default async function ConfiguracoesPage() {
  const corretor = (await getCorretorLogado())!
  const [padrao, arquivo, db] = await Promise.all([obterPadraoAtendimento(), lerPadraoArquivo(), getDb()])
  const gestor = corretor.papel === 'gestor'

  // Equipe (só gestor). Se a tabela ainda não existe no Supabase, avisa em
  // vez de quebrar a página.
  let equipe: Corretor[] | null = null
  let erroEquipe: string | null = null
  let jetimob: { id: number; nome: string }[] = []
  if (gestor) {
    try {
      equipe = await db.listarCorretores()
    } catch (err) {
      erroEquipe = (err as Error).message
    }
    if (jetimobConfigurado()) {
      jetimob = await getCorretores()
        .then((lista) => lista.map((c) => ({ id: c.id, nome: c.nome ?? `Corretor ${c.id}` })))
        .catch(() => [])
    }
  }

  const itens: [string, boolean, string][] = [
    ['I.A. (ANTHROPIC_API_KEY)', iaDisponivel(), iaDisponivel() ? `modelo ${modeloAnalise()}` : 'análise devolve exemplo fixo'],
    ['Banco (SUPABASE_URL + SERVICE_ROLE_KEY)', supabaseConfigurado(), db.modo === 'supabase' ? 'Postgres do Supabase' : 'memória / dados de demonstração'],
    ['Jetimob leitura (JETIMOB_API_KEY)', jetimobConfigurado(), jetimobConfigurado() ? 'imóveis reais do corretor' : 'imóveis de exemplo'],
    ['Jetimob escrita (PAINEL_JETIMOB_ENVIO=1)', envioJetimobHabilitado(), envioJetimobHabilitado() ? 'botão "Enviar para o Jetimob" ativo' : 'só texto para copiar'],
    ['Senha mestra (PAINEL_SENHA)', Boolean(process.env.PAINEL_SENHA), process.env.PAINEL_SENHA ? 'configurada' : 'modo demo (senha "demo")'],
  ]
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Configurações</h1>
          <p>Sua senha, a equipe, o padrão de atendimento que treina a I.A. e o estado das integrações.</p>
        </div>
      </div>
      <section className="p-card" style={{ marginBottom: 16 }}>
        <div className="p-card-head"><h2>Minha senha</h2><span className="p-small p-muted">{corretor.nome}{corretor.usuario ? ` (@${corretor.usuario})` : ''}</span></div>
        <MinhaSenha />
      </section>
      {gestor && (
        <section className="p-card" style={{ marginBottom: 16 }}>
          <div className="p-card-head"><h2>Equipe</h2><span className="p-small p-muted">Logins dos corretores</span></div>
          {equipe ? (
            <EquipeEditor corretores={equipe} meuId={corretor.id} jetimob={jetimob} />
          ) : (
            <div className="p-alert p-alert-warn">
              A tabela de corretores ainda não existe no banco. Aplique <code>supabase/migrations/20261106120000_painel_corretores.sql</code> no SQL Editor do Supabase e recarregue. Detalhe: {erroEquipe}
            </div>
          )}
        </section>
      )}
      <section className="p-card" style={{ marginBottom: 16 }}>
        <div className="p-card-head"><h2>Integrações</h2><span className="p-small p-muted">{corretor.papel === 'gestor' ? 'Gestor' : 'Corretor'}: {corretor.nome} (#{corretor.id})</span></div>
        <ul className="p-list">
          {itens.map(([nome, ok, detalhe]) => (
            <li key={nome} className="p-row p-between">
              <span>{nome}</span>
              <span className="p-row"><span className="p-small p-muted">{detalhe}</span><span className={`p-badge ${ok ? 'p-badge-ok' : 'p-badge-warn'}`}>{ok ? 'ativo' : 'demo'}</span></span>
            </li>
          ))}
        </ul>
      </section>
      <section className="p-card">
        <div className="p-card-head"><h2>Padrão de atendimento (treinamento da I.A.)</h2></div>
        <PadraoEditor textoInicial={padrao.texto} origemInicial={padrao.origem} arquivo={arquivo} />
      </section>
    </>
  )
}
