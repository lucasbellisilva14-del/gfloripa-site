#!/usr/bin/env node
// QA da ponte do WhatsApp: simula o serviço enviando estado e mensagens ao
// painel e confere o que o painel faz com elas. Não conecta ao WhatsApp.
// Uso: node scripts/qa-whatsapp.mjs [baseURL] [token]

const BASE = process.argv[2] ?? 'http://localhost:3000'
const TOKEN = process.argv[3] ?? process.env.PAINEL_WHATSAPP_TOKEN ?? 'token-de-teste'
let falhas = 0
const ok = (c, msg, extra = '') => {
  console.log(`${c ? 'OK   ' : 'FALHA'} ${msg}${extra ? ' :: ' + extra : ''}`)
  if (!c) falhas++
}

const ponte = (caminho, opcoes = {}) =>
  fetch(`${BASE}/api/painel/whatsapp/${caminho}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...(opcoes.headers ?? {}) },
  })

// 1. sem token, tudo barrado
let r = await fetch(`${BASE}/api/painel/whatsapp/entrada`, { method: 'POST', body: '{}' })
ok(r.status === 401 || r.status === 503, `entrada sem token recusada (${r.status})`)
r = await ponte('entrada', { method: 'POST', headers: { authorization: 'Bearer errado' }, body: '{}' })
ok(r.status === 401, `entrada com token errado recusada (${r.status})`)

// 2. estado e QR
r = await ponte('estado', { method: 'POST', body: JSON.stringify({ status: 'aguardando_qr', qr: 'data:image/png;base64,iVBORw0KGgo=' }) })
ok(r.ok, 'ponte publica estado aguardando_qr')
r = await ponte('estado', { method: 'POST', body: JSON.stringify({ status: 'conectado', qr: null, numero: '5548999990000' }) })
const estado = (await r.json()).estado
ok(estado?.status === 'conectado' && estado?.numero === '5548999990000', 'estado conectado gravado')

// 3. sessão guarda e devolve
r = await ponte('sessao', { method: 'PUT', body: JSON.stringify({ dados: { creds: { teste: 1 }, keys: {} } }) })
ok(r.ok, 'sessão salva')
r = await ponte('sessao')
const sessao = (await r.json()).dados
ok(sessao?.creds?.teste === 1, 'sessão devolvida igual')

// 4. mensagens: grupos e vazias descartadas, duplicadas ignoradas
// Conversa nova a cada execucao, para o teste nao esbarrar em dados deixados
// por uma rodada anterior nem pelo qa-painel.mjs.
const sufixo = String(Date.now()).slice(-7)
const chat = `55549${sufixo}@s.whatsapp.net`
const telefoneEsperado = `549${sufixo}`
const base = Date.parse('2026-11-03T12:00:00Z')
const msg = (i, direcao, texto) => ({
  wa_chat_id: chat,
  wa_id: `${sufixo}-${i}`,
  direcao,
  nome: 'Mariana Costa',
  autor: direcao === 'entrada' ? 'Mariana Costa' : null,
  texto,
  data: new Date(base + i * 60000).toISOString(),
})
const lote = [
  msg(1, 'entrada', 'Bom dia Lucas! A casa C0412 na Gamboa ainda está disponível?'),
  msg(2, 'saida', 'Bom dia, Mariana! Está sim. Procuram para morar ou veranear?'),
  msg(3, 'entrada', 'Veranear por enquanto. Temos 600 mil de entrada e financiamos o resto.'),
  msg(4, 'saida', 'Perfeito. Consigo agendar visita domingo às 15h, serve?'),
  msg(5, 'entrada', 'Serve! E me liga sexta à tarde pra confirmar, depois das 14h.'),
  { ...msg(9, 'entrada', 'mensagem de grupo'), wa_chat_id: '123456@g.us' },
  { ...msg(10, 'entrada', ''), wa_id: `${sufixo}-vazia` },
]
r = await ponte('entrada', { method: 'POST', body: JSON.stringify({ mensagens: lote }) })
let b = await r.json()
ok(b.novas === 5, `5 mensagens gravadas, grupo e vazia descartados (novas=${b.novas}, recebidas=${b.recebidas})`)

r = await ponte('entrada', { method: 'POST', body: JSON.stringify({ mensagens: lote }) })
b = await r.json()
ok(b.novas === 0, `lote repetido não duplica (novas=${b.novas})`)

// 5. leitura exige login de corretor
r = await fetch(`${BASE}/api/painel/whatsapp/chat`)
ok(r.status === 401 || r.status === 307 || r.status === 302, `listar conversas sem login barrado (${r.status})`)

// 6. com login
r = await fetch(`${BASE}/api/painel/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ senha: process.env.PAINEL_SENHA ?? 'demo' }),
})
ok(r.ok, 'login do corretor')
const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
ok(Boolean(cookie), 'cookie de sessão recebido')

