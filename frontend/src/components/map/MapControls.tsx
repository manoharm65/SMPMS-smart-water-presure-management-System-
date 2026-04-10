import { useMap } from 'react-leaflet'
import type { MapMode } from '../../store/dashboardStore'

export default function MapControls({
  mapMode,
  onMapModeChange,
  isHardwareMarking,
  hardwarePointCount,
  onToggleHardwareMarking,
  onClearHardwarePoints,
}: {
  mapMode: MapMode
  onMapModeChange: (mode: MapMode) => void
  isHardwareMarking: boolean
  hardwarePointCount: number
  onToggleHardwareMarking: () => void
  onClearHardwarePoints: () => void
}) {
  const map = useMap()

  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-[500] w-48 rounded border border-border bg-panel p-2 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Map View
        </div>
        <div className="flex gap-1">
          <button
            className="rounded border border-border bg-bg px-2 py-1 text-text-muted hover:text-text"
            onClick={() => map.zoomIn()}
            type="button"
          >
            +
          </button>
          <button
            className="rounded border border-border bg-bg px-2 py-1 text-text-muted hover:text-text"
            onClick={() => map.zoomOut()}
            type="button"
          >
            -
          </button>
        </div>
      </div>

      <div className="mt-2 border-t border-border pt-2">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">Layers</div>
        <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
          <span className="text-text-muted">Base Map</span>
          <input
            type="radio"
            checked={mapMode === 'map'}
            onChange={() => onMapModeChange('map')}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
          <span className="text-text-muted">Map + DMA Labels</span>
          <input
            type="radio"
            checked={mapMode === 'dma'}
            onChange={() => onMapModeChange('dma')}
          />
        </label>
      </div>

      <div className="mt-2 border-t border-border pt-2 text-[11px] text-text-faint">
        Auto DMA zones are generated from network density.
      </div>

      {mapMode === 'dma' ? (
        <div className="mt-2 border-t border-border pt-2">
          <div className="text-[11px] uppercase tracking-wider text-text-faint">Hardware Link (DMA-15)</div>
          <button
            type="button"
            className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-left text-[11px] text-text-muted hover:text-text"
            onClick={onToggleHardwareMarking}
          >
            {isHardwareMarking ? 'Stop marking points' : 'Mark 2 ESP points'}
          </button>
          <button
            type="button"
            className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-left text-[11px] text-text-muted hover:text-text"
            onClick={onClearHardwarePoints}
          >
            Clear points
          </button>
          <div className="mt-1 text-[11px] text-text-faint">
            Points: {hardwarePointCount}/2 (inside DMA-15)
          </div>
        </div>
      ) : null}
    </div>
  )
}
