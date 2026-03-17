type KPI = {
  label: string
  value: string
  tone?: 'accent' | 'warning' | 'critical' | 'info'
}

function toneClass(tone: KPI['tone']) {
  switch (tone) {
    case 'warning':
      return 'text-warning'
    case 'critical':
      return 'text-critical'
    case 'info':
      return 'text-info'
    case 'accent':
    default:
      return 'text-accent'
  }
}

export default function KPIBar({ items }: { items: KPI[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-border bg-panel p-2 md:grid-cols-5">
      {items.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded border border-border bg-bg px-2 py-2"
        >
          <div className="text-[11px] uppercase tracking-wider text-text-faint">
            {kpi.label}
          </div>
          <div className={"mt-1 font-mono text-lg leading-none " + toneClass(kpi.tone)}>
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  )
}
