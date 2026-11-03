import AnalisarForm from '@/components/painel/AnalisarForm'
import { iaDisponivel, modeloAnalise } from '@/lib/painel/analise'
import { envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'
import { CONVERSA_DEMO } from '@/lib/painel/demo'

export default function AnalisarPage() {
  const ia = iaDisponivel()
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Analisar conversa</h1>
          <p>Cole ou envie a conversa com o cliente. A I.A. aplica o padrão de atendimento e devolve temperatura, fatos, insights, próxima mensagem, nota para o Jetimob e lembretes.</p>
        </div>
        <span className="p-badge p-badge-neutro">{ia ? `Modelo: ${modeloAnalise()}` : 'I.A. em modo demo'}</span>
      </div>
      <AnalisarForm iaDisponivel={ia} envioJetimob={envioJetimobHabilitado()} exemplo={CONVERSA_DEMO} />
    </>
  )
}
