#!/usr/bin/env node
// QA do painel: testa o fluxo completo em modo demo (login, análise, lembretes,
// imóveis, configurações, mobile) e gera capturas. Uso: node scripts/qa-painel.mjs [baseURL] [pasta]
// Teste de ponta a ponta do painel em modo demo + capturas de tela
import { chromium, devices } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
const BASE = process.argv[2] ?? 'http://localhost:3000'
const OUT = process.argv[3] ?? 'qa-screenshots/painel'
mkdirSync(OUT, { recursive: true })
let falhas = 0
const ok = (c, msg) => { console.log(`${c ? 'OK   ' : 'FALHA'} ${msg}`); if (!c) falhas++ }

// Em ambientes com Chromium próprio (ex.: nuvem), aponte com QA_CHROMIUM=/caminho/chrome
const executablePath = process.env.QA_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); falhas++ })
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })

// 1. redirecionamento sem login
await page.goto(`${BASE}/painel/clientes`)
ok(page.url().includes('/painel/login?next=%2Fpainel%2Fclientes'), 'sem cookie redireciona ao login com next')
await page.screenshot({ path: `${OUT}/01-login.png` })

// 2. senha errada / certa
await page.fill('#senha', 'errada')
await page.click('button[type=submit]')
await page.waitForSelector('.p-alert-danger')
ok(true, 'senha errada mostra erro')
await page.fill('#senha', 'demo')
await page.click('button[type=submit]')
await page.waitForURL('**/painel/clientes')
ok(true, 'login demo leva ao destino')

// 3. dashboard
await page.goto(`${BASE}/painel`)
await page.waitForSelector('h1')
ok((await page.textContent('h1')).includes('Lucas'), 'dashboard saúda o corretor')
ok((await page.$$('.p-stat')).length === 4, 'dashboard tem 4 cartões')
await page.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: true })

// 4. analisar conversa (demo)
await page.goto(`${BASE}/painel/analisar`)

// 4a. envio de arquivos: varios de uma vez, com print no meio
// o input fica escondido pelo CSS da área de arrastar; basta estar no DOM
await page.waitForSelector('#arquivo', { state: 'attached' })
const pngMinimo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
await page.setInputFiles('#arquivo', [
  { name: 'conversa.txt', mimeType: 'text/plain', buffer: Buffer.from('[24/10/2026 09:12] Mariana: Bom dia!') },
  { name: 'print.png', mimeType: 'image/png', buffer: pngMinimo },
])
ok((await page.$$('.p-list li')).length === 3, 'dois arquivos listados mais a linha de total')
ok(await page.isVisible('text=A I.A. vai ler os prints'), 'aviso de print aparece')
await page.click('li:has-text("print.png") button:has-text("Remover")')
ok(!(await page.isVisible('text=A I.A. vai ler os prints')), 'remover o print tira o aviso')
await page.click('button:has-text("Limpar tudo")')
ok((await page.$$('.p-list li')).length === 0, 'limpar tudo esvazia a lista')
await page.screenshot({ path: OUT + '/12-analisar-arquivos.png' })

