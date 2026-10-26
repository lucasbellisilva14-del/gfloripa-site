export default function Loading() {
  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', padding: '90px 48px' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div className="sk" style={{ height: 36, width: 340, borderRadius: 8, marginBottom: 30 }} />
        <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 22 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="sk" style={{ height: 300, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
