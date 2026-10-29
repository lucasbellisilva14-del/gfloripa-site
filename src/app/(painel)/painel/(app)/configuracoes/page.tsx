import PadraoEditor from '@/components/painel/PadraoEditor'
import { lerPadraoArquivo, obterPadraoAtendimento } from '@/lib/painel/padrao-atendimento'
import { getDb, supabaseConfigurado } from '@/lib/painel/db'
import { iaDisponivel, modeloAnalise } from '@/lib/painel/analise'
import { jetimobConfigurado } from '@/lib/painel/imoveis'
import { envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'
import { getCorretorLogado } from '@/lib/painel/sessao'

export default async function ConfiguracoesPage() {
  const corretor = (await getCorretorLogado())!
  const [padrao, arquivo, db] = await Promise.all([obterPadraoAtendimento(), lerPadraoArquivo(), getDb()])
  const itens: [string, boolean, string][] = [
    ['I.A. (ANTHROPIC_API_KEY)', iaDisponivel(), iaDisponivel() ? `modelo ${modeloAnalise()}` : 'análise devolve exemplo fixo'],
    ['Banco (SUPABASE_URL + SERVICE_ROLE_KEY)', supabaseConfigurado(), db.modo === 'supabase' ? 'Postgres do Supabase' : 'memória / dados de demonstração'],
    ['Jetimob leitura (JETIMOB_API_KEY)', jetimobConfigurado(), jetimobConfigurado() ? 'imóveis reais do corretor' : 'imóveis de exemplo'],
    ['Jetimob escrita (PAINEL_JETIMOB_ENVIO=1)', envioJetimobHabilitado(), envioJetimobHabilitado() ? 'botão "Enviar para o Jetimob" ativo' : 'só texto para copiar'],
    ['Senha própria (PAINEL_SENHA)', Boolean(process.env.PAINEL_SENHA), process.env.PAINEL_SENHA ? 'configurada' : 'modo demo (senha "demo")'],
  ]
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Configurações</h1>
          <p>Padrão de atendimento que treina a I.A. e estado das integrações.</p>
        </div>
      </div>
      <section className="p-card" style={{ marginBottom: 16 }}>
        <div className="p-card-head"><h2>Integrações</h2><span className="p-small p-muted">Corretor logado: {corretor.nome} (#{corretor.id})</span></div>
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
