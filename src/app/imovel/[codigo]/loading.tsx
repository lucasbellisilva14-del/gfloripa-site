export default function Loading() {
  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', padding: '90px 48px' }}>
      <div className="two-col" style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 36 }}>
        <div className="sk" style={{ height: 420, borderRadius: 16 }} />
        <div>
          <div className="sk" style={{ height: 16, width: '40%', borderRadius: 8, marginBottom: 14 }} />
          <div className="sk" style={{ height: 34, borderRadius: 8, marginBottom: 10 }} />
          <div className="sk" style={{ height: 34, width: '70%', borderRadius: 8, marginBottom: 24 }} />
          <div className="sk" style={{ height: 38, width: '55%', borderRadius: 8, marginBottom: 26 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="sk" style={{ height: 64, borderRadius: 11 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
