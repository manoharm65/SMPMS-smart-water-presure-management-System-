import { useParams } from 'react-router-dom'

export default function ZoneDetail() {
  const { zoneId } = useParams()
  return (
    <div className="h-full p-3">
      <div className="rounded border border-border bg-panel p-3">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Zone Detail
        </div>
        <div className="mt-1 font-mono text-sm text-text">{zoneId}</div>
        <div className="mt-2 text-sm text-text-muted">
          (stub) Pressure gauge, valve control, 7-day chart, anomaly log.
        </div>
      </div>
    </div>
  )
}
