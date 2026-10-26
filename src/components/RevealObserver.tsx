'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Dispara a animação .reveal uma única vez quando a seção entra na tela.
// IntersectionObserver roda fora do fluxo de scroll: zero custo por frame.
export default function RevealObserver() {
  const pathname = usePathname()

  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in)')
    if (els.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            obs.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [pathname])

  return null
}
