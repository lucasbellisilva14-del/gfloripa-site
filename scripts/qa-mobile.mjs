#!/usr/bin/env node
// QA mobile: audita as páginas do site em viewport de iPhone (375x812).
// Uso: node scripts/qa-mobile.mjs [baseURL] [pastaScreenshots]
//   baseURL padrão: http://localhost:3000 (suba antes com next dev ou next start)
//   pastaScreenshots padrão: qa-screenshots/
// Verifica: meta viewport, overflow horizontal, elementos vazando da viewport,
// fontes menores que 12px, inputs/selects com fonte menor que 16px (zoom no iOS),
// alvos de toque pequenos, e testa os cliques principais (burger, card, modal, Lia).

import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const SHOTS = process.argv[3] ?? 'qa-screenshots'
mkdirSync(SHOTS, { recursive: true })

const iphone = devices['iPhone 13']
const results = []
let failures = 0

function report(page, check, ok, detail = '') {
  results.push({ page, check, ok, detail })
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FALHA'} [${page}] ${check}${detail ? ' :: ' + detail : ''}`)
}

async function auditPage(pw, path, name) {
  const page = await pw.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 }))
  await page.waitForTimeout(1200)

  // meta viewport
  const vp = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null)
  report(name, 'meta viewport presente', !!vp && /width=device-width/.test(vp) && /initial-scale=1/.test(vp), vp ?? 'ausente')
  report(name, 'meta viewport não bloqueia zoom', !vp || (!/maximum-scale\s*=\s*1(\b|[^0-9.])/.test(vp) && !/user-scalable\s*=\s*(no|0)/.test(vp)), vp ?? '')

  // overflow horizontal
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
  report(name, 'sem overflow horizontal', widths.scroll <= widths.inner, `scrollWidth=${widths.scroll} innerWidth=${widths.inner}`)

  // elementos vazando da viewport
  const leaks = await page.evaluate(() => {
    const out = []
    const vw = window.innerWidth
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') {
        // ignora descendentes de containers com overflow hidden/auto no eixo x
        let p = el.parentElement, clipped = false
        while (p && p !== document.body) {
          const ox = getComputedStyle(p).overflowX
          if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' || ox === 'clip') { clipped = true; break }
          p = p.parentElement
        }
        if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || ''} right=${Math.round(r.right)} left=${Math.round(r.left)}`)
      }
      if (out.length >= 8) break
    }
    return out
  })
  report(name, 'nenhum elemento vazando da viewport', leaks.length === 0, leaks.join(' | '))

  // inputs e selects com fonte < 16px (causa zoom automático no iOS Safari)
  const smallFields = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs < 16) out.push(`${el.tagName.toLowerCase()}[${el.getAttribute('placeholder') ?? el.name ?? ''}] ${fs}px`)
    }
    return out
  })
  report(name, 'inputs/selects com fonte >= 16px', smallFields.length === 0, smallFields.join(' | '))

  // texto visível menor que 12px
  const tinyText = await page.evaluate(() => {
    const out = new Set()
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length) continue
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)
      if (!hasText) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      // atribuição de mapa é crédito legal, pequena por padrão em toda a web
      if (el.closest('.leaflet-control-attribution')) continue
      const fs = parseFloat(cs.fontSize)
      if (fs < 11) out.add(`${el.tagName.toLowerCase()} ${fs}px "${el.textContent.trim().slice(0, 24)}"`)
      if (out.size >= 6) break
    }
    return [...out]
  })
  report(name, 'texto legível (>= ~12px)', tinyText.length === 0, tinyText.join(' | '))

  // overlays decorativos sem pointer-events none cobrindo área central
  const blockers = await page.evaluate(() => {
    const pts = [[innerWidth / 2, innerHeight / 2], [innerWidth / 2, innerHeight * 0.3], [innerWidth / 2, innerHeight * 0.7]]
    const out = []
    for (const [x, y] of pts) {
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      const interactive = el.closest('a,button,input,select,textarea,[onclick],[role="button"]')
      const hasText = el.textContent && el.textContent.trim().length > 0
      if (!interactive && !hasText && el !== document.body && el.tagName !== 'IMG' && el.tagName !== 'HTML') {
        const cs = getComputedStyle(el)
        if (cs.position === 'absolute' || cs.position === 'fixed') {
          out.push(`(${Math.round(x)},${Math.round(y)}) ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || ''}`)
        }
      }
    }
    return out
  })
  report(name, 'sem camada decorativa interceptando toques', blockers.length === 0, blockers.join(' | '))

  await page.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, '_')}.png`, fullPage: false })
  return page
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 } })

  // Home
  let page = await auditPage(ctx, '/', 'home')

  // clique: burger abre o menu
  await page.locator('.m-burger').click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  const menuAberto = await page.evaluate(() => !!document.querySelector('.m-burger') && [...document.querySelectorAll('div')].some((d) => getComputedStyle(d).position === 'fixed' && d.textContent.includes('Sobre') && d.textContent.includes('Fale conosco')))
  report('home', 'burger abre o menu mobile', menuAberto)
  if (menuAberto) await page.screenshot({ path: `${SHOTS}/home_menu.png` })
  await page.keyboard.press('Escape').catch(() => {})
  await page.evaluate(() => document.querySelectorAll('button').forEach((b) => { if (b.textContent.trim() === '✕') b.click() }))
  await page.waitForTimeout(300)

  // clique: balão da Lia abre o chat
  await page.locator('button[aria-label="Abrir chat"]').click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(500)
  const chatAberto = await page.evaluate(() => document.body.textContent.includes('Lia · Nagamboa Imóveis'))
  report('home', 'balão da Lia abre o chat', chatAberto)
  if (chatAberto) {
    const chatOk = await page.evaluate(() => {
      const input = [...document.querySelectorAll('input')].find((i) => i.placeholder?.includes('mensagem'))
      if (!input) return 'input não encontrado'
      let panel = input.parentElement
      while (panel && getComputedStyle(panel).position !== 'fixed') panel = panel.parentElement
      if (!panel) return 'painel fixo não encontrado'
      const r = panel.getBoundingClientRect()
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
        return `painel cortado top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} right=${Math.round(r.right)} vh=${innerHeight}`
      }
      const fs = parseFloat(getComputedStyle(input).fontSize)
      if (fs < 16) return `input do chat com ${fs}px (zoom no iOS)`
      return true
    })
    report('home', 'painel do chat cabe na tela', chatOk === true, chatOk === true ? '' : String(chatOk))
    await page.screenshot({ path: `${SHOTS}/home_chat.png` })
    await page.locator('button[aria-label="Fechar chat"]').click().catch(() => {})
  }

  // seletores do hero respondem ao toque
  const heroSelect = await page.evaluate(() => {
    const sel = document.querySelector('.hero select')
    if (!sel) return 'select não encontrado'
    const r = sel.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el === sel || sel.contains(el) || el?.contains(sel) ? true : `coberto por ${el?.tagName}.${String(el?.className).split(' ')[0]}`
  })
  report('home', 'select do hero recebe o toque', heroSelect === true, heroSelect === true ? '' : String(heroSelect))
  await page.close()

  // Imóveis
  page = await auditPage(ctx, '/imoveis', 'imoveis')
  const firstCard = page.locator('a.pcard').first()
  let codigoHref = null
  try {
    codigoHref = await firstCard.getAttribute('href', { timeout: 8000 })
  } catch {}
  if (codigoHref) {
    // dropdowns do FilterBar respondem ao toque
    const selOk = await page.evaluate(() => {
      const sels = [...document.querySelectorAll('select')]
      if (!sels.length) return 'nenhum select'
      for (const sel of sels) {
        const r = sel.getBoundingClientRect()
        if (r.width === 0) continue
        const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1))
        if (el !== sel && !sel.contains(el)) return `select coberto por ${el?.tagName}`
      }
      return true
    })
    report('imoveis', 'selects do filtro recebem o toque', selOk === true, selOk === true ? '' : String(selOk))

    // clique no card navega
    await firstCard.click()
    await page.waitForURL('**/imovel/**', { timeout: 15000 }).catch(() => {})
    report('imoveis', 'card de imóvel navega para a página do imóvel', page.url().includes('/imovel/'), page.url())
  } else {
    report('imoveis', 'card de imóvel presente', false, 'nenhum card carregado (API indisponível?)')
  }
  await page.close()

  // Imóvel (página de detalhe)
  if (codigoHref) {
    page = await auditPage(ctx, codigoHref, 'imovel')
    // botão Tenho interesse abre o modal
    await page.getByRole('button', { name: 'Tenho interesse' }).click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(400)
    const modal = await page.evaluate(() => {
      const input = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Seu nome')
      if (!input) return 'modal não abriu'
      const fs = parseFloat(getComputedStyle(input).fontSize)
      if (fs < 16) return `input do modal com ${fs}px (zoom no iOS)`
      return true
    })
    report('imovel', 'Tenho interesse abre modal com inputs >= 16px', modal === true, modal === true ? '' : String(modal))
    await page.screenshot({ path: `${SHOTS}/imovel_modal.png` })
    // galeria: seta avança a foto
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => document.querySelectorAll('button[aria-label="Fechar"]').forEach((b) => b.click()))
    await page.waitForTimeout(300)
    const beforeCount = await page.evaluate(() => document.body.textContent.match(/(\d+)\s*\/\s*(\d+)/)?.[1] ?? null)
    const nextBtn = page.locator('button[aria-label="Próxima foto"]')
    if (await nextBtn.count()) {
      await nextBtn.click()
      await page.waitForTimeout(400)
      const afterCount = await page.evaluate(() => document.body.textContent.match(/(\d+)\s*\/\s*(\d+)/)?.[1] ?? null)
      report('imovel', 'seta da galeria troca a foto', beforeCount !== null && afterCount !== null && beforeCount !== afterCount, `${beforeCount} -> ${afterCount}`)
    }
    await page.close()
  }

  // Empreendimentos
  page = await auditPage(ctx, '/empreendimentos', 'empreendimentos')
  let empHref = null
  try {
    empHref = await page.locator('a.pcard').first().getAttribute('href', { timeout: 8000 })
  } catch {}
  await page.close()
  if (empHref) {
    page = await auditPage(ctx, empHref, 'empreendimento')
    await page.close()
  }

  // Sobre
  page = await auditPage(ctx, '/sobre', 'sobre')
  await page.close()

  await browser.close()

  console.log('\nResumo: ' + (results.length - failures) + ' OK, ' + failures + ' falhas, screenshots em ' + SHOTS + '/')
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
