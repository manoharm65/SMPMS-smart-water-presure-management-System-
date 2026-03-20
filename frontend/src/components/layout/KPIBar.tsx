export interface KPIData {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: 'ink' | 'pass' | 'warn' | 'signal' | 'low'
}

interface KPIBarProps {
  items: KPIData[]
}

function toneClass(tone: KPIData['tone']) {
  switch (tone) {
    case 'pass':
      return 'text-pass'
    case 'warn':
      return 'text-warn'
    case 'signal':
      return 'text-signal'
    case 'low':
      return 'text-low'
    case 'ink':
    default:
      return 'text-ink'
  }
}

export default function KPIBar({ items }: KPIBarProps) {
  return (
    <div className="grid grid-cols-2 border-b-2 border-r-2 border-rule bg-paper md:grid-cols-5">
      {items.map((kpi, index) => {
        const isLastInRow = (index + 1) % 2 === 0
        const isLastRow = index >= items.length - (items.length % 2 === 0 ? 2 : 1)
        const isLast = index === items.length - 1

        return (
          <div
            key={kpi.label}
            className={[
              'border-rule p-3',
              isLastInRow && !isLast ? 'border-r-0 md:border-r-2' : '',
              !isLastInRow && !isLast ? 'border-r-2' : '',
              index < 2 ? 'border-b-2' : '',
              isLast && isLastRow ? 'border-b-0' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="font-condensed text-[9px] font-700 uppercase tracking-[0.15em] text-dim">
              {kpi.label}
            </div>
            <div className={['mt-1 font-mono text-[42px] font-700 leading-none tracking-tight display-number', toneClass(kpi.tone)].join(' ')}>
              {kpi.value}
              {kpi.unit && (
                <span className="ml-1 text-lg">{kpi.unit}</span>
              )}
            </div>
            {kpi.note && (
              <div className="font-condensed mt-1 text-[11px] text-dim">
                {kpi.note}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