// 4b. analise a partir do texto de exemplo
await page.click('button:has-text("Usar conversa de exemplo")')
await page.fill('#cliente_nome', 'Mariana Costa')
await page.fill('#cliente_telefone', '(54) 99911-0001')
await page.click('button[type=submit]')
await page.waitForSelector('#resultado', { timeout: 60000 })
ok(await page.isVisible('text=Resultado da análise'), 'análise devolve resultado')
ok((await page.$$('#resultado .p-card')).length >= 10, 'resultado tem cards')
const criar = await page.$$('button:has-text("Criar lembrete")')
ok(criar.length === 3, `3 lembretes detectados (${criar.length})`)
await criar[0].click()
await page.waitForSelector('button:has-text("Lembrete criado")')
ok(true, 'criar lembrete funciona')
await page.click('button:has-text("Criar todos")')
await page.waitForFunction(() => document.querySelectorAll('button').length && [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Criar lembrete')).length === 0)
ok(true, 'criar todos funciona')
await page.screenshot({ path: `${OUT}/03-analise.png`, fullPage: true })

// 5. cliente existente foi reaproveitado (telefone) e tem a nova análise
await page.waitForTimeout(900) // espera a rolagem suave até o resultado terminar
await page.click('a:has-text("Ver cliente")')
await page.waitForURL('**/painel/clientes/**')
await page.waitForSelector('h1')
ok((await page.textContent('h1')).includes('Mariana'), 'página do cliente abre')
ok(page.url().includes('demo-cli-mariana'), 'análise foi associada ao cliente demo existente pelo telefone')
const lembretesCli = await page.$$('.p-timeline li')
ok(lembretesCli.length >= 2, `linha do tempo com ${lembretesCli.length} conversas`)
// 5b. correcao manual da ficha: o tipo escolhido fica fixado
await page.click('button:has-text("Editar ficha")')
await page.waitForSelector('#ed-tipo')
await page.selectOption('#ed-tipo', 'proprietario')
await page.click('button:has-text("Salvar")')
await page.waitForSelector('button:has-text("Tipo fixado por você")', { timeout: 15000 })
ok(await page.isVisible('.p-badge:has-text("Proprietário")'), 'tipo editado na ficha aparece')
ok(true, 'tipo fixado manualmente fica marcado')
await page.click('button:has-text("liberar")')
await page.waitForFunction(() => !document.body.textContent.includes('Tipo fixado por você'), null, { timeout: 15000 })
ok(true, 'liberar devolve a decisao do tipo para a I.A.')
await page.screenshot({ path: `${OUT}/04-cliente.png`, fullPage: true })

// 6. lembretes: concluir
await page.goto(`${BASE}/painel/lembretes`)
const antes = (await page.$$('button:has-text("Concluir")')).length
await page.click('button:has-text("Concluir")')
await page.waitForFunction((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Concluir').length === n - 1, antes)
ok(true, 'concluir lembrete atualiza a lista')
await page.screenshot({ path: `${OUT}/05-lembretes.png`, fullPage: true })

// 7. imóveis com busca
await page.goto(`${BASE}/painel/imoveis`)
await page.fill('input[placeholder^="Buscar"]', 'mares')
await page.waitForTimeout(200)
ok((await page.$$('tbody tr')).length === 2, 'busca filtra imóveis')
await page.screenshot({ path: `${OUT}/06-imoveis.png`, fullPage: true })

// 8. configurações: salvar padrão com travessão deve falhar; sem travessão salva
await page.goto(`${BASE}/painel/configuracoes`)
await page.waitForSelector('textarea')
await page.fill('textarea', 'Teste — com travessão')
await page.click('button:has-text("Salvar padrão")')
await page.waitForSelector('.p-alert-danger')
ok(true, 'travessão é rejeitado no padrão')
await page.fill('textarea', '# Padrão de teste\n\nSem travessão.')
await page.click('button:has-text("Salvar padrão")')
await page.waitForSelector('text=Versão editada no painel')
ok(true, 'padrão editado salva')
await page.click('button:has-text("Restaurar do arquivo")')
await page.waitForSelector('text=Versão do arquivo')
ok(true, 'restaurar do arquivo funciona')
await page.screenshot({ path: `${OUT}/07-configuracoes.png` })

// 9. dark mode e mobile
await page.goto(`${BASE}/painel`)
await page.click('button:has-text("Tema:")')
ok((await page.getAttribute('.painel-shell', 'data-tema')) === 'escuro', 'alternar tema aplica data-tema')
await page.screenshot({ path: `${OUT}/08-dashboard-escuro.png` })
const mob = await browser.newContext({ ...devices['iPhone 13'] })
const mp = await mob.newPage()
await mp.goto(`${BASE}/painel/login`)
await mp.fill('#senha', 'demo')
await mp.click('button[type=submit]')
await mp.waitForURL('**/painel')
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
ok(!overflow, 'mobile sem overflow horizontal')
await mp.click('.p-burger')
ok(await mp.isVisible('.p-mobile-nav'), 'menu mobile abre')
await mp.screenshot({ path: `${OUT}/09-mobile.png`, fullPage: false })
ok(!(await mp.isVisible('.lia-fab').catch(() => false)), 'Lia (chat do site) não aparece no painel')

// 9b. tela do WhatsApp: semeia pela ponte e confere o que a tela mostra
const TOKEN_WA = process.env.PAINEL_WHATSAPP_TOKEN || 'token-de-teste'
const ponte = (caminho, corpo) =>
  fetch(BASE + '/api/painel/whatsapp/' + caminho, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN_WA },
    body: JSON.stringify(corpo),
  })
const respEstado = await ponte('estado', { status: 'conectado', qr: null, numero: '5548999990000' })
if (respEstado.ok) {
  const t0 = Date.parse('2026-11-03T12:00:00Z')
  await ponte('entrada', {
    mensagens: [
      ['entrada', 'Bom dia Lucas! A casa C0412 na Gamboa ainda esta disponivel?'],
      ['saida', 'Bom dia, Mariana! Esta sim. Procuram para morar ou veranear?'],
      ['entrada', 'Veranear. Temos 600 mil de entrada e financiamos o resto.'],
      ['saida', 'Consigo agendar visita domingo as 15h, serve?'],
      ['entrada', 'Serve! Me liga sexta a tarde pra confirmar, depois das 14h.'],
    ].map(([direcao, texto], i) => ({
      wa_chat_id: '5554999110001@s.whatsapp.net',
      wa_id: 'qa' + i,
      direcao,
      nome: 'Mariana Costa',
      autor: direcao === 'entrada' ? 'Mariana Costa' : null,
      texto,
      data: new Date(t0 + i * 60000).toISOString(),
    })),
  })
  // a tela confirma com window.confirm antes de parear de novo e de analisar em lote
  page.on('dialog', (d) => d.accept())
  await page.goto(BASE + '/painel/whatsapp')
  await page.waitForSelector('h1')
  await page.waitForSelector('.p-checks li', { timeout: 15000 })
  // O pulso acabou de ser publicado, entao o servico esta vivo por essa via.
  // Mesmo com WHATSAPP_PONTE_URL configurada e sem resposta no endereco direto,
  // a tela deve confiar no pulso e mostrar Conectado; o endereco direto vira
  // uma verificacao reprovada, nao um "fora do ar".
  const saude = await page.evaluate(() => fetch('/api/painel/whatsapp/saude').then((r) => r.json()))
  ok(await page.isVisible('.p-badge:has-text("Conectado")'), 'tela do WhatsApp mostra Conectado com pulso recente')
  const esperadas = saude.direto_configurado ? 6 : 5
  ok((await page.$$('.p-checks li')).length === esperadas, `${esperadas} verificacoes de diagnostico na tela`)
  if (saude.direto_configurado && !saude.saude?.alcancavel) {
    ok(await page.isVisible('text=endereço direto não responde'), 'endereco direto reprovado sem derrubar o status')
  }

  // O CASO RELATADO: servico vivo, sessao encerrada pelo celular, QR novo
  // gravado. A tela tem que mostrar o QR e oferecer o pareamento.
  const pngMinimoQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  await ponte('estado', { status: 'aguardando_qr', qr: pngMinimoQr, numero: null })
  // Conectado, a tela consulta a cada 10 s; "Verificar agora" liga a consulta
  // por segundo, que e o que o corretor faria ao estranhar a demora.
  await page.click('button:has-text("Verificar agora")')
  await page.waitForSelector('img[alt="Código QR para conectar o WhatsApp"]', { timeout: 25000 })
  ok(true, 'QR aparece quando o servico esta vivo e aguardando leitura')
  ok(await page.isVisible('.p-badge:has-text("Aguardando leitura do código")'), 'status acompanha o QR')
  ok(await page.isVisible('button:has-text("Parear de novo")'), 'botao de parear continua disponivel')
  await ponte('estado', { status: 'conectado', qr: null, numero: '5548999990000' })
  await page.waitForSelector('.p-badge:has-text("Conectado")', { timeout: 25000 })
  ok(true, 'volta a Conectado quando o servico avisa')
  ok(await page.isVisible('button:has-text("Reconectar")'), 'botao Reconectar presente')
  ok(await page.isVisible('button:has-text("Parear de novo")'), 'botao Parear de novo presente')
  ok((await page.$$('.p-list li')).length === 1, 'conversa capturada aparece na lista')
  ok(await page.isVisible('.p-novas'), 'contador de mensagens novas aparece')
  await page.click('.p-list button:has-text("Ler")')
  await page.waitForSelector('.p-bolha')
  ok((await page.$$('.p-bolha')).length === 5, 'Ler abre a conversa em baloes')
  ok((await page.$$('.p-bolha-saida')).length === 2, 'mensagens do corretor ficam a direita')
  await page.screenshot({ path: OUT + '/10-whatsapp.png', fullPage: true })
  await page.click('.p-list button:has-text("Analisar")')
  await page.waitForSelector('#resultado-wa', { timeout: 60000 })
  ok(await page.isVisible('text=mensagens analisadas'), 'analise da conversa do WhatsApp na tela')
  ok(await page.isVisible('.p-list a:has-text("Ficha")'), 'conversa vira ficha de cliente')
  ok(!(await page.isVisible('.p-novas')), 'apos analisar, nao ha mensagens novas')
  await page.screenshot({ path: OUT + '/11-whatsapp-analise.png', fullPage: true })
  // comando pela tela: Verificar agora deixa o pedido e a tela avisa com contador
  await page.click('button:has-text("Verificar agora")')
  await page.waitForSelector('.p-alert-info', { timeout: 10000 })
  ok(await page.isVisible('text=Atualizando a cada segundo'), 'Verificar agora avisa e acompanha com contador')
  // o servico (simulado) responde publicando estado: o aviso some sozinho
  await ponte('estado', { status: 'conectado' })
  await page.waitForFunction(() => !document.body.textContent.includes('Atualizando a cada segundo'), null, { timeout: 15000 })
  ok(true, 'aviso do comando some quando o pedido e atendido')
} else {
  ok(true, 'tela do WhatsApp pulada (PAINEL_WHATSAPP_TOKEN nao configurado)')
}

// 9b. login individual: outro corretor não vê os dados do gestor nem a equipe;
// o gestor define a senha dele e ela passa a valer
const ctx2 = await browser.newContext()
const p2 = await ctx2.newPage()
await p2.goto(`${BASE}/painel/login`)
await p2.fill('#usuario', 'murilo')
await p2.fill('#senha', 'demo')
await p2.click('button[type=submit]')
await p2.waitForURL('**/painel')
ok((await p2.textContent('h1'))?.includes('Murilo'), 'login individual entra como Murilo')
const r404 = await p2.goto(`${BASE}/painel/clientes/demo-cli-mariana`)
ok(r404?.status() === 404, `cliente do gestor não abre para outro corretor (${r404?.status()})`)
await p2.goto(`${BASE}/painel/configuracoes`)
ok((await p2.locator('[data-teste=equipe]').count()) === 0, 'corretor comum não vê a Equipe')
await p2.goto(`${BASE}/painel/whatsapp`)
ok(await p2.isVisible('[data-teste=whatsapp-outro-corretor]'), 'WhatsApp avisa que a conexão é do gestor')
await ctx2.close()

await page.goto(`${BASE}/painel/configuracoes`)
ok((await page.locator('[data-teste=equipe] li').count()) === 5, 'gestor vê os cinco corretores')
page.removeAllListeners('dialog') // o handler genérico da tela do WhatsApp aceitaria sem texto
page.once('dialog', (d) => d.accept('murilo2026'))
await page.click('[data-teste=equipe] li:has-text("@murilo") button:has-text("Definir senha")')
await page.waitForSelector('[data-teste=senha-gerada]')
ok(true, 'gestor define a senha de um corretor')
const ctx3 = await browser.newContext()
const p3 = await ctx3.newPage()
await p3.goto(`${BASE}/painel/login`)
await p3.fill('#usuario', 'murilo')
await p3.fill('#senha', 'demo')
await p3.click('button[type=submit]')
await p3.waitForSelector('.p-alert-danger')
ok(true, 'senha antiga "demo" deixa de valer depois de definida')
await p3.fill('#senha', 'murilo2026')
await p3.click('button[type=submit]')
await p3.waitForURL('**/painel')
ok(true, 'senha definida pelo gestor entra')
await ctx3.close()

// 10. logout
// volta ao início primeiro: na tela do WhatsApp a página fica longa depois da
// análise e o botão da barra lateral nem sempre está ao alcance do clique
await page.goto(`${BASE}/painel`)
await page.waitForSelector('button:has-text("Sair")')
await page.click('button:has-text("Sair")')
await page.waitForURL('**/painel/login')
ok(true, 'logout volta ao login')

// 11. site público intacto
await page.goto(`${BASE}/`)
ok(await page.isVisible('.lia-fab'), 'Lia continua no site público')

await browser.close()
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo OK')
process.exit(falhas ? 1 : 0)
