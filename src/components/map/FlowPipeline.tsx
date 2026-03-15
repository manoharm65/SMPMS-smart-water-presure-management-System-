import type L from 'leaflet'
import type { LatLngTuple } from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'

export type FlowPipelineProps = {
  id: string
  positions: LatLngTuple[]
  color: string
  label: string
  hovered: boolean
  onHover: (id: string | null) => void
}

export default function FlowPipeline({
  id,
  positions,
  color,
  label,
  hovered,
  onHover,
}: FlowPipelineProps) {
  const flowRef = useRef<L.Polyline | null>(null)
  const dashArray = useMemo(() => '6 10', [])

  useEffect(() => {
    let raf = 0
    let offset = 0

    const tick = () => {
      offset = (offset + 0.9) % 100
      const layer = flowRef.current
      if (layer) {
        layer.options.dashOffset = String(-offset)
        layer.redraw()
      }
      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      {/* Subtle glow on hover (kept thin for SCADA density) */}
      {hovered ? (
        <Polyline
          positions={positions}
          pathOptions={{ color, weight: 10, opacity: 0.08 }}
          interactive={false}
        />
      ) : null}

      {/* Base line (status color) */}
      <Polyline
        positions={positions}
        pathOptions={{ color, weight: hovered ? 4 : 3, opacity: 0.92 }}
        eventHandlers={{
          mouseover: () => onHover(id),
          mouseout: () => onHover(null),
        }}
      >
        <Tooltip sticky opacity={0.9}>
          <div className="text-xs">
            <div className="font-mono">{label}</div>
            <div className="text-text-muted">Pipeline</div>
          </div>
        </Tooltip>
      </Polyline>

      {/* Animated dashed overlay = “water flow” */}
      <Polyline
        ref={(node) => {
          flowRef.current = node
        }}
        positions={positions}
        pathOptions={{
          color,
          weight: 1,
          opacity: 0.8,
          dashArray,
          dashOffset: '0',
        }}
        interactive={false}
      />
    </>
  )
}
