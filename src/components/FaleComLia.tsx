'use client'

export default function FaleComLia({ assunto }: { assunto: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('nagamboa:abrir-chat'))}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 40,
        padding: '13px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        fontFamily: "'Jost',sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/lia.webp" alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
      Falar com a Lia sobre {assunto}
    </button>
  )
}
