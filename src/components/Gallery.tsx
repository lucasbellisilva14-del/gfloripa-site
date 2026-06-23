'use client'

import { useState } from 'react'
import Image from 'next/image'
import { type PropertyImage } from '@/lib/jetimob'

export default function Gallery({ images, contratoLabel }: { images: PropertyImage[]; contratoLabel: string }) {
  const [idx, setIdx] = useState(0)

  const total = images.length
  const current = images[idx]

  function prev() { setIdx((i) => (i - 1 + total) % total) }
  function next() { setIdx((i) => (i + 1) % total) }

  return (
    <div>
      <div style={{ height: 440, borderRadius: 16, position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg,#0E1D48,#1B4965)' }}>
        {current && (
          <Image
            src={current.link}
            alt={current.titulo || 'Foto do imóvel'}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 860px) 100vw, 60vw"
            priority
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 16%, rgba(232,178,58,.32), transparent 42%)' }} />
        <span style={{ position: 'absolute', left: 18, top: 18, background: 'rgba(232,178,58,.95)', color: '#0A1430', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 30, fontWeight: 600 }}>
          {contratoLabel}
        </span>
        {total > 0 && (
          <div style={{ position: 'absolute', right: 18, top: 18, background: 'rgba(10,20,48,.7)', color: '#fff', fontSize: 12, padding: '6px 12px', borderRadius: 30 }}>
            {idx + 1} / {total}
          </div>
        )}
        {total > 1 && (
          <>
            <button onClick={prev} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', background: 'rgba(10,20,48,.6)', border: '1px solid rgba(255,255,255,.25)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>‹</button>
            <button onClick={next} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', background: 'rgba(10,20,48,.6)', border: '1px solid rgba(255,255,255,.25)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>›</button>
          </>
        )}
      </div>
      {total > 1 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, overflowX: 'auto' }}>
          {images.slice(0, 8).map((img, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{ flex: '1 0 auto', width: 80, height: 72, borderRadius: 9, cursor: 'pointer', border: `2px solid ${i === idx ? '#E8B23A' : 'rgba(255,255,255,.1)'}`, position: 'relative', overflow: 'hidden', background: '#10204A' }}
            >
              <Image src={img.link_thumb || img.link} alt={img.titulo || `foto ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="80px" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
