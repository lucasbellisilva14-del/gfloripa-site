// Ícones SVG simples (sem dependência) usados na navegação do painel.
type P = { className?: string }
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }

export const IconeInicio = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>
)
export const IconeAnalisar = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
)
export const IconeClientes = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 0 1 5.5 5" /></svg>
)
export const IconeLembretes = ({ className }: P) => (
  <svg {...base} className={className}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2H4.5z" /><path d="M10 21h4" /></svg>
)
export const IconeImoveis = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M10 21v-6h4v6" /></svg>
)
export const IconeConfig = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const IconeCopiar = ({ className }: P) => (
  <svg {...base} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
)
