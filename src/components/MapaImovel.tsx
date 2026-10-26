'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

type Props = {
  latitude: number
  longitude: number
  bairro?: string | null
}

// Sempre região aproximada (pino + raio): a localização exata é enviada
// pelo corretor na negociação
export default function MapaImovel({ latitude, longitude, bairro }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mapa: import('leaflet').Map | null = null
    let ativo = true
    ;(async () => {
      const L = (await import('leaflet')).default
      if (!ativo || !ref.current || ref.current.dataset.pronto) return
      ref.current.dataset.pronto = '1'

      mapa = L.map(ref.current, {
        center: [latitude, longitude],
        zoom: 14,
        scrollWheelZoom: false,
        attributionControl: false,
        zoomControl: true,
      })

      // OpenStreetMap (gratuito, sem chave); o filtro CSS nos tiles converte o
      // mapa claro para o tom navy da identidade
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(mapa)
      L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(mapa)

      L.circle([latitude, longitude], {
        radius: 350,
        color: '#E8B23A',
        weight: 1.5,
        fillColor: '#E8B23A',
        fillOpacity: 0.16,
      }).addTo(mapa)

      const ponto = L.divIcon({
        className: '',
        html: '<div class="mapa-ponto"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      L.marker([latitude, longitude], { icon: ponto, interactive: false }).addTo(mapa)
    })()
    return () => {
      ativo = false
      mapa?.remove()
    }
  }, [latitude, longitude])

  return (
    <>
      <style>{`
        .mapa-ponto { width:18px;height:18px;border-radius:50%;background:#E8B23A;border:2.5px solid #0A1430;box-shadow:0 0 0 7px rgba(232,178,58,.3);animation:liaPulse 2.6s ease-out infinite }
        .mapa-imovel .leaflet-tile { filter: invert(1) hue-rotate(195deg) brightness(.82) contrast(1.05) saturate(.55) }
        .mapa-imovel .leaflet-control-zoom a { background:#10204A !important;color:#E8B23A !important;border-color:rgba(255,255,255,.15) !important }
        .mapa-imovel .leaflet-control-attribution { background:rgba(10,20,48,.75) !important;color:rgba(255,255,255,.45) !important;font-size:10.5px }
        .mapa-imovel .leaflet-control-attribution a { color:rgba(255,255,255,.55) !important }
      `}</style>
      <div
        ref={ref}
        className="mapa-imovel"
        style={{ height: 260, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', overflow: 'hidden', background: 'linear-gradient(150deg,#12325A,#1E4D6B)' }}
      />
      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', marginTop: 10 }}>
        Lat {latitude.toFixed(5)} · Long {longitude.toFixed(5)} · Região aproximada{bairro ? `: ${bairro}` : ''}
      </div>
    </>
  )
}