r = await fetch(`${BASE}/api/painel/whatsapp/chat`, { headers: { cookie } })
b = await r.json()
const c1 = (b.chats ?? []).find((c) => c.wa_chat_id === chat)
ok(Boolean(c1), 'a conversa de teste aparece na lista')
ok(c1?.total_mensagens === 5, `contador de mensagens correto (${c1?.total_mensagens})`)
ok(c1?.telefone === telefoneEsperado, `telefone extraído do jid (${c1?.telefone})`)
ok(c1?.nome === 'Mariana Costa', 'nome do contato guardado')
ok(!c1?.cliente_id, 'conversa ainda não virou cliente')

// 7. análise da conversa (modo demo da I.A.)
r = await fetch(`${BASE}/api/painel/whatsapp/analisar`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ chat_id: c1.id }),
})
b = await r.json()
ok(r.ok, 'análise da conversa do WhatsApp', b.error ?? '')
ok(b.mensagens_analisadas === 5, `5 mensagens analisadas (${b.mensagens_analisadas})`)
ok(Boolean(b.analise?.resultado?.temperatura?.nivel), 'análise tem temperatura')
ok(Boolean(b.cliente_id), 'cliente criado a partir da conversa')

r = await fetch(`${BASE}/api/painel/whatsapp/chat`, { headers: { cookie } })
b = await r.json()
const c2 = (b.chats ?? []).find((c) => c.wa_chat_id === chat)
ok(Boolean(c2?.cliente_id), 'conversa vinculada à ficha do cliente')

// 8. arquivar some da lista
r = await fetch(`${BASE}/api/painel/whatsapp/chat`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ chat_id: c1.id, arquivado: true }),
})
ok(r.ok, 'arquivar conversa')
r = await fetch(`${BASE}/api/painel/whatsapp/chat`, { headers: { cookie } })
b = await r.json()
ok(!(b.chats ?? []).some((c) => c.wa_chat_id === chat), 'conversa arquivada sai da lista')

// 9. nome da conversa nunca é o do corretor; agenda e Renomear corrigem
const chat2 = `55549${String(Date.now() + 7).slice(-7)}@s.whatsapp.net`
const m2 = (i, direcao, nome, texto) => ({ wa_chat_id: chat2, wa_id: `${sufixo}-b${i}`, direcao, nome, autor: direcao === 'entrada' ? nome : null, texto, data: new Date(base + i * 60000).toISOString() })
r = await ponte('entrada', { method: 'POST', body: JSON.stringify({ mensagens: [m2(1, 'saida', 'Lucas', 'Olá! Aqui é o Lucas da Nagamboa.')], meu_nome: 'Lucas' }) })
b = await r.json()
ok(b.novas === 1, 'conversa aberta por mensagem do corretor gravada')
r = await fetch(`${BASE}/api/painel/whatsapp/chat`, { headers: { cookie } })
b = await r.json()
let c3 = (b.chats ?? []).find((c) => c.wa_chat_id === chat2)
ok(Boolean(c3) && !c3.nome, `conversa aberta pelo corretor fica sem nome (nome=${c3?.nome})`)

r = await ponte('entrada', { method: 'POST', body: JSON.stringify({ mensagens: [m2(2, 'entrada', 'Roberto', 'Oi Lucas, quero ver o terreno.')], meu_nome: 'Lucas' }) })
r = await fetch(`${BASE}/api/painel/whatsapp/chat`, { headers: { cookie } })
b = await r.json()
c3 = (b.chats ?? []).find((c) => c.wa_chat_id === chat2)
ok(c3?.nome === 'Roberto', `resposta do contato batiza a conversa (nome=${c3?.nome})`)

r = await fetch(`${BASE}/api/painel/whatsapp/contatos`, { method: 'POST', body: '{}' })
ok(r.status === 401 || r.status === 503, `contatos sem token recusado (${r.status})`)
r = await ponte('contatos', { method: 'POST', body: JSON.stringify({ contatos: [{ wa_chat_id: chat2, nome: 'Roberto Silva' }, { wa_chat_id: chat2, nome: 'Lucas' }], meu_nome: 'Lucas' }) })
b = await r.json()
ok(r.ok && b.renomeadas === 1, `agenda renomeia a conversa e ignora o meu nome (renomeadas=${b.renomeadas})`)
r = await fetch(`${BASE}/api/painel/whatsapp/chat`, { headers: { cookie } })
b = await r.json()
c3 = (b.chats ?? []).find((c) => c.wa_chat_id === chat2)
ok(c3?.nome === 'Roberto Silva', `nome da agenda aplicado (nome=${c3?.nome})`)

r = await fetch(`${BASE}/api/painel/whatsapp/chat`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ chat_id: c3.id, nome: 'Roberto Comprador' }),
})
b = await r.json()
ok(r.ok && b.chat?.nome === 'Roberto Comprador', 'Renomear pela tela')
await fetch(`${BASE}/api/painel/whatsapp/chat`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ chat_id: c3.id, arquivado: true }) })

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo OK')
process.exit(falhas ? 1 : 0)
