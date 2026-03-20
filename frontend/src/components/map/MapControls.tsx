import { useMap } from 'react-leaflet'

export type MapLayers = {
  pipelines: boolean
  valves: boolean
  zones: boolean
}

export default function MapControls({
  layers,
  onChange,
}: {
  layers: MapLayers
  onChange: (next: MapLayers) => void
}) {
  const map = useMap()

  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-[500] w-48 rounded border border-border bg-panel p-2 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Layers
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

      <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
        <span className="text-text-muted">Pipelines</span>
        <input
          type="checkbox"
          checked={layers.pipelines}
          onChange={(e) => onChange({ ...layers, pipelines: e.target.checked })}
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
        <span className="text-text-muted">Valves</span>
        <input
          type="checkbox"
          checked={layers.valves}
          onChange={(e) => onChange({ ...layers, valves: e.target.checked })}
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-bg">
        <span className="text-text-muted">Zones</span>
        <input
          type="checkbox"
          checked={layers.zones}
          onChange={(e) => onChange({ ...layers, zones: e.target.checked })}
        />
      </label>

      <div className="mt-2 border-t border-border pt-2">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Legend
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: '#004DB3' }} />
            <span className="text-text-muted">≥ 300mm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: '#0055ff' }} />
            <span className="text-text-muted">200–299mm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: '#4a9ff5' }} />
            <span className="text-text-muted">100–199mm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: '#9ac7ff' }} />
            <span className="text-text-muted">&lt; 100mm</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-3 rounded-sm" style={{ background: '#4a9ff5' }} />
          <span className="text-text-muted">Unknown diameter</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-3 rounded-sm" style={{ background: '#8b5cf6' }} />
          <span className="text-text-muted">Valve</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="leak-indicator" />
          <span className="text-text-muted">Leak / high anomaly</span>
        </div>
      </div>
    </div>
  )
}
