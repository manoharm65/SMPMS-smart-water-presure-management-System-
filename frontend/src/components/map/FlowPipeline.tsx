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
  onSelect?: () => void
  animated?: boolean
  interactive?: boolean
}

export default function FlowPipeline({
  id,
  positions,
  color,
  label,
  hovered,
  onHover,
  onSelect,
  animated = true,
  interactive = true,
}: FlowPipelineProps) {
  const flowRef = useRef<L.Polyline | null>(null)
  const dashArray = useMemo(() => '6 10', [])

  useEffect(() => {
    if (!animated) return

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
  }, [animated])

  if (!interactive) {
    return <Polyline positions={positions} pathOptions={{ color, weight: 2, opacity: 0.85 }} interactive={false} />
  }

  return (
    <>
      {/* Subtle glow on hover (kept thin for SCADA density) */}
      {hovered ? (
        <Polyline positions={positions} pathOptions={{ color, weight: 10, opacity: 0.08 }} interactive={false} />
      ) : null}

      {/* Base line (status color) */}
      <Polyline
        positions={positions}
        pathOptions={{ color, weight: hovered ? 4 : 3, opacity: 0.92 }}
        eventHandlers={{
          mouseover: () => onHover(id),
          mouseout: () => onHover(null),
          click: () => onSelect?.(),
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
      {animated ? (
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
      ) : null}
    </>
  )
}
