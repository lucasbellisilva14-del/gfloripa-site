// Regras de filtragem da ponte, separadas do index.mjs para poderem ser
// testadas sem abrir conexão com o WhatsApp.

// Janela de tempo aceita na captura. Serve de freio: ao conectar, o WhatsApp
// pode despejar um lote de mensagens acumuladas, e não queremos arrastar
// meses de conversa para dentro do painel de uma vez.
export const JANELA_DIAS_PADRAO = 7

// Conversa de pessoa. Em vez de aceitar apenas @s.whatsapp.net, recusamos o
// que sabemos não servir: o WhatsApp vem migrando o endereçamento de conversas
// individuais e uma lista de permitidos fecharia a porta para o formato novo.
export function ehConversaDePessoa(jid) {
  if (typeof jid !== 'string' || !jid.includes('@')) return false
  if (jid.endsWith('@g.us')) return false // grupo
  if (jid.endsWith('@newsletter')) return false // canal
  if (jid.includes('broadcast')) return false // status e lista de transmissão
  return true
}

// Os dois tipos que interessam:
//   notify  mensagem que chega com o serviço no ar
//   append  mensagem que você enviou do celular, ou que ficou na fila
//           enquanto o serviço estava fora do ar
// Descartar 'append' era o que fazia a ponte ignorar as respostas do corretor.
export function tipoAceito(tipo) {
  return tipo === 'notify' || tipo === 'append'
}

// Carimbo de tempo em milissegundos; o WhatsApp manda em segundos e às vezes
// como Long da biblioteca de protocolo.
export function carimboParaMs(valor) {
  const n = Number(valor ?? 0)
  if (!Number.isFinite(n) || n <= 0) return null
  return n * 1000
}

export function dentroDaJanela(ms, janelaDias = JANELA_DIAS_PADRAO, agora = Date.now()) {
  if (ms === null) return true // sem carimbo: aceita e usa a hora de agora
  if (ms > agora + 24 * 60 * 60 * 1000) return false // relógio absurdo, à frente
  return agora - ms <= janelaDias * 24 * 60 * 60 * 1000
}

// Só texto interessa à análise. Mídia vira uma marcação curta para a conversa
// não ficar com buracos sem explicação.
export function textoDaMensagem(m) {
  const c = m?.message
  if (!c) return null
  if (c.conversation) return c.conversation
  if (c.extendedTextMessage?.text) return c.extendedTextMessage.text
  if (c.imageMessage) return c.imageMessage.caption ? `[foto] ${c.imageMessage.caption}` : '[foto]'
  if (c.videoMessage) return c.videoMessage.caption ? `[vídeo] ${c.videoMessage.caption}` : '[vídeo]'
  if (c.audioMessage) return '[áudio]'
  if (c.documentMessage) return `[documento${c.documentMessage.fileName ? ': ' + c.documentMessage.fileName : ''}]`
  if (c.locationMessage) return '[localização]'
  if (c.contactMessage) return '[contato]'
  if (c.stickerMessage) return '[figurinha]'
  if (c.reactionMessage) return null
  if (c.protocolMessage) return null // apagar, editar, sincronização
  return null
}

// Converte a mensagem crua no formato que o painel espera, ou devolve o
// motivo da recusa, para a ponte poder registrar por que ignorou algo.
export function prepararMensagem(m, { janelaDias = JANELA_DIAS_PADRAO, agora = Date.now() } = {}) {
  const jid = m?.key?.remoteJid
  if (!ehConversaDePessoa(jid)) return { recusa: 'nao e conversa de pessoa' }
  const texto = textoDaMensagem(m)
  if (!texto) return { recusa: 'sem texto' }
  const ms = carimboParaMs(m.messageTimestamp)
  if (!dentroDaJanela(ms, janelaDias, agora)) return { recusa: 'fora da janela de dias' }
  if (!m.key?.id) return { recusa: 'sem id' }
  return {
    mensagem: {
      wa_chat_id: jid,
      wa_id: m.key.id,
      direcao: m.key.fromMe ? 'saida' : 'entrada',
      nome: m.pushName ?? null,
      autor: m.key.fromMe ? null : (m.pushName ?? null),
      texto,
      data: new Date(ms ?? agora).toISOString(),
    },
  }
}
