// Tag do Google (Google Ads). O ID é público por natureza.
export const ADS_ID = 'AW-18509417111'

// Rótulo da ação de conversão "Lead site" (Metas → Conversões no Google Ads).
// Sem ele, os eventos nomeados ainda são enviados; a conversão oficial só
// conta quando o rótulo estiver preenchido.
const CONVERSION_LABEL = process.env.NEXT_PUBLIC_ADS_LEAD_LABEL

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  try {
    window.gtag?.('event', name, params)
  } catch {
    // rastreamento nunca pode quebrar a experiência
  }
}

// Conversão principal: lead enviado (formulário ou Lia)
export function trackLead(origem: 'formulario' | 'lia', codigo?: string) {
  trackEvent('lead_enviado', { origem, codigo })
  if (CONVERSION_LABEL) {
    trackEvent('conversion', { send_to: `${ADS_ID}/${CONVERSION_LABEL}` })
  }
}

export function trackWhatsapp(origem: string) {
  trackEvent('whatsapp_aberto', { origem })
}
