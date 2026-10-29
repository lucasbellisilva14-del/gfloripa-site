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
await page.click('text=Usar conversa de exemplo')
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

// 10. logout
await page.click('button:has-text("Sair")')
await page.waitForURL('**/painel/login')
ok(true, 'logout volta ao login')

// 11. site público intacto
await page.goto(`${BASE}/`)
ok(await page.isVisible('.lia-fab'), 'Lia continua no site público')

await browser.close()
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo OK')
process.exit(falhas ? 1 : 0)
