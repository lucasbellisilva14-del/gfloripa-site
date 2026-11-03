'use client'

import { useState } from 'react'
import { IconeCopiar } from './Icones'

export default function CopiarBotao({ texto, rotulo = 'Copiar', className = '' }: { texto: string; rotulo?: string; className?: string }) {
  const [ok, setOk] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // fallback para contextos sem clipboard API
      const ta = document.createElement('textarea')
      ta.value = texto
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setOk(true)
    setTimeout(() => setOk(false), 1600)
  }
  return (
    <button type="button" className={`p-btn p-btn-sm ${className}`} onClick={copiar} aria-live="polite">
      <IconeCopiar className="" /> {ok ? 'Copiado!' : rotulo}
    </button>
  )
}
