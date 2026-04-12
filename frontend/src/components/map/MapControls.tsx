import { useMap } from 'react-leaflet'
import type { MapMode } from '../../store/dashboardStore'

type DmaZoneLevel = 'High' | 'Medium-High' | 'Medium' | 'Low'

type DmaControlOption = {
  id: string
  elevation: number
  zone: DmaZoneLevel
  feedsInto: string[]
}

export default function MapControls({
  mapMode,
  onMapModeChange,
  dmaOptions,
  selectedHardwareDmaId,
  onSelectedHardwareDmaChange,
  selectedDmaElevation,
  selectedDmaZone,
  selectedDmaZoneEmoji,
  selectedDmaFlowDirection,
  selectedDmaFeedsInto,
}: {
  mapMode: MapMode
  onMapModeChange: (mode: MapMode) => void
  dmaOptions: DmaControlOption[]
  selectedHardwareDmaId: string
  onSelectedHardwareDmaChange: (dmaId: string) => void
  selectedDmaElevation: number
  selectedDmaZone: DmaZoneLevel
  selectedDmaZoneEmoji: string
  selectedDmaFlowDirection: string
  selectedDmaFeedsInto: string
}) {
  const map = useMap()

  return (
    <div
      className="pointer-events-auto absolute right-2 top-2 z-[500] text-xs"
      style={{
        width: 260,
        padding: 16,
        fontFamily: 'Segoe UI, sans-serif',
        backgroundColor: '#1a2035',
        color: '#ffffff',
        borderLeft: '1px solid #2e3a55',
        boxShadow: '-2px 0 12px rgba(0,0,0,0.4)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div style={{ color: '#63b3ed', fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}>
          Map View
        </div>
        <div className="flex gap-1">
          <button
            className="px-2 py-1"
            style={{ backgroundColor: '#2e3a55', color: '#ffffff', border: '1px solid #4a5a7b', borderRadius: 4 }}
            onClick={() => map.zoomIn()}
            type="button"
          >
            +
          </button>
          <button
            className="px-2 py-1"
            style={{ backgroundColor: '#2e3a55', color: '#ffffff', border: '1px solid #4a5a7b', borderRadius: 4 }}
            onClick={() => map.zoomOut()}
            type="button"
          >
            -
          </button>
        </div>
      </div>

      <div className="mt-2 border-t pt-2" style={{ borderColor: '#2e3a55' }}>
        <div style={{ color: '#63b3ed', fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}>Layers</div>
        <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
          <span style={{ color: '#cbd5e0' }}>Base Map</span>
          <input
            type="radio"
            checked={mapMode === 'map'}
            onChange={() => onMapModeChange('map')}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
          <span style={{ color: '#cbd5e0' }}>Map + DMA Labels</span>
          <input
            type="radio"
            checked={mapMode === 'dma'}
            onChange={() => onMapModeChange('dma')}
          />
        </label>
      </div>

      <div className="mt-2 border-t pt-2 text-[11px]" style={{ borderColor: '#2e3a55', color: '#a0aec0' }}>
        Auto DMA zones are generated from network density.
      </div>

      {mapMode === 'dma' ? (
        <div className="mt-2 border-t pt-2" style={{ borderColor: '#2e3a55' }}>
          <div style={{ color: '#63b3ed', fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}>HARDWARE LINK (SELECT DMA)</div>
          <label className="mt-1 block" style={{ color: '#a0aec0', fontSize: 12 }}>DMA</label>
          <select
            className="mt-1"
            style={{
              backgroundColor: '#2e3a55',
              color: '#ffffff',
              border: '1px solid #4a5a7b',
              borderRadius: 6,
              padding: '6px 10px',
              width: '100%',
            }}
            value={selectedHardwareDmaId}
            onChange={(e) => onSelectedHardwareDmaChange(e.target.value)}
          >
            {dmaOptions.map((dma) => (
              <option key={dma.id} value={dma.id}>{dma.id}</option>
            ))}
          </select>

          <div
            className="mt-2"
            style={{
              backgroundColor: '#242f4b',
              borderRadius: 8,
              padding: 10,
              border: '1px solid #3a4a6b',
            }}
          >
            <div className="flex justify-between"><span style={{ color: '#a0aec0', fontSize: 12 }}>Selected:</span><span style={{ color: '#ffffff', fontWeight: 600, fontSize: 13 }}>{selectedHardwareDmaId}</span></div>
            <div className="mt-1 flex justify-between"><span style={{ color: '#a0aec0', fontSize: 12 }}>Elevation:</span><span style={{ color: '#ffffff', fontWeight: 600, fontSize: 13 }}>{selectedDmaElevation}m</span></div>
            <div className="mt-1 flex justify-between"><span style={{ color: '#a0aec0', fontSize: 12 }}>Zone:</span><span style={{ color: '#ffffff', fontWeight: 600, fontSize: 13 }}>{selectedDmaZone} {selectedDmaZoneEmoji}</span></div>
            <div className="mt-1 flex justify-between"><span style={{ color: '#a0aec0', fontSize: 12 }}>Flow:</span><span style={{ color: '#ffffff', fontWeight: 600, fontSize: 13 }}>{selectedDmaFlowDirection}</span></div>
            <div className="mt-1 flex justify-between gap-2"><span style={{ color: '#a0aec0', fontSize: 12 }}>Feeds into:</span><span className="text-right" style={{ color: '#ffffff', fontWeight: 600, fontSize: 13 }}>{selectedDmaFeedsInto}</span></div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
